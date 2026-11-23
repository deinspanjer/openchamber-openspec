# Proposal

## Why

Live testing a worktree should not require editing, rebuilding inside, or replacing the
Git-installed extension. Keep a separate local install that developers can switch on for a
test and leave off when they finish.

## What Changes

- Add one command to build the current worktree into a reusable local extension folder with
  its own ID, `openspec-board-dev`. Switch source worktrees by running the command from the
  next worktree, without registering a new folder.
- Document one-time folder installation and approval, then the normal cycle: deploy, switch
  from the Git install to **OpenSpec (dev)**, test, and switch back.
- Keep the Git install's ID, permissions, and storage unchanged. The dev install has separate
  storage, so saved Work Status selections from the Git install do not appear in dev.

## Capabilities

### New Capabilities

None. This is a local development workflow, not a new extension feature.

### Modified Capabilities

None. Board navigation and session launches keep their behavior and target the install that
initiated them.

## Impact

The build and development instructions change. The Git package's `openspec-board` identity
must stay the same: changing it would register a different extension instead of updating the
existing one. Existing panel tests exercise the release identity, so no additional test file
or release guard is planned. No new SDK capability or OpenSpec CLI requirement is needed.
