## Why

The current installer couples skill distribution to a cloned checkout and targets Claude Code plus Codex, while the repository now needs first-class Claude Code and Cursor CLI distribution. Git-backed plugin marketplaces provide independent skill discovery and updates without requiring the repository's skill symlink scripts.

## What Changes

- **BREAKING**: Replace Codex as a supported platform with Cursor CLI.
- **BREAKING**: Stop installing Claude Code skills through the unified symlink/copy installer; distribute them through a Git-backed Claude Code marketplace instead.
- Distribute Cursor CLI skills through a Git-backed Cursor marketplace without requiring publication in the public Cursor Marketplace.
- Expose each release-ready `skills/<name>/` directory as an independently installable marketplace plugin.
- Keep custom agents outside marketplace plugins and install them through scripts.
- Split custom-agent definitions into Claude Code and Cursor CLI variants so each platform receives supported frontmatter and behavior.
- Preserve selective installation, symlink-first behavior, copy mode, backups, and non-destructive handling for agent installation.
- Document migration from legacy Claude Code and Codex skill symlinks without deleting existing user installations automatically.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-install`: Replace Claude Code and Codex script-based skill installation with per-skill Git-backed marketplace distribution for Claude Code and Cursor CLI.
- `agent-install`: Install platform-specific Claude Code and Cursor CLI agent variants through the agent installer.
- `repo-scaffold`: Update repository onboarding, structure, platform support, installation, updating, migration, and troubleshooting guidance.

## Impact

- Affected manifests: new Claude Code and Cursor marketplace metadata consumed by Claude Code and Cursor CLI.
- Affected source layout: platform-specific agent definitions under `agents/`.
- Affected scripts: the unified installer and agent installer; Claude Code and Codex skill helpers are retired or replaced.
- Affected documentation and repository guidance: `README.md`, agent and skill authoring guides, `CLAUDE.md`, and `AGENT.md`.
- Existing users must remove legacy skill symlinks if they want to avoid duplicate user-level and plugin-provided skills; the migration remains explicit and non-destructive.
