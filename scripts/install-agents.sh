#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
CLAUDE_AGENTS_SRC="$REPO_DIR/agents/claude"
CURSOR_AGENTS_SRC="$REPO_DIR/agents/cursor"
CLAUDE_TARGET_DIR="${CLAUDE_AGENTS_DIR:-$HOME/.claude/agents}"
CURSOR_TARGET_DIR="${CURSOR_AGENTS_DIR:-$HOME/.cursor/agents}"

PLATFORM="claude"
AGENT_SELECTION="all"
COPY_MODE=false

claude_agents=()
cursor_agents=()
available_agents=()
selected_agents=()
DISCOVERED_AGENTS=()
CLAUDE_INSTALLED=0
CURSOR_INSTALLED=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --platform claude|cursor|both
      Agent platform to install. Defaults to claude.

  --agents all|none|name[,name...]
      Install every available agent, no agents, or a selected subset.
      Defaults to all.

  --copy
      Copy agent files instead of creating symlinks.

  -h, --help
      Show this help text.

Target overrides:
  CLAUDE_AGENTS_DIR   Defaults to \$HOME/.claude/agents
  CURSOR_AGENTS_DIR   Defaults to \$HOME/.cursor/agents
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

print_list() {
  if [ "$#" -eq 0 ]; then
    printf '%s\n' "(none)"
  else
    local old_ifs="$IFS"
    IFS=','
    printf '%s\n' "$*"
    IFS="$old_ifs"
  fi
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

add_available_agent() {
  local agent_name="$1"

  if ! name_in_list "$agent_name" "${available_agents[@]}"; then
    available_agents+=("$agent_name")
  fi
}

build_available_agents() {
  local agent_name

  discover_agents "$CLAUDE_AGENTS_SRC"
  claude_agents=("${DISCOVERED_AGENTS[@]}")

  discover_agents "$CURSOR_AGENTS_SRC"
  cursor_agents=("${DISCOVERED_AGENTS[@]}")

  available_agents=()
  case "$PLATFORM" in
    claude)
      available_agents=("${claude_agents[@]}")
      ;;
    cursor)
      available_agents=("${cursor_agents[@]}")
      ;;
    both)
      for agent_name in "${claude_agents[@]}" "${cursor_agents[@]}"; do
        [ -n "$agent_name" ] || continue
        add_available_agent "$agent_name"
      done
      ;;
  esac
}

add_selected_agent() {
  local agent_name="$1"

  if ! name_in_list "$agent_name" "${selected_agents[@]}"; then
    selected_agents+=("$agent_name")
  fi
}

parse_agent_selection() {
  local selection
  local item
  local old_ifs
  local parsed_agents=()
  local invalid_agents=()

  selection="$(strip_spaces "$AGENT_SELECTION")"
  if [ -z "$selection" ]; then
    echo "--agents requires a value: all, none, or a comma-separated list of agent names" >&2
    exit 1
  fi

  selected_agents=()
  case "$selection" in
    all)
      selected_agents=("${available_agents[@]}")
      AGENT_SELECTION="$selection"
      return
      ;;
    none)
      AGENT_SELECTION="$selection"
      return
      ;;
  esac

  if [[ "$selection" == *, || "$selection" == ,* || "$selection" == *,,* ]]; then
    echo "Invalid --agents value: $AGENT_SELECTION" >&2
    echo "Use all, none, or a comma-separated list such as pathfinder,implementer." >&2
    exit 1
  fi

  old_ifs="$IFS"
  IFS=','
  read -r -a parsed_agents <<< "$selection"
  IFS="$old_ifs"

  for item in "${parsed_agents[@]}"; do
    if [ -z "$item" ] || ! name_in_list "$item" "${available_agents[@]}"; then
      invalid_agents+=("$item")
    else
      add_selected_agent "$item"
    fi
  done

  if [ "${#invalid_agents[@]}" -gt 0 ]; then
    echo "Unknown custom agent(s): ${invalid_agents[*]}" >&2
    echo "Available custom agents: $(print_list "${available_agents[@]}")" >&2
    exit 1
  fi

  AGENT_SELECTION="$selection"
}

preflight_selected_agents() {
  local agent_name
  local missing_variants=()

  for agent_name in "${selected_agents[@]}"; do
    if { [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]; } &&
       [ ! -f "$CLAUDE_AGENTS_SRC/$agent_name.md" ]; then
      missing_variants+=("Claude Code: agents/claude/$agent_name.md")
    fi

    if { [ "$PLATFORM" = "cursor" ] || [ "$PLATFORM" = "both" ]; } &&
       [ ! -f "$CURSOR_AGENTS_SRC/$agent_name.md" ]; then
      missing_variants+=("Cursor CLI: agents/cursor/$agent_name.md")
    fi
  done

  if [ "${#missing_variants[@]}" -gt 0 ]; then
    echo "Missing selected agent variant(s):" >&2
    for agent_name in "${missing_variants[@]}"; do
      echo "  $agent_name" >&2
    done
    if [ "$PLATFORM" = "both" ]; then
      echo "Installation aborted before changing either target." >&2
    fi
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
  echo "  [BACKUP] $agent_name.md -> $backup_path"
}

install_platform_agents() {
  local platform="$1"
  local source_dir="$2"
  local target_dir="$3"
  local agent_name
  local agent_file
  local target_path
  local installed=0

  if [ "${#selected_agents[@]}" -gt 0 ]; then
    mkdir -p "$target_dir"
  fi

  for agent_name in "${selected_agents[@]}"; do
    agent_file="$source_dir/$agent_name.md"
    target_path="$target_dir/$agent_name.md"

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
      echo "  [COPY] $agent_name.md -> $target_path"
    else
      ln -s "$agent_file" "$target_path"
      echo "  [LINK] $agent_name.md -> $target_path"
    fi

    installed=$((installed + 1))
  done

  case "$platform" in
    claude) CLAUDE_INSTALLED="$installed" ;;
    cursor) CURSOR_INSTALLED="$installed" ;;
  esac
}

print_plan() {
  echo "Agent install plan"
  case "$PLATFORM" in
    claude) echo "  Platforms: Claude Code" ;;
    cursor) echo "  Platforms: Cursor CLI" ;;
    both) echo "  Platforms: Claude Code, Cursor CLI" ;;
  esac
  echo "  Mode:      $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
  echo "  Agents:    $(print_list "${selected_agents[@]}")"
  if [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]; then
    echo "  Claude target: $CLAUDE_TARGET_DIR"
  fi
  if [ "$PLATFORM" = "cursor" ] || [ "$PLATFORM" = "both" ]; then
    echo "  Cursor target: $CURSOR_TARGET_DIR"
  fi
  echo ""
}

print_empty_source_messages() {
  if { [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]; } &&
     [ "${#claude_agents[@]}" -eq 0 ]; then
    echo "No valid Claude Code agents found in $CLAUDE_AGENTS_SRC."
    echo "Add definitions as agents/claude/<name>.md."
  fi

  if { [ "$PLATFORM" = "cursor" ] || [ "$PLATFORM" = "both" ]; } &&
     [ "${#cursor_agents[@]}" -eq 0 ]; then
    echo "No valid Cursor CLI agents found in $CURSOR_AGENTS_SRC."
    echo "Add definitions as agents/cursor/<name>.md."
  fi
}

print_summary() {
  echo ""
  echo "Agent install summary"
  echo "  Mode: $([ "$COPY_MODE" = true ] && echo copy || echo symlink)"
  if [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]; then
    echo "  Claude Code: $CLAUDE_INSTALLED installed to $CLAUDE_TARGET_DIR"
  fi
  if [ "$PLATFORM" = "cursor" ] || [ "$PLATFORM" = "both" ]; then
    echo "  Cursor CLI:  $CURSOR_INSTALLED installed to $CURSOR_TARGET_DIR"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform=*)
      PLATFORM="${1#--platform=}"
      shift
      ;;
    --platform)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--platform requires a value: claude, cursor, or both" >&2
        usage >&2
        exit 1
      fi
      PLATFORM="$2"
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

case "$PLATFORM" in
  claude|cursor|both) ;;
  *)
    echo "Unknown platform: $PLATFORM" >&2
    echo "Valid platforms: claude, cursor, both" >&2
    exit 1
    ;;
esac

build_available_agents
parse_agent_selection
preflight_selected_agents
print_plan

if [ "$AGENT_SELECTION" = "all" ] && [ "${#selected_agents[@]}" -eq 0 ]; then
  print_empty_source_messages
  echo "No agents were installed."
  print_summary
  exit 0
fi

if [ "${#selected_agents[@]}" -eq 0 ]; then
  echo "No custom agents selected; existing agents were left untouched."
  print_summary
  exit 0
fi

if [ "$PLATFORM" = "claude" ] || [ "$PLATFORM" = "both" ]; then
  echo "Installing Claude Code agents"
  install_platform_agents "claude" "$CLAUDE_AGENTS_SRC" "$CLAUDE_TARGET_DIR"
fi

if [ "$PLATFORM" = "cursor" ] || [ "$PLATFORM" = "both" ]; then
  echo "Installing Cursor CLI agents"
  install_platform_agents "cursor" "$CURSOR_AGENTS_SRC" "$CURSOR_TARGET_DIR"
fi

print_summary
