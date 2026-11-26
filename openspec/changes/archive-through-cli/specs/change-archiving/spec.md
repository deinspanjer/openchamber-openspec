# Spec Delta

## Purpose

Archives completed OpenSpec changes from Work Status and the board through the OpenSpec CLI in one
step, and hands an agent only the archives that do not succeed.

## ADDED Requirements

### Requirement: Archive a change through the OpenSpec CLI

`archive` on a Work Status card, a board card or the board detail SHALL archive the change with
the OpenSpec CLI in its originating context, syncing its delta specs into the main specs first. It
SHALL NOT compose a prompt, send a message or create a session when the archive succeeds. The
action SHALL be disabled while its archive is pending, and repeated activation SHALL NOT start a
second archive.

#### Scenario: Unsynced change

- **WHEN** the user activates `archive` on Complete change `add-login` whose delta specs are not in
  the main specs
- **THEN** the main specs gain its requirements and `add-login` moves to the archive
- **AND** no prompt is composed and no session is created

#### Scenario: Change already synced

- **WHEN** `add-login`'s delta specs were already synced exactly as written
- **THEN** `add-login` is archived without changing the main specs

#### Scenario: Repeated activation

- **WHEN** the user activates `archive` again while the first archive is pending
- **THEN** only one archive runs

### Requirement: Refuse changes that are not ready to archive

Immediately before archiving, the extension SHALL read a fresh listing in the originating
context. It SHALL refuse a change that is no longer listed, or whose task total is zero or
whose tasks are not all complete, without running the archive. A refusal SHALL show an error and
SHALL NOT compose a prompt. An obsolete action from a replaced project, planning target or session
SHALL be rejected without feedback in the replacement context.

#### Scenario: Task unchecked since the board loaded

- **WHEN** the board shows `add-login` as Complete but a task is now unchecked
- **THEN** activating `archive` reports that its tasks are incomplete and nothing is archived

#### Scenario: Context replaced while pending

- **WHEN** the user switches project before the archive responds
- **THEN** no toast, prompt or refresh appears in the new project

### Requirement: Report a successful archive

After a successful archive the extension SHALL show a success toast naming the change and SHALL
re-read the surface that started it: the Work Status section, or the board. When the CLI reports
warnings, the toast SHALL list them, and the change SHALL still count as archived.

#### Scenario: Archive with warnings

- **WHEN** the CLI archives `drop-legacy` and warns that a removed requirement was already absent
- **THEN** the toast names `drop-legacy` and shows the warning
- **AND** no prompt is composed

#### Scenario: Work Status after archiving

- **WHEN** a tracked change is archived from its Work Status card
- **THEN** the section re-reads and shows the change as archived and not landed

### Requirement: Hand an unsuccessful archive to the agent

When the CLI does not archive the change, returns output the extension cannot decode or does not
respond in time, the extension SHALL replace the open composer's text with an unsent fallback
prompt and show a toast saying the archive did not complete and a prompt is ready. Composition
SHALL follow the current-chat tracking rules. For `archive without sync`, report the failure
without composing a prompt.

#### Scenario: Reworded synced requirement

- **WHEN** the CLI fails because an ADDED requirement already exists in the main spec
- **THEN** the composer holds an unsent prompt with that CLI output that asks for
  `openspec-archive-change`
- **AND** the change stays active

#### Scenario: Unknown outcome

- **WHEN** the archive times out
- **THEN** the composer holds the fallback prompt and the toast does not claim the change was
  archived
- **AND** the prompt asks the agent to check the active and archived locations before attempting
  a fix

### Requirement: Fallback archive prompt carries the CLI evidence

The fallback prompt SHALL name the change, the command that ran and its raw output. It SHALL ask
the agent to load and invoke `openspec-archive-change` through its skill tool, fix the cause, sync
without asking if the change still needs it, and archive the change.

#### Scenario: Prompt content

- **WHEN** the CLI fails for `add-login` with `archive_spec_update_failed`
- **THEN** the prompt contains `add-login`, the archive command, the CLI's JSON output and a
  request to invoke `openspec-archive-change`

### Requirement: Archive without syncing from the board detail

The board detail of a Complete change SHALL show its primary action as a split button: `archive`
beside a down-arrow menu button with an accessible name. The menu SHALL offer `archive without
sync`, which archives the change through the same path without updating the main specs. Work
Status cards and board cards SHALL keep a single `archive` button.

#### Scenario: Archive without sync

- **WHEN** the user chooses `archive without sync` for `tidy-docs` in the board detail
- **THEN** `tidy-docs` is archived and the main specs are unchanged

#### Scenario: Other stages

- **WHEN** the board detail shows a change in Planning, Ready or In Progress
- **THEN** its primary action is unchanged

### Requirement: Archive all completed changes directly

After `start archiving` is confirmed, `archive all` SHALL archive each available Complete change
known to the board, one at a time, through the same path as `archive`. It SHALL reload the board
once when the run ends and show one toast with the number archived. A context change during the
run SHALL stop further archives and suppress feedback.

#### Scenario: All succeed

- **WHEN** three Complete changes are archived without failures
- **THEN** a toast reports three archived, the board reloads, and no session is created

#### Scenario: Context switched mid-run

- **WHEN** the user switches project after the first of three archives
- **THEN** no further archive starts and no session or toast appears in the new project

### Requirement: Open one session for archive-all failures

When any archive in an `archive all` run did not succeed, the extension SHALL create one session in
the originating project or worktree and submit one fallback prompt listing each failed change with
its command and raw output. It SHALL create no session when every archive succeeds or is refused.

#### Scenario: One fails

- **WHEN** two of three archives succeed and one fails
- **THEN** one session is created with a prompt naming only the failed change and its CLI output
- **AND** the toast reports two archived and names the session

### Requirement: Document the supported OpenSpec version for archiving

The README SHALL state that archiving from the extension requires OpenSpec 2.0 or later. On an
older CLI, archive output that cannot be decoded SHALL follow the agent hand-off rather than be
reported as archived.

#### Scenario: OpenSpec 1.x

- **WHEN** the CLI does not return the archive result shape
- **THEN** the extension prepares the fallback prompt and reports no archive
