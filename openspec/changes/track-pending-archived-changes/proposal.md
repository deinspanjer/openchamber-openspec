# Proposal

## Why

When a session archives a tracked change, the change disappears from Work Status as soon as
OpenSpec moves it into `changes/archive/`. The archive has not landed yet: it is still on the
worktree's branch or uncommitted, and it can't be tracked again. The user loses sight of work the
session is still responsible for until the branch merges.

## What Changes

- A tracked change archived in the current checkout stays on Work Status, marked
  `Archived · not landed`, until its archive folder reaches the base branch. Its card shows the
  final task counts and bar, without workflow chips or a `Tasks:` line.
- "Landed" means the archive folder exists in the first of these refs that exists: `origin/HEAD`,
  `origin/main`, `origin/master`, `main`, `master`, `HEAD`. With only `HEAD`, a card stays until
  the archive is committed. Landing is noticed only after the remote ref is fetched.
- The archived card's name flyout offers `Open in board` and `Untrack`. `Open in board` opens the
  board's `Archived` view and highlights that change.
- `＋ Track a change` also lists archived changes that have not landed, in their own group after
  the active changes, so they can be tracked again.
- Saved tracked lists keep their format. An archived name already stays in storage; only reads
  stop hiding it.
- The section runs the extra check only when a tracked name is missing from the active listing,
  or when the picker opens without a result. A session whose tracked names are all active makes
  no extra calls during ordinary reads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-change-section`: Resolve and show tracked changes that are archived but not landed,
  offer them in the picker, and extend the read rules.
- `archived-changes`: Open the `Archived` view on a change named by Work Status and highlight it.

## Impact

Affects the Work Status section, the board's focus handoff and `Archived` view, the private
service protocol, and `src/service/git.ts`. No manifest change: `git` is already an approved
executable and no capability is added, so users don't approve the service again.

Relies on `openspec list --archived --json`, which the board's `Archived` view already uses. The
user chose this fallback: when the check can't run, the change drops off as it does today. That
covers no Git, Git unavailable, shared or external planning, and a CLI that can't list archived
changes. Malformed CLI or Git output is still an error on the affected card. The fallback adds no
README requirement.

The approved tests use only the existing files: `model.test.mjs`, `service.test.mjs` (disposable
real-Git repo and real CLI), and `panel.test.mjs` (fake SDK host). No new test files or helpers.
