# Proposal

## Why

When a chat session works on an OpenSpec change, nothing beside that session shows which change it
is or how far it has got; the user must open the board and find the card. OpenChamber's phone
clients show nothing from this extension at all, although its service and frames already work
there.

## What Changes

- Add an `OpenSpec change` section to the chat's Work Status panel. It follows the session open in
  the chat and shows that session's tracked change: name, stage, a completion bar followed by
  `completed/total`, the current task as a disclosure, and planning artefact status.
- Resolve the tracked change in a fixed order: the user's choice saved for that session, the
  extension's own item on the session, a worktree named after an active change, otherwise a picker
  of active changes. Never infer it from the transcript.
- Offer the stage's workflow action from the section, prepared unsent in the session's composer
  with the board's existing prompt; also `Change…` and `Open board`.
- Refresh the section when it loads, when the session or project changes, on explicit Refresh, and
  when the shown session finishes a turn. This is the first event-driven read trigger; it reads one
  change, never the whole board.
- Current-chat workflow actions on the board also save the prepared change as that session's
  tracked change when a session exists.
- Opt the panel and full-screen page into OpenChamber's phone clients, with touch-sized controls on
  coarse pointers, room for device insets and the on-screen keyboard, and no automatic focus moves
  that raise the keyboard on touch devices.
- Upgrade `@openchamber/sdk` from 1.24.2 to 2.7.3, which defines status sections, phone opt-in and
  device information.

No new permissions: a status section and the phone opt-in add no capability, so existing installs
are not asked to re-approve. Sidebar marks are deferred because they would.

## Capabilities

### New Capabilities

- `session-change-section`: the session-scoped Work Status section — tracked-change resolution,
  what it shows, its actions and when it refreshes.

### Modified Capabilities

- `change-workflows`: current-chat composition also saves the session's tracked change; new-worktree
  Apply records the change on the session it creates.
- `change-presentation`: the board and detail are available on phones and sized for touch.

## Impact

New status entry and bundle beside `panel/`, `package.json` manifest and build scripts,
`src/panel/controller.ts` (prompt extraction and tracked-change saving), a single-change service
read in `src/service/`, `panel/index.html` styles, the fake SDK host and existing test files,
`openspec/config.yaml` scope, `README.md` and `AGENTS.md`.

Compatibility: hosts before OpenChamber 2.0.1 ignore the status section and hosts before 2.7.1
ignore the phone opt-in; `engines.openchamber` cannot express a floor above 1.22.0, so the README
states the minimum. The SDK upgrade crosses a major version and may change types the panel uses.
The extra reads after each turn add a few `openspec` CLI calls per finished turn in sessions that
show the section expanded. No new CLI commands, flags or skill names.
