# Spec Delta

## Purpose

Shows, beside the chat session that is open, which OpenSpec changes that session works on, how far
each has got, and the next workflow step, on desktop, web and phone.

## ADDED Requirements

### Requirement: Contribute a session section to Work Status

The extension SHALL contribute a Work Status section titled `OpenSpec` that appears only when a
project is open. The section SHALL describe the session open in the chat and SHALL redraw for the
new session or project when the user switches, without requiring a remount. It SHALL add no
capability beyond those already declared.

#### Scenario: Switch sessions

- **WHEN** the section is expanded and the user opens another session in the same project
- **THEN** the section shows the tracked changes of the newly opened session
- **AND** no content from the previous session remains visible after the new state renders

#### Scenario: No project open

- **WHEN** the chat has no project directory
- **THEN** the section is not shown

### Requirement: Resolve the session's tracked changes

When the user has saved a tracked-change list for the session, that list SHALL be the session's
tracked changes, even when it is empty. Otherwise the section SHALL derive at most one change: the
extension's own item on the session naming a change, else the session's worktree when its name
equals a change name. Only changes in the active listing for the session's project SHALL show. The
section SHALL NOT infer changes from conversation content or tool activity.

#### Scenario: Saved list wins

- **WHEN** the user saved `add-login` and `fix-cache` for a session started for `add-search`
- **THEN** the section shows `add-login` and `fix-cache`, in saved order, and not `add-search`

#### Scenario: Worktree Apply session

- **WHEN** a session was started by new-worktree Apply for `add-login` and nothing is saved
- **THEN** the section shows `add-login`

#### Scenario: Bulk archive session

- **WHEN** the session was started by archive all and nothing is saved
- **THEN** the section shows no change and offers `＋ Track a change`

#### Scenario: Untracked everything

- **WHEN** the user untracks the last change of a worktree Apply session
- **THEN** the section shows no change, and the worktree name does not bring it back

#### Scenario: Tracked change no longer active

- **WHEN** a saved change has been archived or deleted
- **THEN** that change is not shown, and the other saved changes still are

### Requirement: Track and untrack changes

`＋ Track a change` SHALL list active changes that are not already tracked, in task-progress order,
and add the chosen one to the session's saved list. `Untrack`, in a change's name flyout, SHALL
remove it. Saved lists SHALL persist for that session across devices on the same server. A new
chat without a session SHALL disable tracking and explain that a session is required.

#### Scenario: Order choices by task progress

- **WHEN** `＋ Track a change` lists active changes
- **THEN** it shows these groups in order, preserving listing order within each group:

1. Some but not all tasks complete.
2. Tasks exist but none are complete.
3. No tasks.
4. At least one task exists and all tasks are complete.

#### Scenario: Track a second change

- **WHEN** session S tracks `add-login` and the user tracks `fix-cache`
- **THEN** the section shows both, and S shows both after reload or on another connected device

#### Scenario: Untrack a change

- **WHEN** the user activates `Untrack` for `fix-cache`
- **THEN** only `add-login` remains for S

### Requirement: Show each tracked change as a compact card

Each tracked change SHALL show as a card: its name followed by `completed/total` task counts on
one line, then a thin completion bar. The name SHALL truncate with an ellipsis before the count
wraps. When the change has tasks, a `Tasks:` disclosure SHALL follow, labelled with a disclosure
icon and no underline. On the same line, show the underlined title of the first incomplete task,
or the last task when all are complete.

#### Scenario: Change in progress

- **WHEN** a tracked change has 17 of 19 tasks complete and 6.2 is the first incomplete task
- **THEN** its card shows the name, `17/19`, a bar at 17/19, and a collapsed `Tasks:` disclosure
  followed by task 6.2's title

#### Scenario: No tasks yet

- **WHEN** a tracked change is in Planning and has no tasks
- **THEN** its card shows `0/0` with an empty bar and no `Tasks:` disclosure

### Requirement: Expand tasks around the current one

Expanding `Tasks:` SHALL show up to five tasks, each with a checkbox reflecting completion and its
title on one line. The window SHALL centre on the first incomplete task where tasks exist on both
sides, and otherwise shift to show five tasks. The checkboxes SHALL be read-only.

#### Scenario: Current task in the middle

- **WHEN** a change has 19 tasks, the 10th is the first incomplete one, and the user expands
  `Tasks:`
- **THEN** tasks 8 to 12 show, the 10th in the middle, with 8 and 9 checked

#### Scenario: Current task near the end

- **WHEN** the first incomplete task is the 18th of 19
- **THEN** tasks 15 to 19 show

#### Scenario: Few tasks

- **WHEN** a change has 3 tasks
- **THEN** all 3 show

#### Scenario: Current task near the start

- **WHEN** the first incomplete task is the first task of 10
- **THEN** tasks 1 to 5 show

### Requirement: Flyouts show detail on demand

Activating a change's name SHALL open a flyout with the name, stage label, goal and `Untrack`.
Activating a task title, in the `Tasks:` line or the expanded list, SHALL open a flyout with that
task's full description. On a phone, flyouts open as the host's bottom sheet. Where the host offers
no flyouts, the same content SHALL expand inline below the activated element.

#### Scenario: Task flyout

- **WHEN** the user activates task 6.2's title
- **THEN** a flyout shows task 6.2's full multi-line description

#### Scenario: Host without flyouts

- **WHEN** the host does not support flyouts and the user activates a change's name
- **THEN** the name, stage, goal and `Untrack` expand inline under the name

### Requirement: Offer workflow chips on each card

Each card SHALL show chips in this order: the stage chip, `sync`, `validate`, `board`. The stage
chip SHALL be `propose` in Planning, `apply` in Ready and In Progress, and `archive` when Complete.
Stage chips and `sync` SHALL replace the open composer's text with an unsent prompt and SHALL NOT
send, create sessions or worktrees, or change OpenSpec files.

#### Scenario: Apply an in-progress change

- **WHEN** the user activates `apply` on an In Progress change
- **THEN** the composer holds the board's current-chat Apply prompt for that change, unsent

#### Scenario: Archive a complete change

- **WHEN** the user activates `archive` on a Complete change
- **THEN** the composer holds the board's Archive prompt for that change, which keeps the archive
  skill's spec-sync step

#### Scenario: Session replaced while preparing

- **WHEN** the user switches session before composition completes
- **THEN** no feedback or composition is replayed into the replacement session

### Requirement: Validate a change on request

`validate` SHALL run OpenSpec validation for that change and show the result in a flyout: valid, or
each reported issue. It SHALL change no files and SHALL run only when activated.

#### Scenario: Valid change

- **WHEN** the user activates `validate` on a valid change
- **THEN** a flyout reports that the change is valid

#### Scenario: Invalid change

- **WHEN** validation reports issues
- **THEN** the flyout lists each issue's message and location

### Requirement: Open the board on the change

`board` SHALL open the extension's board showing that change's detail when the board's project is
the session's project, whether the board was already open or opens now. Otherwise the board SHALL
open at its list.

#### Scenario: Board already open

- **WHEN** the board is open on the same project and the user activates `board` on `add-login`
- **THEN** the board shows `add-login`'s detail

#### Scenario: Board not yet open

- **WHEN** the board is closed and the user activates `board` on `add-login`
- **THEN** the board opens and shows `add-login`'s detail once its listing has loaded

### Requirement: Refresh on context, request and finished turns

The section SHALL read when it loads, when the session or project changes, when the user activates
Refresh, and when the shown session finishes a turn. Each read SHALL cover the listing and, for
each shown change, its planning status and tasks, never every change's summary. The section SHALL
NOT poll or refresh on visibility changes. A failed read SHALL show an error with Refresh on the
affected card, or on the section when the listing fails, and SHALL NOT show partial progress.

#### Scenario: Initial host signals arrive together

- **WHEN** mount-time context and lifecycle signals arrive together
- **THEN** the section runs one read

#### Scenario: Turn finishes

- **WHEN** the shown session's turn completes after the agent checked off a task
- **THEN** the section re-reads once and shows the new count without user action

#### Scenario: Another session's turn finishes

- **WHEN** a session other than the shown one finishes a turn
- **THEN** the section does not read

#### Scenario: Read fails for one change

- **WHEN** the OpenSpec CLI fails while reading one of two tracked changes
- **THEN** that card shows the error and Refresh, and the other card shows its progress

### Requirement: Keep last known progress until fresh data arrives

While a read is pending, the section SHALL display available last known cards for the session and
mark them stale. On failure it SHALL retain that display with an error. The cache SHALL store only
the names, counts, current task titles, and stages, in memory across session switches and in device
storage where supported.

#### Scenario: Return to a session

- **WHEN** the section returns to a session with cached cards
- **THEN** it shows those cards as stale until a successful read replaces them

### Requirement: Keep interaction state across reads

Reads SHALL NOT close an open `Tasks:` disclosure, `＋ Track a change` list or flyout, or move
keyboard focus, while the change, its current task and the tracked list are unchanged.

#### Scenario: Turn finishes while tasks are expanded

- **WHEN** `Tasks:` is expanded and a finished turn re-reads with no change to the tasks
- **THEN** the disclosure stays expanded and focus stays where it was

### Requirement: Fit the section to touch devices

On a coarse pointer every chip, disclosure, task title and name control SHALL have a touch target
at least 44 CSS pixels tall, and the section SHALL fit a 320 CSS pixel width without horizontal
overflow. On a fine pointer the cards SHALL keep their compact height.

#### Scenario: Phone Status tab

- **WHEN** the section renders two tracked changes on a phone at 320px width
- **THEN** names, counts, bars, `Tasks:` lines and chips fit without horizontal scrolling and each
  control's touch target is at least 44px tall
