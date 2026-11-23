import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-extension-version.mjs", import.meta.url));

function releaseFixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "openspec-version-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const options = { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  const git = (...args) => execFileSync("git", args, options);
  const write = (path, content) => writeFileSync(join(cwd, path), content);
  const manifest = (version, fields) =>
    write("package.json", JSON.stringify({ version, openchamber: { apiVersion: 1 }, ...fields }));
  const publish = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-qm",
      "Publish test fixture",
    );
    git("update-ref", "refs/remotes/origin/main", "HEAD");
  };
  git("init", "-q");
  mkdirSync(join(cwd, "panel"));
  manifest("1.6.9");
  write("panel/status.js", "original picker");
  publish();
  return {
    manifest,
    publish,
    write,
    check: () => execFileSync(process.execPath, [script], options),
  };
}

test("rejects an unbumped shipped change already on origin/main", (t) => {
  const { check, manifest, publish, write } = releaseFixture(t);
  write("panel/status.js", "searchable picker");
  manifest("1.6.9", { scripts: { check: "other checks" } });
  publish();
  assert.throws(check, { status: 1, stderr: /panel\/status\.js/ });

  manifest("1.6.10");
  assert.doesNotThrow(check);
});

test("rejects a manifest-only change to extension permissions", (t) => {
  const { check, manifest } = releaseFixture(t);
  manifest("1.6.9", {
    openchamber: { apiVersion: 1, contributes: { service: { permissions: { exec: ["git"] } } } },
  });
  assert.throws(check, { status: 1, stderr: /package\.json \(openchamber\)/ });
});

test("allows docs and tooling changes without a version bump", (t) => {
  const { check, manifest, write } = releaseFixture(t);
  write("README.md", "updated docs");
  manifest("1.6.9", { scripts: { check: "other checks" } });
  assert.doesNotThrow(check);
});
