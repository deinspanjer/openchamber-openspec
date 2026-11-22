# Tasks

## 1. SDK upgrade

- [x] 1.1 Pin `@openchamber/sdk` to `2.7.3` in `package.json`, run `npm ci`, and fix type or
      behaviour breaks in `src/` without feature changes. Read `node_modules/@openchamber/sdk/`
      docs for status sections, storage, `device` and `onSessionLifecycle` before task 3. Verify
      with `npm run check`.

## 2. Shared building blocks

- [x] 2.1 At the model seam (`test/model.test.mjs`), add failing cases for `resolveTrackedChange`:
      saved wins, inactive saved falls through and is reported stale, `data.kind: "change"` items,
      legacy id-only items, `archive-all` never resolves, worktree name, nothing resolves. Implement
      it in `src/model.ts`. Verify with `npm run build:model:test && node --test
      test/model.test.mjs`.
- [x] 2.2 Move `actionPrompt` from `src/panel/controller.ts` into `src/panel/prompts.ts` and
      `findProject` out of `src/panel/worktree.ts`, with no output change. Verify the existing
      prompt and worktree tests in `test/panel.test.mjs` pass unchanged after `npm run build`.
- [x] 2.3 At the service seam (`test/service.test.mjs`), add failing tests for a `/summary` route
      that returns one change's summary and refuses wrong root, planning identity or unknown change
      like `/summaries`. Implement it in `src/service/http.ts` and `src/service/openspec.ts`, add
      `client.summary()` with `decodeSummary`. Verify with `npm run build && node --test
      test/service.test.mjs`.

## 3. Board records tracked changes

- [x] 3.1 At the fake SDK host seam (`test/panel.test.mjs`), extend the fake host with `storage`
      and add failing tests: current-chat composition in a session saves the change; a fresh-chat
      draft, a rejected composition and a replaced context save nothing; a storage failure leaves
      composition successful. Implement the save helper and call it from `preparePrompt`. Verify
      with `npm run build && node --test --test-name-pattern='tracked change' test/panel.test.mjs`.
- [x] 3.2 At the same seam, extend the existing new-worktree Apply and archive-all assertions to
      require `data: { kind: "change", change }` and `data: { kind: "archive-all" }` on
      `startSession`, then add them in `controller.ts`. Verify the worktree and archive tests in
      `test/panel.test.mjs`.
- [x] 3.3 Add the 1,900-key pruning to the save helper with a fake-host test that seeds 1,900
      `session-change:` keys and asserts the 100 oldest are removed. Verify with the focused test.

## 4. Session section

- [x] 4.1 Add `panel/status.html`, `src/status.ts`, the `build:status` script (in `build` and
      `clean`) and the `statusSection` manifest entry. Extend the fake host to serve the status
      entry with `surface: "status"`, `listProjects`/`onSessions`, `setHeight` and
      `setStatusControls`. Add failing tests at the fake host seam for resolution display: saved
      choice, worktree Apply session, archive-all session showing the picker, stale saved change
      message, new chat with disabled picker. Implement. Verify with `npm run build && node --test
      --test-name-pattern='session section' test/panel.test.mjs`.
- [x] 4.2 At the same seam, add failing tests for progress: bar and `3/7` text, collapsed
      current-task disclosure with the first incomplete task's name and full description on
      expand, `0/0` without disclosure in Planning, full bar without disclosure when complete,
      artefact statuses, error with Refresh and no partial progress on read failure. Implement.
- [x] 4.3 At the same seam, add failing tests for the picker (task-count order, choice saved and
      shown), the stage action composing the board's prompt unsent and saving the change, no replay
      after a session switch, and `Open board` calling `openSurface("plugin:openspec-board")`.
      Implement.
- [x] 4.4 At the same seam, extend the fake host to push `onSessionLifecycle`, then add failing
      tests: `completed` for the shown session re-reads once; another session's completion does
      not read; session switch re-resolves and re-reads; stale responses are dropped; header
      Refresh control when `features.statusControls` is present, body button otherwise. Implement.
- [x] 4.5 Update `AGENTS.md` (three generated bundles, the section's refresh rule beside the board
      rule) and `README.md` (the section, minimum OpenChamber 2.7.1 for section and phone support).
      Verify `npm run format:check` passes.

## 5. Phone and touch

- [x] 5.1 Extend the fake host's `ready` with `device`. At the fake host seam, add failing tests at
      320px with `pointer: "coarse"`: board, detail, dialogue and section controls are at least 44px
      tall; with `pointer: "fine"` existing sizes are unchanged. Implement `data-pointer` and the
      coarse styles in `panel/index.html` and `panel/status.html`. Verify with the focused tests.
- [x] 5.2 At the same seam, add failing tests that a reported bottom inset pads the detail footer
      and a reported keyboard height keeps the create dialogue's field and buttons visible.
      Implement the CSS variables.
- [x] 5.3 At the same seam, add failing tests that closing detail and deleting a change on a coarse
      pointer focus a non-text control, and fine-pointer focus is unchanged. Implement in
      `controller.ts`.
- [x] 5.4 Set `panel.mobile: true` in the manifest and widen the scope in `openspec/config.yaml`
      to include OpenChamber's phone clients (2.7.1+). Verify `npm run check`.

## 6. Integration checks

- [x] 6.1 Run `npm run check`; confirm all three bundles are rebuilt and no new capability appears
      in the manifest. Result on 2026-11-21: Chromium 218/218. The harness runs Chromium only. A
      temporary loader-hook run gave WebKit 214/218, with all 4 failures (dialog keyboard focus,
      theme colour) also failing on `23d2503`; Firefox would not launch on this machine. Proper
      cross-browser support is a follow-up change.
## 7. Compact multi-change redesign

Spec: `specs/session-change-section`, `specs/change-workflows`; design: "Compact cards", "Flyouts",
"Validate route", "Focus handoff". Tests fail first at the named seam. Inline waits for fake-host
delivery in both directions. No new test files or shared helpers. One commit per task.

- [ ] 7.1 Model seam: replace `resolveTrackedChange` with `resolveTrackedChanges` and add
      `taskWindow`, with failing cases first (see design's test seams). Update callers so
      `npm run typecheck` passes. Verify with `npm run build:model:test && node --test
      test/model.test.mjs`.
- [ ] 7.2 Service seam: add `/validate` and `/focus` (set, read-once, 30 s expiry, `emit`). Check
      the CLI's issue JSON against an invalid fixture first. Verify with `npm run build && node
      --test test/service.test.mjs`.
- [ ] 7.3 Fake host seam: model `openPopover` (loads the status entry with `surface: "popover"` and
      `ready.popover.data`), `onPopoverClosed`, a `features.popovers` toggle and `onServiceEvent`,
      and apply `setHeight` to the frame with the 24–480 clamp. Add a failing test that a flyout
      opens as a popover when supported and inline otherwise, then implement popover mode in
      `src/status.ts`.
- [ ] 7.4 Same seam: saved tracked lists. Track adds (seeding the derived change first), Untrack
      removes, an empty saved list shows nothing even for a worktree session, a value without
      `changes` counts as unsaved, and the board's current-chat compose appends. Update the
      existing tracked-change tests to the list shape.
- [ ] 7.5 Same seam: compact cards for two tracked changes. Name and `n/m`, the thin bar, the
      `▸ Tasks:` line with the current task, the five-task window on expand, task and name
      flyouts, chips in order with the stage chip per stage (`propose` / `apply` / `archive`), and
      `0/0` without the Tasks line. Remove the 1.3.x bar, disclosure, badges and buttons, and their
      tests.
- [ ] 7.6 Same seam: chip behaviour. `apply` / `propose` / `archive` compose the board's prompts
      unsent and append tracking; `sync` composes the sync prompt; `validate` shows valid and
      invalid results in a flyout; `board` posts the focus, calls
      `openSurface("plugin:openspec-board")`, and a board on the same project (mounted, or mounted
      later) opens that change's detail while another project's board stays at its list.
- [ ] 7.7 Same seam: read and interaction behaviour with two changes. One listing plus summary and
      tasks per change; a failure on one card leaves the other; an expanded `Tasks:` and focus
      survive an unchanged finished-turn read; no `/summaries`. Coarse pointer at 320px: 44px
      targets and no horizontal overflow; fine pointer stays compact.
- [ ] 7.8 Update README and AGENTS.md for the multi-change section, `/validate` and the focus
      handoff. Bump the version to 1.4.0 with `npm version 1.4.0 --no-git-tag-version`. Verify
      with `npm run check` and `npm run format:check`.

## 8. Live checks

- [ ] 8.1 Live-host check per `AGENTS.md` on the released 1.4.0: update, then disable and enable,
      confirm Enabled. Track two changes in a session, expand Tasks, open each flyout, validate,
      open the board from a card, and finish a turn to watch a count update. Ask the user before
      any check that creates sessions or worktrees.
- [ ] 8.2 Phone check with the user: the Status tab and the board page from the More menu. Confirm
      touch sizes, bottom-sheet flyouts, insets and keyboard behaviour, and drop inset padding if
      the host already applies it. Report anything not verified.

## Workflow follow-up

- Draft the upstream OpenChamber issues listed in `design.md` for the user to approve.
