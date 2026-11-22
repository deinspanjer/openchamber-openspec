import assert from "node:assert/strict";
import test from "node:test";
import { deriveChange, resolveTrackedChange } from "../build/model.mjs";

test("stage derivation keeps empty task sets ready and includes skipped custom dependencies", () => {
  const base = {
    id: "example",
    goal: null,
    artifacts: [
      { id: "proposal", status: "skipped", requires: [], outputPath: "proposal.md" },
      { id: "tasks", status: "done", requires: ["proposal"], outputPath: "tasks.md" },
    ],
    applyRequires: ["tasks"],
  };
  assert.equal(deriveChange({ ...base, completedTasks: 0, totalTasks: 0 }).stage, "ready");
  assert.equal(deriveChange({ ...base, completedTasks: 1, totalTasks: 2 }).stage, "progress");
  assert.equal(deriveChange({ ...base, completedTasks: 2, totalTasks: 2 }).stage, "complete");
  assert.equal(deriveChange({ ...base, completedTasks: 2, totalTasks: 2 }).completedArtifacts, 2);
  assert.equal(
    deriveChange({
      ...base,
      artifacts: [{ ...base.artifacts[0], status: "ready" }, base.artifacts[1]],
      completedTasks: 2,
      totalTasks: 2,
    }).stage,
    "planning",
  );
});

test("tracked change resolution prefers the saved active change", () => {
  assert.deepEqual(
    resolveTrackedChange({
      saved: "saved-change",
      items: [{ id: "session-change", data: { kind: "change", change: "item-change" } }],
      worktreeName: "tree-change",
      active: new Set(["saved-change", "item-change", "tree-change"]),
    }),
    { change: "saved-change", source: "saved" },
  );
});

test("tracked change resolution skips an inactive saved choice and reports it if nothing resolves", () => {
  const input = {
    saved: "archived-change",
    items: [],
    worktreeName: "tree-change",
    active: new Set(["tree-change"]),
  };
  assert.deepEqual(resolveTrackedChange(input), { change: "tree-change", source: "worktree" });
  assert.deepEqual(resolveTrackedChange({ ...input, active: new Set() }), {
    change: null,
    staleSaved: "archived-change",
  });
});

test("tracked change resolution takes the first active typed item before legacy items", () => {
  assert.deepEqual(
    resolveTrackedChange({
      saved: null,
      items: [
        { id: "legacy-change" },
        { id: "other-change", data: { kind: "change", change: "inactive-change" } },
        { id: "session-change", data: { kind: "change", change: "item-change" } },
        { id: "another-session-change", data: { kind: "change", change: "other-change" } },
      ],
      worktreeName: null,
      active: new Set(["legacy-change", "item-change", "other-change"]),
    }),
    { change: "item-change", source: "item" },
  );
});

test("tracked change resolution uses an active legacy item ID before the worktree name", () => {
  assert.deepEqual(
    resolveTrackedChange({
      saved: null,
      items: [{ id: "inactive-item" }, { id: "legacy-change" }],
      worktreeName: "tree-change",
      active: new Set(["legacy-change", "tree-change"]),
    }),
    { change: "legacy-change", source: "item" },
  );
});

test("tracked change resolution never uses an archive-all item even if its ID is active", () => {
  assert.deepEqual(
    resolveTrackedChange({
      saved: null,
      items: [{ id: "archive-all", data: { kind: "archive-all" } }],
      worktreeName: null,
      active: new Set(["archive-all"]),
    }),
    { change: null, staleSaved: null },
  );
});

test("tracked change resolution uses an active worktree name", () => {
  assert.deepEqual(
    resolveTrackedChange({
      saved: null,
      items: [],
      worktreeName: "tree-change",
      active: new Set(["tree-change"]),
    }),
    { change: "tree-change", source: "worktree" },
  );
});

test("tracked change resolution returns no change when no candidate matches the listing", () => {
  assert.deepEqual(
    resolveTrackedChange({
      saved: null,
      items: [{ id: "inactive-item" }],
      worktreeName: "inactive-worktree",
      active: new Set(["unrelated-change"]),
    }),
    { change: null, staleSaved: null },
  );
});
