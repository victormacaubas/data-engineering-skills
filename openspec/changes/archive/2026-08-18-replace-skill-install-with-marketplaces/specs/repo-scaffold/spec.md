## ADDED Requirements

### Requirement: Repository guidance reflects the distribution contract
The repository's agent-facing guidance SHALL describe marketplace-managed skills, platform-specific agent sources, and the OpenSpec requirement for install-contract changes.

#### Scenario: Coding agent opens the repository
- **WHEN** a coding agent reads the repository guidance
- **THEN** it identifies `skills/` as the shared skill source of truth
- **AND** identifies the Claude Code and Cursor CLI marketplace catalogs
- **AND** identifies the Claude Code and Cursor CLI agent source directories
- **AND** does not describe Codex as a supported platform

## MODIFIED Requirements

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
