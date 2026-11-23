# Tasks

## 1. Service archive route

- [x] 1.1 Seam `test/service.test.mjs`, real CLI on a disposable root. Add failing tests first:
      an unsynced Complete change archives with its ADDED requirement in the main spec
      (`outcome: "archived"`), and a change synced exactly as written archives with no spec
      change. Then implement `archiveChange` in `src/service/openspec.ts`, the `/archive` branch in
      `src/service/http.ts` (with `mutationDispatched` for `archive`) and `decodeArchiveResult` in
      `src/contracts.ts`, as design.md describes. Verify with `npm run build` and
      `node --test --test-name-pattern='archive' test/service.test.mjs`.
- [x] 1.2 Seam `test/service.test.mjs`, real CLI. Add failing tests first: a reworded synced ADDED
      requirement returns `outcome: "failed"` whose `output` holds the CLI JSON with
      `archive_spec_update_failed`, and the change stays active. A change with an unchecked task
      returns `CHANGE_INCOMPLETE` and stays active. `skipSpecs` archives and leaves the main spec
      byte-identical. Implement until they pass, using the same verification command.
- [x] 1.3 Seam `test/service.test.mjs`, fake runner. Add failing tests first: a CLI timeout and
      non-JSON output after the archive call both decode as `failed` with the command and error
      text, and the HTTP response is 200. The timeout fixture must use the subprocess budget to
      exercise the reserved shutdown margin. Implement until they pass.

## 2. Fallback prompt and Work Status chip

- [x] 2.1 Replace the archive branch of `actionPrompt` with `archiveFallbackPrompt` in
      `src/panel/prompts.ts`, using the text in design.md. Add `archive` to `src/panel/client.ts`.
      Verify with `npm run typecheck`.
- [x] 2.2 Seam `test/panel.test.mjs`, fake SDK host with a fake `/archive` route. Add failing
      tests first: Work Status `archive` on a Complete card sends one `/archive` request, shows
      `Archived <change>.`, re-reads the section once and leaves the composer untouched. A
      repeated click while pending sends no second request. A `failed` result composes the
      fallback prompt naming `openspec-archive-change`, the command and the output. A
      `CHANGE_INCOMPLETE` error shows an error toast and composes nothing. Then wire the chip in
      `src/status.ts`. Verify with `npm run build` and
      `node --test --test-name-pattern='archive' test/panel.test.mjs`.
- [x] 2.3 Seam `test/panel.test.mjs`. Add a failing test first: a session switch while `/archive`
      is pending yields no toast, composition or read in the new session. Implement until it
      passes.

## 3. Board archive and split button

- [x] 3.1 Seam `test/panel.test.mjs`. Add failing tests first: board card `archive` sends
      `/archive`, then reloads the board once on success, or composes the fallback prompt on
      failure. The board detail of a Complete change shows `archive` plus a menu trigger named
      "More archive actions" whose `archive without sync` item sends `skipSpecs: true`. Detail
      for other stages is unchanged. A failed `archive without sync` shows the reason without
      composing. Implement in `src/panel/controller.ts`,
      `src/panel/primary-action.ts`, `src/panel/detail-view.ts` and the panel CSS. Verify with the
      panel test command from 2.2.
- [x] 3.2 Seam `test/panel.test.mjs`. Add failing tests first for archive all: three successes
      reload the board once, toast `Archived 3 of 3 changes.` and start no session. A run with one
      failure starts one session whose prompt names only the failed change and its output. A
      project switch after the first archive starts no further archive, session or toast. Update
      the confirmation text in `src/panel/archive-dialog.ts`. Delete `src/panel/archive-prompt.ts`
      and the obsolete bulk-prompt tests. Implement until the tests pass.

## 4. Docs

- [x] 4.1 Update README (OpenSpec 2.0 minimum for archiving, new archive and archive all
      behaviour) and AGENTS.md (archive exception to draft-only actions, archive-all failure
      session, reload triggers after the panel's or section's own archive), as design.md
      describes. Verify by reading both against the specs in this change.

## 5. Verification

- [x] 5.1 Run `npm run check` and confirm it passes. Report any test not run, and state that
      Firefox and WebKit are not verified.
- [x] 5.2 Live-host check per AGENTS.md "Live-host checks": `npm run dev:deploy`, enable
      **OpenSpec (dev)**, then archive a throwaway Complete change from Work Status and another
      with `archive without sync` from the board detail, and confirm the toasts and the archived
      folders. Restore the Git install and leave dev disabled afterwards.
