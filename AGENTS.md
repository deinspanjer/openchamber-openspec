# OpenChamber – OpenSpec extension

## Setup and verification

- Use Node 22.13+, npm, and `openspec` on `PATH`. After `npm ci`, install test Chromium with
  `npx playwright install chromium`.
- `npm run check` runs lint → format:check → typecheck → test → build. Lint and typecheck exclude
  the JavaScript tests and Python worktree helper. `npm run format` does not include this file.
- Focused tests read generated bundles: run `npm run build:panel` before
  `node --test test/panel.test.mjs`, `npm run build:service` before
  `node --test test/service.test.mjs`, or `npm run build` before integration or harness tests.
- Contracts and document tests bundle their own source: `node --test test/contracts.test.mjs` or
  `node --test test/document.test.mjs`. Document tests still require Chromium.
- Filter with `node --test --test-name-pattern='pattern' test/panel.test.mjs`, after building the
  required bundle. Do not pass test flags through `npm test`, which chains builds and the test
  runner.
- Pure model test: `npm run build:model:test && node --test test/model.test.mjs`. Resource test:
  `npm run build:resources:test && node --test test/resources.test.mjs`.
- Browser tests use a fake SDK host for deterministic races. Service and integration tests also
  invoke the real CLI against disposable OpenSpec roots, not an installed extension or live project.
- **Setup: worktree** runs `uv run --no-project scripts/setup_worktree.py` (Python 3.12+) and links
  only `node_modules` from the main checkout. Installs affect every linked worktree; use separate
  dependencies when branches differ. Git supplies tracked `openspec/` files; optional sharing of
  uncommitted planning is described in
  [Planning across worktrees](README.md#planning-across-worktrees).

## Runtime boundaries

- `src/panel.ts` and `src/status.ts` apply the SDK theme before showing their content.
  `src/panel/client.ts` uses the SDK service bridge, never direct CLI execution or browser HTTP.
  `src/panel/controller.ts` owns the board's context, selection, read scheduling, and workflow
  actions. `src/panel/resources.ts` retains reads by directory, root, planning target, and change.
- Current-chat workflow actions prepare unsent drafts except **archive**, which writes through the
  service. **Run in new worktree** sends its prompt through the SDK. Confirmed **archive all**
  writes through the service and starts a recovery session only for failures.
- Views own mounted DOM and SDK UI handles. Dispose their handles; theme changes and ordinary
  refreshes must not replace the search or detail shells and lose focus, caret, or scroll position.
- `src/contracts.ts` validates the private protocol; `src/model.ts` derives stages. `src/service.ts`
  starts the host-managed service. `src/service/http.ts` owns authentication and request bounds;
  `src/service/openspec.ts` owns scoped CLI translation and safe paths; `src/service/cli.ts` runs
  processes.
- `/validate` runs only for the Work Status **validate** chip. It uses the selected change's root
  and planning identity. The focus handoff stores one target for 30 seconds. The `focus` service
  event signals that a target is pending; only a matching directory can claim it with `GET /focus`.
- `/workflows` reads the global profile via `openspec config list --json`, without planning scope.
  The section falls back to core workflows if the read fails.
- `/pending-archives` compares local archives with the checkout's base ref. Unavailable Git,
  unsupported archived listings and shared planning fall back to active changes only.
- The extension manifest is `package.json`'s `openchamber` field. `service/package.json` only keeps
  the generated service CommonJS inside this ESM repository.
- `panel/main.js`, `panel/status.js`, and `service/main.js` are generated installable bundles.
  Rebuild all three after private-protocol changes; installation does not build them.
  `npm run clean` removes these bundles, not the ignored `build/` test outputs.

## Behaviour constraints

- Load the board only on initial/context loads, explicit Refresh, after the panel's own create,
  delete or archive, and once when a claimed focus names an unlisted change. Do not add polling,
  visibility revalidation, TTL, or board-wide document prefetch.
- Read configured workflows on the board's initial/context loads and explicit Refresh. Reuse the
  result for other board reloads.
- Read Archived, the Specs list, and each spec on first open in a context. Refresh invalidates all
  browse reads and reloads only the visible browse content. A hidden view reads on its next open.
  A claimed archive focus can re-read Archived once if the focused row is missing.
- Load the Work Status section on mount, session or project changes, explicit Refresh, and after the
  shown session or any of its direct or nested subagents finishes an observed turn. Re-read after
  tracking changes or the section's own archive. Read one listing and the summary and tasks for
  each tracked active change only, in the shown session's planning context. Check pending archives
  only when a tracked name is missing from the active listing or the picker has no archive result.
  Keep unchanged card controls mounted across reads. Do not poll, refresh on visibility changes,
  or read board-wide summaries.
- Read configured workflows on mount, project change, and footer Refresh. Reuse the result for
  session switches in the same directory and finished turns.
- Retained reads do not authorise writes or recovery. Reconcile uncertain writes with a fresh
  listing in the original context; do not retry the mutation automatically.
- Deletion checks the active parent and target after its final CLI context check. These checks and
  removal are not atomic; do not claim protection against every filesystem race.

## Live-host checks

- For a live check, follow [Test a worktree on the live host](README.md#test-a-worktree-on-the-live-host).
  Deploy from the worktree, not the Git-installed checkout. Switch installs in **Settings >
  Extensions** and confirm **OpenSpec (dev)** is **Enabled** before testing. Restore the Git install
  and leave dev disabled. Reloading the iframe does not restart the service.
- The OpenChamber browser tool cannot inspect the extension iframe. Use Playwright in its own
  browser against the running host, for example `uv run --with playwright python <script>`.
- Ask the user before a check creates real sessions or worktrees.

## Releasing

- Start from a clean, committed release branch with locked dependencies and a CLI version tested in
  `README.md`. Release forward rather than backfilling tags or Releases.
- Ask before tagging, pushing, or creating a GitHub Release. After tag approval, use
  `npm version patch` (or `minor` / `major`; `prerelease --preid=alpha` for alphas). Keep lifecycle
  hooks enabled and avoid `--force`: they run the checks and stage rebuilt bundles into npm's
  version commit. Run `npm run check:version` against the published `origin/main` before shipping.
  Keep that release check separate from `npm run check` so source-only changes can pass verification.
- Inspect `git show --stat HEAD` and `git status --short`; confirm `vX.Y.Z` points to the version
  commit.
- Label merged PRs using `.github/release.yml`. Write `highlights.md` outside the checkout with what
  is new, what comes next, and the roadmap issue link.
- After push approval: `git push --atomic origin HEAD vX.Y.Z`. After Release approval:
  `gh release create vX.Y.Z --verify-tag --generate-notes --notes-file /path/to/highlights.md`. Add
  `--prerelease` for alpha/beta builds and review the published notes.
