# data-engineering-skills

My personal collection of agent skills for [Claude Code](https://claude.ai/code) and [OpenAI Codex](https://platform.openai.com/docs/codex). Author skills once, install them everywhere with a single command.

## Skills

| Skill | Description |
|-------|-------------|
| `data-governance` | Query Snowflake's `ACCOUNT_USAGE` schema for governance tasks: masking policies, classification, access history, role analysis, and user auditing. |
| `jira-ticket` | Write Jira tickets and comments in plain, human-sounding language via the Atlassian MCP. |
| `python-code-reviewer` | Non-destructive Python code review as a markdown report, scoring security, correctness, performance, and readability. |
| `python-engineering-standards` | Canonical Python coding standards for production code: layout, typing, config, logging, error handling, testing, and packaging. |
| `sql-data-analysis` | SQL standards for analytics, reporting, and transformation work across BigQuery, Snowflake, Redshift, Postgres, and more. |
| `stash` | Park raw content into an Obsidian vault inbox for later processing. |

## Repository structure

```
data-engineering-skills/
├── skills/                  # One subdirectory per skill
│   └── <skill-name>/
│       ├── SKILL.md         # Required — the skill content
│       ├── scripts/         # Optional — helper scripts
│       ├── assets/          # Optional — images, templates
│       └── references/      # Optional — external docs, examples
├── scripts/
│   ├── install.sh           # Unified installer (dispatches to agent scripts)
│   ├── install-claude.sh    # Install into Claude Code
│   └── install-codex.sh     # Install into Codex
├── docs/
│   └── authoring.md         # How to create a new skill
└── openspec/                # Tracked changes (OpenSpec workflow)
```

## Installation

### Claude Code

```bash
./scripts/install-claude.sh
```

Skills are symlinked into `~/.claude/skills/` by default. Override the target with `CLAUDE_SKILLS_DIR`:

```bash
CLAUDE_SKILLS_DIR=/custom/path ./scripts/install-claude.sh
```

Use `--copy` for a copy-based install (e.g. CI):

```bash
./scripts/install-claude.sh --copy
```

### Codex

```bash
./scripts/install-codex.sh
```

Skills are symlinked into `~/.codex/skills/` by default. Override the target with `CODEX_SKILLS_DIR`:

```bash
CODEX_SKILLS_DIR=/custom/path ./scripts/install-codex.sh
```

### Both agents at once

```bash
./scripts/install.sh                   # installs for both
./scripts/install.sh --target claude   # Claude Code only
./scripts/install.sh --target codex    # Codex only
./scripts/install.sh --target codex --copy
```

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
./scripts/install.sh
```

## Uninstalling

Remove the symlinks (or copies) from the target directory:

```bash
rm -rf ~/.claude/skills/<skill-name>
rm -rf ~/.codex/skills/<skill-name>
```

## Troubleshooting

**`bash: ./scripts/install.sh: Permission denied`**
Run `chmod +x scripts/*.sh` once, then retry.

**Script reports `[BACKUP]` for a skill**
An existing file at the target path was not a symlink to this repo. It was renamed to `<path>.bak.<timestamp>` before installing. Check the backup if you had local edits.

**Skill doesn't appear in Claude Code**
Confirm the symlink exists: `ls -la ~/.claude/skills/`. If the link points to a path that no longer exists (e.g. after a branch switch), re-run `install-claude.sh`.

**Codex path is wrong**
Set `CODEX_SKILLS_DIR` to the correct path for your Codex version and re-run `install-codex.sh`.
