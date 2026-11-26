# Proposal

## Why

The board treats a change's `goal` metadata as expected: the detail header shows `Goal unavailable`
when it is missing, the New change dialogue requires one, and prompts tell agents to establish and
record one. Upstream OpenSpec no longer has a workflow that sets or reads `goal`: it only survives as
optional `openspec new change --goal` metadata, which remains from the workspace planning flow removed
in Fission-AI/OpenSpec#1190. Changes made by the OpenSpec skills never have one, and nothing can
record one afterwards. So the board flags normal changes as incomplete and asks agents to write a
field that nothing else reads.

## What Changes

- Detail shows the goal only when the change records a non-blank one. Otherwise the goal region,
  its text and its space are absent. `Goal unavailable` is removed.
- The session section's change flyout already omits a missing goal. A blank goal now counts as
  missing there too.
- **BREAKING (board feature):** The New change dialogue asks only for a name. The board creates
  scaffolds with `openspec new change <name>` and no `--goal`, and has no way to set a goal.
  The user chose removal over an optional field.
- Prompts still include a `Goal:` line when a goal is recorded. They stop asking agents to
  preserve, establish or record a goal. Explore stops asking the agent to clarify a missing goal.

## Consumer impact

- Users who typed a goal in the dialogue lose that input. The intent belongs in `proposal.md`, which
  the OpenSpec workflows write. No mitigation was chosen.
- CLI compatibility improves: creation no longer depends on the `--goal` flag.
- Prompts keep their skill names, so OpenSpec version compatibility is unchanged.
- Existing goals stay readable and shown. Nothing rewrites `.openspec.yaml`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-workflows`: creation without a goal; Propose, Explore, ff and continue prompts drop goal
  maintenance instructions.
- `change-presentation`: detail shows the goal only when recorded.
- `session-change-section`: the change flyout shows the goal only when recorded.
- `shared-planning`: creating in shared planning makes a scaffold without a recorded goal.

## Impact

`src/panel/create-dialog.ts`, `src/panel/client.ts`, `src/service/http.ts`,
`src/service/openspec.ts`, `src/panel/detail-view.ts`, `src/panel/prompts.ts`, `src/contracts.ts`,
`panel/index.html`, and the generated bundles. This changes the private panel–service create
request. Existing tests in `test/panel.test.mjs`, `test/service.test.mjs` and
`test/integration.test.mjs` that fill or assert goal-maintenance behaviour also change. The
extension version is bumped.
