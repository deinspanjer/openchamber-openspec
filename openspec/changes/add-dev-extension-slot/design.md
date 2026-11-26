# Design

## Context

The OpenChamber SDK uses `contributes.panel.id` as the extension identity. Its documented
`HostReadyContext` does not expose the running extension's ID. The board passes the release ID
explicitly when it launches a session. Builds that contribute Work Status also need the ID for
navigation back to the board.

## Goals / Non-Goals

**Goals:** Register the dev install once. A developer can build from any prepared worktree
and test the result without writing to the Git-installed checkout or changing either
install's permissions.

**Non-Goals:** Automatic worktree watching, changes to OpenChamber's installer, and shared
storage between installs. The worktree supplies the build, not the OpenSpec project
context. Select the project to test in the host as usual.

## Decisions

- **Build into one reusable folder.** `npm run dev:deploy` uses the calling worktree,
  including uncommitted source edits. It builds the bundles for the dev package
  and includes the worktree's runtime HTML, assets, and service package metadata. The
  command builds the package before updating the slot, reports the source worktree and
  destination, and leaves the worktree's normal bundle outputs alone. Use a fixed,
  documented folder under the developer's home, outside OpenChamber's managed Git install
  directory. Update only the tool's dev package, not an unrelated existing directory.
- **Do not install the worktree directly.** The worktree's manifest has the release ID.
  A generated dev package inside each worktree would fix the ID but still require
  replacing the registered folder on each switch. OpenChamber resolves folder installs
  with `realpath` and stores the resolved path, so installing a symlink would not provide
  a pointer that can be changed later. Replacing an install at a new path clears its
  grants and disabled state. A fixed folder keeps registration stable and needs only
  the runtime package, not a copy of the checkout.
- **Pass the package's ID to the browser builds.** Use the same build options for both
  variants and derive the esbuild define from the manifest being built. Keep the checked-in
  manifest at `openspec-board`. Generate the dev manifest with `openspec-board-dev` and
  **OpenSpec (dev)** for the panel name and Work Status title, if present. Use the build ID
  for both `startSession` calls in `src/panel/controller.ts`. The same build defines the
  surface ID when the manifest contributes Work Status. The service requires no ID change.

## Risks / Trade-offs

- A mistaken release ID changes the host's lookup and storage namespace. Keep the release
  manifest unchanged and run the existing panel tests for release board navigation and
  session launch.
- Both installs can be enabled and show duplicate OpenSpec surfaces. Switch them in
  **Settings > Extensions**, with the dev install disabled between tests. Restart the
  dev service by disabling and enabling the install, not by reloading its iframe.

## Test seams

Keep the existing fake-host panel tests for release behavior. Add no automated test file
or helper. Use the normal live-host check to confirm the folder can be registered once,
redeployed, and switched on and off. Opening the board from dev Work Status and reading
the selected project's changes exercises dev identity and service routing without creating
a session or worktree.

## Migration Plan

Build the slot, install it as a folder, approve it separately, and leave it disabled
outside tests. To switch worktrees, redeploy from the next worktree while dev is disabled.
To restore normal use, disable dev and enable the existing Git install. No reinstall,
preference migration, or cleanup of the Git package is needed.
