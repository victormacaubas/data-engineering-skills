## What this repo is

A collection of skills and custom agents for Claude Code, Codex, and Cursor CLI. Skills are distributed as three domain plugins — `craft`, `flow`, and `data` — through Git-backed Claude/Cursor catalogs; Codex skills install from this checkout through a symlink-first script. Custom agents are installed by the scripts in `scripts/`.

Claude Code namespaces plugin skills, so an installed skill is invoked and referenced as `<group>:<skill-name>` — `/craft:structure-review`, never a bare `/structure-review`. There is no way to turn the prefix off.

Codex skills install into `~/.codex/skills/` through `scripts/install-codex-skills.sh`; Codex custom agents are TOML files in `agents/codex/` installed by `scripts/install-agents.sh --platform codex`.

## How to work here

### Model-specific prompting

Applies to skills and agents alike. `docs/prompting.md` holds the general principles; this is how to get the part that changes with each model.

- **Know which model runs it, then read that model's current guide before writing.** For an existing agent, read `model:` in each platform variant. For an existing skill, find what loads it: the main session, plus any agent that preloads it.
- **For a new agent or skill, there's nothing to read yet.** Propose the model and effort following the repo's pattern (Sonnet for bounded workers, Opus for judgment and review) with a one-line reason; for a skill, ask what will load it. Confirm with the user before writing.
- **Check the guide for that exact model version, not the latest one.** Anthropic models: [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), which links each model's page. OpenAI models: [Model guidance](https://developers.openai.com/api/docs/guides/latest-model), selecting the pinned version in its switcher.
- **Where the model's guide and `docs/prompting.md` disagree, the model's guide wins.** Record what you adopted and declined in the *Decisions log* in `docs/prompting.md`.

### Skill authoring

**For any new or significantly modified skill, use the `skill-creator` skill and enter plan mode first.** Don't write SKILL.md from scratch or overhaul one without a plan the user has approved.

- Skills are self-contained. A skill and its `references/` carry everything needed to follow it, and should never point at another skill for content — including a sibling in the same group.
- **Don't over-explain in a skill body.** No meta-commentary on what the skill does, why it exists, or what it will carry you through; whoever is reading it already loaded it. Write the instruction and the trap it avoids, not a case for following it.
- Each release-ready skill is a kebab-case directory at `skills/<group>/<name>/`, where `<group>` is `craft`, `flow`, or `data`. Skill names must be unique across all three groups.
- `SKILL.md` is the only required file. It contains the full skill instructions in markdown.
- Optional subdirectories are `scripts/`, `assets/`, and `references/`. A catalog entry sources the group directory, so these files are packaged with `SKILL.md` and top-level agents remain excluded.
- **A skill loads only when its group entry lists it.** Each entry carries an explicit `skills` array of `./<skill-name>` paths; a directory present on disk but absent from the array loads nowhere, and nothing reports it.
- Skills not ready to ship go in `skills/in-progress/<name>/`. `in-progress/` and `deprecated/` are not groups and must never be cataloged or treated as plugin roots.
- Graduating, renaming, or removing a skill requires matching changes to both catalogs' `skills` arrays and the group's `README.md`. Validate JSON, catalog parity, array/directory agreement, and cross-group name uniqueness.
- **A skill's group is part of its public name.** Moving one between groups is a breaking rename: it changes the invocation identifier and silently breaks every agent preload and downstream `CLAUDE.md` naming it. Regrouping needs its own OpenSpec change.
- Marketplace updates are explicit client operations, not live symlink updates.
- If a skill depends on custom agents, document the prerequisites in the group's catalog description and README onboarding. Current dependencies: `/craft:architecture-baseline` on `researcher`, `/flow:orchestrate` on `implementer`/`pathfinder`/`researcher`/`structure-reviewer`, and `/flow:scout` on `pathfinder`/`researcher`.
- See `docs/authoring.md` for a step-by-step guide.

### Agent authoring

- Every supported agent has complete matching-name definitions at `agents/claude/<name>.md`, `agents/codex/<name>.toml`, and `agents/cursor/<name>.md`.
- Markdown agent files start with YAML frontmatter; Codex TOML agent files contain `name`, `description`, and `developer_instructions`. In every variant, `name` matches the filename.
- Claude and Cursor variants may use different model and capability fields. Preserve the same role and safety intent with native controls; use Cursor's `readonly: true` for non-writing agents.
- Claude agents preload skills with a namespaced `skills:` entry (`craft:structure-review`). A preload that doesn't resolve is skipped with only a debug-log warning, so the agent launches and returns output without it — verify a preload change by *running* the agent, never by a clean launch.
- Cursor variants have no `skills` field. They name the skill in prose and try the namespaced form first, then the bare one, which is what the Cursor fallback installer produces.
- `agents/README.md` is the agent index. Update all platform entries, models, descriptions, and intentional differences together.
- Agents install into `~/.claude/agents/`, `~/.codex/agents/`, and `~/.cursor/agents/`. See `docs/agents.md`.
- Marketplace plugins must not expose or install the top-level custom agents.
- See `docs/agents.md` for a full authoring guide.

### Preserving user changes

**Never overwrite an existing `SKILL.md` without explicit confirmation.** Skills may contain hand-tuned instructions that the user doesn't want discarded.

Before editing any existing skill file:
1. Read the current content.
2. Tell the user what you plan to change and why.
3. Wait for confirmation before writing.

### Install scripts

`scripts/install.sh` is the user-facing agent wizard; `scripts/install-agents.sh` accepts `--platform claude|cursor|codex|both`, `--agents all|none|name[,name...]`, and `--copy`. `scripts/install-codex-skills.sh` installs Codex skills; `scripts/install-cursor-skills.sh` remains the Cursor fallback where plugin imports are blocked.

- Agent sources are `agents/claude/`, `agents/codex/`, and `agents/cursor/`.
- The Cursor skill fallback discovers `skills/<group>/<name>/`, skipping `in-progress/` and `deprecated/`. It accepts `--skills` (bare names) or `--group`, never both, and installs into a flat target, so fallback skills are unprefixed. That divergence from the namespaced marketplace form is deliberate — don't "fix" it.
- Default targets are `~/.claude/agents/`, `~/.codex/agents/`, and `~/.cursor/agents/`.
- `CLAUDE_AGENTS_DIR`, `CODEX_AGENTS_DIR`, and `CURSOR_AGENTS_DIR` override those targets.
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
agents/codex/                    ← Codex TOML agent definitions
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
- Don't delete legacy user installs or backups automatically.
- Don't edit `openspec/` artifact files unless running an OpenSpec workflow step.
