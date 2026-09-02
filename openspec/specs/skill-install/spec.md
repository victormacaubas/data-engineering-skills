## Purpose
Define how release-ready repository skills are distributed, installed, updated, and migrated through Git-backed marketplaces for Claude Code and Cursor CLI.

## Requirements

### Requirement: Git-backed marketplace catalogs
The system SHALL provide repository-hosted marketplace catalogs that Claude Code and Cursor CLI can register directly from the repository Git URL without requiring publication in either platform's public marketplace.

#### Scenario: Claude Code registers the marketplace
- **WHEN** a user adds the repository Git URL as a Claude Code marketplace
- **THEN** Claude Code discovers the repository's installable skill plugins

#### Scenario: Cursor CLI registers the marketplace
- **WHEN** a user adds the repository Git URL as a Cursor CLI marketplace
- **THEN** Cursor CLI discovers the repository's installable skill plugins

### Requirement: Independently installable skills
The marketplace catalogs SHALL expose each domain group under `skills/` as a separate installable plugin whose source is the group directory and whose `skills` array lists every release-ready member of that group.

#### Scenario: User installs one skill
- **WHEN** a user selects one domain-group plugin from either marketplace
- **THEN** every skill in that selected group, and only files within its group directory, are installed

#### Scenario: User installs one group
- **WHEN** a user selects one group plugin from either marketplace
- **THEN** every skill listed in that entry's `skills` array is installed
- **AND** no skill outside that group is installed

#### Scenario: Work-in-progress and deprecated skills are excluded
- **WHEN** a skill exists below `skills/in-progress/` or `skills/deprecated/`
- **THEN** it is not a member of any group plugin's `skills` array

#### Scenario: Catalog and directory agree
- **WHEN** a release-ready skill directory exists under a group
- **THEN** the group entry's `skills` array lists it
- **AND** every path in that array resolves to a directory containing `SKILL.md`

#### Scenario: Marketplace catalogs remain aligned
- **WHEN** a release-ready skill is added, moved between groups, or removed
- **THEN** the Claude Code and Cursor CLI catalogs expose the same group names and the same member set within each group

### Requirement: Skill plugins exclude custom agents
Claude Code and Cursor CLI marketplace-installed skill plugins SHALL NOT install or expose custom-agent definitions from the repository, and no Claude/Cursor catalog entry SHALL use a source that contains `agents/`.

#### Scenario: Skill with agent dependency is installed
- **WHEN** a user installs a Claude Code or Cursor CLI group containing a skill that depends on a custom agent
- **THEN** that marketplace installation contains skills only
- **AND** its documentation identifies the separate agent-install prerequisite

#### Scenario: Group plugin is installed
- **WHEN** a user installs any group plugin
- **THEN** the installed package contains only that group's skill directories
- **AND** the group descriptions identify the separate agent-install prerequisites for member skills that depend on custom agents

#### Scenario: Repository root is not a plugin source
- **WHEN** a catalog entry is validated
- **THEN** its source resolves to a group directory under `skills/`
- **AND** never to the repository root

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

### Requirement: Codex skills install from the shared source tree
The repository SHALL provide a symlink-first Codex installer that exposes release-ready skills from the shared `skills/<group>/<name>/` source tree.

#### Scenario: User installs Codex skills
- **WHEN** a user runs `scripts/install-codex-skills.sh --skills all`
- **THEN** every release-ready directory containing `SKILL.md` is symlinked into `~/.codex/skills/`
- **AND** no skill under `skills/in-progress/` or `skills/deprecated/` is available

#### Scenario: Codex selects a group
- **WHEN** a user runs `scripts/install-codex-skills.sh --group data`
- **THEN** only the data group's skills are installed into the flat Codex skills target

### Requirement: Namespaced skill invocation
Skills installed from a group plugin SHALL invoke as `<group>:<skill-name>`, where the group is the marketplace plugin name and the skill name is the frontmatter `name` in its `SKILL.md`.

#### Scenario: User invokes an installed skill
- **WHEN** a user has installed the `craft` group
- **THEN** its member skills are available as `/craft:structure-review`, `/craft:code-audit`, `/craft:architecture-baseline`, and `/craft:python-engineering-standards`

#### Scenario: Skill names are unique across groups
- **WHEN** the catalogs are validated
- **THEN** no skill name appears in more than one group

### Requirement: Group membership is part of a skill's public name
A skill's group SHALL be treated as part of its published identifier, so moving a skill between groups is a breaking change.

#### Scenario: A skill is proposed for a different group
- **WHEN** a change would move a skill from one group to another
- **THEN** it is treated as a breaking rename requiring its own tracked change
- **AND** the repository guidance records that agent preloads and downstream references break silently when the group changes

### Requirement: Cursor fallback installer supports the grouped layout
The Cursor fallback installer SHALL discover release-ready skills nested under group directories and install them into the Cursor skills directory without group prefixes.

#### Scenario: Fallback installs every release-ready skill
- **WHEN** a user runs `./scripts/install-cursor-skills.sh --skills all`
- **THEN** every skill under a group directory containing `SKILL.md` is installed
- **AND** no skill under `skills/in-progress/` or `skills/deprecated/` is installed

#### Scenario: Fallback installs one group
- **WHEN** a user runs `./scripts/install-cursor-skills.sh --group data`
- **THEN** only that group's skills are installed

#### Scenario: Fallback skills are unprefixed
- **WHEN** a skill is installed by the fallback installer
- **THEN** it is placed at `<cursor-skills-dir>/<skill-name>/` and invokes without a group prefix

#### Scenario: Unknown group is rejected
- **WHEN** a user names a group that does not exist
- **THEN** the installer exits with an error listing the valid groups
- **AND** installs nothing

#### Scenario: Existing safety behaviour is preserved
- **WHEN** the fallback installer runs against an existing target
- **THEN** symlink-first installation, `--copy`, timestamped backups for non-repository targets, and refresh-without-backup for repository-owned symlinks behave as before
