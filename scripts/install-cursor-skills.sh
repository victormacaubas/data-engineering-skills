#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SKILLS_SRC="$REPO_DIR/skills"
TARGET_DIR="${CURSOR_SKILLS_DIR:-$HOME/.cursor/skills}"

NON_GROUP_DIRS=("in-progress" "deprecated")

SKILL_SELECTION="all"
SKILLS_FLAG_SEEN=false
GROUP_SELECTION=""
COPY_MODE=false
valid_skills=()
valid_groups=()
skill_groups=()
selected_skills=()

usage() {
  cat <<EOF
Usage: $0 [options]

Fallback installer for Cursor CLI environments where team policy blocks
third-party plugin imports.

Skills live at skills/<group>/<name>/. This installer flattens them into the
target directory, so a fallback skill is invoked unprefixed (structure-review)
rather than namespaced (craft:structure-review) as it would be when installed
from the marketplace plugin.

Options:
  --skills all|name[,name...]
      Install every release-ready skill or a selected subset, by bare skill
      name. Defaults to all. Mutually exclusive with --group.

  --group name[,name...]
      Install every skill in the named group(s). Mutually exclusive with an
      explicit --skills list.

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

group_of() {
  local needle="$1"
  local i

  for i in "${!valid_skills[@]}"; do
    if [ "${valid_skills[$i]}" = "$needle" ]; then
      printf '%s\n' "${skill_groups[$i]}"
      return 0
    fi
  done

  return 1
}

discover_skills() {
  local group_dir
  local skill_dir
  local group_name
  local skill_name

  valid_skills=()
  valid_groups=()
  skill_groups=()

  for group_dir in "$SKILLS_SRC"/*/; do
    [ -d "$group_dir" ] || continue
    group_name="$(basename "$group_dir")"

    if name_in_list "$group_name" "${NON_GROUP_DIRS[@]}"; then
      continue
    fi

    for skill_dir in "$group_dir"*/; do
      [ -d "$skill_dir" ] || continue
      [ -f "$skill_dir/SKILL.md" ] || continue
      skill_name="$(basename "$skill_dir")"

      if name_in_list "$skill_name" "${valid_skills[@]:-}"; then
        echo "Duplicate skill name across groups: $skill_name" >&2
        echo "Skill names must be unique because the target directory is flat." >&2
        exit 1
      fi

      valid_skills+=("$skill_name")
      skill_groups+=("$group_name")

      if ! name_in_list "$group_name" "${valid_groups[@]:-}"; then
        valid_groups+=("$group_name")
      fi
    done
  done
}

parse_group_selection() {
  local selection
  local item
  local i
  local old_ifs
  local groups=()
  local invalid=()

  selection="$(strip_spaces "$GROUP_SELECTION")"
  if [ -z "$selection" ]; then
    echo "--group requires a comma-separated list of group names" >&2
    exit 1
  fi

  if [[ "$selection" == *, || "$selection" == ,* || "$selection" == *,,* ]]; then
    echo "Invalid --group value: $GROUP_SELECTION" >&2
    exit 1
  fi

  old_ifs="$IFS"
  IFS=','
  read -r -a groups <<< "$selection"
  IFS="$old_ifs"

  for item in "${groups[@]}"; do
    if [ -z "$item" ] || ! name_in_list "$item" "${valid_groups[@]:-}"; then
      invalid+=("$item")
    fi
  done

  if [ "${#invalid[@]}" -gt 0 ]; then
    echo "Unknown group(s): ${invalid[*]}" >&2
    echo "Available groups: ${valid_groups[*]:-(none)}" >&2
    exit 1
  fi

  selected_skills=()
  for i in "${!valid_skills[@]}"; do
    if name_in_list "${skill_groups[$i]}" "${groups[@]}"; then
      selected_skills+=("${valid_skills[$i]}")
    fi
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
    if [ -z "$item" ] || ! name_in_list "$item" "${valid_skills[@]:-}"; then
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
      SKILLS_FLAG_SEEN=true
      shift
      ;;
    --skills)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--skills requires all or a comma-separated list of skill names" >&2
        usage >&2
        exit 1
      fi
      SKILL_SELECTION="$2"
      SKILLS_FLAG_SEEN=true
      shift 2
      ;;
    --group=*)
      GROUP_SELECTION="${1#--group=}"
      shift
      ;;
    --group)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--group requires a comma-separated list of group names" >&2
        usage >&2
        exit 1
      fi
      GROUP_SELECTION="$2"
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

if [ -n "$GROUP_SELECTION" ] && [ "$SKILLS_FLAG_SEEN" = true ]; then
  echo "--group and --skills are mutually exclusive" >&2
  usage >&2
  exit 1
fi

discover_skills

if [ -n "$GROUP_SELECTION" ]; then
  parse_group_selection
  selection_label="group(s) $GROUP_SELECTION"
else
  parse_skill_selection
  selection_label="$SKILL_SELECTION"
fi

echo "Installing Cursor CLI skills (team-policy fallback)"
echo "  Source: $SKILLS_SRC/<group>/<name>"
echo "  Target: $TARGET_DIR (flat, unprefixed)"
echo "  Mode:   $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
echo "  Skills: $selection_label"
echo ""

if [ "${#selected_skills[@]}" -eq 0 ]; then
  echo "No release-ready skills found in $SKILLS_SRC."
  exit 0
fi

mkdir -p "$TARGET_DIR"
installed=0

for skill_name in "${selected_skills[@]}"; do
  skill_group="$(group_of "$skill_name")"
  skill_dir="$SKILLS_SRC/$skill_group/$skill_name"
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
    echo "  [COPY] $skill_group/$skill_name -> $target_path"
  else
    ln -s "$skill_dir" "$target_path"
    echo "  [LINK] $skill_group/$skill_name -> $target_path"
  fi

  installed=$((installed + 1))
done

echo ""
echo "$installed Cursor CLI skill(s) installed to $TARGET_DIR"
