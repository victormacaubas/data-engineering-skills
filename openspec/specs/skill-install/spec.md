## ADDED Requirements

### Requirement: Single-command install for Claude Code
The system SHALL provide a script `scripts/install-claude.sh` that installs all skills from the `skills/` directory into the Claude Code skills directory with one invocation.

#### Scenario: Default install with symlinks
- **WHEN** user runs `./scripts/install-claude.sh` without arguments
- **THEN** each skill directory under `skills/` is symlinked into `~/.claude/skills/<skill-name>/`
- **AND** the script prints the resolved target path and symlink status for each skill

#### Scenario: Custom target directory via environment variable
- **WHEN** user sets `CLAUDE_SKILLS_DIR=/custom/path` and runs the script
- **THEN** skills are installed into `/custom/path/<skill-name>/` instead of the default

#### Scenario: Copy mode install
- **WHEN** user runs `./scripts/install-claude.sh --copy`
- **THEN** skill directories are copied (not symlinked) into the target directory

### Requirement: Single-command install for Codex
The system SHALL provide a script `scripts/install-codex.sh` that installs all skills from the `skills/` directory into the Codex skills directory with one invocation.

#### Scenario: Default install with symlinks
- **WHEN** user runs `./scripts/install-codex.sh` without arguments
- **THEN** each skill directory under `skills/` is symlinked into `~/.codex/skills/<skill-name>/`
- **AND** the script prints the resolved target path and symlink status for each skill

#### Scenario: Custom target directory via environment variable
- **WHEN** user sets `CODEX_SKILLS_DIR=/custom/path` and runs the script
- **THEN** skills are installed into `/custom/path/<skill-name>/` instead of the default

### Requirement: Unified install dispatcher
The system SHALL provide a script `scripts/install.sh` that dispatches to platform-specific and content-type install scripts.

#### Scenario: Install everything
- **WHEN** user runs `./scripts/install.sh`
- **THEN** `install-claude.sh`, `install-codex.sh`, and `install-agents.sh` are all executed

#### Scenario: Install for a specific platform
- **WHEN** user runs `./scripts/install.sh --target claude`
- **THEN** only `install-claude.sh` is executed

#### Scenario: Install custom agents only
- **WHEN** user runs `./scripts/install.sh --target agents`
- **THEN** only `install-agents.sh` is executed

### Requirement: Safe install with backup
The system SHALL NOT overwrite existing files or directories that are not symlinks pointing to this repository without creating a backup first.

#### Scenario: Existing non-repo file at target path
- **WHEN** the target path exists and is NOT a symlink to a path within this repository
- **THEN** the existing path is renamed to `<path>.bak.<YYYYMMDD-HHMMSS>` before installing
- **AND** a warning is printed showing the backup location

#### Scenario: Existing symlink from this repo
- **WHEN** the target path is already a symlink pointing into this repository
- **THEN** the symlink is updated in place without creating a backup

### Requirement: Clear success messaging
The system SHALL print a summary after installation completes.

#### Scenario: Successful install
- **WHEN** install completes without errors
- **THEN** the script prints: number of skills installed, target directory used, and any next-step instructions

#### Scenario: No skills found
- **WHEN** the `skills/` directory contains no valid skill directories
- **THEN** the script prints a message explaining that no skills were found and how to add one
