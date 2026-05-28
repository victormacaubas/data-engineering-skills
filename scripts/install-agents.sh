#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
AGENTS_SRC="$REPO_DIR/agents"
TARGET_DIR="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"
COPY_MODE=false

usage() {
  echo "Usage: $0 [--copy]"
}

resolve_link_target() {
  local link_path="$1"
  local link_target
  local link_dir
  local target_dir
  local target_base

  link_target="$(readlink "$link_path")"
  if [[ "$link_target" != /* ]]; then
    link_dir="$(cd "$(dirname "$link_path")" && pwd -P)"
    link_target="$link_dir/$link_target"
  fi

  target_dir="$(dirname "$link_target")"
  target_base="$(basename "$link_target")"
  if [ -d "$target_dir" ]; then
    target_dir="$(cd "$target_dir" && pwd -P)"
    link_target="$target_dir/$target_base"
  fi

  printf '%s\n' "$link_target"
}

is_repo_symlink() {
  local link_path="$1"
  local link_target

  link_target="$(resolve_link_target "$link_path")"
  [[ "$link_target" == "$REPO_DIR" || "$link_target" == "$REPO_DIR"/* ]]
}

backup_existing_path() {
  local target_path="$1"
  local agent_name="$2"
  local ts
  local backup_path
  local suffix=1

  ts="$(date +%Y%m%d-%H%M%S)"
  backup_path="${target_path}.bak.${ts}"
  while [ -e "$backup_path" ] || [ -L "$backup_path" ]; do
    backup_path="${target_path}.bak.${ts}.${suffix}"
    suffix=$((suffix + 1))
  done

  mv "$target_path" "$backup_path"
  echo "  [BACKUP] $agent_name → $backup_path"
}

for arg in "$@"; do
  case "$arg" in
    --copy) COPY_MODE=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

echo "Installing custom agents for Claude Code"
echo "  Source:  $AGENTS_SRC"
echo "  Target:  $TARGET_DIR"
echo "  Mode:    $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
echo ""

mkdir -p "$TARGET_DIR"

installed=0

for agent_file in "$AGENTS_SRC"/*.md; do
  # No glob match — no .md files found
  [ -e "$agent_file" ] || continue

  agent_name="$(basename "$agent_file")"

  # Exclude README.md
  [ "$agent_name" = "README.md" ] && continue

  target_path="$TARGET_DIR/$agent_name"

  # If target exists and is a symlink pointing into this repo, update in place
  if [ -L "$target_path" ]; then
    if is_repo_symlink "$target_path"; then
      rm "$target_path"
    else
      backup_existing_path "$target_path" "$agent_name"
    fi
  elif [ -e "$target_path" ]; then
    backup_existing_path "$target_path" "$agent_name"
  fi

  if [ "$COPY_MODE" = true ]; then
    cp "$agent_file" "$target_path"
    echo "  [COPY]   $agent_name → $target_path"
  else
    ln -s "$agent_file" "$target_path"
    echo "  [LINK]   $agent_name → $target_path"
  fi

  installed=$((installed + 1))
done

echo ""
if [ "$installed" -eq 0 ]; then
  echo "No agents found in $AGENTS_SRC."
  echo "Add an agent by creating agents/<name>.md, then re-run this script."
  exit 0
fi

echo "$installed agent(s) installed to $TARGET_DIR"
