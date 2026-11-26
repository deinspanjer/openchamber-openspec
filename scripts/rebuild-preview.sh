#!/usr/bin/env bash
# Rebuild the personal preview branch: upstream/main plus every unlanded feature branch,
# versioned <upstream version>-dre.<N> so a Git install from #preview sees each build as an update.
#
#   bash scripts/rebuild-preview.sh              merge, check, commit and push
#   bash scripts/rebuild-preview.sh --continue DIR   resume in DIR after fixing a stop
#
# Independent branches overlap (for example package.json scripts, and the panel-ID declaration
# both direct-archive and dev-process add), so a merge or `npm run check` can stop. The script
# then leaves its worktree in place: resolve, commit the merge (rerere records it for next time),
# finish any remaining merges by hand, and run --continue. Drop a branch once upstream lands it.
set -euo pipefail

BRANCHES=(
  origin/upstream/direct-archive
  origin/upstream/dev-process
  origin/upstream/cli-telemetry-opt-out
)

self=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
common=$(git rev-parse --path-format=absolute --git-common-dir)
git config rerere.enabled true
git config rerere.autoUpdate true

if [[ ${1:-} == --continue ]]; then
  work=$2
  cd "$work"
else
  gtimeout -k 5s 60s git fetch --prune upstream
  gtimeout -k 5s 60s git fetch --prune origin
  work=$(mktemp -d "${TMPDIR:-/tmp}/openspec-preview.XXXXXX")
  git worktree add --detach "$work" upstream/main >/dev/null
  cp "$self" "$work/.rebuild-preview.sh"
  cd "$work"
  for branch in "${BRANCHES[@]}"; do
    if ! git merge --no-edit --no-ff "$branch" -m "Merge $branch into preview"; then
      if [[ -z $(git diff --name-only --diff-filter=U) ]]; then
        git commit --no-edit
      else
        echo "Stopped merging $branch in $work. Resolve, commit, merge the rest, then:" >&2
        echo "  bash $self --continue $work" >&2
        exit 1
      fi
    fi
  done
fi

base_version=$(git show upstream/main:package.json | node -pe 'JSON.parse(require("fs").readFileSync(0)).version')
previous=$(git show origin/preview:package.json 2>/dev/null | node -pe 'JSON.parse(require("fs").readFileSync(0)).version' 2>/dev/null || true)
n=1
if [[ $previous =~ ^${base_version//./\\.}-dre\.([0-9]+)$ ]]; then n=$((BASH_REMATCH[1] + 1)); fi
version="$base_version-dre.$n"

node -e '
const fs = require("fs");
for (const file of ["package.json", "package-lock.json"]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = process.argv[1];
  if (data.packages?.[""]) data.packages[""].version = process.argv[1];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}' "$version"

npm ci --no-audit --no-fund
if ! npm run check; then
  echo "npm run check failed in $work. Fix and commit, then: bash $self --continue $work" >&2
  exit 1
fi
mkdir -p scripts
[[ -f .rebuild-preview.sh ]] && mv .rebuild-preview.sh scripts/rebuild-preview.sh
git add package.json package-lock.json panel/main.js panel/status.js service/main.js scripts/rebuild-preview.sh
git commit -m "chore: build preview $version

Personal preview of upstream/main plus unlanded feature branches, rebuilt by
scripts/rebuild-preview.sh.

$(printf -- '- %s\n' "${BRANCHES[@]}")"
gtimeout -k 5s 60s git push --force-with-lease=preview origin HEAD:refs/heads/preview
echo "Pushed preview $version at $(git rev-parse --short HEAD)"
cd /
git -C "$(dirname "$common")" worktree remove --force "$work"
