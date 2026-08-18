#!/usr/bin/env bash
set -euo pipefail

echo "scripts/install-claude.sh no longer installs Claude Code skills." >&2
echo "Skills are now distributed through this repository's Git-backed Claude marketplace." >&2
echo "Register it in Claude Code with:" >&2
echo "  /plugin marketplace add <repository-git-url>" >&2
echo "Then install the desired skill plugin from that marketplace." >&2
echo "Existing legacy skill files, directories, symlinks, and backups were not modified." >&2
exit 1
