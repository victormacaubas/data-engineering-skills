#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="all"
INSTALL_ARGS=()

usage() {
  echo "Usage: $0 [--target claude|codex|all] [--copy]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target=*) TARGET="${1#--target=}"; shift ;;
    --target)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--target requires a value: claude, codex, or all" >&2
        usage >&2
        exit 1
      fi
      TARGET="$2"
      shift 2
      ;;
    --copy) INSTALL_ARGS+=(--copy); shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$TARGET" in
  claude)
    bash "$SCRIPT_DIR/install-claude.sh" "${INSTALL_ARGS[@]}"
    ;;
  codex)
    bash "$SCRIPT_DIR/install-codex.sh" "${INSTALL_ARGS[@]}"
    ;;
  all)
    bash "$SCRIPT_DIR/install-claude.sh" "${INSTALL_ARGS[@]}"
    echo ""
    bash "$SCRIPT_DIR/install-codex.sh" "${INSTALL_ARGS[@]}"
    ;;
  *)
    echo "Unknown target: $TARGET. Valid options: claude, codex, all" >&2
    usage >&2
    exit 1
    ;;
esac
