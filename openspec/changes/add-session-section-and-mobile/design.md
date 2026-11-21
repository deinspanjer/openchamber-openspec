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

Declare `contributes.statusSection: { entry: "panel/status.html", title: "OpenSpec change",
height: 160, requiresProject: true }`, built from `src/status.ts` to `panel/status.js` by a new
`build:status` script included in `build` and `clean`. A separate entry keeps the section's frame
small and avoids branching the board controller on `ready.surface`. Reusing `panel.entry`
(`statusSection: true`) was rejected: every section frame would load the board's code and DOM.

The section uses `@openchamber/sdk/ui` mounts (`mountProgress`, `mountButton`, `mountMenu`,
`mountBadge`) and a native `<details>` for the current task, whose `<summary>` is clamped to one
line with ellipsis. It reports height with `setHeight` from a `ResizeObserver`. Refresh is a header
control through `setStatusControls` when `ready.features.statusControls` is present, otherwise a
body button.

**Upstream cause, host-drawn section rejected:** a `source` section's request carries only
`directory` and `locale` (`packages/ui/src/lib/guests/status-view.ts:36`), so it cannot be
session-scoped, and it re-reads on an interval that would run the CLI continuously.

### Resolve the tracked change with a pure function

Add to `src/model.ts`:

```ts
type TrackedSource = "saved" | "item" | "worktree";
resolveTrackedChange(input: {
  saved: string | null;
  items: { id: string; data?: unknown }[];
  worktreeName: string | null;
  active: ReadonlySet<string>;
}): { change: string; source: TrackedSource } | { change: null; staleSaved: string | null };
```

Order: `saved` if active; then the first item whose `data` is `{ kind: "change", change }` with an
active `change`; then, for sessions created before this change, an item without `data` whose `id`
is an active change name; then `worktreeName` if active. Items with `data.kind === "archive-all"`
never resolve. Keeping it in `src/model.ts` uses the existing model test bundle.

### Session context from the host's session list

The section maps its directory to a registered project with the same lookup `inspectWorktreeDestination`
uses (extracted from `src/panel/worktree.ts` into an exported `findProject(host, directory)`), then
holds one `onSessions(projectId)` subscription and picks the record for `ready.session.id`. A
changed record (items or worktree) re-runs resolution and reads only if the resolved change
changed. Directory change releases and replaces the subscription.

### Saved choices in instance storage

Key `session-change:<sessionId>`, value `{ change, savedAt }`, in `host.storage` default instance
scope, so every device on the same server sees it. The board's `preparePrompt` writes it after a
successful compose when `sessionId` is non-null and the context is still current; failures are
swallowed after a console warning. Before writing, if `keys()` holds 1,900 or more
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
and `client.summary()` with `decodeSummary`. A section read is `list` → `summary` → `tasks` for the
resolved change; stage comes from `deriveChange` with the listing's counts. The private protocol is
internal, so no compatibility shim.

### Refresh triggers

Reads happen on mount, session change, directory change, Refresh, and `onSessionLifecycle` with
`phase === "completed"` for the shown session id. One read at a time; a trigger during a read
queues a single follow-up. An epoch, as in the controller, drops responses for a replaced session
or directory. The AGENTS.md board rule stays as is; the section has its own rule in the spec.

### Shared prompts

Move `actionPrompt` and the stage-to-intent mapping from `controller.ts` into
`src/panel/prompts.ts`, unchanged in output. The section composes with
`host.compose({ text, mode: "replace" })` and toasts like the board, then saves the tracked change
through the same helper.

### `Open board`

`host.openSurface("openspec-board")` opens the rail panel on desktop and the workspace tab on a
phone. **Upstream cause:** `openSurface` takes no target, so the board opens at its root rather
than on the change.

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

- Model seam (`test/model.test.mjs`): `resolveTrackedChange` order, staleness, archive-all, legacy
  items.
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
  only for the shown session; the README's telemetry-off advice reduces CLI latency.
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
