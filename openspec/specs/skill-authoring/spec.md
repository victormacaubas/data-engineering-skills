## ADDED Requirements

### Requirement: Skill directory convention
Each skill SHALL reside in `skills/<skill-name>/` where `<skill-name>` is a kebab-case identifier.

#### Scenario: Valid skill structure
- **WHEN** a directory exists at `skills/<name>/` containing a `SKILL.md` file
- **THEN** install scripts SHALL recognize it as a valid skill and process it for installation

#### Scenario: Missing SKILL.md
- **WHEN** a directory exists at `skills/<name>/` but does NOT contain a `SKILL.md` file
- **THEN** install scripts SHALL skip it and print a warning

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
The repository SHALL include documentation at `docs/authoring.md` explaining how to create a new skill.

#### Scenario: Developer creates a new skill
- **WHEN** a developer reads `docs/authoring.md`
- **THEN** they find step-by-step instructions for creating a skill directory, writing SKILL.md, and testing the skill locally
