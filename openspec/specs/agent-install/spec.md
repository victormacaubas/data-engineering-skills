## Purpose
Define how repository custom agents are installed into Claude Code and how the unified installer exposes supported custom-agent selection behavior.
## Requirements
### Requirement: Single-command install for agents
The system SHALL provide a script `scripts/install-agents.sh` that installs all agent `.md` files from the `agents/` directory into the Claude Code agents directory with one invocation.

#### Scenario: Default install with symlinks
- **WHEN** user runs `./scripts/install-agents.sh` without arguments
- **THEN** each `.md` file in `agents/` (excluding `README.md`) is symlinked into `~/.claude/agents/<name>.md`
- **AND** the script prints the resolved target path and symlink status for each agent

#### Scenario: Custom target directory via environment variable
- **WHEN** user sets `CLAUDE_AGENTS_DIR=/custom/path` and runs the script
- **THEN** agents are installed into `/custom/path/<name>.md` instead of the default

#### Scenario: Copy mode install
- **WHEN** user runs `./scripts/install-agents.sh --copy`
- **THEN** agent files are copied (not symlinked) into the target directory

#### Scenario: Non-agent files are excluded
- **WHEN** the `agents/` directory contains `README.md` or other non-`.md` files (e.g. directories, dotfiles)
- **THEN** only files matching `*.md` (excluding `README.md`) are installed

### Requirement: Safe install with backup
The system SHALL NOT overwrite existing files that are not symlinks pointing to this repository without creating a backup first.

#### Scenario: Existing non-repo file at target path
- **WHEN** the target path exists and is NOT a symlink to a path within this repository
- **THEN** the existing file is renamed to `<path>.bak.<YYYYMMDD-HHMMSS>` before installing
- **AND** a warning is printed showing the backup location

#### Scenario: Existing symlink from this repo
- **WHEN** the target path is already a symlink pointing into this repository
- **THEN** the symlink is updated in place without creating a backup

### Requirement: Clear success messaging
The system SHALL print a summary after installation completes.

#### Scenario: Successful install
- **WHEN** install completes without errors
- **THEN** the script prints: number of agents installed, target directory used

#### Scenario: No agents found
- **WHEN** the `agents/` directory contains no valid agent `.md` files
- **THEN** the script prints a message explaining that no agents were found and how to add one

### Requirement: Agents README
The system SHALL provide an `agents/README.md` file that lists all available agents with their name and description.

#### Scenario: README content
- **WHEN** a user opens `agents/README.md`
- **THEN** they see a table with agent name, model, and description extracted from each agent's YAML frontmatter

### Requirement: Documentation
The system SHALL provide a `docs/agents.md` guide explaining how to author and install agents.

#### Scenario: Guide structure
- **WHEN** a user reads `docs/agents.md`
- **THEN** they find sections covering: agent file format, frontmatter fields, authoring steps, install instructions, and naming conventions

### Requirement: Selectable custom-agent installation
The unified installer SHALL allow users to install all custom agents, a selected subset of custom agents, or no custom agents when Claude Code is part of the selected platform.

#### Scenario: All custom agents selected
- **WHEN** user selects all custom agents
- **THEN** every valid agent `.md` file in `agents/` excluding `README.md` is installed into the Claude Code agents directory

#### Scenario: Custom-agent subset selected
- **WHEN** user selects one or more custom-agent names
- **THEN** only those valid agent files are installed into the Claude Code agents directory

#### Scenario: Both platforms selected with custom agents
- **WHEN** user selects both Claude Code and Codex as the platform
- **AND** user selects one or more custom agents
- **THEN** selected custom agents are installed into the Claude Code agents directory
- **AND** no custom agents are installed for Codex
- **AND** the final summary explains that custom agents are currently Claude Code-only

#### Scenario: Custom agents skipped
- **WHEN** user chooses to skip custom agents
- **THEN** no custom-agent files are installed

#### Scenario: Invalid custom agent selected non-interactively
- **WHEN** user provides a custom-agent name that does not exist in `agents/`
- **THEN** the script exits with an error listing the invalid custom-agent name

#### Scenario: Invalid custom agent choice entered interactively
- **WHEN** user enters an invalid interactive custom-agent selection
- **THEN** the wizard reports the invalid choice and asks for the selection again

### Requirement: Codex-only installs skip custom agents
The unified installer SHALL NOT ask users to select custom agents when the selected platform is Codex only.

#### Scenario: Codex only selected interactively
- **WHEN** user selects Codex as the only platform in the interactive wizard
- **THEN** the wizard skips custom-agent selection
- **AND** the wizard explains that custom agents are currently Claude Code-only

#### Scenario: Codex only selected non-interactively with agents
- **WHEN** user runs `./scripts/install.sh --platform codex --agents all`
- **THEN** the script exits with an error explaining that custom-agent installation requires Claude Code

### Requirement: Custom-agent platform support messaging
The unified installer SHALL clearly report when custom-agent installation only applies to Claude Code because Codex custom-agent installation is not supported.

#### Scenario: Both platforms selected and agents installed
- **WHEN** user selects both Claude Code and Codex
- **AND** one or more custom agents are installed
- **THEN** the install summary states that custom agents were installed for Claude Code only
- **AND** the install summary states that custom agents are currently not installable for Codex

### Requirement: Non-interactive custom-agent selection
The unified installer SHALL support explicit non-interactive custom-agent selections for automation.

#### Scenario: Non-interactive all custom agents
- **WHEN** user runs `./scripts/install.sh --platform claude --skills all --agents all`
- **THEN** all valid custom agents are installed into the Claude Code agents directory without prompting

#### Scenario: Non-interactive custom-agent subset
- **WHEN** user runs `./scripts/install.sh --platform claude --skills all --agents codebase-explorer`
- **THEN** only `codebase-explorer.md` is installed into the Claude Code agents directory without prompting

### Requirement: Selection preserves installed custom agents
The system SHALL NOT remove unselected already-installed custom agents during selective installation.

#### Scenario: Previously installed custom agent is not selected
- **WHEN** a repo-owned custom-agent symlink already exists in the target directory
- **AND** user runs a selective install that does not include that custom agent
- **THEN** the existing symlink remains in place

