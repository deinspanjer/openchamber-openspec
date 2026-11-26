# Spec Delta

## MODIFIED Requirements

### Requirement: Refresh on context, request and finished turns

The section SHALL read when it loads, when the session or project changes, when the user activates
the footer's Refresh, and when the shown session or any of its direct or nested subagents
finishes an observed turn. Each read SHALL cover the shown session's planning context: the
listing and, for each shown active change, its planning status and tasks, never every change's
summary. A read SHALL check for archives that have not landed only when a tracked name is missing
from the active listing. The section SHALL NOT poll or refresh on visibility changes.

#### Scenario: Initial host signals arrive together

- **WHEN** mount-time context and lifecycle signals arrive together
- **THEN** the section runs one read

#### Scenario: Turn finishes

- **WHEN** the shown session's turn completes after the agent checked off a task
- **THEN** the section re-reads once and shows the new count without user action

#### Scenario: A subagent finishes a turn while the shown session keeps working

- **WHEN** a direct or nested subagent checks off a tracked task in the shown session's planning
  context and finishes its turn
- **THEN** the section shows the new count without waiting for the shown session's turn to end
- **AND** it does not re-read the configured workflows

#### Scenario: A subagent takes several turns

- **WHEN** a subagent checks off another tracked task on a later turn and returns to idle
- **THEN** the section refreshes again, even if the subagent failed after checking off the task

#### Scenario: A subagent is idle or paused rather than finishing a turn

- **WHEN** a subagent is first seen idle or pauses for a retry, permission, or an answer
- **THEN** the section does not refresh on that signal

#### Scenario: A subagent works in a separate worktree

- **WHEN** a subagent finishes a turn after checking off tasks in a worktree with separate
  planning
- **THEN** the section does not show the isolated progress
- **AND** if those edits later land in the shown session's checkout, the next refresh shows them

#### Scenario: A subagent works in a worktree with shared planning

- **WHEN** a subagent in another worktree checks off a tracked task in planning shared with the
  shown session and finishes its turn
- **THEN** the section shows the new count without a merge

#### Scenario: Another session's turn finishes

- **WHEN** a session that is neither the shown session nor one of its descendants finishes a turn
- **THEN** the section does not read

#### Scenario: Every tracked change is active

- **WHEN** every tracked name is in the active listing
- **THEN** the read does not check archived changes or Git

#### Scenario: The session archives its change

- **WHEN** the shown session's turn archives tracked change `add-login`
- **THEN** the finished-turn read shows `add-login` as archived and not landed, without user action
