## ADDED Requirements

### Requirement: README with complete onboarding
The repository SHALL include a `README.md` at the root that provides complete onboarding information.

#### Scenario: New user reads README
- **WHEN** a user clones the repository and reads README.md
- **THEN** they find: repo purpose, directory structure, how to add a skill, how to install for Codex, how to install for Claude Code, how to update, and troubleshooting guidance

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
