# Spec Delta

## Purpose

Shows, beside the chat session that is open, which OpenSpec change that session works on, how far
it has got, and the next workflow step, on desktop, web and phone.

## ADDED Requirements

### Requirement: Contribute a session section to Work Status

The extension SHALL contribute a Work Status section titled `OpenSpec change` that appears only
when a project is open. The section SHALL describe the session open in the chat and SHALL redraw
for the new session or project when the user switches, without requiring a remount. It SHALL add
no capability beyond those already declared.

#### Scenario: Switch sessions

- **WHEN** the section is expanded and the user opens another session in the same project
- **THEN** the section shows the tracked change of the newly opened session, or its picker
- **AND** no content from the previous session remains visible after the new state renders

#### Scenario: No project open

- **WHEN** the chat has no project directory
- **THEN** the section is not shown

### Requirement: Resolve the session's tracked change in a fixed order

The section SHALL resolve the tracked change from, in order: the change the user saved for that
session; the extension's own item on that session naming a change; the session's worktree when its
name equals a change name. A candidate SHALL count only when it names a change in the active
listing for the session's project; otherwise resolution continues with the next source. The
section SHALL NOT infer a change from conversation content or tool activity.

#### Scenario: Saved choice wins

- **WHEN** the user saved `add-login` for the session and the session was started for `fix-cache`
- **THEN** the section shows `add-login`

#### Scenario: Worktree Apply session

- **WHEN** a session was started by new-worktree Apply for `add-login` and no choice is saved
- **THEN** the section shows `add-login`

#### Scenario: Bulk archive session

- **WHEN** the session was started by archive all and nothing else names a change
- **THEN** the section shows the picker rather than treating the archive session as a change

#### Scenario: Tracked change no longer active

- **WHEN** the saved change has been archived or deleted
- **THEN** resolution continues with the next source, and the section says the saved change is no
  longer active when no other source names one

### Requirement: Let the user choose the tracked change

When no change resolves, the section SHALL show a picker of active changes with Ready and In
Progress changes first. `Change…` SHALL open the same picker when a change is shown. A choice SHALL
be saved for that session so that every device connected to the same OpenChamber server resolves
it. A new chat without a session SHALL show the picker's choices disabled with an explanation that
a choice can be saved once the session exists.

#### Scenario: Choose a change

- **WHEN** the user picks `add-login` in the picker for session S
- **THEN** the section shows `add-login` for S, and S resolves to `add-login` after reload or on
  another connected device

### Requirement: Show the tracked change's progress

For a tracked change the section SHALL show its name, its stage label, and a completion bar followed
by `completed/total` task counts. The current task SHALL be the first incomplete task in
`tasks.md` order and SHALL be shown as a disclosure whose summary is the task's name on one line and
whose expanded content is its full description. The section SHALL list each applicable planning
artefact with its status: done, ready, blocked or skipped.

#### Scenario: Change in progress

- **WHEN** the tracked change has 3 of 7 tasks complete and task 2.1 is the first incomplete task
- **THEN** the section shows a bar at 3/7 followed by `3/7` and a collapsed disclosure summarised by
  task 2.1's name
- **AND** expanding the disclosure shows task 2.1's full description

#### Scenario: No tasks yet

- **WHEN** the tracked change is in Planning and has no tasks
- **THEN** the section shows `0/0` with an empty bar, no current-task disclosure, and the artefact
  statuses

#### Scenario: All tasks complete

- **WHEN** every task is complete
- **THEN** the bar is full and no current-task disclosure is shown

### Requirement: Offer the stage's workflow action from the section

The section SHALL offer the stage's workflow action using the board's vocabulary and prompts:
propose, apply, continue, archive, and verify for Complete changes. Activating it SHALL replace the
open composer's text with the same unsent prompt the board prepares for the current chat, and SHALL
NOT send, create sessions or worktrees, or change OpenSpec files. `Open board` SHALL open the
extension's board.

#### Scenario: Prepare continue from the section

- **WHEN** the tracked change is In Progress and the user activates `continue`
- **THEN** the composer holds the board's current-chat Apply prompt for that change, unsent

#### Scenario: Session replaced while preparing

- **WHEN** the user switches session before composition completes
- **THEN** no feedback or composition is replayed into the replacement session

### Requirement: Refresh on context, request and finished turns

The section SHALL read its change when it loads, when the session or project changes, when the user
activates Refresh, and when the shown session finishes a turn. Each read SHALL cover only the
listing, the tracked change's planning status and its tasks, never every change's summary. The
section SHALL NOT poll or refresh on visibility changes. A failed read SHALL show an error with
Refresh and SHALL NOT show partial progress.

#### Scenario: Turn finishes

- **WHEN** the shown session's turn completes after the agent checked off a task
- **THEN** the section re-reads and shows the new count without user action

#### Scenario: Another session's turn finishes

- **WHEN** a session other than the shown one finishes a turn
- **THEN** the section does not read

#### Scenario: Read fails

- **WHEN** the OpenSpec CLI fails while reading the tracked change
- **THEN** the section shows the error and a Refresh control instead of progress

### Requirement: Fit the section to touch devices

On a coarse pointer the section's controls SHALL be at least 44 CSS pixels tall, and its layout
SHALL fit a 320 CSS pixel width without horizontal overflow.

#### Scenario: Phone Status tab

- **WHEN** the section renders on a phone at 320px width
- **THEN** the bar, counts, disclosure and actions fit without horizontal scrolling and each
  control is at least 44px tall
