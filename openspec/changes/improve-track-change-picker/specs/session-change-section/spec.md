# Spec Delta

## MODIFIED Requirements

### Requirement: Track and untrack changes

`＋ Track a change` SHALL list active changes that are not already tracked and add only the chosen
change to the session's saved list. Choices with a local Git hint SHALL appear first, with each
group in task-progress order. `Untrack`, in a change's name flyout, SHALL remove it. Saved lists
SHALL persist for that session across devices on the same server. A new chat without a session
SHALL disable tracking and explain that a session is required.

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

## ADDED Requirements

### Requirement: Filter the tracking picker by change name

When the picker has more than one eligible choice before filtering, it SHALL offer a
`Search changes` field. Filtering SHALL match a case-insensitive substring of the change name
after trimming surrounding whitespace, without changing relative order. An open picker SHALL
retain its query across ordinary updates. Reopening SHALL start with an empty query.

#### Scenario: Refine a search that has no matches

- **WHEN** the user enters a query that excludes all choices
- **THEN** the picker distinguishes no matches from no untracked changes
- **AND** the search field stays available so the user can refine or clear the query

### Requirement: Show local Git hints only in the tracking picker

The picker SHALL open without waiting for Git. Only opening the picker SHALL trigger a Git status
read, and only for local OpenSpec planning in the current checkout with eligible choices. A choice
with staged, unstaged, or non-ignored untracked files SHALL have an icon labelled
`Modified in this checkout`. Git hints SHALL NOT alter the session's tracked list.

#### Scenario: Edited choices rise to the top

- **WHEN** the user opens the picker and Git reports edits under one eligible change and a new
  file under another
- **THEN** both choices move ahead of choices with no reported edits and show the hint
- **AND** no change is tracked until the user selects it

#### Scenario: Git status is unavailable or inapplicable

- **WHEN** Git cannot report status for local planning, or the planning target is shared or
  external to the checkout
- **THEN** the picker offers the same choices in task-progress order without Git hints
- **AND** search and selection remain available

#### Scenario: The picker closes or switches context before Git returns

- **WHEN** the picker closes or the session, project, or planning target changes before the result
  arrives
- **THEN** the late result does not affect a reopened picker or a different context
