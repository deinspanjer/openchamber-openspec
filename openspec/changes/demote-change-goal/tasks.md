# Tasks

## 1. One definition of a recorded goal

- [x] 1.1 In `src/contracts.ts` `decodeSummary`, return `goal: null` for an empty or whitespace-only
      string, and still reject non-string, non-null values. Verify with
      `npm run build:model:test && node --test test/contracts.test.mjs`, where the existing
      goal-decoding tests pass unchanged.

## 2. Detail shows the goal only when recorded

- [x] 2.1 In `src/panel/detail-view.ts`, replace the `Goal unavailable` fallback: each update sets
      `goal.hidden = !state.change.goal` and `goal.textContent = state.change.goal ?? ""`. Check
      that no rule in `panel/index.html` overrides `[hidden]` on `.goal`. Verify that the existing
      detail-header, long-goal, literal-goal and focus tests in `test/panel.test.mjs` still pass
      (`npm run build && node --test --test-name-pattern='goal|detail header' test/panel.test.mjs`).

## 3. Remove the goal from creation

- [x] 3.1 Service: in `src/service/openspec.ts` `createChange`, drop the `goal` parameter and the
      `BAD_GOAL` check, and run `["new", "change", name]`. In `src/service/http.ts`, stop reading
      `goal` for `/create`. Drop the `goal` keys from `/create` bodies in `test/service.test.mjs`.
      Verify with `npm run build && node --test test/service.test.mjs`.
- [x] 3.2 Panel: remove the Goal field, its state, its validation and its disposal from
      `src/panel/create-dialog.ts`. Change `client.create` in `src/panel/client.ts` to
      `(scope, name)`. In `test/panel.test.mjs`, delete the `Goal` fills and value assertions.
      Make the fake `/create` handler store `goal: null`, and give its known-error reply a code
      other than `BAD_GOAL`. Verify with
      `npm run build && node --test --test-name-pattern='creat|draft|retry|scope' test/panel.test.mjs`.

## 4. Prompts drop goal maintenance

- [x] 4.1 Reword the Explore, Propose, ff and continue prompts in `src/panel/prompts.ts` as
      design.md specifies, and keep the `Goal:` line when a goal is recorded. Update the existing
      propose and explore tests in `test/panel.test.mjs` as design.md "Test seams" describes, and
      rename the propose test to match what it still checks. Update the creation and propose step
      in `test/integration.test.mjs` to fill no Goal and expect no `Goal:` line. Verify that
      `node --test --test-name-pattern='propose|explore|ff|continue' test/panel.test.mjs` and
      `node --test test/integration.test.mjs` pass after `npm run build`.
- [x] 4.2 In `openspec/specs/change-workflows/spec.md`, edit the Purpose so it no longer says
      "goal-aware prompts". Verify with `openspec validate demote-change-goal --strict`.

## 5. Release and verify

- [x] 5.1 Bump the extension version (patch) in `package.json` and `package-lock.json`, then run
      `npm run check` and confirm it passes, including the extension-version check.
- [x] 5.2 Live-host check from AGENTS.md: after `npm run build`, disable and then re-enable the
      extension, and confirm it is Enabled. Using Playwright against `http://127.0.0.1:57123`, open
      detail for a change without a goal: confirm it shows no goal text, no `Goal unavailable` and
      no gap. Open detail for a change with a goal: confirm the goal shows. Open New change: confirm
      it shows only Change name. Cancel the dialogue without creating anything, unless the user
      approves creating a real change.

## Workflow follow-up

- Archive `track-pending-archived-changes` before this change. Both modify "Flyouts show detail on
  demand" in `session-change-section`, and this delta is written on top of that change's wording.
  If that change's wording moves again before archive, rebase this delta on it.
