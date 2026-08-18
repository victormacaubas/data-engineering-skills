## Purpose
Define the repository onboarding, contributor guidance, and baseline files needed to maintain and distribute its skills and custom agents safely.

## Requirements

### Requirement: README with complete onboarding
The repository SHALL include a root `README.md` that provides complete onboarding for marketplace-installed skills and script-installed agents on Claude Code and Cursor CLI.

#### Scenario: New user reads README
- **WHEN** a user opens `README.md`
- **THEN** they find the repository purpose and directory structure
- **AND** instructions for registering the Git-backed Claude Code marketplace
- **AND** instructions for registering the Git-backed Cursor marketplace in Cursor CLI without public marketplace submission
- **AND** instructions for installing individual skills
- **AND** instructions for installing Claude Code and Cursor CLI agents
- **AND** update, migration, uninstall, and troubleshooting guidance
- **AND** no active Codex installation instructions

### Requirement: Repository guidance reflects the distribution contract
The repository's agent-facing guidance SHALL describe marketplace-managed skills, platform-specific agent sources, and the OpenSpec requirement for install-contract changes.

#### Scenario: Coding agent opens the repository
- **WHEN** a coding agent reads the repository guidance
- **THEN** it identifies `skills/` as the shared skill source of truth
- **AND** identifies the Claude Code and Cursor CLI marketplace catalogs
- **AND** identifies the Claude Code and Cursor CLI agent source directories
- **AND** does not describe Codex as a supported platform

### Requirement: CLAUDE.md with repo-specific guidance
The repository SHALL include a `CLAUDE.md` at the root that instructs Claude Code how to work within this project.

#### Scenario: Claude Code opens this repo
- **WHEN** Claude Code starts a session in this repository
- **THEN** it reads CLAUDE.md and follows its guidance for skill authoring, preserving user changes, and using OpenSpec for tracked changes

### Requirement: CLAUDE.md preserves user changes
The CLAUDE.md SHALL instruct Claude Code to never overwrite existing user skill files without explicit confirmation.

#### Scenario: Editing an existing skill
- **WHEN** Claude Code is asked to modify a skill that already has user content
- **THEN** it follows CLAUDE.md guidance to preserve existing content and confirm before destructive changes

### Requirement: .gitignore covers common exclusions
The repository SHALL include a `.gitignore` that excludes OS files, editor files, and build artifacts.

#### Scenario: Clean git status after clone
- **WHEN** a user clones and opens the repo in their editor
- **THEN** .DS_Store, .vscode/, .idea/, and similar files do not appear in git status
