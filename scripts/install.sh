#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SKILLS_SRC="$REPO_DIR/skills"
AGENTS_SRC="$REPO_DIR/agents"

PLATFORM=""
PLATFORM_SOURCE=""
TARGET_VALUE=""
SKILL_SELECTION=""
AGENT_SELECTION=""
COPY_MODE=false
HAS_ARGS=false
CODEX_AGENT_NOTE=false

valid_skills=()
valid_agents=()
CHOICE_RESULT=""
MULTI_SELECTION=""

usage() {
  cat <<EOF
Usage: $0 [options]

Interactive:
  $0

Non-interactive:
  $0 --platform claude --skills all --agents all
  $0 --platform codex --skills sql-data-analysis,data-governance
  $0 --platform both --skills all --agents codebase-explorer

Options:
  --platform claude|codex|both|agents
      Platform to install for. Use "both" for Claude Code and Codex skills.
      Use "agents" for Claude Code custom agents only.

  --skills all|name[,name...]
      Skills to install for the selected platform. Defaults to all when a
      platform is provided non-interactively.

  --agents all|none|name[,name...]
      Custom agents to install for Claude Code. Use all to install every
      custom agent, or none to skip agents.

  --copy
      Copy files instead of creating symlinks.

  --target claude|codex|agents|all
      Compatibility alias for --platform. "all" maps to "both".

  -h, --help
      Show this help text.
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

discover_skills() {
  local skill_dir

  valid_skills=()
  for skill_dir in "$SKILLS_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    [ -f "$skill_dir/SKILL.md" ] || continue
    valid_skills+=("$(basename "$skill_dir")")
  done
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

validate_skill_selection() {
  local selection
  local item
  local invalid=()
  local old_ifs
  local selected=()

  selection="$(strip_spaces "$SKILL_SELECTION")"
  if [ -z "$selection" ]; then
    echo "--skills requires a value: all or a comma-separated list of skill names" >&2
    exit 1
  fi

  if [ "$selection" = "all" ]; then
    SKILL_SELECTION="$selection"
    return
  fi

  if [[ "$selection" == *, || "$selection" == ,* || "$selection" == *,,* ]]; then
    echo "Invalid --skills value: $SKILL_SELECTION" >&2
    echo "Use all or a comma-separated list such as sql-data-analysis,data-governance." >&2
    exit 1
  fi

  old_ifs="$IFS"
  IFS=','
  read -r -a selected <<< "$selection"
  IFS="$old_ifs"

  for item in "${selected[@]}"; do
    if [ -z "$item" ] || ! name_in_list "$item" "${valid_skills[@]}"; then
      invalid+=("$item")
    fi
  done

  if [ "${#invalid[@]}" -gt 0 ]; then
    echo "Unknown skill(s): ${invalid[*]}" >&2
    echo "Available skills: ${valid_skills[*]:-(none)}" >&2
    exit 1
  fi

  SKILL_SELECTION="$selection"
}

validate_agent_selection() {
  local selection
  local item
  local invalid=()
  local old_ifs
  local selected=()

  selection="$(strip_spaces "$AGENT_SELECTION")"
  if [ -z "$selection" ]; then
    echo "--agents requires a value: all, none, or a comma-separated list of custom-agent names" >&2
    exit 1
  fi

  case "$selection" in
    all|none)
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
  read -r -a selected <<< "$selection"
  IFS="$old_ifs"

  for item in "${selected[@]}"; do
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

normalize_platform() {
  local value="$1"

  case "$value" in
    claude|codex|both|agents)
      printf '%s\n' "$value"
      ;;
    all)
      printf '%s\n' "both"
      ;;
    *)
      echo "Unknown platform: $value" >&2
      echo "Valid platforms: claude, codex, both, agents" >&2
      exit 1
      ;;
  esac
}

platform_includes_claude() {
  [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]
}

platform_includes_codex() {
  [ "$PLATFORM" = "codex" ] || [ "$PLATFORM" = "both" ]
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
    read -r input
    input="$(strip_spaces "$input")"

    if [[ "$input" =~ ^[0-9]+$ ]] && [ "$input" -ge 1 ] && [ "$input" -le "${#options[@]}" ]; then
      CHOICE_RESULT="$input"
      echo ""
      return
    fi

    echo "Invalid choice. Please enter a number from 1 to ${#options[@]}."
    echo ""
  done
}

prompt_multi_choice() {
  local title="$1"
  local all_label="$2"
  local skip_label="$3"
  shift 3
  local items=("$@")
  local input
  local choice
  local old_ifs
  local choices=()
  local selected=()
  local max_choice
  local item_index

  max_choice=$((1 + ${#items[@]}))
  if [ -n "$skip_label" ]; then
    max_choice=$((max_choice + 1))
  fi

  while true; do
    echo "$title"
    echo "  1. $all_label"
    if [ -n "$skip_label" ]; then
      echo "  2. $skip_label"
      item_index=3
    else
      item_index=2
    fi

    for choice in "${items[@]}"; do
      echo "  $item_index. $choice"
      item_index=$((item_index + 1))
    done

    printf "Enter numbers separated by commas: "
    read -r input
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
      if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$max_choice" ]; then
        selected=()
        break
      fi

      if [ "$choice" -eq 1 ]; then
        MULTI_SELECTION="all"
        echo ""
        return
      fi

      if [ -n "$skip_label" ] && [ "$choice" -eq 2 ]; then
        MULTI_SELECTION="none"
        echo ""
        return
      fi

      if [ -n "$skip_label" ]; then
        selected+=("${items[$((choice - 3))]}")
      else
        selected+=("${items[$((choice - 2))]}")
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
  echo "Install wizard"
  echo ""

  prompt_choice "Which platform should be installed?" \
    "Claude Code" \
    "Codex" \
    "Both Claude Code and Codex"

  case "$CHOICE_RESULT" in
    1) PLATFORM="claude" ;;
    2) PLATFORM="codex" ;;
    3) PLATFORM="both" ;;
  esac

  discover_skills
  if [ "${#valid_skills[@]}" -eq 0 ]; then
    SKILL_SELECTION="all"
  else
    prompt_multi_choice "Which skills should be installed?" "All skills" "" "${valid_skills[@]}"
    SKILL_SELECTION="$MULTI_SELECTION"
  fi

  discover_agents
  if platform_includes_claude; then
    if [ "${#valid_agents[@]}" -eq 0 ]; then
      AGENT_SELECTION="none"
      echo "No custom agents found in $AGENTS_SRC."
      echo ""
    else
      prompt_multi_choice "Which custom agents should be installed for Claude Code?" \
        "All custom agents" \
        "Skip custom agents" \
        "${valid_agents[@]}"
      AGENT_SELECTION="$MULTI_SELECTION"
    fi
  else
    AGENT_SELECTION="none"
    echo "Custom agents are currently Claude Code-only, so the installer will skip agents for Codex."
    echo ""
  fi

  prompt_choice "Install mode?" "Symlink" "Copy"
  case "$CHOICE_RESULT" in
    1) COPY_MODE=false ;;
    2) COPY_MODE=true ;;
  esac
}

run_claude_skills() {
  local args=(--skills "$SKILL_SELECTION")
  if [ "$COPY_MODE" = true ]; then
    args+=(--copy)
  fi
  bash "$SCRIPT_DIR/install-claude.sh" "${args[@]}"
}

run_codex_skills() {
  local args=(--skills "$SKILL_SELECTION")
  if [ "$COPY_MODE" = true ]; then
    args+=(--copy)
  fi
  bash "$SCRIPT_DIR/install-codex.sh" "${args[@]}"
}

run_agents() {
  local args=(--agents "$AGENT_SELECTION")
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
      PLATFORM_SOURCE="platform"
      shift
      ;;
    --platform)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--platform requires a value: claude, codex, both, or agents" >&2
        usage >&2
        exit 1
      fi
      PLATFORM="$(normalize_platform "$2")"
      PLATFORM_SOURCE="platform"
      shift 2
      ;;
    --target=*)
      TARGET_VALUE="${1#--target=}"
      PLATFORM="$(normalize_platform "$TARGET_VALUE")"
      PLATFORM_SOURCE="target"
      shift
      ;;
    --target)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--target requires a value: claude, codex, agents, or all" >&2
        usage >&2
        exit 1
      fi
      TARGET_VALUE="$2"
      PLATFORM="$(normalize_platform "$TARGET_VALUE")"
      PLATFORM_SOURCE="target"
      shift 2
      ;;
    --skills=*)
      SKILL_SELECTION="${1#--skills=}"
      shift
      ;;
    --skills)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--skills requires a value: all or a comma-separated list of skill names" >&2
        usage >&2
        exit 1
      fi
      SKILL_SELECTION="$2"
      shift 2
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

if [ "$HAS_ARGS" = false ]; then
  if [ -t 0 ]; then
    run_wizard
  else
    echo "Interactive install requires a terminal." >&2
    echo "For non-interactive installs, pass explicit flags, for example:" >&2
    echo "  $0 --platform both --skills all --agents all" >&2
    exit 1
  fi
fi

if [ -z "$PLATFORM" ]; then
  PLATFORM="both"
  PLATFORM_SOURCE="default"
fi

case "$PLATFORM" in
  claude|codex|both)
    if [ -z "$SKILL_SELECTION" ]; then
      SKILL_SELECTION="all"
    fi

    if platform_includes_claude; then
      if [ -z "$AGENT_SELECTION" ]; then
        if [ "$PLATFORM_SOURCE" = "default" ] || { [ "$PLATFORM_SOURCE" = "target" ] && [ "$TARGET_VALUE" = "all" ]; }; then
          AGENT_SELECTION="all"
        else
          AGENT_SELECTION="none"
        fi
      fi
    elif [ -n "$AGENT_SELECTION" ] && [ "$(strip_spaces "$AGENT_SELECTION")" != "none" ]; then
      echo "Custom-agent installation requires Claude Code; Codex custom agents are not supported by this installer yet." >&2
      exit 1
    else
      AGENT_SELECTION="none"
    fi
    ;;
  agents)
    if [ -n "$SKILL_SELECTION" ]; then
      echo "--skills cannot be used with --platform agents" >&2
      exit 1
    fi
    if [ -z "$AGENT_SELECTION" ]; then
      AGENT_SELECTION="all"
    fi
    ;;
esac

discover_skills
discover_agents

if [ "$PLATFORM" != "agents" ]; then
  validate_skill_selection
fi

if platform_includes_claude || [ "$PLATFORM" = "agents" ]; then
  validate_agent_selection
fi

echo "Install plan"
echo "  Platform: $PLATFORM"
if [ "$PLATFORM" != "agents" ]; then
  echo "  Skills:   $SKILL_SELECTION"
fi
if platform_includes_claude || [ "$PLATFORM" = "agents" ]; then
  echo "  Agents:   $AGENT_SELECTION (Claude Code only)"
else
  echo "  Agents:   skipped (custom agents are Claude Code-only)"
fi
echo "  Mode:     $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
echo ""

case "$PLATFORM" in
  claude)
    run_claude_skills
    echo ""
    if [ "$(strip_spaces "$AGENT_SELECTION")" != "none" ]; then
      run_agents
    fi
    ;;
  codex)
    run_codex_skills
    ;;
  both)
    run_claude_skills
    echo ""
    run_codex_skills
    echo ""
    if [ "$(strip_spaces "$AGENT_SELECTION")" != "none" ]; then
      run_agents
      CODEX_AGENT_NOTE=true
    fi
    ;;
  agents)
    run_agents
    ;;
esac

echo ""
echo "Install complete."
if [ "$CODEX_AGENT_NOTE" = true ]; then
  echo "Note: Custom agents were installed for Claude Code only. Custom agents are currently not installable for Codex."
fi
