import spawn from "cross-spawn";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { isChangeName } from "../model.js";
import { serviceError } from "./cli.js";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const badOutput = () => serviceError("BAD_GIT_OUTPUT", "Invalid Git status data.", 502);
const timedOut = () => serviceError("GIT_TIMEOUT", "Git status request timed out.", 504);
const unavailable = () => serviceError("GIT_UNAVAILABLE", "Git status is unavailable.", 503);

function git(cwd: string, args: string[], deadline: number): Promise<string>;
function git(
  cwd: string,
  args: string[],
  deadline: number,
  missing: "worktree" | "head",
): Promise<string | null>;
async function git(
  cwd: string,
  args: string[],
  deadline: number,
  missing?: "worktree" | "head",
): Promise<string | null> {
  const timeout = deadline - Date.now();
  if (timeout <= 0) throw timedOut();
  // Resolve the selected checkout, not one redirected by inherited Git environment variables.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  return await new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...env, LC_ALL: "C", GIT_NO_LAZY_FETCH: "1", GIT_ALLOW_PROTOCOL: "" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stopped = false;
    const stop = (fault: Error) => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      child.stdout!.destroy();
      child.stderr!.destroy();
      reject(fault);
    };
    const timer = setTimeout(() => stop(timedOut()), timeout);
    for (const [stream, output] of [
      [child.stdout!, stdout],
      [child.stderr!, stderr],
    ] as const) {
      let size = 0;
      stream.on("data", (value: Buffer) => {
        if (stopped) return;
        size += value.length;
        if (size > MAX_OUTPUT_BYTES)
          stop(serviceError("GIT_OUTPUT_TOO_LARGE", "Git status output is too large.", 413));
        else output.push(value);
      });
    }
    child.on("error", () => {
      clearTimeout(timer);
      reject(Date.now() >= deadline ? timedOut() : unavailable());
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (stopped) return;
      if (Date.now() >= deadline) return reject(timedOut());
      if (code === 0) return resolve(Buffer.concat(stdout).toString("utf8"));
      const diagnostic = Buffer.concat(stderr).toString("utf8");
      if (
        (missing === "worktree" &&
          /^fatal: (?:not a git repository\b|this operation must be run in a work tree\b)/.test(
            diagnostic,
          )) ||
        (missing === "head" && /^fatal: Not a valid object name HEAD\r?\n?$/.test(diagnostic))
      )
        return resolve(null);
      reject(unavailable());
    });
  });
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

async function localChanges(
  directory: string,
  root: string,
  planningRoot: string,
  deadline: number,
): Promise<{ top: string; changes: string; prefix: string } | null> {
  if (planningRoot !== join(root, "openspec")) return null;
  const selected = await realpath(directory);
  const reported = await git(selected, ["rev-parse", "--show-toplevel"], deadline, "worktree");
  if (reported === null) return null;
  if (!reported.endsWith("\n") || !isAbsolute(reported.slice(0, -1))) throw badOutput();
  const top = await realpath(reported.slice(0, -1));
  const changes = join(planningRoot, "changes");
  if (
    !inside(selected, top) ||
    !inside(planningRoot, top) ||
    !(await isRealDirectory(planningRoot)) ||
    !(await isRealDirectory(changes))
  )
    return null;
  const prefix = relative(top, changes).split(sep).join("/");
  return { top, changes, prefix };
}

const readOnly = ["--no-optional-locks", "--literal-pathspecs", "-c", "core.fsmonitor=false"];

export async function modifiedChangeIds(
  directory: string,
  root: string,
  planningRoot: string,
  deadline: number,
): Promise<string[]> {
  const local = await localChanges(directory, root, planningRoot, deadline);
  if (!local) return [];
  const { top, prefix } = local;
  const output = await git(
    top,
    [
      ...readOnly,
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

const baseRefs = [
  "refs/remotes/origin/HEAD",
  "refs/remotes/origin/main",
  "refs/remotes/origin/master",
  "refs/heads/main",
  "refs/heads/master",
];

export async function pendingArchives(
  directory: string,
  root: string,
  planningRoot: string,
  names: string[],
  deadline: number,
): Promise<string[]> {
  if (!names.length) return [];
  const local = await localChanges(directory, root, planningRoot, deadline);
  if (!local || !(await isRealDirectory(join(local.changes, "archive")))) return [];
  const { top, prefix } = local;
  const refs = await git(
    top,
    [...readOnly, "for-each-ref", "--format=%(refname)", ...baseRefs],
    deadline,
  );
  if (refs && !refs.endsWith("\n")) throw badOutput();
  const available = new Set(refs ? refs.slice(0, -1).split("\n") : []);
  // for-each-ref can match descendants of a requested prefix. Only exact refs are bases.
  for (const ref of available)
    if (!baseRefs.some((base) => ref === base || ref.startsWith(`${base}/`))) throw badOutput();
  const base = baseRefs.find((ref) => available.has(ref));
  const archivePrefix = `${prefix}/archive/`;
  const args = (ref: string) => [
    ...readOnly,
    "ls-tree",
    "-d",
    "--name-only",
    "-z",
    ref,
    "--",
    archivePrefix,
  ];
  const output = base
    ? await git(top, args(base), deadline)
    : await git(top, args("HEAD"), deadline, "head");
  if (!output) return names;
  if (!output.endsWith("\0")) throw badOutput();
  const landed = new Set<string>();
  for (const path of output.slice(0, -1).split("\0")) {
    if (!path.startsWith(archivePrefix)) throw badOutput();
    const name = path.slice(archivePrefix.length);
    if (!name || name.includes("/")) throw badOutput();
    landed.add(name);
  }
  return names.filter((name) => !landed.has(name));
}
