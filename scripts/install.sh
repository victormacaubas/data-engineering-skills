#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
CLAUDE_AGENTS_SRC="$REPO_DIR/agents/claude"
CURSOR_AGENTS_SRC="$REPO_DIR/agents/cursor"

PLATFORM=""
AGENT_SELECTION=""
COPY_MODE=false
HAS_ARGS=false

valid_agents=()
DISCOVERED_AGENTS=()
CHOICE_RESULT=""
MULTI_SELECTION=""

usage() {
  cat <<EOF
Usage: $0 [options]

Interactive:
  $0

Non-interactive:
  $0 --platform claude --agents all
  $0 --platform cursor --agents pathfinder,implementer
  $0 --platform both --agents none --copy

Options:
  --platform claude|cursor|both
      Platform-specific custom agents to install. Defaults to both when other
      non-interactive options are supplied.

  --agents all|none|name[,name...]
      Install every available custom agent, no agents, or a selected subset.
      Defaults to all.

  --copy
      Copy agent files instead of creating symlinks.

  -h, --help
      Show this help text.

Skills are installed through the repository's Git-backed Claude Code and
Cursor CLI marketplaces, not through this script.
EOF
}

marketplace_migration_error() {
  local option="$1"

  echo "$option is retired because skills are now installed through Git-backed marketplaces." >&2
  echo "Claude Code: /plugin marketplace add <repository-git-url>" >&2
  echo "Cursor CLI:  agent plugin marketplace add <repository-git-url>" >&2
  echo "Use this script only for custom agents: $0 --platform claude|cursor|both --agents all|none|name[,name...]" >&2
  exit 2
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

join_items() {
  local joined=""
  local item

  for item in "$@"; do
    if [ -z "$joined" ]; then
      joined="$item"
    else
      joined="$joined,$item"
    fi
  done

  printf '%s\n' "$joined"
}

discover_agents() {
  local source_dir="$1"
  local agent_file

  DISCOVERED_AGENTS=()
  for agent_file in "$source_dir"/*.md; do
    [ -f "$agent_file" ] || continue
    DISCOVERED_AGENTS+=("$(basename "${agent_file%.md}")")
  done
}

add_valid_agent() {
  local agent_name="$1"

  if ! name_in_list "$agent_name" "${valid_agents[@]}"; then
    valid_agents+=("$agent_name")
  fi
}

discover_agents_for_platform() {
  local agent_name

  valid_agents=()
  if [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]; then
    discover_agents "$CLAUDE_AGENTS_SRC"
    for agent_name in "${DISCOVERED_AGENTS[@]}"; do
      add_valid_agent "$agent_name"
    done
  fi

  if [ "$PLATFORM" = "cursor" ] || [ "$PLATFORM" = "both" ]; then
    discover_agents "$CURSOR_AGENTS_SRC"
    for agent_name in "${DISCOVERED_AGENTS[@]}"; do
      add_valid_agent "$agent_name"
    done
  fi
}

normalize_platform() {
  local value="$1"

  case "$value" in
    claude|cursor|both)
      printf '%s\n' "$value"
      ;;
    codex)
      echo "Codex support has ended; existing legacy Codex installations are left untouched." >&2
      echo "Use --platform cursor for Cursor CLI custom agents." >&2
      exit 2
      ;;
    *)
      echo "Unknown platform: $value" >&2
      echo "Valid platforms: claude, cursor, both" >&2
      exit 1
      ;;
  esac
}

prompt_choice() {
  local title="$1"
  shift
  local options=("$@")
  local input
  local idx

  while true; do
    echo "$title"
    for idx in "${!options[@]}"; do
      echo "  $((idx + 1)). ${options[$idx]}"
    done
    printf "Enter choice: "
    if ! read -r input; then
      echo "" >&2
      echo "Input ended before the wizard was complete." >&2
      exit 1
    fi
    input="$(strip_spaces "$input")"

    if [[ "$input" =~ ^[0-9]+$ ]] &&
       [ "$input" -ge 1 ] &&
       [ "$input" -le "${#options[@]}" ]; then
      CHOICE_RESULT="$input"
      echo ""
      return
    fi

    echo "Invalid choice. Please enter a number from 1 to ${#options[@]}."
    echo ""
  done
}

prompt_agent_selection() {
  local input
  local choice
  local old_ifs
  local choices=()
  local selected=()
  local max_choice=$((2 + ${#valid_agents[@]}))
  local item_index

  while true; do
    echo "Which custom agents should be installed?"
    echo "  1. All custom agents"
    echo "  2. Skip custom agents"
    item_index=3
    for choice in "${valid_agents[@]}"; do
      echo "  $item_index. $choice"
      item_index=$((item_index + 1))
    done

    printf "Enter numbers separated by commas: "
    if ! read -r input; then
      echo "" >&2
      echo "Input ended before the wizard was complete." >&2
      exit 1
    fi
    input="$(strip_spaces "$input")"

    if [ -z "$input" ] || [[ "$input" == *, || "$input" == ,* || "$input" == *,,* ]]; then
      echo "Invalid selection. Please enter numbers separated by commas."
      echo ""
      continue
    fi

    old_ifs="$IFS"
    IFS=','
    read -r -a choices <<< "$input"
    IFS="$old_ifs"

    selected=()
    for choice in "${choices[@]}"; do
      if ! [[ "$choice" =~ ^[0-9]+$ ]] ||
         [ "$choice" -lt 1 ] ||
         [ "$choice" -gt "$max_choice" ]; then
        selected=()
        break
      fi

      if [ "$choice" -eq 1 ]; then
        MULTI_SELECTION="all"
        echo ""
        return
      fi

      if [ "$choice" -eq 2 ]; then
        MULTI_SELECTION="none"
        echo ""
        return
      fi

      if ! name_in_list "${valid_agents[$((choice - 3))]}" "${selected[@]}"; then
        selected+=("${valid_agents[$((choice - 3))]}")
      fi
    done

    if [ "${#selected[@]}" -gt 0 ]; then
      MULTI_SELECTION="$(join_items "${selected[@]}")"
      echo ""
      return
    fi

    echo "Invalid selection. Please enter valid numbers from the list."
    echo ""
  done
}

run_wizard() {
  echo "Custom agent install wizard"
  echo ""

  prompt_choice "Which platform should receive custom agents?" \
    "Claude Code" \
    "Cursor CLI" \
    "Both Claude Code and Cursor CLI"

  case "$CHOICE_RESULT" in
    1) PLATFORM="claude" ;;
    2) PLATFORM="cursor" ;;
    3) PLATFORM="both" ;;
  esac

  discover_agents_for_platform
  if [ "${#valid_agents[@]}" -eq 0 ]; then
    AGENT_SELECTION="none"
    echo "No valid custom-agent definitions are available for $PLATFORM."
    echo "Expected definitions under agents/claude/ and/or agents/cursor/."
    echo ""
  else
    prompt_agent_selection
    AGENT_SELECTION="$MULTI_SELECTION"
  fi

  prompt_choice "Install mode?" "Symlink" "Copy"
  case "$CHOICE_RESULT" in
    1) COPY_MODE=false ;;
    2) COPY_MODE=true ;;
  esac
}

run_agent_installer() {
  local args=(--platform "$PLATFORM" --agents "$AGENT_SELECTION")

  if [ "$COPY_MODE" = true ]; then
    args+=(--copy)
  fi

  bash "$SCRIPT_DIR/install-agents.sh" "${args[@]}"
}

while [[ $# -gt 0 ]]; do
  HAS_ARGS=true
  case "$1" in
    --platform=*)
      PLATFORM="$(normalize_platform "${1#--platform=}")"
      shift
      ;;
    --platform)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--platform requires a value: claude, cursor, or both" >&2
        usage >&2
        exit 1
      fi
      PLATFORM="$(normalize_platform "$2")"
      shift 2
      ;;
    --agents=*)
      AGENT_SELECTION="${1#--agents=}"
      shift
      ;;
    --agents)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--agents requires a value: all, none, or a comma-separated list of agent names" >&2
        usage >&2
        exit 1
      fi
      AGENT_SELECTION="$2"
      shift 2
      ;;
    --copy)
      COPY_MODE=true
      shift
      ;;
    --skills|--skills=*|--target|--target=*)
      marketplace_migration_error "$1"
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

if [ "$HAS_ARGS" = false ]; then
  if [ -t 0 ]; then
    run_wizard
  else
    echo "Interactive install requires a terminal." >&2
    echo "For a non-interactive install, pass explicit flags, for example:" >&2
    echo "  $0 --platform both --agents all" >&2
    exit 1
  fi
fi

if [ -z "$PLATFORM" ]; then
  PLATFORM="both"
fi

if [ -z "$AGENT_SELECTION" ]; then
  AGENT_SELECTION="all"
fi

run_agent_installer
