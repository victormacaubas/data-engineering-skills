# Agents

Custom agent definitions for [Claude Code](https://claude.ai/code). Each file is a self-contained markdown file with YAML frontmatter that Claude Code loads as a subagent.

## Available agents

| Agent | Model | Description |
|-------|-------|-------------|
| `codebase-explorer` | `claude-sonnet-4-6[1m]` | Explore a directory or codebase region and return a structured handoff summary of architecture, entry points, key files, conventions, dependencies, direct answers, coverage, confidence, assumptions, and questions. Read-only and designed for parallel spawning across multiple directories or modules. |
| `implementer` | `claude-sonnet-4-6[1m]` | Implements code from a plan, task list, or set of instructions. Writes production code, tests, and fixtures, runs verification (pytest, ruff, mypy), and returns a structured pass/fail report. Use for any bounded implementation work: feature slices, bug fixes, refactors, test additions, or migrations. Does not commit or update plan tracking; the orchestrator owns those. Designed for parallel spawning across disjoint task slices. |

## Installing

```bash
./scripts/install-agents.sh
```

Agents are symlinked into `~/.claude/agents/` by default. See [docs/agents.md](../docs/agents.md) for full install and authoring instructions.
