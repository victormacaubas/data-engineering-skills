## MODIFIED Requirements

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
- **THEN** its source resolves to a group directory under `skills/`, or, in the Claude Code catalog only, to a mod directory under `mods/`
- **AND** never to the repository root
