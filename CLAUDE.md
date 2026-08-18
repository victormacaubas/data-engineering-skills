## What this repo is

A collection of skills and custom agents for Claude Code and Cursor CLI. Skills are distributed as three domain plugins — `craft`, `flow`, and `data` — through Git-backed catalogs at `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`. Custom agents are installed by the scripts in `scripts/`.

Claude Code namespaces plugin skills, so an installed skill is invoked and referenced as `<group>:<skill-name>` — `/craft:structure-review`, never a bare `/structure-review`. There is no way to turn the prefix off.

Codex is retired. Mention it only in clearly labeled guidance for inspecting and removing legacy skill installs.

## How to work here

### Skill authoring

**For any new or significantly modified skill, use the `skill-creator` skill and enter plan mode first.** Don't write SKILL.md from scratch or overhaul one without a plan the user has approved.

- Skills are self-contained. A skill and its `references/` carry everything needed to follow it, and should never point at another skill for content — including a sibling in the same group.
- Each release-ready skill is a kebab-case directory at `skills/<group>/<name>/`, where `<group>` is `craft`, `flow`, or `data`. Skill names must be unique across all three groups.
- `SKILL.md` is the only required file. It contains the full skill instructions in markdown.
- Optional subdirectories are `scripts/`, `assets/`, and `references/`. A catalog entry sources the group directory, so these files are packaged with `SKILL.md` and top-level agents remain excluded.
- **A skill loads only when its group entry lists it.** Each entry carries an explicit `skills` array of `./<skill-name>` paths; a directory present on disk but absent from the array loads nowhere, and nothing reports it.
- Skills not ready to ship go in `skills/in-progress/<name>/`. `in-progress/` and `deprecated/` are not groups and must never be cataloged or treated as plugin roots.
- Graduating, renaming, or removing a skill requires matching changes to both catalogs' `skills` arrays and the group's `README.md`. Validate JSON, catalog parity, array/directory agreement, and cross-group name uniqueness.
- **A skill's group is part of its public name.** Moving one between groups is a breaking rename: it changes the invocation identifier and silently breaks every agent preload and downstream `CLAUDE.md` naming it. Regrouping needs its own OpenSpec change.
- Marketplace updates are explicit client operations, not live symlink updates.
- If a skill depends on custom agents, document the prerequisites in the group's catalog description and README onboarding. Current dependencies: `/craft:architecture-baseline` on `researcher`, `/flow:orchestrate` on `implementer`/`pathfinder`/`researcher`, and `/flow:scout` on `pathfinder`/`researcher`.
- See `docs/authoring.md` for a step-by-step guide.

### Agent authoring

- Every supported agent has complete matching-name definitions at `agents/claude/<name>.md` and `agents/cursor/<name>.md`.
- Every file starts with YAML frontmatter containing at least `name` and `description`; `name` must match the filename.
- Claude and Cursor variants may use different model and capability fields. Preserve the same role and safety intent with native controls; use Cursor's `readonly: true` for non-writing agents.
- Claude agents preload skills with a namespaced `skills:` entry (`craft:structure-review`). A preload that doesn't resolve is skipped with only a debug-log warning, so the agent launches and returns output without it — verify a preload change by *running* the agent, never by a clean launch.
- Cursor variants have no `skills` field. They name the skill in prose and try the namespaced form first, then the bare one, which is what the Cursor fallback installer produces.
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

`scripts/install.sh` is the user-facing agent wizard; `scripts/install-agents.sh` accepts `--platform claude|cursor|both`, `--agents all|none|name[,name...]`, and `--copy`. `scripts/install-cursor-skills.sh` is the only script that installs skills, and only as a fallback where Cursor blocks plugin imports.

- Agent sources are `agents/claude/` and `agents/cursor/`.
- The Cursor skill fallback discovers `skills/<group>/<name>/`, skipping `in-progress/` and `deprecated/`. It accepts `--skills` (bare names) or `--group`, never both, and installs into a flat target, so fallback skills are unprefixed. That divergence from the namespaced marketplace form is deliberate — don't "fix" it.
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
.claude-plugin/marketplace.json  ← Claude Code catalog: craft, flow, data
.cursor-plugin/marketplace.json  ← Cursor CLI catalog: same three groups
skills/craft/<name>/             ← plugin root: architecture, standards, reviews
skills/flow/<name>/              ← plugin root: explore, plan, delegate, ticket
skills/data/<name>/              ← plugin root: SQL standards, warehouse governance
skills/in-progress/<name>/       ← not a group, not cataloged
skills/deprecated/<name>/        ← not a group, not cataloged
agents/claude/                   ← Claude Code agent definitions
agents/cursor/                   ← Cursor CLI agent definitions
scripts/                         ← agent installers, Cursor skill fallback, migration shims
docs/                            ← developer documentation
openspec/                        ← tracked changes
```

## What NOT to do

- Don't create skills outside `skills/<group>/`.
- Don't add a skill to a group directory without adding it to both catalogs' `skills` arrays.
- Don't move a released skill between groups as a tidy-up; it's a breaking rename.
- Don't shorten a skill name because the group prefix carries the domain.
- Don't create agent definitions outside their platform directory.
- Don't use the repository root as a marketplace plugin source — it would ship `agents/` inside every plugin.
- Don't reference a repository skill by bare name in a Claude agent preload.
- Don't add active Codex installation instructions.
- Don't delete legacy user installs or backups automatically.
- Don't edit `openspec/` artifact files unless running an OpenSpec workflow step.
