## ADDED Requirements

### Requirement: Platform-specific agent definitions
The repository SHALL maintain distinct Claude Code and Cursor CLI variants for every supported custom agent.

#### Scenario: Agent variants are available
- **WHEN** a supported agent is listed by the repository
- **THEN** a Claude Code definition exists under `agents/claude/`
- **AND** a Cursor CLI definition with the same agent name exists under `agents/cursor/`

#### Scenario: Platform frontmatter differs
- **WHEN** Claude Code and Cursor CLI require different agent frontmatter or model identifiers
- **THEN** each variant uses only the behavior intended for its target platform

### Requirement: Agent-focused installation wizard
The system SHALL retain `scripts/install.sh` as an agent-focused interactive and non-interactive entry point that delegates installation to the agent installer.

#### Scenario: Interactive installation
- **WHEN** a user runs `./scripts/install.sh` from an interactive terminal without selection flags
- **THEN** the wizard prompts for Claude Code, Cursor CLI, or both
- **AND** prompts for agent selection and symlink or copy mode
- **AND** does not offer skill installation

#### Scenario: Retired skill options
- **WHEN** a user passes a legacy skill-install option to `scripts/install.sh`
- **THEN** the script exits with an explanation that skills are installed through marketplaces

## MODIFIED Requirements

### Requirement: Single-command install for agents
The system SHALL provide `scripts/install-agents.sh` to install selected platform-specific agent definitions into Claude Code, Cursor CLI, or both platforms with one invocation.

#### Scenario: Default install with symlinks
- **WHEN** a user selects one or both platforms and does not include `--copy`
- **THEN** the selected platform-specific agent definitions are installed as symlinks

#### Scenario: Install for Claude Code
- **WHEN** a user runs `./scripts/install-agents.sh --platform claude --agents all`
- **THEN** each Claude Code agent variant is symlinked into `~/.claude/agents/<name>.md`
- **AND** no Cursor CLI agent variant is installed

#### Scenario: Install for Cursor CLI
- **WHEN** a user runs `./scripts/install-agents.sh --platform cursor --agents all`
- **THEN** each Cursor CLI agent variant is symlinked into `~/.cursor/agents/<name>.md`
- **AND** no Claude Code agent variant is installed

#### Scenario: Install for both platforms
- **WHEN** a user runs `./scripts/install-agents.sh --platform both --agents all`
- **THEN** Claude Code variants are installed into `~/.claude/agents/`
- **AND** Cursor CLI variants are installed into `~/.cursor/agents/`

#### Scenario: Custom target directory via environment variable
- **WHEN** a user sets `CLAUDE_AGENTS_DIR` or `CURSOR_AGENTS_DIR`
- **THEN** the corresponding platform variants are installed into the configured target directory

#### Scenario: Copy mode install
- **WHEN** a user includes `--copy`
- **THEN** selected agent files are copied rather than symlinked for every selected platform

#### Scenario: Non-agent files are excluded
- **WHEN** a platform agent source directory contains a non-`.md` entry
- **THEN** the installer excludes that entry from discovery and installation

### Requirement: Clear success messaging
The system SHALL print a per-platform summary after agent installation completes.

#### Scenario: Successful install
- **WHEN** agent installation completes without errors
- **THEN** the script prints the selected platforms, number of agents installed per platform, target directories, and install mode

#### Scenario: No agents found
- **WHEN** a selected platform source directory contains no valid agent `.md` files
- **THEN** the script identifies the platform with no agents and explains where its definitions belong

### Requirement: Agents README
The system SHALL provide an `agents/README.md` file that lists each available agent and its Claude Code and Cursor CLI variants.

#### Scenario: README content
- **WHEN** a user opens `agents/README.md`
- **THEN** they see each agent's name, description, and platform-specific model or behavior differences

### Requirement: Documentation
The system SHALL provide a `docs/agents.md` guide explaining how to author, keep aligned, install, update, and verify Claude Code and Cursor CLI agent variants.

#### Scenario: Guide structure
- **WHEN** a user reads `docs/agents.md`
- **THEN** they find platform-specific frontmatter guidance, source layout, parity expectations, install commands, target directories, and naming conventions

### Requirement: Selectable custom-agent installation
The agent installer SHALL allow users to install all custom agents, a selected subset, or no agents for Claude Code, Cursor CLI, or both.

#### Scenario: All custom agents selected
- **WHEN** a user selects all agents for one or both platforms
- **THEN** every valid definition in each selected platform source directory is installed into that platform's target directory

#### Scenario: Custom-agent subset selected
- **WHEN** a user selects one or more agent names
- **THEN** only matching variants are installed for each selected platform

#### Scenario: Both platforms selected with custom agents
- **WHEN** a user selects both platforms and one or more agents
- **THEN** the corresponding Claude Code and Cursor CLI variants are installed

#### Scenario: Custom agents skipped
- **WHEN** a user chooses to skip custom agents
- **THEN** no custom-agent files are installed

#### Scenario: Missing platform variant
- **WHEN** a selected agent lacks a definition for any selected platform
- **THEN** the installer exits before installation and identifies the missing variant

#### Scenario: Invalid custom agent selected non-interactively
- **WHEN** a user selects an unknown agent name
- **THEN** the installer exits with an error listing the invalid name and available agents

#### Scenario: Invalid custom agent choice entered interactively
- **WHEN** a user enters an invalid agent selection in the interactive wizard
- **THEN** the wizard reports the invalid choice and prompts again

### Requirement: Non-interactive custom-agent selection
The system SHALL support explicit platform and custom-agent selections without prompting.

#### Scenario: Non-interactive all custom agents
- **WHEN** a user runs `./scripts/install.sh --platform both --agents all`
- **THEN** all valid platform variants are installed without prompting

#### Scenario: Non-interactive custom-agent subset
- **WHEN** a user runs `./scripts/install.sh --platform cursor --agents pathfinder,implementer`
- **THEN** only the Cursor CLI variants of `pathfinder` and `implementer` are installed without prompting

## REMOVED Requirements

### Requirement: Codex-only installs skip custom agents
**Reason**: Codex is no longer a supported platform, and Cursor CLI has its own custom-agent target.

**Migration**: Use `--platform cursor` to install Cursor CLI agent variants.

### Requirement: Custom-agent platform support messaging
**Reason**: Custom agents are now supported for both Claude Code and Cursor CLI.

**Migration**: Installation summaries report the actual selected platforms and target directories.
