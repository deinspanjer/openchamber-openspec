import spawn from "cross-spawn";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import semver from "semver";

const upstream = "origin/main";
const shippedPaths = ["assets", "panel", "service"];
const manifestFields = ["name", "description", "type", "openchamber"];

function git(...args) {
  const result = spawn.sync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr.trim() || `Git failed (${result.signal ?? result.status}).`);
  return result.stdout;
}

function checkVersion() {
  if (git("rev-parse", "--is-shallow-repository").trim() === "true") {
    throw new Error("Fetch full Git history with `git fetch --unshallow origin` and rerun.");
  }

  const commits = git("log", "--first-parent", "--format=%H", upstream, "--", "package.json")
    .trim()
    .split("\n");
  const current = JSON.parse(readFileSync("package.json", "utf8"));
  // Compare to the commit that introduced this version, not later same-version commits on main.
  let release;
  for (const commit of commits) {
    const manifest = JSON.parse(git("show", `${commit}:package.json`));
    if (release && !semver.eq(manifest.version, release.manifest.version)) break;
    release = { commit, manifest };
  }

  const published = release.manifest.version;
  const order = semver.compare(current.version, published);
  if (order > 0) return;
  if (order < 0) {
    throw new Error(
      `Extension version ${current.version} is older than ${published} on ${upstream}.`,
    );
  }

  const changed = new Set(
    (
      git("diff", "--name-only", "--no-renames", "-z", release.commit, "--", ...shippedPaths) +
      git("ls-files", "--others", "--exclude-standard", "-z", "--", ...shippedPaths)
    )
      .split("\0")
      .filter(Boolean),
  );
  for (const field of manifestFields) {
    if (!isDeepStrictEqual(current[field], release.manifest[field])) {
      changed.add(`package.json (${field})`);
    }
  }
  if (changed.size) {
    throw new Error(
      `Shipped extension files changed since ${published} without a version bump:\n` +
        [...changed].map((file) => `  ${file}`).join("\n") +
        "\nIncrease the version in the same release as these changes, e.g. `npm version patch --no-git-tag-version`.",
    );
  }
}

try {
  checkVersion();
} catch (error) {
  console.error(`Extension version check failed: ${error.stderr?.trim() || error.message}`);
  process.exitCode = 1;
}
