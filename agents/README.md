# Agents

Complete custom-agent definitions for Claude Code and Cursor CLI live in separate platform directories:

```text
agents/
├── claude/
│   └── <agent-name>.md
└── cursor/
    └── <agent-name>.md
```

Every supported agent has one variant in each directory with the same filename and frontmatter `name`. Review both variants together when changing an agent.

## Available agents

| Agent | Variants | Claude Code model | Cursor CLI model | Description | Intentional Cursor CLI difference |
|-------|----------|-------------------|------------------|-------------|-----------------------------------|
| `pathfinder` | [Claude](claude/pathfinder.md) · [Cursor](cursor/pathfinder.md) | `claude-sonnet-5[1m]` | `claude-sonnet-5[effort=high,context=1m]` | Explores code, documents, tickets, wikis, and data warehouses and returns a compressed, source-grounded briefing. | Uses `readonly: true`. Cursor pins Sonnet 5 with high effort and 1M context, while using available read/MCP capabilities instead of Claude's tool allowlist. |
| `researcher` | [Claude](claude/researcher.md) · [Cursor](cursor/researcher.md) | `claude-sonnet-5[1m]` | `claude-sonnet-5[effort=high,context=1m]` | Researches bounded web questions and returns structured findings with fetched sources. | Uses `readonly: true`. Prompt references use generic web-search and page-fetching capabilities because Claude-specific tool identifiers are not portable. |
| `implementer` | [Claude](claude/implementer.md) · [Cursor](cursor/implementer.md) | `claude-sonnet-5[1m]` | `claude-sonnet-5[effort=high,context=1m]` | Implements bounded plan slices, writes code and tests, runs verification, and returns a structured status report. | Not read-only because it writes implementation artifacts. Cursor cannot reproduce Claude's tool allowlist, `permissionMode`, or skill preloading; the prompt loads `craft:python-engineering-standards` when installed and otherwise records the fallback. |
| `code-auditor` | [Claude](claude/code-auditor.md) · [Cursor](cursor/code-auditor.md) | `claude-opus-4-6[1m]` | `gpt-5.6-sol[effort=xhigh,context=1m]` | Runs a defect-focused code audit and writes the JSON review artifact before returning its verdict and score. | Not read-only because it writes `.code-audit/` reports. Cursor cannot restrict writes to only that report path or preload `craft:code-audit`; prompt guardrails preserve the source-read-only contract and require loading the installed skill. |
| `structure-reviewer` | [Claude](claude/structure-reviewer.md) · [Cursor](cursor/structure-reviewer.md) | `claude-opus-4-6[1m]` | `gpt-5.6-sol[effort=xhigh,context=1m]` | Reviews structure and project conformance, writes a markdown report, and returns the gate verdict and highest-leverage fixes. | Not read-only because it writes `.structure-review/` reports. Cursor cannot restrict writes to only that report path or preload `craft:structure-review`; prompt guardrails preserve the source-read-only contract and require loading the installed skill. |

## Platform behavior

Claude Code variants retain their existing model pins, tool allowlists, permission modes, effort settings, and skill preloads. Cursor CLI variants use only supported frontmatter: `name`, `description`, `model`, `readonly`, and `is_background`. The review agents pin GPT-5.6 Sol; the remaining agents pin Claude Sonnet 5. All request high effort and 1M context, and none sets `is_background`.

### Skill preloads are namespaced

Claude Code namespaces every plugin-provided skill as `<plugin-name>:<skill-name>`, so a `skills:` preload must name the marketplace plugin too. All three preloading agents draw from the `craft` plugin:

| Agent | Preload |
|---|---|
| `implementer` | `craft:python-engineering-standards` |
| `code-auditor` | `craft:code-audit` |
| `structure-reviewer` | `craft:structure-review` |

Two consequences worth knowing before changing any of these:

- **A preload that doesn't resolve fails silently.** Claude Code skips it and writes a warning to the debug log; the agent still launches and still produces output, just without the skill. A successful launch therefore proves nothing. Verify a preload change by running the agent and confirming the skill's method actually shows up in its behaviour.
- **The prefix is the plugin name, so group membership is part of the identifier.** Moving a skill to a different group breaks every preload naming it, silently, per the point above. Regrouping is a breaking change and needs its own tracked change.

Cursor CLI has no frontmatter equivalent for Claude's granular tool allowlists, `permissionMode`, `effort`, or `skills`. `readonly: true` provides an enforceable read-only boundary for `pathfinder` and `researcher`. Writing agents omit `readonly` so they can produce implementation or report artifacts; their prompt-level write restrictions remain operational guidance rather than a CLI-enforced path allowlist.

## Installing

```bash
./scripts/install-agents.sh --platform claude --agents all
./scripts/install-agents.sh --platform cursor --agents all
./scripts/install-agents.sh --platform both --agents pathfinder,implementer
```

Agents are symlinked into `~/.claude/agents/` or `~/.cursor/agents/` by default; the installer also supports copy mode and target-directory overrides. See [docs/agents.md](../docs/agents.md) for full install and authoring instructions.
