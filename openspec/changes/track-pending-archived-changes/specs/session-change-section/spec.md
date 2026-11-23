## MODIFIED Requirements

### Requirement: Resolve the session's tracked changes

When the user has saved a tracked-change list for the session, that list SHALL be the session's
tracked changes, even when it is empty. Otherwise the section SHALL derive at most one change: the
extension's own item on the session naming a change, else the session's worktree when its name
equals a change name. Only changes in the active listing for the session's project, or archived
but not landed in the current checkout, SHALL show. The section SHALL NOT infer changes from
conversation content or tool activity.

#### Scenario: Saved list wins

- **WHEN** the user saved `add-login` and `fix-cache` for a session started for `add-search`
- **THEN** the section shows `add-login` and `fix-cache`, in saved order, and not `add-search`

#### Scenario: Worktree Apply session

- **WHEN** a session was started by new-worktree Apply for `add-login` and nothing is saved
- **THEN** the section shows `add-login`

#### Scenario: Worktree Apply session after archiving

- **WHEN** a session was started by new-worktree Apply for `add-login`, nothing is saved, and the
  session archived `add-login` without the archive landing
- **THEN** the section shows `add-login` as archived and not landed

#### Scenario: Bulk archive session

- **WHEN** the session was started by archive all and nothing is saved
- **THEN** the section shows no change and offers `＋ Track a change`

#### Scenario: Untracked everything

- **WHEN** the user untracks the last change of a worktree Apply session
- **THEN** the section shows no change, and the worktree name does not bring it back

#### Scenario: Tracked change no longer active

- **WHEN** a saved change has been deleted, or archived with the archive landed
- **THEN** that change is not shown, and the other saved changes still are

#### Scenario: Active change wins over an archived one of the same name

- **WHEN** a tracked name is in the active listing and also has an archive that has not landed
- **THEN** the section shows the active change

### Requirement: Track and untrack changes

`＋ Track a change` SHALL list active changes that are not already tracked, then archived changes
that have not landed and are not already tracked, and add only the chosen change to the session's
saved list. Among active choices, those with a local Git hint SHALL appear first, with each group
in task-progress order. `Untrack`, in a change's name flyout, SHALL remove it. Saved lists SHALL
persist for that session across devices on the same server. A new chat without a session SHALL
disable tracking and explain that a session is required.

#### Scenario: Order choices by task progress

- **WHEN** `＋ Track a change` lists active changes
- **THEN** within each group with or without a local Git hint, it shows these groups in order,
  preserving listing order within each group:

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

#### Scenario: Track an archived change again

- **WHEN** `add-login` is archived without the archive landing, is not tracked, and the user opens
  `＋ Track a change`
- **THEN** `add-login` is listed after every active choice, labelled `Archived · not landed`
- **AND** choosing it shows its archived card

#### Scenario: Pending archives are unknown when the picker opens

- **WHEN** the user opens the picker before the pending-archive check returns, or the check cannot
  run
- **THEN** the picker shows the active choices at once, and archived choices only once known

### Requirement: Show each tracked change as a compact card

Each tracked change SHALL show as a card: its name followed by `completed/total` task counts on
one line, then a thin completion bar. The name SHALL truncate with an ellipsis before the count
wraps. When an active change has tasks, a `Tasks:` disclosure SHALL follow, labelled with a
disclosure icon and no underline. On the same line, show the underlined title of the first
incomplete task, or the last task when all are complete.

#### Scenario: Change in progress

- **WHEN** a tracked change has 17 of 19 tasks complete and 6.2 is the first incomplete task
- **THEN** its card shows the name, `17/19`, a bar at 17/19, and a collapsed `Tasks:` disclosure
  followed by task 6.2's title

#### Scenario: No tasks yet

- **WHEN** a tracked change is in Planning and has no tasks
- **THEN** its card shows `0/0` with an empty bar and no `Tasks:` disclosure

### Requirement: Flyouts show detail on demand

Activating an active change's name SHALL open a flyout with the name, stage label, goal and change
actions. Activating a task title, in the `Tasks:` line or the expanded list, SHALL open a flyout
with that task's full description. On a phone, flyouts open as the host's bottom sheet. Where the
host offers no flyouts, the same content SHALL expand inline below the activated element.

#### Scenario: Task flyout

- **WHEN** the user activates task 6.2's title
- **THEN** a flyout shows task 6.2's full multi-line description

#### Scenario: Host without flyouts

- **WHEN** the host does not support flyouts and the user activates an active change's name
- **THEN** the name, stage, goal, actions and `Untrack` expand inline under the name

### Requirement: Offer change actions in the name flyout

The active change's name flyout SHALL offer `update` and `Open in board`, preceded by `continue`
when the change is in Planning and both `ff` and `continue` are configured. `Untrack` SHALL
follow as a small control aligned right.

#### Scenario: Name flyout actions

- **WHEN** the user opens the name flyout of an In Progress change
- **THEN** it offers `update` and `Open in board`, and a smaller right-aligned `Untrack`
- **AND** it offers no `continue`

#### Scenario: Continue beside fast-forward

- **WHEN** `ff` and `continue` are both configured and the user opens a Planning change's name
  flyout
- **THEN** it offers `continue` before `update` and `Open in board`

#### Scenario: Update a change

- **WHEN** the user activates `update` in a change's name flyout
- **THEN** the composer holds an unsent prompt to revise that change's planning artefacts

### Requirement: Offer workflow chips on each card

Each active change card SHALL show chips in this order: the stage chip, the stage's secondary chip
when it has one, `sync`, `validate`. `sync` SHALL be hidden when the change's specs artefact is
skipped. Cards SHALL have no `board` chip. Workflow chips SHALL replace the open composer's text
with an unsent prompt and SHALL NOT send, create sessions or worktrees, or change OpenSpec files.

#### Scenario: Specs skipped

- **WHEN** a tracked change's specs artefact is skipped
- **THEN** its card shows no `sync` chip

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

### Requirement: Open the board on the change

`Open in board`, in an active change's name flyout, SHALL open the extension's board showing that
change's detail when the board's project is the session's project, whether the board was already
open or opens now. Otherwise the board SHALL open at its list.

#### Scenario: Board already open

- **WHEN** the board is open on the same project and the user activates `Open in board` for
  `add-login`
- **THEN** the board shows `add-login`'s detail

#### Scenario: Board not yet open

- **WHEN** the board is closed and the user activates `Open in board` for `add-login`
- **THEN** the board opens and shows `add-login`'s detail once its listing has loaded

### Requirement: Refresh on context, request and finished turns

The section SHALL read when it loads, when the session or project changes, when the user activates
the footer's Refresh, and when the shown session finishes a turn. Each read SHALL cover the listing
and, for each shown active change, its planning status and tasks, never every change's summary.
A read SHALL check for archives that have not landed only when a tracked name is missing from the
active listing. The section SHALL NOT poll or refresh on visibility changes.

#### Scenario: Initial host signals arrive together

- **WHEN** mount-time context and lifecycle signals arrive together
- **THEN** the section runs one read

#### Scenario: Turn finishes

- **WHEN** the shown session's turn completes after the agent checked off a task
- **THEN** the section re-reads once and shows the new count without user action

#### Scenario: Another session's turn finishes

- **WHEN** a session other than the shown one finishes a turn
- **THEN** the section does not read

#### Scenario: Every tracked change is active

- **WHEN** every tracked name is in the active listing
- **THEN** the read does not check archived changes or Git

#### Scenario: The session archives its change

- **WHEN** the shown session's turn archives tracked change `add-login`
- **THEN** the finished-turn read shows `add-login` as archived and not landed, without user action

## ADDED Requirements

### Requirement: Decide whether an archive has landed

A tracked change archived in the current checkout SHALL count as not landed while its archive
folder is missing from the base ref: the first of `origin/HEAD`, `origin/main`, `origin/master`,
`main`, `master` and `HEAD` that exists. The check SHALL apply only to local planning inside the
checkout. When it cannot run, the change SHALL not show, as before this change.

#### Scenario: Archive committed on a feature branch

- **WHEN** a worktree branch committed the archive of `add-login` and `origin/HEAD` lacks it
- **THEN** `add-login` shows as archived and not landed

#### Scenario: Archive merged and fetched

- **WHEN** the fetched base ref contains `add-login`'s archive folder
- **THEN** the next read no longer shows `add-login`

#### Scenario: Repository without remotes or default branches

- **WHEN** only `HEAD` exists among the candidate refs
- **THEN** `add-login` shows only while its archive is uncommitted

#### Scenario: Check cannot run

- **WHEN** Git is missing or unavailable, the planning target is shared or outside the checkout, or
  the CLI cannot list archived changes
- **THEN** the archived change does not show, and the section shows no error for it

#### Scenario: Malformed output

- **WHEN** the CLI or Git returns output the extension cannot decode
- **THEN** each tracked name missing from the active listing shows an error card with Refresh

### Requirement: Show an archived change as a read-only card

A tracked change archived but not landed SHALL show as a card with its name, final
`completed/total` task counts, the completion bar and the label `Archived · not landed`. It SHALL
show no workflow chips and no `Tasks:` line. Activating its name SHALL open a flyout with the name,
the label, `Open in board` and a small right-aligned `Untrack`.

#### Scenario: Archived card

- **WHEN** tracked change `add-login` was archived with 7 of 7 tasks and has not landed
- **THEN** its card shows `add-login`, `7/7`, a full bar and `Archived · not landed`
- **AND** it shows no chips and no `Tasks:` line

#### Scenario: Archived name flyout

- **WHEN** the user activates `add-login`'s name on its archived card
- **THEN** the flyout shows the name, `Archived · not landed`, `Open in board` and `Untrack`

#### Scenario: Untrack an archived change

- **WHEN** the user activates `Untrack` in the archived card's flyout
- **THEN** the card is removed, and `add-login` is offered again in `＋ Track a change`

#### Scenario: Open an archived change in the board

- **WHEN** the user activates `Open in board` in the archived card's flyout
- **THEN** the board opens at its `Archived` view with `add-login` highlighted
