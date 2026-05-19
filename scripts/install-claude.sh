#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SKILLS_SRC="$REPO_DIR/skills"
TARGET_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
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
  local skill_name="$2"
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
  echo "  [BACKUP] $skill_name → $backup_path"
}

for arg in "$@"; do
  case "$arg" in
    --copy) COPY_MODE=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

echo "Installing skills for Claude Code"
echo "  Source:  $SKILLS_SRC"
echo "  Target:  $TARGET_DIR"
echo "  Mode:    $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
echo ""

mkdir -p "$TARGET_DIR"

installed=0
skipped=0

for skill_dir in "$SKILLS_SRC"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"

  if [ ! -f "$skill_dir/SKILL.md" ]; then
    echo "  [SKIP] $skill_name — no SKILL.md found"
    skipped=$((skipped + 1))
    continue
  fi

  target_path="$TARGET_DIR/$skill_name"

  # If target exists and is a symlink pointing into this repo, update in place
  if [ -L "$target_path" ]; then
    if is_repo_symlink "$target_path"; then
      rm "$target_path"
    else
      backup_existing_path "$target_path" "$skill_name"
    fi
  elif [ -e "$target_path" ]; then
    backup_existing_path "$target_path" "$skill_name"
  fi

  if [ "$COPY_MODE" = true ]; then
    cp -r "$skill_dir" "$target_path"
    echo "  [COPY]   $skill_name → $target_path"
  else
    ln -s "${skill_dir%/}" "$target_path"
    echo "  [LINK]   $skill_name → $target_path"
  fi

  installed=$((installed + 1))
done

echo ""
if [ "$installed" -eq 0 ] && [ "$skipped" -eq 0 ]; then
  echo "No skills found in $SKILLS_SRC."
  echo "Add a skill by creating skills/<name>/SKILL.md, then re-run this script."
  exit 0
fi

echo "$installed skill(s) installed to $TARGET_DIR"
if [ "$skipped" -gt 0 ]; then
  echo "$skipped skill(s) skipped (missing SKILL.md)"
fi
