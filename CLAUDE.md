## What this repo is

A collection of agent skills for Claude Code and Codex. Each skill lives in `skills/<name>/SKILL.md`. Install scripts in `scripts/` deploy them via symlink or copy.

## How to work here

### Skill authoring

- Each skill is a directory under `skills/` with a kebab-case name.
- `SKILL.md` is the only required file. It contains the full skill instructions in markdown.
- Optional subdirectories: `scripts/`, `assets/`, `references/`. These are installed as a unit alongside `SKILL.md`.
- Skills not ready to ship go in `skills/in-progress/<name>/`. The install scripts only look one level deep, so nothing inside `in-progress/` is ever installed. Move the directory up to `skills/<name>/` when it's ready.
- See `docs/authoring.md` for a step-by-step guide.

### Agent authoring

- Each agent is a single `.md` file under `agents/` with a kebab-case name (e.g. `agents/my-agent.md`). Agents are not directories.
- Every agent file starts with YAML frontmatter containing at minimum `name` and `description`. Optional fields: `model`, `tools`, `effort`.
- `agents/README.md` is the agent index — update it when adding a new agent (name, model, description).
- Agents install into `~/.claude/agents/<name>.md`. The install script is `scripts/install-agents.sh`.
- See `docs/agents.md` for a full authoring guide.

### Preserving user changes

**Never overwrite an existing `SKILL.md` without explicit confirmation.** Skills may contain hand-tuned instructions that the user doesn't want discarded.

Before editing any existing skill file:
1. Read the current content.
2. Tell the user what you plan to change and why.
3. Wait for confirmation before writing.

### Install scripts

The scripts in `scripts/` are the install contract. Changes to these scripts affect all users of the repo. Before modifying them:
- Confirm the change doesn't break the symlink-first strategy.
- Confirm backup behaviour (`.bak.<timestamp>`) is preserved.
- Run `bash -n <script>` to verify syntax after changes.

### Tracked changes (OpenSpec)

Non-trivial changes to this repo are tracked in `openspec/changes/`. Each change has a proposal, design, specs, and tasks.

- Use `/opsx:propose` to propose a new change before implementing.
- Use `/opsx:apply` to implement tasks from an active change.
- Use `/opsx:archive` to archive a completed change.

Don't make large structural changes (new scripts, new conventions) without creating an OpenSpec change first, unless the user explicitly asks for a quick edit.

## Directory layout

```
skills/          ← skill source of truth
agents/          ← custom agent definitions (single .md files)
scripts/         ← install automation
docs/            ← developer documentation
openspec/        ← tracked changes
```

## What NOT to do

- Don't create skills outside `skills/`.
- Don't create agents outside `agents/`.
- Don't edit `openspec/` artifact files unless running an OpenSpec workflow step.
