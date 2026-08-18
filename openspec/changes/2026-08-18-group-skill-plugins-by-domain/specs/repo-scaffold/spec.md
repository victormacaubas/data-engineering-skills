## MODIFIED Requirements

### Requirement: Repository guidance reflects the distribution contract
The repository's agent-facing guidance SHALL describe domain-grouped marketplace plugins, the namespaced skill invocation form, platform-specific agent sources, and the OpenSpec requirement for install-contract changes.

#### Scenario: Coding agent opens the repository
- **WHEN** a coding agent reads the repository guidance
- **THEN** it identifies `skills/<group>/<name>/` as the shared skill source of truth
- **AND** identifies the Claude Code and Cursor CLI marketplace catalogs and the three domain groups they expose
- **AND** identifies the Claude Code and Cursor CLI agent source directories
- **AND** does not describe Codex as a supported platform

#### Scenario: Coding agent references a skill
- **WHEN** repository guidance or an agent definition names an installed skill
- **THEN** it uses the `<group>:<skill-name>` form
- **AND** records that group membership is part of the published name

### Requirement: README with complete onboarding
The `README.md` SHALL document marketplace registration, group plugin installation, the namespaced invocation form, agent installation, the Cursor fallback installer, and migration from the previous per-skill plugins.

#### Scenario: New user installs skills
- **WHEN** a user follows the README
- **THEN** they register the marketplace and install the `craft`, `flow`, and `data` plugins
- **AND** they learn that skills invoke as `/<group>:<skill-name>`
- **AND** they find the group-to-skill table

#### Scenario: Existing user migrates from per-skill plugins
- **WHEN** a user has the eleven previous per-skill plugins installed
- **THEN** the README explains uninstalling them and installing the three group plugins
- **AND** no documented command removes their existing installations automatically
