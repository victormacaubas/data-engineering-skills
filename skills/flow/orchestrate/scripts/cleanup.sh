#!/usr/bin/env bash
# Remove one orchestrate run folder: .orchestrate/<slug>/ under the current directory.
# Run from the repo root after the user confirms. Never touches anything outside .orchestrate/.
set -euo pipefail

usage() { echo "usage: cleanup.sh <slug>" >&2; exit 2; }

[[ $# -eq 1 ]] || usage
slug="$1"

if [[ -z "$slug" || "$slug" == "." || "$slug" == ".." || "$slug" == *"/"* || "$slug" == .* ]]; then
  echo "cleanup.sh: refusing slug '$slug' (empty, dot-prefixed, or contains '/')" >&2
  exit 2
fi

root=".orchestrate"
target="$root/$slug"

if [[ -L "$root" || -L "$target" ]]; then
  echo "cleanup.sh: refusing to follow a symlink at $target" >&2
  exit 1
fi

if [[ ! -d "$target" ]]; then
  echo "cleanup.sh: nothing to remove at $target"
  exit 0
fi

rm -rf -- "$target"
echo "removed $target"

# Drop the folder itself once no run is left in it (only its own .gitignore remains).
remaining=$(find "$root" -mindepth 1 -maxdepth 1 ! -name .gitignore -print -quit)
if [[ -z "$remaining" ]]; then
  rm -f -- "$root/.gitignore"
  rmdir -- "$root"
  echo "removed $root"
fi
