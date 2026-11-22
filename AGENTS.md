# OpenChamber – OpenSpec extension

## Setup and verification

- Use Node 22.13+, npm, and `openspec` on `PATH`. After `npm ci`, install test Chromium with
  `npx playwright install chromium`.
- `npm run check` runs lint → format:check → typecheck → test → build. Use `npm run format` to
  format. Lint and typecheck cover `src`, not the JavaScript tests or Python worktree helper.
- Focused browser or service test: `npm run build`, then `node --test test/panel.test.mjs`
  (substitute `document`, `service`, or `integration`). Filter with
  `node --test --test-name-pattern='pattern' test/panel.test.mjs`; do not pass flags through
  `npm test`.
- Pure model test: `npm run build:model:test && node --test test/model.test.mjs`. Resource test:
  `npm run build:resources:test && node --test test/resources.test.mjs`.
- Browser tests use a fake SDK host for deterministic races. Service and integration tests also
  invoke the real CLI against disposable OpenSpec roots, not an installed extension or live project.
- VS Code's **Setup: worktree** runs `uv run --no-project scripts/setup_worktree.py` (Python 3.12+).
  It links `node_modules` from the main checkout and refuses conflicting destinations or tracked
  paths. Git checks out the tracked `openspec/` files in each worktree. To share uncommitted planning
  through a project setup hook, see [Planning across worktrees](README.md#planning-across-worktrees).
  Installs affect every linked worktree; keep separate dependencies when branches differ.

## Runtime boundaries

- `src/panel.ts` and `src/status.ts` apply the SDK theme before showing their content.
  `src/panel/client.ts` uses the SDK service bridge, never direct CLI execution or browser HTTP.
  `src/panel/controller.ts` owns the board's context, selection, read scheduling, and workflow
  actions. `src/panel/resources.ts` retains reads by directory, root, planning target, and change.
- Current-chat workflow actions prepare unsent drafts. **Run in new worktree** and confirmed
  **archive all** create sessions and submit their prompts through the SDK.
- Views own mounted DOM and SDK UI handles. Dispose their handles; theme changes and ordinary
  refreshes must not replace the search or detail shells and lose focus, caret, or scroll position.
- `src/contracts.ts` validates the private protocol; `src/model.ts` derives stages. `src/service.ts`
  starts the host-managed service. `src/service/http.ts` owns authentication and request bounds;
  `src/service/openspec.ts` owns scoped CLI translation and safe paths; `src/service/cli.ts` runs
  processes.
- The extension manifest is `package.json`'s `openchamber` field, not `service/package.json`. The
  latter keeps generated `service/main.js` CommonJS inside this ESM repository.
- `panel/main.js` and `panel/status.js` are generated ES2022 browser IIFEs. `service/main.js` is
  the generated Node 22 CJS bundle. Rebuild all three after private-protocol changes. Installation
  does not build them. To activate changes, reinstall or update the extension and restart its
  service as below. `npm run clean` removes only these three bundles, not `build/`.

## Behaviour constraints

- Load the board only on initial/context loads, explicit Refresh, and after the panel's own create
  or delete. Do not add polling, visibility revalidation, TTL, or board-wide document prefetch.
- Load the Work Status section on mount, session or project changes, explicit Refresh, and after
  the shown session finishes a turn. Read the listing and only the tracked change's summary and
  tasks. Do not poll, refresh on visibility changes, or read board-wide summaries.
- Retained reads do not authorise writes or recovery. Reconcile uncertain writes with a fresh
  listing in the original context; do not retry the mutation automatically.
- Deletion checks the active parent and target after its final CLI context check. These checks and
  removal are not atomic; do not claim protection against every filesystem race.

## Live-host checks

- After `npm run build`, use the OpenChamber browser tool in **Settings > Extensions** to
  **Disable** then **Enable** the OpenSpec extension; confirm it is **Enabled**. Reloading the
  iframe does not restart the service.
- Check behaviour inside the extension with Playwright in its own browser:
  `uv run --with playwright python <script>` against the running OpenChamber web UI
  (`http://127.0.0.1:57123` on this machine). The OpenChamber browser tool cannot see inside the
  extension iframe.
- Ask the user before a check creates real sessions or worktrees.
- Git-URL installs update only when `package.json` `version` increases. OpenChamber compares semver,
  not commits, so bump the version (`npm version <x.y.z> --no-git-tag-version`) in any release
  users should receive.
