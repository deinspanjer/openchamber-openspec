# Tasks

## 1. Resolution model

- [x] 1.1 Seam: `test/model.test.mjs`. Add failing cases for `resolveTrackedChanges` with an
  `eligible` set. Pin these: a saved archived id that is eligible shows in saved order; the item
  and worktree fallbacks pick an eligible archived id; a missing id that isn't eligible is
  dropped; an id that is both active and archived resolves once. Rename `active` to `eligible` in
  `src/model.ts` and `src/panel/tracked-change.ts` and update the callers. Then run
  `npm run build:model:test && node --test test/model.test.mjs`.

## 2. Pending-archive service route

- [x] 2.1 Seam: `test/service.test.mjs`, disposable real-Git repo and the real CLI, built like the
  `modified-changes` test. Add a failing `/pending-archives` test. Pin these: an uncommitted
  archive is pending; an archive committed on a branch while `main` lacks it is pending; once
  merged into `main`, it is not pending; with no candidate base ref, only uncommitted archives
  are pending; undated and dated names map to ids; the newest of two same-id names wins; shared
  planning and a directory outside Git return `{ changes: [] }`; a stale planning identity is
  rejected. Implement `pendingArchives` in `src/service/git.ts`, the adapter method in
  `src/service/openspec.ts`, `decodePendingArchives` in `src/contracts.ts`, and the route in
  `src/service/http.ts`, as `design.md` describes. Then run
  `npm run build && node --test --test-name-pattern='pending-archives' test/service.test.mjs`.
- [x] 2.2 Seam: `test/service.test.mjs`, `withService` with a stub runner. Add failing cases:
  `OPENSPEC_ERROR` from `list --archived` returns `{ changes: [] }`, and malformed archived output
  returns `BAD_CLI_OUTPUT`. Implement the fault classification, then rerun the focused service
  test.
- [x] 2.3 Add `client.pendingArchives(scope)` to `src/panel/client.ts`. Add the `/pending-archives`
  note and its fallback to AGENTS.md next to the `/validate` and `/workflows` notes. Then run
  `npm run typecheck`.

## 3. Work Status cards

- [x] 3.1 Seam: `test/panel.test.mjs`, fake SDK host. Add a failing case for the read gate: with
  every tracked change active, no `/pending-archives` request is sent; with a saved name missing
  from the listing, exactly one is sent per read. Implement the two-step resolution in `read()` in
  `src/status.ts`, and store `eligible` in `selection` for the `onSessions` re-resolve. Update
  AGENTS.md's Work Status read rule. Then run
  `npm run build && node --test --test-name-pattern='pending' test/panel.test.mjs`.
- [x] 3.2 Seam: `test/panel.test.mjs`. Add a failing case for the archived card and flyout. Pin
  these: an archived card shows the name, `7/7`, a full bar and `Archived · not landed`, with no
  chips and no `Tasks:` line; its flyout offers `Open in board` and `Untrack`; Untrack removes the
  card; a `/pending-archives` failure shows an error card with Refresh for the missing name; a
  stale cached archived card keeps its label. Implement the card variant, `ArchivedFlyout`, the
  `decodeFlyout` branch and the `DisplayCard.archived` cache field. Then rerun the focused test.
- [x] 3.3 Seam: `test/panel.test.mjs`. Add a failing case for the picker group. Pin these:
  untracked pending ids appear after every active choice, labelled `Archived · not landed`;
  search filters them; selecting one tracks it and shows its card; when the read had no pending
  result, opening the picker fetches it once and active choices show first; a late result after
  close or a context switch is ignored. Implement it in `updatePicker` and `setPickerOpen`. Then
  rerun the focused test.

## 4. Board focus on archived changes

- [x] 4.1 Seam: `test/panel.test.mjs`. Extend the fake host's `/focus` handling to cover archive
  targets. Add failing cases: `Open in board` on an archived card posts
  `{ directory, archive: name }`; the board switches to `Archived` and marks that row
  `aria-current="true"`; a hiding search query is cleared; a retained list lacking the name is
  re-read once, then a toast says it isn't in the archived list; leaving `Archived` clears the
  mark. Implement the `Focus` union in `src/service/http.ts` and `src/panel/client.ts`, the
  controller handling in `src/panel/controller.ts`, and the row mark in `src/panel/board-view.ts`.
  Add the `/focus` archive-validation case to `test/service.test.mjs`. Then run
  `npm run build && node --test test/panel.test.mjs test/service.test.mjs`.

## 5. Verification

- [x] 5.1 Run `npm run check` and confirm it passes.
- [ ] 5.2 Run the live-host check in AGENTS.md. Build, then disable and re-enable the extension in
  Settings > Extensions and confirm it is Enabled. With Playwright against the running web UI,
  use an existing session in a worktree that tracks a change. Archive the change there without
  committing, finish a turn or press Refresh, and confirm the archived card, its flyout, and that
  `Open in board` highlights the row in `Archived`. Commit the archive and confirm the card
  stays; check the 320px phone width. Ask the user before creating any real session or worktree.
  Report Firefox and WebKit as not verified.

## Workflow follow-up

- Push after automated verification. The maintainer will run the live-host check.
