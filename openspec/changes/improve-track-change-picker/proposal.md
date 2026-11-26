# Proposal

## Why

Work Status already lets users choose what a session tracks, but finding the right change takes longer as the list grows. A search field and a cue for local edits help users find their change without guessing what the session worked on.

## What Changes

- Filter the existing picker by change name when it has more than one choice.
- On picker open, put choices with uncommitted edits in the current checkout first and mark them with an accessible icon. Preserve task-progress order within each group.
- Keep tracking manual. Open the picker immediately and keep search and selection available when the Git hint cannot be provided, including with shared planning or without Git. Do not compare branches or read session history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-change-section`: Search and local Git hints in the manual tracking picker.

## Impact

Changes the Work Status picker and its private service protocol. No OpenSpec CLI, skill, or saved-tracking format changes. Git is optional for the hint, not required to track a change.

**BREAKING** for existing approvals: OpenChamber requires users to approve the service again
after the extension adds `git` to its executable list. The user chose to keep the Git hint and
document the re-approval in the README. No new capability is requested.

The approved checks use the existing service and browser test files. No new test files or harnesses.
