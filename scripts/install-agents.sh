#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
AGENTS_SRC="$REPO_DIR/agents"
TARGET_DIR="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"
COPY_MODE=false
AGENT_SELECTION="all"

valid_agents=()
selected_agents=()

usage() {
  echo "Usage: $0 [--copy] [--agents all|none|name[,name...]]"
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

discover_agents() {
  local agent_file
  local agent_name

  valid_agents=()

  for agent_file in "$AGENTS_SRC"/*.md; do
    [ -e "$agent_file" ] || continue
    agent_name="$(basename "$agent_file")"
    [ "$agent_name" = "README.md" ] && continue
    valid_agents+=("${agent_name%.md}")
  done
}

parse_agent_selection() {
  local selection
  local item
  local invalid=()
  local old_ifs

  selection="$(strip_spaces "$AGENT_SELECTION")"
  if [ -z "$selection" ]; then
    echo "--agents requires a value: all, none, or a comma-separated list of custom-agent names" >&2
    exit 1
  fi

  case "$selection" in
    all)
      selected_agents=("${valid_agents[@]}")
      AGENT_SELECTION="$selection"
      return
      ;;
    none)
      selected_agents=()
      AGENT_SELECTION="$selection"
      return
      ;;
  esac

  if [[ "$selection" == *, || "$selection" == ,* || "$selection" == *,,* ]]; then
    echo "Invalid --agents value: $AGENT_SELECTION" >&2
    echo "Use all, none, or a comma-separated list such as codebase-explorer,apply-tasks." >&2
    exit 1
  fi

  old_ifs="$IFS"
  IFS=','
  read -r -a selected_agents <<< "$selection"
  IFS="$old_ifs"

  for item in "${selected_agents[@]}"; do
    if [ -z "$item" ] || ! name_in_list "$item" "${valid_agents[@]}"; then
      invalid+=("$item")
    fi
  done

  if [ "${#invalid[@]}" -gt 0 ]; then
    echo "Unknown custom agent(s): ${invalid[*]}" >&2
    echo "Available custom agents: ${valid_agents[*]:-(none)}" >&2
    exit 1
  fi

  AGENT_SELECTION="$selection"
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
  echo "  [BACKUP] $agent_name -> $backup_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy)
      COPY_MODE=true
      shift
      ;;
    --agents=*)
      AGENT_SELECTION="${1#--agents=}"
      shift
      ;;
    --agents)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--agents requires a value: all, none, or a comma-separated list of custom-agent names" >&2
        usage >&2
        exit 1
      fi
      AGENT_SELECTION="$2"
      shift 2
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

discover_agents
parse_agent_selection

echo "Installing custom agents for Claude Code"
echo "  Source:  $AGENTS_SRC"
echo "  Target:  $TARGET_DIR"
echo "  Mode:    $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
echo "  Agents:  $AGENT_SELECTION"
echo ""

if [ "$AGENT_SELECTION" = "all" ] && [ "${#valid_agents[@]}" -eq 0 ]; then
  echo "No agents found in $AGENTS_SRC."
  echo "Add an agent by creating agents/<name>.md, then re-run this script."
  exit 0
fi

if [ "${#selected_agents[@]}" -eq 0 ]; then
  echo "No custom agents selected."
  exit 0
fi

mkdir -p "$TARGET_DIR"

installed=0

for agent_name in "${selected_agents[@]}"; do
  agent_file="$AGENTS_SRC/$agent_name.md"
  target_path="$TARGET_DIR/$agent_name.md"

  if [ -L "$target_path" ]; then
    if is_repo_symlink "$target_path"; then
      rm "$target_path"
    else
      backup_existing_path "$target_path" "$agent_name.md"
    fi
  elif [ -e "$target_path" ]; then
    backup_existing_path "$target_path" "$agent_name.md"
  fi

  if [ "$COPY_MODE" = true ]; then
    cp "$agent_file" "$target_path"
    echo "  [COPY]   $agent_name.md -> $target_path"
  else
    ln -s "$agent_file" "$target_path"
    echo "  [LINK]   $agent_name.md -> $target_path"
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
