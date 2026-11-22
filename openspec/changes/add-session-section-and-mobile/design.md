# Design

## Context

See `proposal.md` for motivation and `specs/` for behaviour. The panel is one IIFE bundle
(`panel/main.js` from `src/panel.ts`); `src/panel/controller.ts` owns context, reads and workflow
actions and builds workflow prompts inline (`actionPrompt`). Reads go through `src/panel/client.ts`
to the host-runtime service (`src/service/http.ts` routes `/changes`, `/summaries`, `/tasks`,
`/document`, `/create`, `/delete`). `/summaries` reads every change; the adapter already has a
per-change `summaryFor` (`src/service/openspec.ts:301`).

Host facts this design relies on (OpenChamber 2.7.3; source references are to the OpenChamber
repository):

- A Work Status section frame receives the chat's open session and the session's directory, and
  stays mounted across session switches; `ready`, `onSession` and `onDirectory` are pushed again
  (`packages/ui/src/components/layout/PluginPane.tsx:218-223, 368, 1141-1143`). Phones show
  sections in the Status tab without opt-in (`packages/ui/src/hooks/useGuestSurfaces.ts:83-96`).
- Session records from `listSessions`/`onSessions` carry this extension's items with their `data`
  and the session's worktree (`packages/ui/src/lib/guests/workspace.ts:111-120`); `startSession`
  items persist in OpenCode session metadata on the server.
- `onSessionLifecycle` reports `completed` when a session goes idle.
- `ready.device` gives `formFactor`, `pointer`, `insets` and `keyboard`, re-sent on change
  (`packages/sdk/src/contract.ts:267-286`).
- `panel.mobile: true` shows the panel as a phone workspace tab, and `page: true` follows it
  (`packages/sdk/src/manifest.ts:1213-1217`, `packages/ui/src/lib/guests/phone.ts:19-23`). Service
  requests are plain `/api/*` calls, which the private relay forwards.
- SDK 1.24.2 (the current pin) defines none of `statusSection`, `panel.mobile` or `device`.

## Goals / Non-Goals

**Goals:**

- One shared implementation of prompts, stage derivation, client and decoders for board and
  section.
- Tracked-change resolution as a pure function, testable at the model seam.

**Non-Goals:**

- Sidebar marks, session events, transcript access or any capability that forces re-approval.
- Selecting the change on the board from `Open board`.
- A host-drawn (`source`) section.
- Upstream OpenChamber changes; the gaps below are reported, not worked around beyond what is
  stated.

## Decisions

### A separate status entry, not the panel page

Declare `contributes.statusSection: { entry: "panel/status.html", title: "OpenSpec",
height: 160, requiresProject: true }`, built from `src/status.ts` to `panel/status.js` by a new
`build:status` script included in `build` and `clean`. A separate entry keeps the section's frame
small and avoids branching the board controller on `ready.surface`. Reusing `panel.entry`
(`statusSection: true`) was rejected: every section frame would load the board's code and DOM.

The section reports height with `setHeight` from a `ResizeObserver`. Refresh is a header control
through `setStatusControls` when `ready.features.statusControls` is present, otherwise a body
button.

### Compact cards (redesign after first live use, 2026-11-21)

The first build (1.3.x) used a large progress bar, a current-task `<details>`, an artefact badge
list and `Open board` / stage / `Change…` buttons. The user found it too tall and asked for the
layout below. Each tracked change is a card:

- Line 1: name (a button opening the change flyout), then `completed/total`.
- A 3px bar. It's the section's own element, not `mountProgress`, which draws a caption and a
  checkmark.
- When tasks exist: a `<details>` whose `<summary>` is `▸ Tasks:` (underlined) and the current
  task's title clamped to one line. The title is its own button opening the task flyout. Expanded,
  it lists the five-task window from `taskWindow` (below). Each row is a read-only checkbox and a
  title button opening that task's flyout.
- Chips: stage chip (`propose` | `apply` | `archive`, from `deriveChange`'s stage; `ready` and
  `progress` both map to `apply`), `sync`, `validate`, `board`, as small `mountButton`s with the
  stage chip in the primary style.
- `＋ Track a change` after the last card opens the inline list (kept from 1.3.1, now excluding
  changes already tracked).

`taskWindow(tasks, size = 5)` is a pure function in `src/model.ts`. It centres on the first
incomplete task (or the last task when all are done) and clamps to the list's ends. The board's
verify action stays on the board only.

**Upstream cause, host-drawn section rejected:** a `source` section's request carries only
`directory` and `locale` (`packages/ui/src/lib/guests/status-view.ts:36`), so it cannot be
session-scoped, and it re-reads on an interval that would run the CLI continuously.

### Resolve the tracked changes with a pure function

Replace `resolveTrackedChange` in `src/model.ts` with:

```ts
type TrackedSource = "saved" | "item" | "worktree" | "none";
resolveTrackedChanges(input: {
  saved: string[] | null; // null = nothing saved for this session
  items: { id: string; data?: unknown }[];
  worktreeName: string | null;
  active: ReadonlySet<string>;
}): { changes: string[]; source: TrackedSource };
```

A non-null `saved` is authoritative. It returns its active members in saved order, with source
`saved`, even when the result is empty. Otherwise it derives at most one change: the first item
whose `data` is `{ kind: "change", change }` with an active `change`; then an item without `data`
whose `id` is an active change name (sessions started by the board before item data existed); then
`worktreeName` if active. Items with `data.kind === "archive-all"` never resolve. Keeping it in
`src/model.ts` uses the existing model test bundle.

### Session context from the host's session list

The section maps its directory to a registered project with the same lookup `inspectWorktreeDestination`
uses (extracted from `src/panel/worktree.ts` into an exported `findProject(host, directory)`), then
holds one `onSessions(projectId)` subscription and picks the record for `ready.session.id`. A
changed record (items or worktree) re-runs resolution and reads only if the resolved change
changed. Directory change releases and replaces the subscription.

### Saved choices in instance storage

Key `session-change:<sessionId>`, value `{ changes: string[], savedAt }`, in `host.storage`
default instance scope, so every device on the same server sees it. A stored value without a
`changes` array (the 1.3.x `{ change }` shape, used on one session) counts as nothing saved; there
is no migration. Track and Untrack write the whole list. The board's `preparePrompt` appends the
change, if absent, after a successful compose when `sessionId` is non-null and the context is still
current. When nothing is saved yet, the first write seeds the list with the session's derived
change, so tracking a second change keeps the first. Failures are swallowed after a console
warning. Before writing, if `keys()` holds 1,900 or more
`session-change:` keys, delete the 100 with the oldest `savedAt` to stay under the 2,000-key limit.

**Upstream cause, `sessionLink` rejected:** it attaches a visible linked item to the session, works
only on the current session, and the SDK has no way to remove it.

### Record items on created sessions

New-worktree Apply's `startSession` adds `data: { kind: "change", change: change.id }`; archive
all adds `data: { kind: "archive-all" }`. Item ids and titles are unchanged, so the existing
duplicate-worktree check (`session.items.some(item => item.id === name)`) keeps working.

### Single-change read route

Add `/summary` to the service: `{ directory, root, planning, change }` → the same summary shape as
one `/summaries` entry, using `summaryFor` with the existing scope and planning-identity checks,
and `client.summary()` with `decodeSummary`. A section read is one `list`, then `summary` and
`tasks` for each shown change, with the changes run in parallel. A failure marks only that card.
Stage comes from `deriveChange` with the listing's counts. The private protocol is internal, so no
compatibility shim.

### Validate route

Add `/validate`: `{ directory, expectedRoot, planning, change }` → runs `openspec validate <change>
--type change --json` inside the same scope and planning checks as `/summary`, and returns
`{ valid: boolean, issues: { level, path, message }[] }` decoded from the CLI's `items[0].valid`
and `items[0].issues`. The JSON was checked on 2.1.0 for a valid change; confirm the issue fields
against an invalid fixture before decoding them. A non-zero
exit with parseable JSON is a result (invalid), not an error. It runs only when `validate` is
activated, never on refresh, and needs no new permission (`exec: ["openspec"]` already covers it).
Decode only the fields shown. Unexpected output fails that request.

The picker orders by listing task counts because exact stage ordering would read every change's status.

### Refresh triggers

Reads happen on mount, session change, directory change, Refresh, and `onSessionLifecycle` with
`phase === "completed"` for the shown session id. One read at a time; a trigger during a read
queues a single follow-up. An epoch, as in the controller, drops responses for a replaced session
or directory. The AGENTS.md board rule stays as is; the section has its own rule in the spec.

### Shared prompts

Move `actionPrompt` and the stage-to-intent mapping from `controller.ts` into
`src/panel/prompts.ts`, unchanged in output. Add `syncPrompt(change)`: "Use your skill tool to load
and invoke the openspec-sync-specs skill for OpenSpec change "<name>"." plus one sentence asking it
to report what it synced, without archiving. The section composes with
`host.compose({ text, mode: "replace" })` and toasts like the board, then appends the change to the
session's tracked list through the same helper.

### Flyouts

Use `host.openPopover` when `ready.features.popovers` is set. The popover loads `panel/status.html`
again with `surface: "popover"` and `ready.popover.data` set to `{ kind: "change", name, stage,
goal }`, `{ kind: "task", id, description }` or `{ kind: "validation", change, result }`. In that
mode `src/status.ts` renders only the flyout card and sizes it with `setHeight`. `Untrack` in a
change flyout writes storage itself (popover frames share the extension's grants), then closes. The
section re-resolves on its next read, or at once when the popover's `onPopoverClosed` fires with
reason `closed`. Anchors use `mountPopoverAnchor` so a tap on a phone opens the bottom sheet.
Without `features.popovers`, the same card renders inline under its anchor as a toggled element.
Data stays under the 16,000-character popover limit; a task description is cut at 4,000 characters
with an ellipsis.

### `Open board`

`host.openSurface("plugin:openspec-board")` opens the rail panel on desktop and the workspace tab
on a phone once the panel opts in. The 2.7.3 host checks the surface ID in
`packages/ui/src/lib/guests/host-bridge.ts:299-304`; extension modes require the `plugin:` prefix
(`packages/ui/src/lib/surfaces/modes.ts:21-30`, tag `v2.7.3`). **Upstream cause:** `openSurface`
takes no target item, so the board would open at its root rather than on the change.

**Focus handoff:** `board` first posts `/focus` `{ directory, change }` to the service, then calls
`openSurface`. The service keeps one pending focus in memory for 30 s and calls
`createServiceHost({ env: process.env }).emit("focus", { directory, change })`. `emit` needs no
capability (`packages/sdk/GUEST_SERVICES.md:204`). A mounted board hears it via
`host.onServiceEvent`. A board that mounts later asks `GET /focus` once after its first listing,
which returns and clears the pending focus. The controller applies a focus only when `directory`
equals its current directory and the change is in its listing, by calling its existing
`openDetail`. It never triggers an extra board load.

### Phone and touch

Set `panel.mobile: true`. Both entries set `data-pointer` on `<html>` from `ready.device.pointer`
(falling back to `matchMedia("(pointer: coarse)")` when `device` is absent) and CSS variables
`--oc-inset-bottom` and `--oc-keyboard` from `device.insets.bottom` and `device.keyboard`. Styles
under `[data-pointer="coarse"]` raise buttons, menu triggers, tabs and search to `min-height:
44px`; the detail footer pads by the inset; open dialogues cap `max-height` at
`calc(100dvh - var(--oc-keyboard) - 32px)` and scroll inside. The controller's automatic focus
targets (`controller.ts:724, 775`) go to the Create button instead of the search field when the
pointer is coarse.

### Test seams

- Model seam (`test/model.test.mjs`): `resolveTrackedChanges` (saved list authoritative incl.
  empty, inactive members dropped, derived fallback, archive-all) and `taskWindow` (centre, both
  ends, fewer than five, all done).
- Redesign additions at the fake host seam: `openPopover` loading the status entry with
  `surface: "popover"` and `ready.popover.data`, `onPopoverClosed`, the `features.popovers` toggle
  for the inline fallback, `onServiceEvent` delivery for focus, and `setHeight` applied to the frame
  with the real 24–480 clamp. Service seam: `/validate` (valid, invalid, bad output) and `/focus`
  (set, read-once, 30 s expiry).
- Fake SDK host seam (`test/panel.test.mjs`): extend the fake host to serve `panel/status.html`,
  push `onSessionLifecycle`, answer `storage`, `setStatusControls`, `setHeight`, `openSurface`,
  `listProjects`/`onSessions`, and include `device` in `ready`. Section and board-saving behaviour
  and coarse-pointer sizing and focus are pinned here.
- Service seam (`test/service.test.mjs`): `/summary` scope checks and output against the real CLI
  on a disposable root.

No new test files or helpers.

## Risks / Trade-offs

- SDK 1.24.2 → 2.7.3 crosses a major version → the upgrade is its own first task, verified by
  `npm run check` before any feature work.
- Insets may already be applied by the host around the frame, doubling padding → verify on a phone
  during the live check and drop the inset padding if the host already applies it.
- Reads after every finished turn cost a few CLI calls → only while the section is expanded and
  only for the shown session; the README's telemetry-off advice reduces CLI latency. With N tracked
  changes a read is 1 + 2N calls; tracking is deliberate, so N stays small.
- Popover frames load the status bundle again per opening → the status bundle stays small (no board
  code), and the inline fallback covers hosts without popovers.
- Storage is per server; a saved choice does not follow a session to another server → acceptable,
  sessions are per server too.
- Older hosts ignore the section and phone opt-in, and `engines.openchamber` cannot express 2.7.1 →
  README states the minimum version for these features.

## Migration Plan

Upgrade the SDK, then land section, board saving and phone support. Build all bundles, reinstall or
update the extension, and disable/enable it to restart the service. No data migration: sessions
created earlier resolve through their legacy items or worktree names. Rollback is reinstalling the
previous version; stored choices are ignored by it and removed on uninstall.

## Upstream gaps to report

Draft for the OpenChamber maintainers after implementation, with the user's approval:
`source` status requests should carry the session id; `openSurface` should accept a target item;
an extension should be able to remove its own item from a session; `engines.openchamber` should
accept current versions; `packages/sdk/API.md:299`, `packages/sdk/DOCUMENTATION.md:91` and
`useWorkStatusExtensionSections.ts:14-15` still say status sections or `startSession` are not on the
phone.
