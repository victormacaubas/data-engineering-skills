<p align="center">
  <img src="assets/personal-logo.png" alt="Personal logo" width="160">
</p>

# data-engineering-skills

A collection of skills and custom agents for [Claude Code](https://claude.ai/code) and Cursor CLI. Skills are installed individually from Git-backed marketplace catalogs. Custom agents are installed from this checkout with the repository scripts.

## Skills

| Skill | Description |
|-------|-------------|
| `architecture-baseline` | Decide a new project's architectural constraints before feature work. Requires the separately installed `researcher` agent. |
| `code-audit` | Audit code in any language and write a machine-readable report covering correctness, security, performance, architecture, error handling, and readability. |
| `data-governance` | Query Snowflake's `ACCOUNT_USAGE` schema for masking, classification, access history, roles, and user auditing. |
| `grill-me` | Pressure-test ideas and change artifacts before implementation. |
| `orchestrate` | Drive workers to implement a bounded plan. Requires the separately installed `implementer`, `pathfinder`, and `researcher` agents. |
| `python-engineering-standards` | Apply production Python standards for layout, typing, configuration, logging, error handling, testing, and packaging. |
| `scout` | Explore work whose shape is not settled and return a decision-ready briefing. Requires the separately installed `pathfinder` and `researcher` agents. |
| `sql-data-analysis` | Apply SQL standards for analytics, reporting, extraction, and transformation. |
| `stash` | Park raw content in an Obsidian vault inbox for later processing. |
| `structure-review` | Review the shape and project conformance of a finished change before merge or archive. |
| `write-ticket` | Write Jira tickets and comments in plain language through the Atlassian MCP. |

Each release-ready `skills/<name>/` directory is a separate plugin. Its `SKILL.md` and any local `scripts/`, `assets/`, and `references/` are installed together. Repository custom agents are never included in a skill plugin.

## Install skills

Use this repository URL:

```text
https://github.com/victormacaubas/data-engineering-skills.git
```

### Claude Code

In Claude Code, add the marketplace:

```text
/plugin marketplace add https://github.com/victormacaubas/data-engineering-skills.git
```

Install each skill by its marketplace-qualified name:

```text
/plugin install sql-data-analysis@data-engineering-skills
```

Repeat the install command for each skill you want.

### Cursor CLI

In an interactive Cursor CLI session:

```text
/plugin marketplace add https://github.com/victormacaubas/data-engineering-skills.git
```

Or register the marketplace from a shell:

```bash
agent plugin marketplace add https://github.com/victormacaubas/data-engineering-skills.git
```

Then open `/plugin` in Cursor CLI to browse the registered marketplace and install individual skills. Public Cursor Marketplace submission is not required.

#### Restricted-team fallback

If Cursor CLI reports `[permission_denied] Third-party plugin imports are disabled by team admin settings`, ask an admin to import this repository as a Team Marketplace. When plain user skills are permitted, you can instead clone this repository and install skills directly:

```bash
./scripts/install-cursor-skills.sh --skills all
./scripts/install-cursor-skills.sh --skills architecture-baseline,sql-data-analysis
```

The fallback symlinks skills into `~/.cursor/skills/` by default. It preserves unselected skills and backs up conflicting non-repository paths. Use `--copy` for copies or override the target:

```bash
CURSOR_SKILLS_DIR=/custom/cursor/skills \
  ./scripts/install-cursor-skills.sh --skills all
```

This fallback installs plain Cursor skills, not plugins. Marketplace installation remains the preferred distribution path.

### Skills that need custom agents

Marketplace plugins contain skills only. Install these agents separately before using an agent-dependent skill:

| Skill | Required agents |
|-------|-----------------|
| `architecture-baseline` | `researcher` |
| `orchestrate` | `implementer`, `pathfinder`, `researcher` |
| `scout` | `pathfinder`, `researcher` |

For example:

```bash
./scripts/install-agents.sh --platform both --agents implementer,pathfinder,researcher
```

## Install custom agents

Clone the repository before running its agent installer:

```bash
git clone https://github.com/victormacaubas/data-engineering-skills.git
cd data-engineering-skills
```

Run the interactive agent-only wizard:

```bash
./scripts/install.sh
```

For non-interactive installs:

```bash
./scripts/install-agents.sh --platform claude --agents all
./scripts/install-agents.sh --platform cursor --agents pathfinder,researcher
./scripts/install-agents.sh --platform both --agents implementer,pathfinder,researcher
```

The default mode creates symlinks. Use `--copy` when links are unsuitable:

```bash
./scripts/install-agents.sh --platform both --agents all --copy
```

Claude Code agents install into `~/.claude/agents/`; Cursor CLI agents install into `~/.cursor/agents/`. Override either target with an environment variable:

```bash
CLAUDE_AGENTS_DIR=/custom/claude/agents \
  ./scripts/install-agents.sh --platform claude --agents all

CURSOR_AGENTS_DIR=/custom/cursor/agents \
  ./scripts/install-agents.sh --platform cursor --agents all
```

The installer backs up an existing non-repository target as `<path>.bak.<timestamp>`. It does not remove unselected agents.

## Updating

Skill updates are explicit. Open `/plugin` in the client where the skill is installed, refresh or update the registered marketplace, and update the installed plugin. Marketplace skills do not track this checkout as live symlinks.

Cursor fallback symlinks reflect edits after `git pull`. If fallback skills were installed with `--copy`, rerun `install-cursor-skills.sh` after pulling.

Agent symlinks reflect edits after `git pull`. If agents were installed with `--copy`, rerun the same agent install command after pulling.

## Uninstalling

Use `/plugin` in Claude Code or Cursor CLI to uninstall and manage marketplace skills.

For a Cursor fallback installation, remove the confirmed skill path from `~/.cursor/skills/`.

To uninstall a custom agent, remove its file or symlink from the relevant target:

```bash
rm ~/.claude/agents/<agent-name>.md
rm ~/.cursor/agents/<agent-name>.md
```

Removing an agent does not uninstall any skill that depends on it.

## Migrating legacy skill installs

Earlier releases installed skills directly under `~/.claude/skills/`. Codex support has ended, but old Codex installs may still exist under `~/.codex/skills/`. No marketplace command or agent installer removes old files, symlinks, directories, or `.bak.<timestamp>` backups.

Install and verify the marketplace plugin first. Then inspect any legacy target before deleting it:

```bash
ls -ld ~/.claude/skills/<skill-name> ~/.codex/skills/<skill-name> 2>/dev/null
readlink ~/.claude/skills/<skill-name> 2>/dev/null || true
readlink ~/.codex/skills/<skill-name> 2>/dev/null || true
```

Remove only a path you have confirmed is an obsolete repository-owned link or an unneeded copy. Preserve customized copies and backups. If both a marketplace plugin and a legacy install remain, the client may discover the skill twice.

## Repository structure

```text
data-engineering-skills/
├── .claude-plugin/marketplace.json  # Claude Code skill catalog
├── .cursor-plugin/marketplace.json  # Cursor CLI skill catalog
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── scripts/
│       ├── assets/
│       └── references/
├── agents/
│   ├── claude/<agent-name>.md
│   └── cursor/<agent-name>.md
├── scripts/                         # Agent installers, Cursor skill fallback, migration shims
├── docs/                            # Authoring guides
└── openspec/                        # Tracked changes
```

See [docs/authoring.md](docs/authoring.md) to create or graduate a skill and [docs/agents.md](docs/agents.md) to author platform-specific agents.

## Troubleshooting

**A marketplace is not listed**

Check that the Git URL is reachable, then add it again with the marketplace-add command for that client. A recent client version with Git-backed marketplace support is required. If Cursor team policy blocks third-party imports, use the documented Team Marketplace or plain-skill fallback.

**A skill is missing from a marketplace**

Only release-ready immediate children of `skills/` are cataloged. Work under `skills/in-progress/` and `skills/deprecated/` is excluded.

**A skill appears twice**

Inspect `~/.claude/skills/<skill-name>` and, for legacy cleanup only, `~/.codex/skills/<skill-name>`. Remove only the obsolete installation after verifying whether it is a symlink, copy, or customized directory.

**An agent-dependent skill cannot dispatch a worker**

Install the required agent names for the current platform with `scripts/install-agents.sh`, then restart or reload the client if needed.

**An installed agent does not appear**

Check `~/.claude/agents/` or `~/.cursor/agents/` and rerun the installer for that platform. If copy mode was used, rerun after every source update.

**The installer reports `[BACKUP]`**

An existing agent target was not a repository-owned symlink. The installer moved it to `<path>.bak.<timestamp>` before installing the selected variant. Review the backup before removing it.
