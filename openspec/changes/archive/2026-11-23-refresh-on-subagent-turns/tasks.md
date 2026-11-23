# Tasks

## 1. Confirm the host signal

- [x] 1.1 Observe the Work Status frame's project session snapshots while a real subagent takes
  two turns. Confirm that its parent link and active-to-idle transition are visible for both
  turns before the shown session finishes. Get approval before creating a session or worktree.
  If the signal is absent, stop and report what the host delivered.

## 2. Refresh Work Status

- [x] 2.1 In the fake SDK host in `test/panel.test.mjs`, add a failing regression case for
  successive turns of a nested subagent while the shown session is still active. Check that
  the counts update in the shown session's planning context without reloading workflows.
  Include snapshots that must not trigger a read: an unrelated turn, an initial idle record,
  and an idle record after switching sessions. Implement the trigger and context reset in
  `src/status.ts`. Run the focused tests and confirm the counts and requests match.
- [x] 2.2 Update the Work Status refresh rule in `AGENTS.md`. Check it against the spec delta
  and keep the existing bans on polling and visibility refresh.

## 3. Verify the change

- [x] 3.1 Run `npm run check`. Follow the live-host checks in `AGENTS.md` and confirm in the
  running UI that the parent card updates after a subagent checks off a tracked task, without
  waiting for the parent turn to end. Report the observed result and any unverified hosts.
