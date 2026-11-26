# Spec Delta

## MODIFIED Requirements

### Requirement: Use OpenSpec workflow vocabulary consistently

Cards and detail SHALL label the Planning primary action by the configured workflows (`ff`,
`continue` or `propose`), both ready and in-progress implementation actions `apply`, and the
completed primary action `archive`. The separate secondary completed action SHALL be `verify`,
available independently of archive and shown only when the verify workflow is configured. Board
stage headings and detail badges SHALL use Planning, Ready, In Progress and Complete. The board's
manual reload action SHALL be labelled `refresh`. These are presentations of existing CLI-derived
progress, not new persisted states. Standard artefact labels SHALL remain Proposal, Specs, Design
and Tasks; custom artefact identifiers SHALL remain supported.

#### Scenario: Match actions across board and detail

- **WHEN** the core set is configured and a user views a change in each of the four stages and opens
  its detail
- **THEN** the primary labels match on both surfaces; Planning, Ready and In Progress call
  `openspec-propose`, `openspec-apply-change` and `openspec-apply-change` respectively, and
  Complete archives through the OpenSpec CLI
- **AND** Complete offers no `verify`

#### Scenario: Verify configured

- **WHEN** the verify workflow is configured and a user views a Complete change
- **THEN** card and detail expose secondary `verify` calling `openspec-verify-change` independently
  of `archive`

### Requirement: Workflow composition stays unsent and context-bound

Current-chat workflow actions SHALL prepare editable, unsent prompts and SHALL replace the open
composer's text, including a fresh-chat draft with no session ID. Prompts SHALL name the change and
relevant skill without directory or root paths. Apply SHALL direct completion of pending tasks and
reporting of verification and blockers; Verify SHALL compare implementation with planning artefacts
and report gaps without archiving. `archive` and `archive without sync` follow the change-archiving
requirements and are the only per-change actions that change OpenSpec files. Among per-change
actions, only explicit new-worktree Apply SHALL create a worktree and session and send the Apply
prompt as its first message through the SDK. Unavailable changes SHALL have disabled workflow
actions. Obsolete actions SHALL be rejected before dispatch. Unrelated project, planning-target, or
session replacement SHALL discard late feedback without replaying composition. New-worktree prompt
submission SHALL target only the created session, even if the originating panel is closed.
Keeping the panel open is optional.

#### Scenario: Compose without changing workflow state

- **WHEN** a current-chat workflow action other than archive replaces an existing composer draft
  or a fresh-chat draft
- **THEN** its named skill and relevant guidance are present, filesystem paths are absent, and no
  send or session-creation request occurs
- **AND** no card moves or tasks are marked complete merely from composition

#### Scenario: Context replacement or composition failure

- **WHEN** the host rejects composition or an unrelated context replaces its destination while
  composition is pending
- **THEN** a failure is shown only in the still-current relevant context and no action is replayed
  into the replacement context

#### Scenario: Run in the created worktree session

- **WHEN** the user explicitly selects new-worktree Apply and the host creates its session
- **THEN** the ordinary local Apply prompt is sent only in that session as its first message
- **AND** the prompt contains no planning-root path, copying instruction, or special
  external-planning workflow

### Requirement: Confirm bulk archiving from the board

The board SHALL offer `archive all` beside `new change`, using a native secondary button, an archive
icon and the same small control size. It SHALL target completed changes across the board,
independently of search filtering. The action SHALL be disabled without a resolved OpenSpec context,
while the board is loading, when no available Complete change is known, or while a run is
pending. Activation SHALL open an accessible confirmation dialogue explaining that it archives each
completed change with the OpenSpec CLI, syncing specs first, skips unfinished changes, and opens a
session only to fix archives that fail. Controls SHALL be labelled `cancel` and `start archiving`.
Cancellation, including Escape, SHALL archive nothing and create no session.

#### Scenario: Confirm or cancel

- **WHEN** the user activates `archive all`
- **THEN** the dialogue opens without archiving anything or creating a session
- **AND** only `start archiving` authorises the run; `cancel` or Escape dismisses it without
  effects

#### Scenario: Filtered or empty board

- **WHEN** search hides a completed change
- **THEN** search does not narrow the bulk operation
- **AND** a board without any available Complete change has a disabled `archive all` action

### Requirement: Workflow prompts explicitly request skill invocation

Every generated workflow prompt SHALL use ordinary prose to ask the agent to load and invoke the
appropriate named OpenSpec skill through its skill tool before performing that workflow. Generated
workflow instructions SHALL use bare skill names rather than slash commands or dollar-prefixed
mentions, without relying on host skill injection. User-supplied goal text SHALL remain unchanged.
Existing workflow guidance, change identity, destinations and approval boundaries SHALL remain
unchanged. The extension SHALL request skill invocation, not claim that a skill was loaded.

#### Scenario: Prepare a per-change workflow

- **WHEN** a user prepares Explore, Propose, Fast-forward, Continue, Apply or Verify in the
  current chat
- **THEN** the editable, unsent prompt explicitly requests loading and invoking `openspec-explore`,
  `openspec-propose`, `openspec-ff-change`, `openspec-continue-change`, `openspec-apply-change` or
  `openspec-verify-change` respectively through the agent's skill tool
- **AND** the generated workflow instruction uses neither a slash command nor a dollar mention
- **AND** the existing change-specific guidance and recorded goal or progress remain present

#### Scenario: Apply in a new worktree

- **WHEN** a user explicitly chooses new-worktree Apply
- **THEN** the submitted first message contains the same ordinary Apply prompt used for current-chat
  preparation, including the explicit request to invoke `openspec-apply-change`
- **AND** skill invocation does not depend on composer processing

#### Scenario: Archive completed changes in bulk

- **WHEN** an archive-all run leaves failures
- **THEN** the fallback prompt explicitly requests loading and invoking `openspec-archive-change`
  through the agent's skill tool

### Requirement: New-worktree Apply records its change on the created session

New-worktree Apply SHALL record the change it applies on the session it creates, so that the
session shows that change as tracked without a saved list. Sessions created for archive-all
failures SHALL be recorded so that they never resolve as a change.

#### Scenario: Apply in a new worktree

- **WHEN** new-worktree Apply creates session S for `add-login`
- **THEN** S shows `add-login` as tracked

#### Scenario: Archive all

- **WHEN** archive all creates session S for its failures
- **THEN** S does not resolve any change from its recorded item

## REMOVED Requirements

### Requirement: Launch one context-bound archive session

**Reason**: Archive all now archives through the CLI and creates a session only for failures.
**Migration**: See "Archive all completed changes directly" in `change-archiving`. The partial and
uncertain launch reporting requirement still applies to the failure session.

### Requirement: Bulk archive prompts exclude unfinished changes

**Reason**: The service refuses unfinished changes before archiving, and no bulk prompt is sent.
**Migration**: See "Refuse changes that are not ready to archive" and "Archive all completed
changes directly" in `change-archiving`.
