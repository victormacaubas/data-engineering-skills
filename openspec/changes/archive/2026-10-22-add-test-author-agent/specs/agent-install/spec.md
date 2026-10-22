## MODIFIED Requirements

### Requirement: Codex agent definitions are installed from TOML sources
Every repository custom agent SHALL have a same-name Codex-native TOML definition at `agents/codex/<name>.toml`, and the existing agent installer SHALL symlink or copy those files to the configured Codex target.

#### Scenario: User installs Codex agents
- **WHEN** a user runs `scripts/install-agents.sh --platform codex --agents all`
- **THEN** Codex receives `code-auditor`, `implementer`, `pathfinder`, `researcher`, `structure-reviewer`, and `test-author` under `~/.codex/agents/`
- **AND** each agent preserves the corresponding Claude/Cursor role and safety intent using Codex-native controls

#### Scenario: Agent source is changed
- **WHEN** a repository custom agent's role or safety contract changes
- **THEN** its Claude, Cursor, and Codex variants are reviewed together
- **AND** the installer points to the canonical `agents/codex/` definition rather than a divergent copy
