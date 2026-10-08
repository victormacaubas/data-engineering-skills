## MODIFIED Requirements

### Requirement: README with complete onboarding
The `README.md` SHALL have one `## Install` section ordered Claude Code, Codex, then Cursor CLI. It SHALL document marketplace registration, group/plugin installation, mod installation for Claude Code, the namespaced invocation form, Codex symlink installation, agent installation, updates, the Cursor fallback installer, and migration from the previous per-skill plugins.

#### Scenario: New user reads README
- **WHEN** a user opens `README.md`
- **THEN** they find the repository purpose and directory structure
- **AND** a single `## Install` section ordered Claude Code, Codex, then Cursor CLI
- **AND** installation and update guidance for each platform
- **AND** migration, uninstall, and troubleshooting guidance

#### Scenario: New user installs skills
- **WHEN** a user follows the README
- **THEN** they register the marketplace and install the `craft`, `flow`, and `data` plugins
- **AND** they learn that skills invoke as `/<group>:<skill-name>`
- **AND** they find the group-to-skill table

#### Scenario: New user installs a mod
- **WHEN** a user follows the Claude Code subsection of `## Install`
- **THEN** they find the table of available mods and the command that installs one
- **AND** they learn that mods are available for Claude Code only

#### Scenario: User installs from Codex
- **WHEN** a user follows the Codex subsection of `## Install`
- **THEN** they install skills with `scripts/install-codex-skills.sh`
- **AND** they can find the documented symlink and copy update procedure
- **AND** they learn that Codex agents install from `agents/codex/` through `install-agents.sh --platform codex`

#### Scenario: Existing user migrates from per-skill plugins
- **WHEN** a user has the eleven previous per-skill plugins installed
- **THEN** the README explains uninstalling them and installing the three group plugins
- **AND** no documented command removes their existing installations automatically

### Requirement: Repository guidance reflects the distribution contract
The repository's agent-facing guidance SHALL describe domain-grouped marketplace plugins, Claude Code mods under `mods/`, the namespaced skill invocation form, platform-specific agent sources, and the OpenSpec requirement for install-contract changes.

#### Scenario: Coding agent opens the repository
- **WHEN** a coding agent reads the repository guidance
- **THEN** it identifies `skills/<group>/<name>/` as the shared skill source of truth
- **AND** identifies the Claude Code and Cursor CLI marketplace catalogs and the three domain groups they expose
- **AND** identifies `mods/<name>/` as the source of Claude Code mods, each cataloged as its own plugin in the Claude Code catalog only
- **AND** identifies `scripts/install-codex-skills.sh` and `agents/codex/` as the Codex distribution sources
- **AND** identifies the Claude Code, Cursor CLI, and Codex agent source directories
- **AND** describes Codex as a supported platform

#### Scenario: Coding agent references a skill
- **WHEN** repository guidance or an agent definition names an installed skill
- **THEN** it uses the `<group>:<skill-name>` form
- **AND** records that group membership is part of the published name
