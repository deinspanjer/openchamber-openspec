# Upgrade the OpenChamber SDK

## Why

The board needs the OpenChamber 2.x SDK before it can use the host's phone and Work Status surfaces.

## What changes

- Pin SDK 2.7.3 and declare OpenChamber 2.7.1 as the minimum host.
- Keep the existing board's control sizes and wait for fake-host messages to reach the board before asserting their effects.
- Retain upstream's OpenSpec 1.x and 2.x CLI fixture support and exact task-text checks.

This change separates the SDK and test prerequisites from the archived `add-session-section-and-mobile` and `support-openspec-2-and-repair-dev-tooling` changes.
