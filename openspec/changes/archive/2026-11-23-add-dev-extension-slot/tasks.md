# Tasks

## 1. Build and deploy

- [x] 1.1 Use the package's panel ID in the browser builds for board navigation and session
  launches. Keep the release build targets and manifest unchanged. Build the release and run
  `node --test test/panel.test.mjs` to verify the existing board and session behavior.
- [x] 1.2 Add `npm run dev:deploy` to build the current worktree's dev package and update the
  fixed local folder. Run the command and inspect the dev manifest and runtime files at the
  reported destination. Confirm the normal worktree outputs and the Git install are untouched.
- [x] 1.3 Document the folder install, deployment, and switch-back steps in `README.md`. Point
  `AGENTS.md` live-host checks at the dev install. Follow the documented build command and
  confirm it reports the folder that the instructions say to register.

## 2. Verify on the host

- [x] 2.1 Run `npm run check` and the updated `AGENTS.md` live-host check. Register and approve
  dev once. Confirm a redeploy uses the same folder without another install or approval.
  Disable the Git install, enable dev, and open its board from Work Status. Confirm the board
  lists the selected project's changes. Disable dev and re-enable the Git install. Confirm
  it opens normally with its existing state. Do not create sessions or worktrees for this check.
