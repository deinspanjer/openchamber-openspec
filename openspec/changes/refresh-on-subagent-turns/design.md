# Design

## Context

`src/status.ts` already subscribes to project session snapshots through `host.onSessions`. The
upstream OpenChamber guest host sends `onSessionLifecycle` events only for the current chat, so
removing the extension's lifecycle ID check would not expose subagent turns.

## Goals / Non-Goals

Reuse the existing Work Status read path and project subscription. Keep the shown session's
tracking and planning scope. Do not add a host API, service route, or manifest capability.

## Decisions

- Keep `onSessionLifecycle` for the shown session. Compare successive project snapshots for
  subagents. Follow `parentId` to identify direct and nested descendants of the shown session.
  Do not count its siblings or its own record in this comparison.
- Treat a known active state (`running`, `retrying`, `waiting-permission`, or `waiting-question`)
  followed by `idle` as a finished turn, whether it succeeded or failed. `unknown`, initial
  idle records, and missing records do not establish a finished turn. Reset the comparison on
  context switches so old snapshots do not trigger reads in a replacement view.
- Request one `read()` per snapshot with a qualifying transition. Combine with any existing
  selection-triggered read from that snapshot and rely on the existing in-flight queue. Do not
  reload workflows. The child supplies a signal, not a directory or a task count, so do not
  filter by worktree or read the child's checkout.

## Risks / Trade-offs

- A host snapshot can miss a short turn. Verify that the live host publishes active and idle
  states for a real subagent before implementing. If it does not, stop and reconsider the
  trigger rather than adding polling or a watcher.
- A subagent with isolated planning can trigger a read that finds no change. Accept that extra
  read rather than trying to resolve the subagent's planning scope.

## Test seams

- Use the existing fake SDK host in `test/panel.test.mjs` for snapshot sequences and their
  effects on the card and OpenSpec requests. Do not add a test file or helper module.
- Use the running OpenChamber web UI to check real subagent snapshots and the card update. Ask
  before creating any sessions or worktrees for the check. No new CLI fixture is needed.
