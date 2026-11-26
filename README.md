# OpenSpec for OpenChamber

A kanban board for the OpenSpec changes in your OpenChamber project or worktree. See each change's
stage, artefacts and task progress in one place, create or delete changes, and kick start the next
workflow step.

![OpenSpec board grouping changes by stage, with task progress and workflow actions.](docs/images/board-view.jpg)
![OpenSpec change detail showing the selected Specs tab and its specification.](docs/images/change-view.jpg)

This extension is simply another way to use OpenSpec, without adding planning features or
conventions of its own. OpenSpec's own CLI and skills remain the core.

Contributions that keep this extension in step with OpenSpec or take advantage of it's additional
features are welcome.

## Get started

1. Install the [OpenSpec CLI](https://openspec.dev/docs/installation) on the OpenChamber server
   (tested with 1.13.1 and 2.1.0).
2. Run `openspec config profile`. Keep the core workflows, add **verify**, and choose skills
   delivery.
3. In your project, run `openspec init --tools opencode`.
4. In OpenChamber, open **Settings > Extensions** and add
   `https://github.com/jaythomasonprojects/openchamber-openspec.git`. Its service runs `openspec`
   with your user access, and the `sessions` permission lets it start sessions for worktree Apply
   and bulk archiving. If you trust that, choose **Allow and enable**.
5. Open the **OpenSpec** rail panel, or find it under **Extension pages**.

The board's help button opens the OpenSpec quickstart. For ~ x2 faster loads, run
`openspec config set telemetry.enabled false`, since telemetry can slow down every CLI call.

## Planning across worktrees

Commit your `openspec/` directory and worktrees pick up changes through Git like any other file.
**Run in new worktree** starts from your project's default base, so commit the change there first.

Optionally, to share uncommitted planning between worktrees, use your project's setup hook to link
each worktree's `openspec/` to the main checkout's. The board follows the link but does not create
or repair it.

## Develop

Requires Node 22.13+, npm and the OpenSpec CLI. Run `npm ci`, `npx playwright install chromium`,
then `npm run check`. OpenChamber does not build extensions on install. Use `npm run build` to
rebuild the release package. Before shipping, run `npm run check:version` to check that changes to
shipped files or the extension manifest have a new version.

GitHub Actions runs the suite natively on Windows and macOS with Node 24 and OpenSpec 2.1.0. Linux
verification remains local. Docker is not required for the suite. Each job runs the full suite
against the npm installation, then checks the standalone executable with the focused installed-CLI
test. The selected command and installation type are checked so one installation cannot hide a
broken launch of the other.

Validate workflow changes on a separate testing branch: temporarily add that exact branch to the
push filter in `.github/workflows/verify.yml`, push, and inspect results with `gh run list`,
`gh run watch` and `gh run view --log-failed`. Repeat until both platforms pass the candidate
revision. Restore only the `dev`/`main` push and pull-request targets before merging into `dev`,
then check its resulting run. The temporary branch rule is not part of the permanent workflow.

### Test a worktree on the live host

Use **OpenSpec (dev)** to test without changing the Git-installed extension. If the dev extension is
already installed, disable it before deploying. From the worktree you want to test, with its
dependencies installed, run:

```bash
npm run dev:deploy
```

The command builds the current worktree, including uncommitted edits, into
`~/.local/share/openchamber-openspec-dev` and prints the absolute path.

1. For the first test, open **Settings > Extensions > Add extension**. Add the printed folder path
   on the OpenChamber server. Review the permissions for **OpenSpec (dev)** and approve the
   extension if you trust the build.
2. Disable the Git-installed **OpenSpec** and enable **OpenSpec (dev)**. Open the project or
   worktree you want to test in OpenChamber. Deployment selects the extension code, not the project
   it displays.
3. When you finish, disable **OpenSpec (dev)** and re-enable the Git install.

To test another worktree, deploy from that worktree while dev is disabled. The same Settings entry
works for each build. Enabling dev starts a fresh service. Reloading its iframe does not.
