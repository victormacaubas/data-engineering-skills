## Why

The repo already has `skills/` with install scripts, but the `agents/` directory (containing custom agent definitions like `codebase-explorer.md`) has no install automation, no documentation, and is not mentioned anywhere in the repo's README or CLAUDE.md. Users can't discover or install agents without manually inspecting the directory.

## What Changes

- Add `scripts/install-agents.sh` — a new install script that deploys agent `.md` files from `agents/` into Claude Code's agents directory (`~/.claude/agents/`), following the same symlink-first strategy as the skill installers.
- Create `agents/README.md` — an index listing all available agents with descriptions.
- Update root `README.md` — add an "Agents" section and update the repo structure diagram to reflect the `agents/` folder.
- Update `CLAUDE.md` — add agent authoring conventions and instructions for contributors.
- Add `docs/agents.md` — a guide for authoring and installing agents, structured like `docs/authoring.md`.

## Capabilities

### New Capabilities
- `agent-install`: Install automation for custom agents (symlink/copy into `~/.claude/agents/`), mirroring the pattern of `skill-install`.

### Modified Capabilities
- `skill-install`: The unified `scripts/install.sh` dispatcher gains a `--target agents` option to include agent installation alongside skills.

## Impact

- New file: `scripts/install-agents.sh`
- New file: `agents/README.md`
- New file: `docs/agents.md`
- Modified: `scripts/install.sh` (new dispatch target)
- Modified: `README.md` (repo-level documentation)
- Modified: `CLAUDE.md` (contributor instructions)
