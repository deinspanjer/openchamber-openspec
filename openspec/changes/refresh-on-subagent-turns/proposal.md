# Proposal

## Why

When a subagent checks off OpenSpec tasks, the parent chat's Work Status card can stay stale until
the parent finishes its own turn. The card should show the new count after each subagent turn,
even while the parent is still working.

## What Changes

- Refresh the shown session's tracked changes after each observed turn of a direct or nested
  subagent. Keep the existing refresh when the shown session finishes its own turn.
- Read only the shown session's planning context. Shared planning edits can appear on the next
  read. Edits in an isolated worktree appear only after they reach the shown session's checkout.
- Keep refresh event-driven. Per-edit updates, file watching, and automatic detection of merges
  performed outside the session are out of scope. The footer's **Refresh** remains available.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-change-section`: Refresh Work Status when a descendant session finishes a turn.

## Impact

This affects the Work Status section in `src/status.ts`. No manifest permission, SDK API, or
OpenSpec CLI change is required.
