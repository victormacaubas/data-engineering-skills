## Purpose
Define the repository conventions and documentation required to author self-contained skills with valid package structure.

## Requirements

### Requirement: Skill directory convention
Each release-ready skill SHALL reside in `skills/<group>/<skill-name>/`, where `<group>` is a domain group directory and `<skill-name>` is a kebab-case identifier unique across all groups.

#### Scenario: Valid skill structure
- **WHEN** a directory exists at `skills/<group>/<name>/` containing a `SKILL.md` file
- **THEN** it is a valid release-ready skill eligible for its group's catalog entry

#### Scenario: Missing SKILL.md
- **WHEN** a directory exists at `skills/<group>/<name>/` but does NOT contain a `SKILL.md` file
- **THEN** it is not a skill, and tooling that discovers skills SHALL skip it

#### Scenario: Non-release directories are not groups
- **WHEN** a directory exists at `skills/in-progress/` or `skills/deprecated/`
- **THEN** it is not treated as a domain group and its contents are not cataloged

### Requirement: SKILL.md as the skill contract
Every skill SHALL have a `SKILL.md` file at its root that contains the full skill instructions.

#### Scenario: Skill content format
- **WHEN** a `SKILL.md` file is read by an agent
- **THEN** it SHALL contain markdown-formatted instructions that the agent can follow directly

### Requirement: Optional subdirectories
Skills MAY include optional subdirectories for organization.

#### Scenario: Skill with helper scripts
- **WHEN** a skill has a `scripts/` subdirectory
- **THEN** the entire skill directory (including `scripts/`) SHALL be installed as a unit

#### Scenario: Skill with assets
- **WHEN** a skill has an `assets/` subdirectory
- **THEN** the entire skill directory (including `assets/`) SHALL be installed as a unit

### Requirement: Authoring documentation
The repository SHALL include documentation at `docs/authoring.md` explaining how to create a new skill, which group it belongs to, how to publish it, and how the Codex installer exposes the shared source.

#### Scenario: Developer creates a new skill
- **WHEN** a developer reads `docs/authoring.md`
- **THEN** they find step-by-step instructions for choosing a group, creating the skill directory, writing `SKILL.md`, and testing the skill locally

#### Scenario: Developer graduates a skill
- **WHEN** a developer moves a skill out of `skills/in-progress/`
- **THEN** the documented steps place it under a group directory
- **AND** add it to the `skills` array of that group's entry in both marketplace catalogs
- **AND** confirm that the Codex installer discovers the new skill

### Requirement: Group membership is declared, not inferred
A skill SHALL be loadable only when its group's catalog entry lists it explicitly.

#### Scenario: Skill added to a group directory without a catalog entry
- **WHEN** a skill directory exists under a group but is absent from that group's `skills` array
- **THEN** catalog validation fails and identifies the unlisted skill

#### Scenario: Catalog lists a skill that does not exist
- **WHEN** a group's `skills` array names a path with no `SKILL.md`
- **THEN** catalog validation fails and identifies the missing path
