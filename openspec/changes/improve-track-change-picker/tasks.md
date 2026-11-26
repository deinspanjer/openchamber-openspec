# Tasks

## 1. Local Git hints

- [x] 1.1 In `test/service.test.mjs`, add a failing route test using the existing fake OpenSpec runner
  and a disposable Git repository. Verify that staged, unstaged, and non-ignored untracked files
  yield deduplicated change IDs under the exact local planning prefix, not IDs from the archive or
  other planning paths. Include shared planning without hints and a stale planning identity
  rejected by the scope check. Implement the scoped route and bounded Git read from `design.md`,
  declare `git` in the manifest, and rerun the focused service tests after `npm run build`.

## 2. Picker

- [x] 2.1 In `test/panel.test.mjs`, extend the existing picker test with a failing search case. Verify
  case-insensitive filtering, that a no-match query can be cleared, and that selecting a filtered
  result saves that change ID. Add the search field and rerun the focused test after `npm run build`.
- [x] 2.2 In `test/panel.test.mjs`, add failing cases at the fake SDK bridge. Verify that only
  opening with eligible choices requests hints; hints reorder only eligible rows while a query is
  active; and opening, searching, Git failure, and hint arrival do not save tracking. Verify
  task-progress order without hints and that closing and reopening or switching sessions discards
  a delayed result. Wire the typed client and the per-opening hint state, then rerun the focused
  browser tests after `npm run build`.

## 3. End-to-end verification

- [x] 3.1 Run `npm run check`. Follow the live-host checks in `AGENTS.md`: reinstall or update the
  built extension as needed, disable and re-enable it, and inspect the picker in the extension
  iframe on desktop and at phone width. In an existing session with eligible choices and a
  known local OpenSpec edit, verify that search works before Git responds, the edited choice shows
  the accessible icon, and no card appears until selection. Check keyboard focus and that the
  picker stays within 320 CSS pixels. Confirm that the manifest update requires service re-approval
  and that the updated copy works after approval. Document this one-time step in the README. Ask
  before any check creates a real session or worktree. Report unverified Firefox and WebKit behavior.
