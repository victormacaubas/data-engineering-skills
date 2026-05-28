## ADDED Requirements

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
