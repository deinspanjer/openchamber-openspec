# Design

## Context

The service reads `goal` from `.openspec.yaml` and returns it on each summary. `goal` is `null` when
absent and the raw string otherwise. The panel and the status section both decode summaries through
`decodeSummary` in `src/contracts.ts`, via `createClient` in `src/panel/client.ts`. Today, blank
goals are handled in different ways. `src/panel/prompts.ts` skips the `Goal:` line for
whitespace-only goals. The status flyout (`src/status.ts`, `changeFlyout` and `renderFlyout`)
renders any non-empty string. Detail (`src/panel/detail-view.ts:278`) renders the raw string, or
`Goal unavailable` for `null`, in an always-visible, focusable region.

Creation passes through four layers. `src/panel/create-dialog.ts` requires a goal, `client.create`
posts `{ name, goal, ... }` to `/create`, and `src/service/http.ts` reads it with `requiredString`.
Then `createChange` in `src/service/openspec.ts` rejects a blank goal with `BAD_GOAL` and runs
`openspec new change <name> --goal <goal>`.

## Goals / Non-Goals

**Goals:** one definition of "recorded goal" (a non-blank string), used by every surface; creation
without a goal at every layer.

**Non-Goals:** restyling a goal that is present, changing how metadata is read or bounded
(`metadataFor` and its path and byte checks stay), or touching `affected_areas`.

## Decisions

### Normalise a blank goal to `null` in `decodeSummary`

`decodeSummary` returns `goal: null` when the string is empty or whitespace. It still rejects
non-string, non-null values. Every panel and status consumer receives a `DerivedChange` that came
through this decoder. With the normalisation there, detail, flyout and prompts can all test plain
truthiness. The alternative was to normalise in the service's `metadataFor`. That would also work,
but then the panel's guarantee would depend on the service, and the fake-host tests send blank goals
straight to the panel. Leave the `?.trim()` checks in `prompts.ts` as they are; they are harmless.

### Hide the goal element instead of removing it

Detail keeps its single `.goal` element so updates do not rebuild the header. Each update sets
`goal.hidden = !state.change.goal` and `goal.textContent = state.change.goal ?? ""`. The `hidden`
attribute removes the element from layout, from the tab order, and from the accessibility tree, so
the focusable `Recorded objective` region exists only when it has content. Setting the text on every
update stops a previous change's goal from lingering. Confirm that no CSS rule in
`panel/index.html` sets `display` on `.goal` and so overrides `[hidden]`. Today none does.

### Remove the goal from creation end to end

- `create-dialog.ts`: delete the Goal text field, its state, its validation and its dispose call.
  `Attempt` becomes `{ scope, name }`.
- `client.ts`: `create(scope, name)` posts no `goal`.
- `http.ts`: `/create` calls `adapter.createChange(directory, name, expectedRoot, expectedPlanning)`.
- `openspec.ts`: drop the `goal` parameter and the `BAD_GOAL` check. Run `["new", "change", name]`.

The request body parser already ignores unknown keys. A body from an older panel that still has
`goal` creates a scaffold with no goal. A new panel posting to a service that has not been restarted
gets `400 Missing goal.` before any write, and the dialogue stays in editing with the message. The
AGENTS.md restart step covers that case, so there is no compatibility shim. The user chose removal
over an optional field (see proposal.md).

### Prompt wording

`Goal: <text>` stays in every prompt that includes it today, but only when a goal is recorded. Every
other goal instruction goes:

- **Explore:** `Investigate the purpose, relevant code, options and trade-offs for ${target}. Discuss
  findings without file changes or implementation.` Drop the missing-goal sentence.
- **Propose:** `Inspect ${target}'s status and preserve existing decisions. Finish planning this
  existing scaffold and complete missing planning artefacts using OpenSpec's artefact instructions.`
  Then the unchanged no-new-change and conflict sentences. Drop "current metadata" too: it existed
  only to find the goal.
- **ff / continue:** "preserving existing decisions", without "and any recorded goal".

Update and the other prompts stay as they are.

## Test seams

The user asked for no new assertions that only pin removed code or acceptance-visible layout. The
work edits existing tests that encode the removed behaviour and adds no test file or helper.

- `test/panel.test.mjs` (fake SDK host):
  - Remove the `Goal` fills and their value checks from the create-dialog tests.
  - The fake `/create` handler stores `goal: null`, and its known-error reply uses a code other
    than `BAD_GOAL`.
  - The propose test (currently "propose preserves goals and conditionally records…") keeps its
    verbatim-goal prefix check and its no-`Goal:`/`Goal: null` checks. It drops the goal-maintenance
    and "current metadata" matches, and gets a name that matches what it still checks.
  - The explore test drops its missing-goal clarification match.
- `test/service.test.mjs`: drop the `goal` keys from `/create` bodies.
- `test/integration.test.mjs`: the real-CLI creation step stops filling Goal, and its propose
  regex expects no `Goal:` line. This is the existing wiring check that `openspec new change <name>`
  works without `--goal`.
- `test/helpers/openspec.mjs` keeps `--goal` in `fixtureChange`. Fixtures still need recorded goals
  to cover the read path.

The live-host check covers the visible header and dialogue changes.

## Risks / Trade-offs

- [The board can no longer set a goal] → Accepted. Intent belongs in `proposal.md`.
- [Panel and service versions skew after an update without a service restart] → Creation fails
  with a pre-write 400 and keeps the draft. Restarting the service fixes it.
