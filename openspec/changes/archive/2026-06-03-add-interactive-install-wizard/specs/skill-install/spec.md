## MODIFIED Requirements

### Requirement: Unified install dispatcher
The system SHALL provide a script `scripts/install.sh` that acts as the primary installer entry point for platform-specific skills and supported custom agents.

#### Scenario: Interactive install wizard by default
- **WHEN** user runs `./scripts/install.sh` without explicit selection flags from an interactive terminal
- **THEN** the script prompts the user to choose the install platform, skills to install, supported custom agents to install, and install mode

#### Scenario: Install for a specific platform
- **WHEN** user runs `./scripts/install.sh --platform claude` with non-interactive skill selections
- **THEN** only Claude Code skills are installed

#### Scenario: Install custom agents only
- **WHEN** user runs `./scripts/install.sh --platform agents` with non-interactive agent selections
- **THEN** only `install-agents.sh` is executed for the selected custom agents

#### Scenario: Install everything non-interactively
- **WHEN** user runs `./scripts/install.sh --platform both --skills all --agents all`
- **THEN** Claude Code skills, Codex skills, and Claude Code custom agents are installed

#### Scenario: Non-interactive invocation without selections
- **WHEN** user runs `./scripts/install.sh` without explicit selection flags in a non-interactive context
- **THEN** the script exits with an error explaining which non-interactive flags are required

## ADDED Requirements

### Requirement: Platform selection
The unified installer SHALL allow users to choose the target platform before installing skills.

#### Scenario: Claude Code selected
- **WHEN** user selects Claude Code
- **THEN** selected skills are installed into the Claude Code skills directory

#### Scenario: Codex selected
- **WHEN** user selects Codex
- **THEN** selected skills are installed into the Codex skills directory

#### Scenario: Both platforms selected
- **WHEN** user selects both platforms
- **THEN** selected skills are installed into both the Claude Code and Codex skills directories

### Requirement: Selectable skill installation
The system SHALL allow users to install all skills or a selected subset of skills from the `skills/` directory.

#### Scenario: All skills selected
- **WHEN** user selects all skills
- **THEN** every valid skill directory under `skills/` is installed for the selected platform or platforms

#### Scenario: Skill subset selected
- **WHEN** user selects one or more skill names
- **THEN** only those valid skill directories are installed for the selected platform or platforms

#### Scenario: Invalid skill selected non-interactively
- **WHEN** user provides a skill name that does not exist in `skills/`
- **THEN** the script exits with an error listing the invalid skill name

#### Scenario: Invalid skill choice entered interactively
- **WHEN** user enters an invalid interactive skill selection
- **THEN** the wizard reports the invalid choice and asks for the selection again

### Requirement: Non-interactive skill selection
The unified installer SHALL support explicit non-interactive skill selections for automation.

#### Scenario: Non-interactive all skills
- **WHEN** user runs `./scripts/install.sh --platform codex --skills all`
- **THEN** all valid skills are installed into the Codex skills directory without prompting

#### Scenario: Non-interactive skill subset
- **WHEN** user runs `./scripts/install.sh --platform claude --skills sql-data-analysis,data-governance`
- **THEN** only `sql-data-analysis` and `data-governance` are installed into the Claude Code skills directory without prompting

### Requirement: Selection preserves installed items
The system SHALL NOT remove unselected already-installed skills during selective installation.

#### Scenario: Previously installed skill is not selected
- **WHEN** a repo-owned skill symlink already exists in the target directory
- **AND** user runs a selective install that does not include that skill
- **THEN** the existing symlink remains in place
