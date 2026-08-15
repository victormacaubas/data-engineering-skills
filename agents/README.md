# Agents

Custom agent definitions for [Claude Code](https://claude.ai/code). Each file is a self-contained markdown file with YAML frontmatter that Claude Code loads as a subagent.

## Available agents

| Agent | Model | Description |
|-------|-------|-------------|
| `pathfinder` | `claude-sonnet-5[1m]` | Explore and understand existing material before writing code — get the lay of the land in an unfamiliar codebase, map a module or directory, read up on documentation, or answer a bounded question across code, docs, tickets, wikis, and data warehouses. Returns a compressed structured briefing of direct answers, per-source findings, coverage, confidence, assumptions, and open questions. Read-only by tool allowlist and designed for parallel spawning across sources. |
| `implementer` | `claude-sonnet-5[1m]` | Implements tasks from a plan, list, or set of instructions. Writes production code, tests, and fixtures, runs verification (pytest, ruff, mypy), and returns a structured pass/fail report. Use for any bounded implementation work: feature slices, bug fixes, refactors, test additions, or migrations. Does not commit or update plan tracking; the orchestrator owns those. Designed for parallel spawning across disjoint task slices. |
| `code-reviewer` | `claude-opus-4-6[1m]` | Use to review, audit, grade, critique, or gate code in any language — a file, module, PR, or branch diff — runs the code-audit skill end-to-end and returns the JSON artifact path plus the headline verdict and score. Assesses defects (security, correctness, performance) ranked by severity; not the shape of the change. |
| `structure-reviewer` | `claude-opus-4-6[1m]` | Use to review the shape of a finished change before it merges or gets archived — module cohesion and size, state ownership, duplication, test design, pattern fit, naming, and whether CLAUDE.md, ADRs, import contracts, and an OpenSpec change's own design were actually followed. Runs the structure-review skill end-to-end and returns the markdown report path plus the gate verdict and top fix-list items. Findings ranked by leverage, not severity. |
| `researcher` | `claude-sonnet-4-6[1m]` | Research a topic on the web and return structured findings with sources. Lightweight mid-session lookups for syntax, libraries, APIs, announcements, or technology comparisons. Web-only by tool allowlist, no filesystem access.

## Installing

```bash
./scripts/install-agents.sh
```

Agents are symlinked into `~/.claude/agents/` by default. See [docs/agents.md](../docs/agents.md) for full install and authoring instructions.
