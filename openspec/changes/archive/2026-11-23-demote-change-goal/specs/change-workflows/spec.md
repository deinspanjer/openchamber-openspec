# Spec Delta

## REMOVED Requirements

### Requirement: Propose completes the existing scaffold

**Reason**: It asked agents to establish and record a goal, which no OpenSpec workflow reads.
**Migration**: Replaced by "Propose finishes the existing scaffold", which keeps the existing-change
guidance without goal maintenance.

### Requirement: Explore the goal from a Planning change card

**Reason**: It centred exploration on the goal and asked agents to clarify a missing one.
**Migration**: Replaced by "Explore from a Planning change card", which explores the change's purpose
and mentions a goal only when one is recorded.

## ADDED Requirements

### Requirement: Propose finishes the existing scaffold

The `propose` prompt SHALL name the existing change, include its recorded goal when present and
explicitly call `openspec-propose` to finish planning it. It SHALL ask the agent to inspect status,
preserve existing decisions and complete missing artefacts using OpenSpec's artefact instructions,
and SHALL NOT ask it to establish, record or preserve a goal. It SHALL prohibit creating another
change or implementing code, and ask the agent to explain any conflict with new-change creation.

#### Scenario: Propose an empty or partially planned change

- **WHEN** the user chooses `propose` for an empty scaffold or one with an existing proposal
- **THEN** the prepared prompt contains explicit existing-change guidance, preserves existing
  decisions and asks for missing artefacts rather than a new change
- **AND** the extension itself neither writes planning artefacts nor starts implementation

#### Scenario: Propose a change without a recorded goal

- **WHEN** the user chooses `propose` for a change whose goal is absent or blank
- **THEN** the prompt has no `Goal:` line and no instruction about goals
- **AND** composing the prompt does not write metadata

#### Scenario: Propose a change with a recorded goal

- **WHEN** the user chooses `propose` for a change with a recorded goal
- **THEN** the prompt includes `Goal:` followed by that goal's text, including line breaks

### Requirement: Explore from a Planning change card

Every available Planning change card SHALL offer a compact secondary `explore` action beside its
Planning primary action; other stages SHALL NOT. The prompt SHALL name the change, include the
recorded goal when present and explicitly call `openspec-explore` to investigate the change's
purpose, relevant code, options and trade-offs. It SHALL request discussion without file changes or
implementation, and SHALL NOT mention a goal when none is recorded.

#### Scenario: Explore a change with a recorded goal

- **WHEN** the user chooses `explore` on a Planning card whose change records a goal
- **THEN** an exploration prompt for that change, including its goal, is prepared
- **AND** the stage, task counts and artefact counts remain unchanged

#### Scenario: State changes after rendering

- **WHEN** a Planning card becomes Ready, In Progress or Complete before its old action dispatches
- **THEN** the stale Explore action SHALL NOT compose a prompt

#### Scenario: Explore a change without a recorded goal

- **WHEN** the user explores a change whose goal is absent or blank
- **THEN** the prompt names the change and has no `Goal:` line and no instruction about goals
- **AND** Explore continues to request discussion without file changes

## MODIFIED Requirements

### Requirement: Create a change scaffold from the board

The board SHALL offer `new change` when an OpenSpec context is resolved. It SHALL open a dialogue
asking only for a change name. Names SHALL be lowercase letters or digits separated by single
hyphens; invalid input SHALL be reported in the dialogue without a request. Creation SHALL make only
the named scaffold, without goal metadata, in the originating context. Success SHALL close the
dialogue and reload the originating board. A draft or attempt from one context SHALL NOT be
submitted in a different context.

#### Scenario: Create a valid change

- **WHEN** the user submits a valid name in the unchanged originating context
- **THEN** one scaffold without a goal is created, the dialogue closes and the board reloads

#### Scenario: Reject invalid input

- **WHEN** the name is not hyphen-separated lowercase letters or digits
- **THEN** the dialogue shows the error and no creation request occurs
