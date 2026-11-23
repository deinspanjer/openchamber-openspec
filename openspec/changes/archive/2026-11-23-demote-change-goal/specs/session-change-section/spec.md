# Spec Delta

## MODIFIED Requirements

### Requirement: Flyouts show detail on demand

Activating an active change's name SHALL open a flyout with the name, stage label, goal when one is
recorded and change actions. An absent or blank goal SHALL leave no goal line. Activating a task
title, in the `Tasks:` line or the expanded list, SHALL open a flyout with that task's full
description. On a phone, flyouts open as the host's bottom sheet. Where the host offers no flyouts,
the same content SHALL expand inline below the activated element.

#### Scenario: Task flyout

- **WHEN** the user activates task 6.2's title
- **THEN** a flyout shows task 6.2's full multi-line description

#### Scenario: Host without flyouts

- **WHEN** the host does not support flyouts and the user activates an active change's name
- **THEN** the name, stage, goal when recorded, actions and `Untrack` expand inline under the name

#### Scenario: Change without a goal

- **WHEN** the user activates the name of an active change whose goal is absent or blank
- **THEN** the flyout shows the name, stage and actions with no goal line
