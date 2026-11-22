import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { isChangeName } from "../model.js";
import { ServiceFault, serviceError } from "./cli.js";

const exec = promisify(execFile);
const badOutput = () => serviceError("BAD_GIT_OUTPUT", "Invalid Git status data.", 502);
const timedOut = () => serviceError("GIT_TIMEOUT", "Git status request timed out.", 504);

function git(cwd: string, args: string[], deadline: number): Promise<string>;
function git(
  cwd: string,
  args: string[],
  deadline: number,
  discovering: true,
): Promise<string | null>;
async function git(
  cwd: string,
  args: string[],
  deadline: number,
  discovering = false,
): Promise<string | null> {
  const timeout = deadline - Date.now();
  if (timeout <= 0) throw timedOut();
  // Resolve the selected checkout, not one redirected by inherited Git environment variables.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  try {
    const { stdout } = await exec("git", args, {
      cwd,
      env: { ...env, LC_ALL: "C", GIT_NO_LAZY_FETCH: "1", GIT_ALLOW_PROTOCOL: "" },
      timeout,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGKILL",
    });
    if (Date.now() >= deadline) throw timedOut();
    return stdout;
  } catch (caught) {
    const error = caught as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (caught instanceof ServiceFault) throw caught;
    if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")
      throw serviceError("GIT_OUTPUT_TOO_LARGE", "Git status output is too large.", 413);
    if (error.killed || Date.now() >= deadline) throw timedOut();
    if (
      discovering &&
      /^fatal: (?:not a git repository\b|this operation must be run in a work tree\b)/.test(
        error.stderr ?? "",
      )
    )
      return null;
    throw serviceError("GIT_UNAVAILABLE", "Git status is unavailable.", 503);
  }
}

function inside(path: string, parent: string): boolean {
  const suffix = relative(parent, path);
  return suffix !== ".." && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

async function isRealDirectory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory() && (await realpath(path)) === path;
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw caught;
  }
}

function changeIds(output: string, prefix: string): string[] {
  if (output === "") return [];
  if (!output.endsWith("\0")) throw badOutput();
  const changes = new Set<string>();
  for (const record of output.slice(0, -1).split("\0")) {
    if (record.length < 4 || !/^(?! {2})(?:[ MADTU]{2}|\?\?) /.test(record)) throw badOutput();
    const path = record.slice(3);
    if (!path.startsWith(prefix)) continue;
    const child = path.slice(prefix.length);
    const slash = child.indexOf("/");
    if (slash < 1 || slash === child.length - 1) continue;
    const id = child.slice(0, slash);
    if (id !== "archive" && isChangeName(id)) changes.add(id);
  }
  return [...changes];
}

export async function modifiedChangeIds(
  directory: string,
  root: string,
  planningRoot: string,
  deadline: number,
): Promise<string[]> {
  if (planningRoot !== join(root, "openspec")) return [];
  const selected = await realpath(directory);
  const reported = await git(selected, ["rev-parse", "--show-toplevel"], deadline, true);
  if (reported === null) return [];
  if (!reported.endsWith("\n") || !isAbsolute(reported.slice(0, -1))) throw badOutput();
  const top = await realpath(reported.slice(0, -1));
  const changes = join(planningRoot, "changes");
  if (
    !inside(selected, top) ||
    !inside(planningRoot, top) ||
    !(await isRealDirectory(planningRoot)) ||
    !(await isRealDirectory(changes))
  )
    return [];
  const prefix = relative(top, changes).split(sep).join("/");
  const output = await git(
    top,
    [
      "--no-optional-locks",
      "--literal-pathspecs",
      "-c",
      "core.fsmonitor=false",
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--no-renames",
      "--ignore-submodules=all",
      "--",
      prefix,
    ],
    deadline,
  );
  return changeIds(output, `${prefix}/`);
}
