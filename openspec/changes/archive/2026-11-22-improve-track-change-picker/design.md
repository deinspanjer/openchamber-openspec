# Design

## Context

`src/status.ts` already builds the picker from the Work Status listing and tracked cards. Its
`pickerPriority` orders choices by task progress; its context epoch protects asynchronous reads
from session and project switches. The board's `mountSearchField` in `src/panel/board-view.ts`
establishes the search control and matching rule. The service already resolves the checkout and
canonical planning directory separately in `src/service/openspec.ts`.

## Goals / Non-Goals

Use the last successful listing to open the existing picker immediately. Keep the hint scoped to
this opening and to this checkout. Keep the footer, tracked cards, tracking storage, session
resolution, and existing read triggers unchanged. There is no new agent-facing action.

## Decisions

### Enrich the picker, not the session

Search alone would be the smallest implementation but would not surface a recently edited choice.
Enriching the picker preserves explicit selection without needing session attribution or a saved
hint. Leave the current picker usable without Git. Use uncommitted status rather than a
merge-base diff: no base-ref discovery, network access, or attribution of branch history. A
committed edit no longer gets a hint unless there are further local edits.

### Tie the hint to one opening

- In `src/status.ts` and `panel/status.html`, mount the SDK search field in the existing picker,
  outside the choice list. Search change IDs as the board does. When offered, focus search on
  open; otherwise keep the existing first-choice behavior. Keep search available if a nonempty
  query is already in use when choices change. Reopening clears the query and the hints. Let the
  SDK field consume Escape to clear a nonempty query (`event.defaultPrevented`). Otherwise Escape
  and Cancel close the picker and return focus to the Track button.
- Open using the current listing and launch at most one hint request per open, only if there are
  choices. Add a per-opening token alongside the existing context guard. Accept the result only
  while that opening is live and the latest listing still has the same directory, root, and
  planning identity. If an ordinary read replaces that scope while the picker stays open, clear
  the hints and retire the pending request without starting another one.
- Intersect the returned names with the latest eligible choices. Use a stable sort: hinted first,
  then the existing `pickerPriority`. Keep the search node and query mounted throughout; move or
  update rows without losing focus on a still-visible choice. Indicate the hint with a
  monochrome icon and an accessible description, keeping the change name itself unchanged.
- Only selection calls the existing `appendTrackedChange` and normal refresh path. No storage
  writes from searching, opening or closing, and no Git requests from Refresh, turn completion,
  typing, or loading the section.

### Return only change IDs from a scoped status read

Add `POST /modified-changes` through the existing authenticated service bridge in
`src/service/http.ts`. Take the listing's `directory`, `expectedRoot`, and `expectedPlanning`.
Use the adapter's existing context check in `src/service/openspec.ts`. `src/panel/client.ts`
and `src/contracts.ts` validate the reply (`{ changes: string[] }`, each a valid change ID);
no raw paths or Git output cross the bridge.

Keep Git handling in a focused service module, `src/service/git.ts`. Only scan a real local
`openspec/changes` directory under the resolved root, in the Git worktree containing the
selected directory. Reject linked planning or a linked changes parent for this hint; do not follow
them into another checkout. Use canonical paths and a segment-aware containment check. Resolve
the Git top level from the selected directory so a project nested in a repository can use its
exact repo-relative `openspec/changes` prefix. A non-Git directory or a planning target outside
the checkout has no hints.

Use a shell-free, bounded subprocess call for Git; the existing OpenSpec runner supplies
`--json` and is not a Git runner. From the Git top level, run
`git --no-optional-locks --literal-pathspecs -c core.fsmonitor=false status --porcelain=v1 -z --untracked-files=all --no-renames --ignore-submodules=all -- <repo-relative changes directory>`.
Use the service request deadline and output bounds. Parse NUL-delimited records and take only the
valid first child ID with a path beneath it. No rename pairs to parse: a move shows as removal and
addition. Exclude the archive directory, ignore names outside the exact prefix, and deduplicate.
An unavailable, timed-out, or invalid status read fails only the hint request; the picker keeps
its original order and remains interactive. Declare `git` in `service.permissions.exec` in
`package.json`. The capability names do not change, but OpenChamber includes the executable
list in the approved service scope. A live update of an approved test copy removed its service
grant until approval. Keep the hint and document the required re-approval in the README.

## Risks / Trade-offs

- Several sessions can share a checkout. Each sees the same local hint. The label describes a
  checkout, never who made the edit.
- Git results may arrive after the user starts searching. Keep the input and focus stable and
  apply hints to the filtered list, not the request's older choice order.
- Shared planning and committed edits get no hint. Search and manual tracking cover both without a
  branch comparison or a second repository scan.

## Test seams

- `test/service.test.mjs`: Exercise the service route with a disposable Git checkout and the
  existing fake OpenSpec runner. Pin path mapping and planning isolation; use real Git for
  porcelain behavior, not a second OpenSpec CLI suite.
- `test/panel.test.mjs`: Extend the fake SDK service responder. Pin the open-only request and
  manual-save boundary, search and ordering with an asynchronous hint, and stale-result isolation.
  Check expected visuals and touch behavior in the live host rather than asserting markup.

## Rollback

Revert the picker and private route together and rebuild the bundles. The saved tracking record
has not changed and needs no migration in either direction.
