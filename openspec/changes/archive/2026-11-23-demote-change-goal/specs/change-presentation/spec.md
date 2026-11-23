# Spec Delta

## ADDED Requirements

### Requirement: Detail shows a goal only when one is recorded

Detail SHALL show a change's goal below the name and affected-area badges only when its metadata
records a non-blank goal, as plain text. When the goal is absent or blank, detail SHALL show no goal
text, placeholder or empty space, and no focusable goal region. Moving between changes in an open
detail SHALL NOT keep a previous change's goal.

#### Scenario: Change without a goal

- **WHEN** a user opens detail for a change whose metadata has no goal, or only whitespace
- **THEN** no goal region or placeholder text appears and the header leaves no gap for it

#### Scenario: Change with a goal

- **WHEN** a user opens detail for a change that records a goal
- **THEN** the goal appears below the name and badges with its text and line breaks preserved

#### Scenario: Switch from a change with a goal to one without

- **WHEN** detail shows a change with a goal and the user opens a change without one
- **THEN** the previous goal is no longer shown
