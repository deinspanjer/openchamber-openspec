# Spec Delta

## MODIFIED Requirements

### Requirement: Keep every operation inside the resolved planning scope

Listing, detail metadata, artefact discovery, document reads, CLI task reads, and change creation
SHALL work through valid shared planning. The service SHALL validate the active changes directory
and named change against the resolved planning boundary. CLI-returned paths SHALL be validated after
consistent lexical and canonical resolution. A change target SHALL be a real named child of the
authorised active changes directory, not a linked escape or another active or archived change.
Documents and goal metadata SHALL remain inside that selected change. Task input paths SHALL be
validated before the CLI reads them. Bounded reads, CLI-authoritative task counts and first-line
descriptions, and scaffold-only creation SHALL apply through shared planning as they do locally.

#### Scenario: Browse shared change content

- **WHEN** the user opens a shared change with proposal, multiple specs, design, goal metadata, and
  tasks
- **THEN** details, document selectors, content, and CLI task descriptions resolve correctly through
  the link
- **AND** no full-source task parser or unbounded document read is introduced

#### Scenario: Create in shared planning

- **WHEN** the user creates a valid named change through a stable shared-planning context
- **THEN** one scaffold is created in the shared active changes directory
- **AND** the extension does not replace the link or create a second planning directory in the
  worktree

#### Scenario: Reject unsafe nested targets

- **WHEN** the changes parent or named change is an unsafe link, a CLI path names a different change
  or archive, or a document, metadata file, or task input escapes its selected change
- **THEN** the affected operation reports an error without reading the escaped content or mutating
  its target
