#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SKILLS_SRC="$REPO_DIR/skills"
TARGET_DIR="${CURSOR_SKILLS_DIR:-$HOME/.cursor/skills}"

SKILL_SELECTION="all"
COPY_MODE=false
valid_skills=()
selected_skills=()

usage() {
  cat <<EOF
Usage: $0 [options]

Fallback installer for Cursor CLI environments where team policy blocks
third-party plugin imports.

Options:
  --skills all|name[,name...]
      Install every release-ready skill or a selected subset. Defaults to all.

  --copy
      Copy skill directories instead of creating symlinks.

  -h, --help
      Show this help text.

Target override:
  CURSOR_SKILLS_DIR   Defaults to \$HOME/.cursor/skills
EOF
}

strip_spaces() {
  local value="$1"
  value="${value//[[:space:]]/}"
  printf '%s\n' "$value"
}

name_in_list() {
  local needle="$1"
  shift
  local item

  for item in "$@"; do
    if [ "$item" = "$needle" ]; then
      return 0
    fi
  done

  return 1
}

discover_skills() {
  local skill_dir

  valid_skills=()
  for skill_dir in "$SKILLS_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    [ -f "$skill_dir/SKILL.md" ] || continue
    valid_skills+=("$(basename "$skill_dir")")
  done
}

parse_skill_selection() {
  local selection
  local item
  local old_ifs
  local invalid=()

  selection="$(strip_spaces "$SKILL_SELECTION")"
  if [ -z "$selection" ]; then
    echo "--skills requires all or a comma-separated list of skill names" >&2
    exit 1
  fi

  if [ "$selection" = "all" ]; then
    selected_skills=("${valid_skills[@]}")
    return
  fi

  if [[ "$selection" == *, || "$selection" == ,* || "$selection" == *,,* ]]; then
    echo "Invalid --skills value: $SKILL_SELECTION" >&2
    exit 1
  fi

  old_ifs="$IFS"
  IFS=','
  read -r -a selected_skills <<< "$selection"
  IFS="$old_ifs"

  for item in "${selected_skills[@]}"; do
    if [ -z "$item" ] || ! name_in_list "$item" "${valid_skills[@]}"; then
      invalid+=("$item")
    fi
  done

  if [ "${#invalid[@]}" -gt 0 ]; then
    echo "Unknown skill(s): ${invalid[*]}" >&2
    echo "Available skills: ${valid_skills[*]:-(none)}" >&2
    exit 1
  fi
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
  local timestamp
  local backup_path
  local suffix=1

  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup_path="${target_path}.bak.${timestamp}"
  while [ -e "$backup_path" ] || [ -L "$backup_path" ]; do
    backup_path="${target_path}.bak.${timestamp}.${suffix}"
    suffix=$((suffix + 1))
  done

  mv "$target_path" "$backup_path"
  echo "  [BACKUP] $skill_name -> $backup_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skills=*)
      SKILL_SELECTION="${1#--skills=}"
      shift
      ;;
    --skills)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--skills requires all or a comma-separated list of skill names" >&2
        usage >&2
        exit 1
      fi
      SKILL_SELECTION="$2"
      shift 2
      ;;
    --copy)
      COPY_MODE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

discover_skills
parse_skill_selection

echo "Installing Cursor CLI skills (team-policy fallback)"
echo "  Source: $SKILLS_SRC"
echo "  Target: $TARGET_DIR"
echo "  Mode:   $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
echo "  Skills: $SKILL_SELECTION"
echo ""

if [ "${#selected_skills[@]}" -eq 0 ]; then
  echo "No release-ready skills found in $SKILLS_SRC."
  exit 0
fi

mkdir -p "$TARGET_DIR"
installed=0

for skill_name in "${selected_skills[@]}"; do
  skill_dir="$SKILLS_SRC/$skill_name"
  target_path="$TARGET_DIR/$skill_name"

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
    cp -R "$skill_dir" "$target_path"
    echo "  [COPY] $skill_name -> $target_path"
  else
    ln -s "$skill_dir" "$target_path"
    echo "  [LINK] $skill_name -> $target_path"
  fi

  installed=$((installed + 1))
done

echo ""
echo "$installed Cursor CLI skill(s) installed to $TARGET_DIR"
