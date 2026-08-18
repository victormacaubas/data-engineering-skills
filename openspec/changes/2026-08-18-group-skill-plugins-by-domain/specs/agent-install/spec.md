## ADDED Requirements

### Requirement: Agent skill preloads use namespaced identifiers
Every Claude Code agent that preloads a repository skill SHALL name it in the `<group>:<skill-name>` form matching its marketplace plugin.

#### Scenario: Agent preloads a repository skill
- **WHEN** `agents/claude/structure-reviewer.md` preloads the structure-review skill
- **THEN** its `skills` frontmatter names `craft:structure-review`
- **AND** the same namespaced form is used for `craft:code-audit` in `code-auditor` and `craft:python-engineering-standards` in `implementer`

#### Scenario: Bare skill names are rejected
- **WHEN** an agent definition preloads a repository skill by bare name
- **THEN** the reference is treated as broken, because a bare name does not resolve to a plugin-provided skill

#### Scenario: Preload failure is silent
- **WHEN** an agent names a skill that does not resolve
- **THEN** the agent still launches and the failure appears only in the debug log
- **AND** the agents documentation records this, so a preload change is verified by running the agent rather than by a successful launch

#### Scenario: Group change breaks preloads
- **WHEN** a skill moves to a different group
- **THEN** every agent preloading it must be updated in the same change
