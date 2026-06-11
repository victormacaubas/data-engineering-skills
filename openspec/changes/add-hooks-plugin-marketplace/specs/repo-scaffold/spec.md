## MODIFIED Requirements

### Requirement: README with complete onboarding
The repository SHALL include a `README.md` at the root that provides complete onboarding information, including how to install hooks via the Claude Code plugin marketplace.

#### Scenario: New user reads README
- **WHEN** a user clones the repository and reads README.md
- **THEN** they find: repo purpose, directory structure, how to add a skill, how to install for Codex, how to install for Claude Code, how to update, and troubleshooting guidance

#### Scenario: User learns how to install hooks
- **WHEN** a user reads the README's hooks section
- **THEN** they find that hooks ship as marketplace plugins (not symlinked skills/agents)
- **AND** they find the install flow: `/plugin marketplace add victormacaubas/data-engineering-skills` followed by `/plugin install <plugin>@data-engineering-skills`
- **AND** they find how to refresh installed plugins with `/plugin marketplace update`

### Requirement: CLAUDE.md with repo-specific guidance
The repository SHALL include a `CLAUDE.md` at the root that instructs Claude Code how to work within this project, including how to author plugins and how hooks are distributed.

#### Scenario: Claude Code opens this repo
- **WHEN** Claude Code starts a session in this repository
- **THEN** it reads CLAUDE.md and follows its guidance for skill authoring, preserving user changes, and using OpenSpec for tracked changes

#### Scenario: Claude Code authors or distributes a hook
- **WHEN** Claude Code is asked to add or change a hook in this repo
- **THEN** CLAUDE.md guides it to author the hook as a plugin under `plugins/<name>/` and to list it in `.claude-plugin/marketplace.json`
- **AND** CLAUDE.md records that hooks are marketplace-distributed and that the install scripts must not be changed to install hooks
