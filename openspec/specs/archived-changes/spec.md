# archived-changes Specification

## Purpose

Show the project's archived OpenSpec changes on the board, newest first, read-only.

## Requirements

### Requirement: List archived changes newest first

The `Archived` view SHALL list every archived change reported by the OpenSpec CLI for the board's
OpenSpec root. Each row SHALL show the change name without its date prefix, the archive date and
its task count as `<completed> of <total> tasks`. Rows SHALL be ordered by archive date, newest
first, then by name. A change without a date prefix SHALL sort after dated ones, by name. The view
SHALL offer no workflow, edit or delete actions.

#### Scenario: Two archived changes

- **WHEN** the CLI reports `2026-11-20-add-login` with 7 of 7 tasks and
  `2026-11-22-fix-cache` with 3 of 3 tasks
- **THEN** the view shows `fix-cache`, `2026-11-22`, `3 of 3 tasks` first, then `add-login`,
  `2026-11-20`, `7 of 7 tasks`

#### Scenario: Nothing archived

- **WHEN** the project has no archived changes
- **THEN** the view shows an empty state saying no changes are archived

### Requirement: Read archived changes only on demand

The board SHALL read archived changes when the `Archived` view first opens in a context and retain
the result until Refresh, a context change, or a focus request for an unlisted archive. After
Refresh, the next showing SHALL read again; if `Archived` is already shown, it SHALL read
immediately. A failed read SHALL show the error and `refresh` in the view and SHALL NOT show a
partial list. Reads SHALL verify the OpenSpec root as other board reads do.

#### Scenario: Older CLI

- **WHEN** the installed OpenSpec CLI cannot list archived changes
- **THEN** the view shows the CLI's error and the other views keep working

#### Scenario: Return to the view

- **WHEN** the user leaves `Archived` and opens it again in the same context without Refresh
- **THEN** the view shows its earlier list without a new read

#### Scenario: Refresh while Archived is hidden

- **WHEN** the user refreshes another view after reading `Archived`
- **THEN** the board does not read archived changes until the user returns to `Archived`

### Requirement: Open the Archived view on a change from Work Status

When Work Status asks the board to show an archived change of the board's project, the board
SHALL switch to `Archived`, mark that change's row as current and scroll it into view, whether the
board was already open or opens now. When the board's search query would hide the row, the board
SHALL clear the query. The mark SHALL last until the user leaves `Archived` or another change is
focused.

#### Scenario: Board already open on another view

- **WHEN** the board shows the active list and Work Status opens `2026-11-22-add-login` in the board
- **THEN** the board shows `Archived` with the `add-login` row marked as current and visible

#### Scenario: Search hides the row

- **WHEN** the board's search query is `cache` and Work Status opens `2026-11-22-add-login`
- **THEN** the query is cleared and the `add-login` row is marked as current

#### Scenario: Retained list predates the archive

- **WHEN** the retained archived list lacks the focused change
- **THEN** the board reads archived changes once more, and marks the row if the new list has it

#### Scenario: Change not in the archived list

- **WHEN** the focused change is still missing after that read
- **THEN** the board shows a notice that the change isn't in this board's archived list, and marks
  no row

#### Scenario: Board on another project

- **WHEN** the board's project is not the session's project
- **THEN** the board opens at its list and marks no row
