# Add OpenSpec to Work Status

## Why

Users must leave the current chat and find a change on the board to see its progress or prepare the
next workflow.

## What changes

- Add compact tracked-change cards with counts, a progress bar, a five-task window, and change and
  task flyouts. Show a recorded goal, but leave the goal line out when none is recorded.
- Resolve tracking from saved choices, a session's typed item, or a worktree name. Save a change
  when the board prepares its workflow in an existing chat.
- Use the configured profile for workflow chips and the footer. Prepare workflows as unsent
  drafts, run validation on request, and link directly to the change on the board.
- Refresh on mount, context change, manual request, and finished turns. Read only the tracked
  changes and keep unchanged controls mounted.
- Fit the section to phone widths without changing the existing board's touch sizing.

## Capabilities

- Add `session-change-section` for tracking, progress, actions, and refresh behavior.
- Extend `change-workflows` with session tracking and the focus handoff.

## Impact

This restores the Work Status portion of the archived change. `upgrade-openchamber-sdk` and
`add-phone-support` carry the SDK and phone-board requirements. `improve-track-change-picker`,
`track-pending-archived-changes`, and `refresh-on-subagent-turns` extend these requirements. Pending
archive tracking adds the `git` exec permission and requires one-time approval.
