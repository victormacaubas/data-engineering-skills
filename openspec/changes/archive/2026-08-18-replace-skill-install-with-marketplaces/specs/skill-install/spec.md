## ADDED Requirements

### Requirement: Git-backed marketplace catalogs
The system SHALL provide repository-hosted marketplace catalogs that Claude Code and Cursor CLI can register directly from the repository Git URL without requiring publication in either platform's public marketplace.

#### Scenario: Claude Code registers the marketplace
- **WHEN** a user adds the repository Git URL as a Claude Code marketplace
- **THEN** Claude Code discovers the repository's installable skill plugins

#### Scenario: Cursor CLI registers the marketplace
- **WHEN** a user adds the repository Git URL as a Cursor CLI marketplace
- **THEN** Cursor CLI discovers the repository's installable skill plugins

### Requirement: Independently installable skills
The marketplace catalogs SHALL expose each release-ready immediate child of `skills/` that contains `SKILL.md` as a separate installable plugin.

#### Scenario: User installs one skill
- **WHEN** a user selects one skill plugin from either marketplace
- **THEN** only that skill and the files contained in its skill directory are installed

#### Scenario: Work-in-progress and deprecated skills are excluded
- **WHEN** a skill exists below `skills/in-progress/` or `skills/deprecated/`
- **THEN** it is not listed as an installable marketplace plugin

#### Scenario: Marketplace catalogs remain aligned
- **WHEN** a release-ready skill is added, renamed, or removed
- **THEN** the Claude Code and Cursor CLI catalogs expose the same set of skill names

### Requirement: Skill plugins exclude custom agents
Marketplace-installed skill plugins SHALL NOT install or expose custom-agent definitions from the repository.

#### Scenario: Skill with agent dependency is installed
- **WHEN** a user installs a skill that depends on a custom agent
- **THEN** the marketplace installation contains the skill only
- **AND** the skill documentation identifies the separate agent-install prerequisite

### Requirement: Marketplace-managed skill updates
The system SHALL allow users to obtain skill updates by updating the registered Git-backed marketplace and its installed plugins.

#### Scenario: Repository skill changes
- **WHEN** an installed skill changes in the marketplace repository
- **AND** the user updates the marketplace or plugin through the platform
- **THEN** the platform obtains the updated skill without running a repository install script

### Requirement: Non-destructive legacy migration
The system SHALL document legacy Claude Code and Codex skill installation cleanup without automatically deleting existing skill files, directories, symlinks, or backups.

#### Scenario: Existing user migrates to marketplace skills
- **WHEN** a user has skills previously installed by the repository scripts
- **THEN** the migration guidance explains how to identify and remove legacy installations
- **AND** no marketplace or agent installation command removes those installations automatically

## REMOVED Requirements

### Requirement: Single-command install for Claude Code
**Reason**: Claude Code skills are now distributed as independently installable marketplace plugins.

**Migration**: Register the repository's Claude Code marketplace and install the desired skill plugins.

### Requirement: Single-command install for Codex
**Reason**: Codex is no longer a supported platform.

**Migration**: Existing Codex installations remain untouched; users may remove legacy symlinks manually.

### Requirement: Unified install dispatcher
**Reason**: Skill installation moves to platform marketplaces, while scripts remain responsible only for custom agents.

**Migration**: Use the platform marketplace for skills and the agent installer for custom agents.

### Requirement: Safe install with backup
**Reason**: Marketplace clients, rather than repository scripts, now manage skill installation.

**Migration**: Backup behavior remains part of the custom-agent installation capability.

### Requirement: Clear success messaging
**Reason**: Marketplace clients now report skill installation outcomes.

**Migration**: Follow the success and error information shown by Claude Code or Cursor CLI.

### Requirement: Platform selection
**Reason**: Skill platform selection is represented by the marketplace registered in Claude Code or Cursor CLI.

**Migration**: Register the marketplace in each platform where skills are needed.

### Requirement: Selectable skill installation
**Reason**: Each skill is now an independently selectable marketplace plugin.

**Migration**: Select the desired plugin entries in the platform marketplace.

### Requirement: Non-interactive skill selection
**Reason**: Repository scripts no longer automate skill installation.

**Migration**: Use supported Claude Code or Cursor CLI marketplace automation when non-interactive provisioning is required.

### Requirement: Selection preserves installed items
**Reason**: Installed-skill lifecycle is now owned by each platform's plugin manager.

**Migration**: Manage installed plugins through Claude Code or Cursor CLI; legacy script-installed skills remain untouched until manually removed.
