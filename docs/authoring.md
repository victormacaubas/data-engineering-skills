# Authoring a skill

This guide walks through creating a new skill from scratch and testing it locally.

## Recommended: use the `skill-creator` skill

The easiest way to create a skill is with the [`skill-creator`](https://github.com/anthropics/claude-code-skills) skill from Anthropic. It scaffolds the directory structure, writes a `SKILL.md` template, and can run evals to test performance — all in one step.

In a Claude Code session:

```
/skill-creator
```

Follow the prompts to name and describe your skill. Then install it with the scripts below.

The manual steps below are for reference or when you prefer to author the skill file directly.

---

## 1. Create the skill directory

Skill names are kebab-case. Create a directory under `skills/`:

```bash
mkdir skills/my-new-skill
```

## 2. Write `SKILL.md`

`SKILL.md` is the only required file. It contains the full instructions the agent will follow when the skill is invoked. Create it:

```bash
touch skills/my-new-skill/SKILL.md
```

### What to put in `SKILL.md`

Write markdown-formatted instructions that are self-contained — the agent reads only this file when executing the skill. A good `SKILL.md` includes:

- **What the skill does** — one-sentence purpose at the top.
- **When to use it** — conditions or triggers that make this skill relevant.
- **Steps** — ordered list of actions the agent should take.
- **Output format** — what the agent should produce (code, a report, a message, etc.).
- **Guardrails** — what the agent should NOT do (e.g. "never delete files").

### Example structure

```markdown
# my-new-skill

One-sentence description of what this skill does.

## When to use

Describe the trigger conditions.

## Steps

1. First, do X.
2. Then, do Y.
3. Finally, produce Z.

## Output

Describe the expected output format.

## Guardrails

- Never do A.
- Always confirm before B.
```

## 3. Add optional subdirectories

If your skill needs helper files, add them in subdirectories:

```
skills/my-new-skill/
├── SKILL.md          # Required
├── scripts/          # Shell scripts the skill calls
├── assets/           # Images, templates, static files
└── references/       # External docs, examples
```

The entire skill directory is installed as a unit — all subdirectories arrive alongside `SKILL.md`.

## 4. Install locally to test

Symlink the skill into Claude Code:

```bash
./scripts/install.sh --platform claude --skills my-new-skill --agents none
```

The script prints which skills it installed and where. Because it uses symlinks, any edit to `SKILL.md` is immediately live — no re-install needed.

To test with Codex:

```bash
./scripts/install.sh --platform codex --skills my-new-skill
```

## 5. Verify the install

For Claude Code:

```bash
ls -la ~/.claude/skills/my-new-skill
# Should show: ... -> /path/to/this/repo/skills/my-new-skill/
```

For Codex:

```bash
ls -la ~/.codex/skills/my-new-skill
```

## 6. Iterate

Edit `skills/my-new-skill/SKILL.md` and test in your agent session. Changes are live immediately via the symlink.

## Staging work-in-progress skills

If your skill isn't ready to ship yet, put it in `skills/in-progress/` instead of `skills/`:

```bash
mkdir -p skills/in-progress/my-new-skill
touch skills/in-progress/my-new-skill/SKILL.md
```

The install scripts only glob `skills/*/` (one level deep), so anything inside `in-progress/` is never installed. It's tracked in git, visible to collaborators, but harmless to end users.

When the skill is ready, graduate it:

```bash
mv skills/in-progress/my-new-skill skills/my-new-skill
./scripts/install.sh
```

## Naming conventions

| Convention | Example |
|------------|---------|
| Kebab-case directory name | `data-analysis-workflow` |
| Short, descriptive | `sql-data-analysis`, `python-code-reviewer` |
| Action-oriented or domain-oriented | `respond-to-jira-ticket`, `stash` |

Avoid generic names (`helper`, `utils`) — names appear in the agent's skill list and should be self-explanatory.
