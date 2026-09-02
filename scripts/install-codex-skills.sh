#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CODEX_TARGET_DIR="${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"

usage() {
  cat <<EOF
Usage: $0 [options]

Install release-ready skills for Codex from this checkout. The default mode
creates symlinks in ~/.codex/skills, so edits and git pulls are reflected
immediately. The selection and safety behavior matches install-cursor-skills.sh.

Options:
  --skills all|name[,name...]
      Install every release-ready skill or a selected bare-name subset.

  --group name[,name...]
      Install every skill in one or more domain groups. Mutually exclusive with
      an explicit --skills selection.

  --copy
      Copy skill directories instead of creating symlinks.

  -h, --help
      Show this help text.

Target override:
  CODEX_SKILLS_DIR   Defaults to \$HOME/.codex/skills
EOF
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

env SKILLS_PLATFORM_LABEL="Codex" CURSOR_SKILLS_DIR="$CODEX_TARGET_DIR" \
  bash "$SCRIPT_DIR/install-cursor-skills.sh" "$@"
