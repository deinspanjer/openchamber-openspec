import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runFixtureCommand } from "./helpers/openspec.mjs";

const script = fileURLToPath(new URL("../scripts/check-extension-version.mjs", import.meta.url));

async function releaseFixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "openspec-version-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  const options = { cwd, env };
  const git = (...args) => runFixtureCommand("git", args, options);
  const write = (path, content) => writeFileSync(join(cwd, path), content);
  const manifest = (version, fields) =>
    write("package.json", JSON.stringify({ version, openchamber: { apiVersion: 1 }, ...fields }));
  const publish = async () => {
    await git("add", ".");
    await git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=hooks",
      "commit",
      "-qm",
      "Publish test fixture",
    );
    await git("update-ref", "refs/remotes/origin/main", "HEAD");
  };
  await git("init", "-q");
  mkdirSync(join(cwd, "hooks"));
  mkdirSync(join(cwd, "panel"));
  manifest("1.6.9");
  write("panel/status.js", "original picker");
  await publish();
  return {
    manifest,
    publish,
    write,
    check: () => runFixtureCommand(process.execPath, [script], options),
  };
}

test("rejects an unbumped shipped change already on origin/main", async (t) => {
  const { check, manifest, publish, write } = await releaseFixture(t);
  write("panel/status.js", "searchable picker");
  manifest("1.6.9", { scripts: { check: "other checks" } });
  await publish();
  await assert.rejects(check, { code: 1, stderr: /panel\/status\.js/ });

  manifest("1.6.10");
  await check();
});

test("rejects a manifest-only change to extension permissions", async (t) => {
  const { check, manifest } = await releaseFixture(t);
  manifest("1.6.9", {
    openchamber: { apiVersion: 1, contributes: { service: { permissions: { exec: ["git"] } } } },
  });
  await assert.rejects(check, { code: 1, stderr: /package\.json \(openchamber\)/ });
});

test("allows docs and tooling changes without a version bump", async (t) => {
  const { check, manifest, write } = await releaseFixture(t);
  write("README.md", "updated docs");
  manifest("1.6.9", { scripts: { check: "other checks" } });
  await check();
});
