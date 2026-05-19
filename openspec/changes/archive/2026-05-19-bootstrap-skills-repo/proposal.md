## Why

This repository needs a structured foundation so that custom agent skills can be authored, shared, and installed into both Codex and Claude Code with a single command. Without scaffolding, each skill would require ad-hoc installation steps and there would be no consistent convention for authoring or discovery.

## What Changes

- Establish canonical directory layout for skills (`skills/<name>/SKILL.md`).
- Add install scripts (`scripts/install-codex.sh`, `scripts/install-claude.sh`, `scripts/install.sh`) that symlink or copy skills into the correct agent-specific locations.
- Create `README.md` with repo purpose, structure, installation, authoring, and troubleshooting docs.
- Create `CLAUDE.md` with repo-specific instructions for Claude Code when working inside this project.
- Add `docs/` with skill authoring guidance.
- Bootstrap `openspec/` directory with this change as the first tracked change.

## Capabilities

### New Capabilities
- `skill-install`: Install scripts that deploy skills into Codex and Claude Code target directories with symlink support, backup safety, and configurable paths via environment variables.
- `skill-authoring`: Repository conventions, templates, and documentation for creating new skills following a consistent structure.
- `repo-scaffold`: Top-level project files (README, CLAUDE.md, .gitignore) that make the repo self-documenting and ready for contributors.

### Modified Capabilities
<!-- No existing capabilities to modify — this is a greenfield bootstrap. -->

## Impact

- New files across the entire repository (no existing code affected).
- Users will depend on install script conventions for path resolution; these become a contract.
- Claude Code sessions inside this repo will follow CLAUDE.md guidance for skill authoring and OpenSpec usage.
- Codex agents will consume skills from their configured skill directory after installation.
