## ADDED Requirements

### Requirement: Agent skill preloads use namespaced identifiers
Every Claude Code agent that preloads a repository skill SHALL name it in the `<group>:<skill-name>` form matching its marketplace plugin.

#### Scenario: Agent preloads a repository skill
- **WHEN** `agents/claude/structure-reviewer.md` preloads the structure-review skill
- **THEN** its `skills` frontmatter names `craft:structure-review`
- **AND** the same namespaced form is used for `craft:code-audit` in `code-auditor` and `craft:python-engineering-standards` in `implementer`

#### Scenario: Bare skill names are rejected
- **WHEN** an agent definition preloads a repository skill by bare name
- **THEN** the reference is treated as broken, because a bare name does not resolve to a plugin-provided skill

#### Scenario: Preload failure is silent
- **WHEN** an agent names a skill that does not resolve
- **THEN** the agent still launches and the failure appears only in the debug log
- **AND** the agents documentation records this, so a preload change is verified by running the agent rather than by a successful launch

#### Scenario: Group change breaks preloads
- **WHEN** a skill moves to a different group
- **THEN** every agent preloading it must be updated in the same change

### Requirement: Codex agent definitions are installed from TOML sources
Every repository custom agent SHALL have a same-name Codex-native TOML definition at `agents/codex/<name>.toml`, and the existing agent installer SHALL symlink or copy those files to the configured Codex target.

#### Scenario: User installs Codex agents
- **WHEN** a user runs `scripts/install-agents.sh --platform codex --agents all`
- **THEN** Codex receives `code-auditor`, `implementer`, `pathfinder`, `researcher`, and `structure-reviewer` under `~/.codex/agents/`
- **AND** each agent preserves the corresponding Claude/Cursor role and safety intent using Codex-native controls

#### Scenario: Agent source is changed
- **WHEN** a repository custom agent's role or safety contract changes
- **THEN** its Claude, Cursor, and Codex variants are reviewed together
- **AND** the installer points to the canonical `agents/codex/` definition rather than a divergent copy
