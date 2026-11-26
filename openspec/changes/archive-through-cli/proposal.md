# Proposal

## Why

Archiving a completed change takes several agent turns that rarely change the outcome. **archive**
prepares a prompt for `openspec-archive-change`, and the skill stops to ask whether to sync specs
first. **archive all** starts a session whose bulk skill asks for a selection and then a
confirmation. `openspec archive <name> --yes --json` already syncs and archives in one step. It
checks the archive destination before writing specs, archives an already-synced change cleanly,
and returns an error code for anything it refuses. An agent is needed only when that command
does not archive cleanly.

## What Changes

- **archive** in Work Status, on board cards and in the board detail runs the CLI archive through
  the extension service. It syncs specs and archives in one step, with no prompt and no agent turn.
  Success shows a toast and re-reads the surface.
- When the CLI does not archive cleanly, the extension puts an unsent fallback prompt in the open
  composer. The prompt carries the command and its raw output and asks the agent to load
  `openspec-archive-change`, fix the cause and archive. This covers failures,
  unparseable output and timeouts.
- Before running the CLI, the service refuses a change that is no longer listed or whose tasks are
  incomplete. `--yes` would otherwise skip the CLI's own task check. A refusal shows an error toast
  and prepares no prompt.
- The board detail's Complete action becomes a split button: `archive` beside a down-arrow menu
  that offers `archive without sync`, which archives with `--skip-specs`.
- **archive all** archives each available Complete change through the same path, one at a time,
  after the existing confirmation. It starts a session only when some archives failed, with one
  fallback prompt listing every failure. When every archive succeeds, it starts no session.
- **BREAKING** for users on OpenSpec 1.x: direct archive needs OpenSpec 2.0 or later. On an older
  CLI every archive falls through to the fallback prompt.
- **BREAKING** for users with **bulk-archive** configured: **archive all** no longer uses
  `openspec-bulk-archive-change` and its codebase-driven conflict resolution. When two changes
  touch one capability, the CLI applies them in archive order. If the later delta no longer
  applies, its archive fails and goes to the failure session.

## Capabilities

### New Capabilities

- `change-archiving`: archiving changes through the OpenSpec CLI from Work Status and the board,
  the skip-sync variant, bulk archive and the agent fallback for archives that do not succeed.

### Modified Capabilities

- `change-workflows`: archive no longer prepares a skill prompt; **archive all** no longer launches
  a bulk-archive session for every run. Composition rules gain the archive exception, and the bulk
  archive launch and prompt requirements are removed in favour of `change-archiving`.
- `session-change-section`: the `archive` chip archives directly instead of composing, and the
  section re-reads after its own archive.

## Impact

- Service: a new private archive route in `src/service/http.ts` and an archive operation in
  `src/service/openspec.ts`. `src/contracts.ts` decodes the result, and `src/panel/client.ts`
  calls it.
- Panel: `src/status.ts` (Work Status chip), `src/panel/controller.ts` (single archive and archive
  all), `src/panel/primary-action.ts` and `src/panel/detail-view.ts` (split button),
  `src/panel/archive-dialog.ts` (dialogue text), `src/panel/prompts.ts` and
  `src/panel/archive-prompt.ts` (fallback prompts replace the archive and bulk prompts).
- Docs: README states the OpenSpec 2.0 minimum for archiving. In AGENTS.md, workflow actions still
  prepare drafts, except **archive**, which writes through the service.
- No manifest change: `exec: openspec`, `prompt` and `sessions` are already granted, so users do
  not re-approve permissions.

## Recorded choices

- Older CLIs: state a minimum version. The README requires OpenSpec 2.0 for archiving, the same
  version as **Archived**. 2.0.0 and 2.1.0 return the archive JSON this change decodes; 1.x was not
  checked. No other fallback beyond the general fallback prompt.
- `archive without sync` lives in the board detail of a Complete change, in a split button's menu.
  Work Status and board cards keep a single `archive` button.
- **archive all** failures open one new session; success opens none.
- Archive reserves time for CLI shutdown. An unknown result is not reported as a confirmed
  failure or success. The explicit `archive without sync` variant reports failures without
  composing a prompt.
- Test seams: existing files only (see design.md).
- Bulk-archive users lose the skill's conflict resolution, and no mitigation is added. Conflicts
  surface as CLI failures and go to the agent.
