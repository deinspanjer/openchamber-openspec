# Design

## Context

- `resolveTrackedChanges` in `src/model.ts` filters every candidate by `active`, the set of ids in
  `openspec list`. `resolveSessionChanges` in `src/panel/tracked-change.ts` wraps it. Archived
  names stay in the `session-change:<id>` storage entry, because `updateTrackedChanges` writes back
  the unfiltered list. Only reads hide them.
- `read()` in `src/status.ts` lists changes, resolves the tracked names, then reads summary and
  tasks per name. `updatePicker` offers only active, untracked ids. The `onSessions` handler
  re-resolves with `selection.active` to detect a changed selection.
- The board already reads `openspec list --archived --json` through `/archived`
  (`archived()` in `src/service/openspec.ts`, `decodeArchived` in `src/contracts.ts`). Names are
  `YYYY-MM-DD-<id>`, and undated names occur.
- `modifiedChangeIds` in `src/service/git.ts` shows how Git is scoped: local planning only
  (`planningRoot === join(root, "openspec")`), checkout top resolved with
  `rev-parse --show-toplevel`, inherited `GIT_*` variables stripped, and `[]` when inapplicable.
- The board focus handoff (`/focus` in `src/service/http.ts`, `setFocus` and `claimFocus` in
  `src/panel/client.ts`, `claimFocus` and `applyFocus` in `src/panel/controller.ts`) carries
  `{ directory, change }` for active changes only. Archived rows in `src/panel/board-view.ts`
  are not interactive.
- `git` is already in the manifest's `exec` list, so no re-approval.

## Goals / Non-Goals

**Goals:** keep a tracked change visible from archive until landing, let it be tracked again,
and open it in the board's `Archived` view. Spend no extra reads while every tracked change is
active.

**Non-Goals:** attributing an archive to a particular session (the check is per checkout),
detecting landing without a fetch, archived task lists or goals, and changing the saved storage
format.

## Decisions

### Landing is "archive folder missing from the base tree"

Simpler designs were rejected. Git status alone loses the card at commit, before landing.
Storage alone never drops the card. Merge-base diffs need history walks and still need a base ref.
Comparing the working-tree archive listing with one `ls-tree` of the base needs only a base ref.

Add `pendingArchives(directory, root, planningRoot, names, deadline)` to `src/service/git.ts`.
Apply the same scope guards as `modifiedChangeIds`, returning no names when inapplicable.

1. Run `git for-each-ref --format=%(refname)` on `refs/remotes/origin/HEAD`,
   `refs/remotes/origin/main`, `refs/remotes/origin/master`, `refs/heads/main` and
   `refs/heads/master`. Take the first, in that order, that is listed. Otherwise use `HEAD`.
2. Run `git ls-tree -d --name-only -z <ref> -- <prefix>/archive/`. Use the same `-c` and lock
   flags as the status call. An unborn `HEAD` counts as an empty tree.
3. Return the archived names whose folder is missing from that output.

### One service route, `/pending-archives`

`POST /pending-archives` takes `{ directory, expectedRoot, expectedPlanning }` and returns
`{ changes: [{ id, name, completedTasks, totalTasks }] }`. In `src/service/openspec.ts`:

- Resolve the scope with `context()`, run `list --archived` through `checked()`, then call
  `pendingArchives`. Re-check `planningScope` afterwards, as `modifiedChanges` does.
- `id` is `name` with any `^\d{4}-\d{2}-\d{2}-` prefix removed. Drop names whose `id` fails
  `isChangeName`. When several pending names share an `id`, keep the latest dated archive,
  treating an undated archive as older than any dated one.
- The user chose to fall back when the check can't run. Return `{ changes: [] }` for an
  inapplicable scope, a `GIT_UNAVAILABLE` fault, or an `OPENSPEC_ERROR` from
  `list --archived` (older CLI). Any other fault stays an error, such as `BAD_CLI_OUTPUT`,
  `BAD_GIT_OUTPUT`, timeouts or `ROOT_CHANGED`.

Add `decodePendingArchives` to `src/contracts.ts`. Validate `id` with `isChangeName`, check
`name` against `id`, check counts, and reject duplicate ids. Add `client.pendingArchives(scope)`
to `src/panel/client.ts`. Register the path in `src/service/http.ts` beside `/modified-changes`.

### Resolve with an eligibility set and gate the extra read

Rename `resolveTrackedChanges`' `active` to `eligible`; its logic is unchanged. In `read()`:

1. Resolve with an eligibility set that accepts every valid name. If none of the results is
   missing from `active`, skip the check: `pending` is empty, and this is the hot path.
2. Otherwise call `client.pendingArchives(listing)`. On failure, give each missing name an error
   card with Refresh. That uses the existing `{ id, message }` card, so no partial progress shows.
3. Resolve again with `eligible = active ∪ pending ids`. Names in `active` win.
4. Store `pending` and `eligible` in `selection`. The `onSessions` handler re-resolves with
   `selection.eligible`, so archived cards don't flap on session snapshots.

Archived names skip `client.summary` and `client.tasks`.

### Archived card, flyout and cache

- Add `{ id, archive: PendingArchive }` to `Card`. Reuse `mountTrackedCard`: the name, counts and
  bar come from the archive entry. Hide the chip row and the `Tasks:` line, and show
  `Archived · not landed` in place of the stage chip.
- Add `ArchivedFlyout = { kind: "archived", name, archive, directory }` with a matching
  `decodeFlyout` branch. `renderFlyout` shows the heading, the label, `Open in board` and
  `Untrack`.
- `DisplayCard` in `src/panel/status-cache.ts` gains optional `archived: true`, so stale cards
  keep the label. Cached entries without the field decode as before.

### Picker group

`updatePicker` takes the pending list too. Untracked pending ids, minus active ones, are appended
after the active groups in name order. Each row shows the `Archived · not landed` label and no Git
hint. Selecting one goes through `appendTrackedChange` and then `read()`, as for active choices.

If the latest read did not fetch pending archives, opening the picker fetches them. Use the
per-opening token and `samePickerScope` guard that the modified-change hints already use. Run that
request in parallel with the hint request, and append the group when it arrives. On failure, the
picker shows active choices only.

### Board focus on an archived change

- `Focus` becomes `{ directory, change } | { directory, archive }`. `archive` must match
  `^(\d{4}-\d{2}-\d{2}-)?<change name>$`.
- `setFocus` and `claimFocus` use the same target object. `claimFocus` verifies the directory.
- The status card's `Open in board` sends `{ directory, archive: name }`.
- In `src/panel/controller.ts`, an archive target closes any detail and sets
  `boardTab = "archived"`. It records `focusedArchive = { name, reloaded: false }` and reads
  archived changes when no state is retained.
- When archived state has a value: if the name is listed, set `currentArchive` and clear the board
  query when it would hide the row. If it isn't listed and has not been reloaded, invalidate,
  re-read once and mark it reloaded. Otherwise show the toast
  `<name> isn't in this board's archived list.`
- `currentArchive` clears when the tab changes or a new focus arrives.
- `BoardState` carries `currentArchive`. `updateArchived` in `src/panel/board-view.ts` sets
  `aria-current="true"` on that row and includes `currentArchive` in its memo key. The controller
  asks the view to scroll to the row once after each focus resolves.

### Documentation

Update AGENTS.md's Work Status read rule. The pending-archive check runs only when a tracked name
is missing from the active listing, and when the picker opens without a pending result. Add one
line next to the `/validate` and `/workflows` notes that describes `/pending-archives` and its
fallback.

## Risks / Trade-offs

- **Stale remote refs:** landing is noticed only after a fetch, so a card can outlive its merge.
  This is accepted.
- **Per checkout, not per session:** another session in the same worktree that tracks the name
  also sees the card. Tracking stays per session, so this is harmless.
- **Main checkout with a remote:** archives committed but not pushed count as not landed, which
  is intended.
- **Extra spawns when a tracked name is missing:** the gated read resolves the scoped OpenSpec
  context, lists archives, and runs up to three Git commands. A saved name remains stored after
  landing or deletion, so a hidden name can still trigger this read. The common path, where all
  tracked names are active, does not run it.
- **Name collisions:** if the same id is archived twice before landing, only the newest shows.

## Test seams

The user approved extending only the existing files. No new test files or helpers.

- `test/model.test.mjs`: `resolveTrackedChanges` with an eligibility set that includes archived
  ids, including the item and worktree fallbacks and the active-wins case.
- `test/service.test.mjs`: `/pending-archives` against a disposable real-Git repo and the real
  CLI, built the same way as the existing `modified-changes` test. Use `withService` with a stub
  runner for the `OPENSPEC_ERROR` fallback and the `BAD_CLI_OUTPUT` error.
- `test/panel.test.mjs` (fake SDK host): the archived card and flyout, the read gate (no
  `/pending-archives` request while every tracked change is active), the picker group, and the
  board's `Archived` focus and highlight. Extend the fake host's `/focus` handling for archive
  targets.
