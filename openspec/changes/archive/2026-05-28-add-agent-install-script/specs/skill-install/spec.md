## MODIFIED Requirements

### Requirement: Unified install dispatcher
The system SHALL provide a script `scripts/install.sh` that dispatches to platform-specific and content-type install scripts.

#### Scenario: Install everything
- **WHEN** user runs `./scripts/install.sh`
- **THEN** `install-claude.sh`, `install-codex.sh`, and `install-agents.sh` are all executed

#### Scenario: Install for a specific platform
- **WHEN** user runs `./scripts/install.sh --target claude`
- **THEN** only `install-claude.sh` is executed

#### Scenario: Install custom agents only
- **WHEN** user runs `./scripts/install.sh --target agents`
- **THEN** only `install-agents.sh` is executed
