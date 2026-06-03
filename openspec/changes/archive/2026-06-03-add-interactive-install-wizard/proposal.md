## Why

The current install workflow exposes multiple scripts and installs everything by default, which makes first-time setup less guided than the product now needs. A single interactive installer should let users choose the platform, skills, and custom agents they actually want without needing to understand the underlying script split.

## What Changes

- Make `scripts/install.sh` the primary user-facing installer entry point.
- Add an interactive terminal wizard when `scripts/install.sh` is run without explicit selection flags.
- Let users choose the target platform: Claude Code, Codex, or both.
- Let users choose all skills or a subset of skills to install.
- Let users choose all custom agents, a subset of custom agents, or skip agents when Claude Code is part of the selected platform.
- When users choose both Claude Code and Codex, install selected skills for both platforms and install selected custom agents for Claude Code only.
- Skip or clearly explain custom-agent selection when the user selects Codex only, because custom agents currently install only into Claude Code's `~/.claude/agents/` directory.
- Print a final summary message when Codex is selected with custom agents, explaining that custom agents are currently Claude Code-only.
- Preserve non-interactive flags for automation and CI.
- Preserve the existing symlink-first default and copy mode.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `skill-install`: The unified installer behavior changes from a target-only dispatcher into an interactive wizard with selectable platforms and selectable skills.
- `agent-install`: Custom-agent installation becomes selectable from the unified installer and is only offered when Claude Code is included in the platform selection.

## Impact

- Affected scripts: `scripts/install.sh`, `scripts/install-claude.sh`, `scripts/install-codex.sh`, and `scripts/install-agents.sh`.
- Affected documentation: root `README.md`, `docs/authoring.md` as needed, and `docs/agents.md` as needed.
- Affected specs: `skill-install` and `agent-install`.
- No new external dependencies are expected; implementation should remain portable Bash for macOS and Linux.
