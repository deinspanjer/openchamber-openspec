# Spec Delta

## ADDED Requirements

### Requirement: Current-chat composition saves the session's tracked change

When a current-chat workflow action composes a prompt and the chat has a session, the extension
SHALL save that change as the session's tracked change, replacing any earlier choice. It SHALL save
only after composition succeeds in a still-current context. A fresh-chat draft without a session
SHALL save nothing. Saving SHALL NOT send, link items visibly on the session, or change OpenSpec
files, and a save failure SHALL NOT undo or fail the composition.

#### Scenario: Prepare apply in an existing session

- **WHEN** the user prepares apply for `add-login` in the current chat of session S
- **THEN** the composer holds the unsent Apply prompt and S's tracked change is `add-login`

#### Scenario: Prepare in a fresh chat

- **WHEN** the user prepares a workflow while the chat has no session
- **THEN** the prompt is composed and no tracked change is saved

#### Scenario: Composition fails

- **WHEN** the host rejects composition
- **THEN** no tracked change is saved

### Requirement: New-worktree Apply records its change on the created session

New-worktree Apply SHALL record the change it applies on the session it creates, so that the
session resolves that change as its tracked change without a saved choice. Bulk archive sessions
SHALL be recorded so that they never resolve as a change.

#### Scenario: Apply in a new worktree

- **WHEN** new-worktree Apply creates session S for `add-login`
- **THEN** S resolves `add-login` as its tracked change

#### Scenario: Archive all

- **WHEN** archive all creates session S
- **THEN** S does not resolve any change from its recorded item
