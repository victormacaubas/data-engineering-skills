<p align="center">
  <img src="assets/personal-logo.png" alt="Personal logo" width="160">
</p>

# data-engineering-skills

My personal collection of agent skills for [Claude Code](https://claude.ai/code) and [OpenAI Codex](https://platform.openai.com/docs/codex). Author skills once, install them everywhere with a single command.

## Skills

| Skill | Description |
|-------|-------------|
| `code-audit` | Language-agnostic code audit emitting a machine-parseable JSON artifact to `./reviews/`. Finds bugs, security issues, and architecture problems with severity-counted findings. Loads per-language packs (Python, SQL, JS/TS, React, Terraform, Bash). Works reliably in subagent contexts. |
| `data-governance` | Query Snowflake's `ACCOUNT_USAGE` schema for governance tasks: masking policies, classification, access history, role analysis, and user auditing. |
| `grill-me` | Pressure-test raw ideas, drafted plans, and OpenSpec changes before implementation, sharpening scope, trade-offs, scenarios, specs, and tasks. |
| `jira-ticket` | Write Jira tickets and comments in plain, human-sounding language via the Atlassian MCP. |
| `python-engineering-standards` | Canonical Python coding standards for production code: layout, typing, config, logging, error handling, testing, and packaging. |
| `sql-data-analysis` | SQL standards for analytics, reporting, and transformation work across BigQuery, Snowflake, Redshift, Postgres, and more. |
| `stash` | Park raw content into an Obsidian vault inbox for later processing. |

## Agents

Custom agent definitions for Claude Code. Each file is a self-contained markdown file that Claude Code loads as a subagent.

| Agent | Model | Description |
|-------|-------|-------------|
| `codebase-explorer` | `claude-sonnet-4-6[1m]` | Explore a directory or codebase region and return a structured handoff summary of architecture, entry points, key files, conventions, dependencies, and open questions. |
| `implementer` | `claude-sonnet-4-6[1m]` | Implements code from a plan, task list, or set of instructions. Writes production code, tests, and fixtures, runs verification (pytest, ruff, mypy), and returns a structured pass/fail report. Use for any bounded implementation work: feature slices, bug fixes, refactors, test additions, or migrations. Designed for parallel spawning across disjoint task slices. |

## Repository structure

```
data-engineering-skills/
├── skills/                  # One subdirectory per skill
│   └── <skill-name>/
│       ├── SKILL.md         # Required — the skill content
│       ├── scripts/         # Optional — helper scripts
│       ├── assets/          # Optional — images, templates
│       └── references/      # Optional — external docs, examples
├── agents/                  # One .md file per custom agent
│   ├── README.md            # Agent index
│   └── <agent-name>.md      # Agent definition with YAML frontmatter
├── scripts/
│   ├── install.sh           # Interactive unified installer
│   ├── install-claude.sh    # Install skills into Claude Code
│   ├── install-codex.sh     # Install skills into Codex
│   └── install-agents.sh    # Install agents into ~/.claude/agents/
├── docs/
│   ├── authoring.md         # How to create a new skill
│   └── agents.md            # How to author and install agents
└── openspec/                # Tracked changes (OpenSpec workflow)
```

## Prerequisites

- [uv](https://docs.astral.sh/uv/) — used by the `implementer` agent for Python execution. Install with `curl -LsSf https://astral.sh/uv/install.sh | sh` or `brew install uv`.

## Installation

Run the unified installer:

```bash
./scripts/install.sh
```

The wizard asks which platform to install for, which skills to install, which Claude Code custom agents to install, and whether to use symlinks or copies.

For automation, pass selections explicitly:

```bash
./scripts/install.sh --platform both --skills all --agents all
./scripts/install.sh --platform claude --skills sql-data-analysis,data-governance --agents codebase-explorer
./scripts/install.sh --platform codex --skills python-engineering-standards
./scripts/install.sh --platform agents --agents codebase-explorer
```

Use `--copy` for a copy-based install instead of symlinks:

```bash
./scripts/install.sh --platform both --skills all --agents all --copy
```

When `--platform both` is selected, skills are installed for both Claude Code and Codex. Custom agents are installed for Claude Code only, and the installer prints a note explaining that Codex custom-agent installation is not supported yet.

### Target directories

Skills are symlinked into `~/.claude/skills/` and `~/.codex/skills/` by default. Custom agents are symlinked into `~/.claude/agents/`. Override targets with environment variables:

```bash
CLAUDE_SKILLS_DIR=/custom/claude/skills ./scripts/install.sh --platform claude --skills all --agents none
CODEX_SKILLS_DIR=/custom/codex/skills ./scripts/install.sh --platform codex --skills all
CLAUDE_AGENTS_DIR=/custom/claude/agents ./scripts/install.sh --platform agents --agents all
```

### Direct helper scripts

The platform-specific scripts remain available for direct use:

```bash
./scripts/install-claude.sh --skills all
./scripts/install-codex.sh --skills sql-data-analysis
./scripts/install-agents.sh --agents codebase-explorer
```

Calling a helper without a selection still installs all valid items for that helper.

## Adding a skill

See [docs/authoring.md](docs/authoring.md) for a step-by-step guide.

Quick version:

1. Create `skills/<your-skill-name>/SKILL.md`
2. Write your skill instructions in `SKILL.md`
3. Re-run the install script — symlinks update automatically

## Updating

Because installs use symlinks by default, edits to any `SKILL.md` in this repo are immediately reflected in the target agent directory. No re-install needed.

To pick up newly added skills after pulling:

```bash
./scripts/install.sh --platform both --skills all --agents all
```

## Adding an agent

See [docs/agents.md](docs/agents.md) for a full authoring guide.

Quick version:

1. Create `agents/<your-agent-name>.md` with YAML frontmatter (`name`, `description`, optionally `model` and `tools`).
2. Write the agent instructions below the frontmatter.
3. Re-run the install script — symlinks update automatically.

## Uninstalling

Remove the symlinks (or copies) from the target directory:

```bash
rm -rf ~/.claude/skills/<skill-name>
rm -rf ~/.codex/skills/<skill-name>
rm -f ~/.claude/agents/<agent-name>.md
```

## Troubleshooting

**`bash: ./scripts/install.sh: Permission denied`**
Run `chmod +x scripts/*.sh` once, then retry.

**Script reports `[BACKUP]` for a skill**
An existing file at the target path was not a symlink to this repo. It was renamed to `<path>.bak.<timestamp>` before installing. Check the backup if you had local edits.

**Skill doesn't appear in Claude Code**
Confirm the symlink exists: `ls -la ~/.claude/skills/`. If the link points to a path that no longer exists (e.g. after a branch switch), re-run `./scripts/install.sh`.

**Agent doesn't appear in Claude Code**
Confirm the symlink exists: `ls -la ~/.claude/agents/`. If the link is broken, re-run `./scripts/install.sh --platform agents --agents all`.

**Codex path is wrong**
Set `CODEX_SKILLS_DIR` to the correct path for your Codex version and re-run `./scripts/install.sh --platform codex --skills all`.
