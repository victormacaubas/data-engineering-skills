## What this repo is

A collection of skills and custom agents for Claude Code and Cursor CLI. Skills are distributed individually through Git-backed catalogs at `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`. Custom agents are installed by the scripts in `scripts/`.

Codex is retired. Mention it only in clearly labeled guidance for inspecting and removing legacy skill installs.

## How to work here

### Skill authoring

**For any new or significantly modified skill, use the `skill-creator` skill and enter plan mode first.** Don't write SKILL.md from scratch or overhaul one without a plan the user has approved.

- Skills are self-contained. A skill and its `references/` carry everything needed to follow it, and should never point at another skill for content.
- Each skill is a directory under `skills/` with a kebab-case name.
- `SKILL.md` is the only required file. It contains the full skill instructions in markdown.
- Optional subdirectories are `scripts/`, `assets/`, and `references/`. A marketplace entry must use the skill directory as its source so these files are packaged with `SKILL.md` and top-level agents remain excluded.
- Skills not ready to ship go in `skills/in-progress/<name>/`. The catalogs must not list `in-progress/` or `deprecated/`.
- Graduating, renaming, or removing a skill requires matching plugin-name/source changes in both marketplace catalogs. Validate JSON, catalog parity, and skill-local source isolation.
- Marketplace updates are explicit client operations, not live symlink updates.
- If a skill depends on custom agents, document the separate agent prerequisites in both catalog descriptions and README onboarding. Current dependencies include `architecture-baseline` on `researcher`, `orchestrate` on `implementer`/`pathfinder`/`researcher`, and `scout` on `pathfinder`/`researcher`.
- See `docs/authoring.md` for a step-by-step guide.

### Agent authoring

- Every supported agent has complete matching-name definitions at `agents/claude/<name>.md` and `agents/cursor/<name>.md`.
- Every file starts with YAML frontmatter containing at least `name` and `description`; `name` must match the filename.
- Claude and Cursor variants may use different model and capability fields. Preserve the same role and safety intent with native controls; use Cursor's `readonly: true` for non-writing agents.
- `agents/README.md` is the agent index. Update both platform entries, models, descriptions, and intentional differences together.
- Agents install into `~/.claude/agents/` and `~/.cursor/agents/`. See `docs/agents.md`.
- Marketplace plugins must not expose or install the top-level custom agents.
- See `docs/agents.md` for a full authoring guide.

### Preserving user changes

**Never overwrite an existing `SKILL.md` without explicit confirmation.** Skills may contain hand-tuned instructions that the user doesn't want discarded.

Before editing any existing skill file:
1. Read the current content.
2. Tell the user what you plan to change and why.
3. Wait for confirmation before writing.

### Install scripts

The scripts install custom agents only. `scripts/install.sh` is the user-facing wizard; `scripts/install-agents.sh` accepts `--platform claude|cursor|both`, `--agents all|none|name[,name...]`, and `--copy`.

- Agent sources are `agents/claude/` and `agents/cursor/`.
- Default targets are `~/.claude/agents/` and `~/.cursor/agents/`.
- `CLAUDE_AGENTS_DIR` and `CURSOR_AGENTS_DIR` override those targets.
- Installation is symlink-first, preserves copy mode and timestamped backups, and does not remove unselected agents.
- Legacy skill helpers are failing migration shims. No script or marketplace operation removes legacy skill files, symlinks, directories, or backups automatically.

Changes to scripts affect all users of the repo. Before modifying them:
- Confirm the change doesn't break the symlink-first strategy.
- Confirm backup behaviour (`.bak.<timestamp>`) is preserved.
- Run `bash -n <script>` to verify syntax after changes.

### Tracked changes (OpenSpec)

Non-trivial changes to this repo are tracked in `openspec/changes/`. Each change has a proposal, design, specs, and tasks.

- Use `/opsx:propose` to propose a new change before implementing.
- Use `/opsx:apply` to implement tasks from an active change.
- Use `/opsx:archive` to archive a completed change.

**Use OpenSpec for any change that:**
- Alters repo structure (new top-level directories, moving files around)
- Adds or modifies install scripts or wizards
- Introduces new tooling (npm, pip, brew, package managers)
- Adds new scripts under `scripts/`
- Changes the install contract in any way

Don't make these changes without creating an OpenSpec change first, unless the user explicitly asks for a quick edit.

## Directory layout

```
.claude-plugin/marketplace.json  ← Claude Code skill catalog
.cursor-plugin/marketplace.json  ← Cursor CLI skill catalog
skills/                          ← shared skill source of truth
agents/claude/                   ← Claude Code agent definitions
agents/cursor/                   ← Cursor CLI agent definitions
scripts/                         ← agent installation and migration shims
docs/                            ← developer documentation
openspec/                        ← tracked changes
```

## What NOT to do

- Don't create skills outside `skills/`.
- Don't create agent definitions outside their platform directory.
- Don't use the repository root as a marketplace plugin source.
- Don't add active Codex installation instructions.
- Don't delete legacy user installs or backups automatically.
- Don't edit `openspec/` artifact files unless running an OpenSpec workflow step.
