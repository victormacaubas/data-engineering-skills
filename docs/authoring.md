# Authoring a skill

Skills are authored once under `skills/<group>/` and released inside one of three domain plugins in the Claude Code and Cursor CLI Git-backed catalogs.

## Pick a group first

Every release-ready skill belongs to exactly one group, and the group directory is the plugin root:

| Group | What belongs there |
|-------|--------------------|
| `craft` | How code gets written and checked — architectural baselines, language standards, the reviews that gate a change. |
| `flow` | How work gets driven from idea to build — exploring, pressure-testing, delegating, ticketing, capture. |
| `data` | The warehouse surface — analytical SQL and governance auditing. |

The group becomes the invocation prefix: a skill in `craft` is invoked as `/craft:<skill-name>`. That makes group membership part of the skill's public name. **Moving a released skill to a different group is a breaking rename**, and it breaks silently — agent preloads that name the old prefix are skipped with only a debug-log warning. Regrouping needs its own OpenSpec change.

## Use `skill-creator`

For a new skill or a significant change to an existing one, enter plan mode and use the repository's `skill-creator` skill. Do not write a new `SKILL.md` from scratch or overhaul one without an approved plan.

Never overwrite an existing `SKILL.md` without explicit confirmation:

1. Read the current file.
2. Explain what will change and why.
3. Wait for confirmation before editing.

## Package layout

Use a kebab-case directory name inside the group:

```text
skills/craft/my-new-skill/
├── SKILL.md          # Required
├── scripts/          # Optional helpers
├── assets/           # Optional templates or static files
└── references/       # Optional supporting material
```

`SKILL.md` and its sibling directories must be self-contained. A skill must not point to another repository skill for content, including a sibling in the same group — sharing a plugin is a packaging fact, not a licence to split content across skills.

The group directory is the plugin root, so only its members ship. Files outside it, including the top-level custom agents, are never installed with the plugin.

Skill names must be unique across all three groups. The Cursor fallback installer flattens groups into one directory and will refuse to run on a collision.

## Write `SKILL.md`

A useful skill states:

- what it does and when it should run;
- the ordered method;
- the expected output;
- safety and scope guardrails;
- any platform or external-service prerequisites.

Keep instructions plain and testable. Put long reference material in `references/` and executable helpers in `scripts/`.

## Keep work in progress out of the catalogs

Skills that are not ready to release belong under `skills/in-progress/`, which is not a group and is never a plugin root:

```bash
mkdir -p skills/in-progress/my-new-skill
```

Neither marketplace catalog may list `skills/in-progress/` or `skills/deprecated/`, and neither is treated as a domain group by the catalogs or the Cursor fallback installer. Use the skill-creator evaluation workflow and client-supported local testing while iterating. Marketplace installs are explicit snapshots from Git, not live symlinks to the checkout.

## Graduate a skill

Graduation is more than moving the directory. **A skill loads only when its group entry lists it** — a directory present under a group but absent from the `skills` array loads nowhere, and nothing reports it. Complete all of these steps:

1. Move the package into its group:

   ```bash
   git mv skills/in-progress/my-new-skill skills/craft/my-new-skill
   ```

2. Add `"./my-new-skill"` to the `craft` entry's `skills` array in `.claude-plugin/marketplace.json`.
3. Add the same path to the `craft` entry's `skills` array in `.cursor-plugin/marketplace.json`.
4. Keep the paths relative to the plugin root and prefixed with `./`. The entry's `source` stays `./skills/craft` and must never be the repository root.
5. Keep the group names and member sets aligned between the catalogs.
6. Add the skill to the group's `skills/<group>/README.md` table.
7. If the skill dispatches custom agents, name those separate prerequisites in the group's catalog description and the root README. Do not bundle `agents/` into the plugin.
8. Validate and load the package in both Claude Code and Cursor CLI before release.

Do not add a fixed plugin version unless platform validation requires one. Git supplies the update identity, so routine skill edits do not require hand-maintained version bumps.

## Validate the release

At minimum, verify:

- both marketplace files parse as JSON;
- both catalogs expose the same three group names and the same member set within each group;
- every `source` is a `skills/<group>/` directory, never the repository root;
- every `skills` array path starts with `./` and resolves to a directory containing `SKILL.md`;
- the array members and the group directory's contents agree exactly, with no extras and no omissions;
- no skill name appears in more than one group;
- no entry reaches `skills/in-progress/` or `skills/deprecated/`;
- installing a group includes only its members' `SKILL.md` and local supporting files;
- installing a group does not expose top-level custom agents;
- agent-dependent skills are identified in their group's description;
- a representative install works from each Git-backed marketplace, and its skills appear as `/<group>:<skill-name>`.

## Local testing

Marketplace installs are snapshots from Git, not live symlinks to the checkout. To test before pushing, register the local path as a marketplace rather than reaching for `claude --plugin-dir`, which expects a single plugin root.

For Cursor, the fallback installer reads the checkout directly and is the fastest loop:

```bash
CURSOR_SKILLS_DIR=/tmp/cursor-skills ./scripts/install-cursor-skills.sh --group craft
```

Skills installed that way are unprefixed, so they exercise the content but not the namespacing.

After changing a released skill, use `/plugin` in each client to refresh or update the marketplace and installed plugin before testing. An existing marketplace installation does not update immediately when the checkout changes.

## Naming conventions

| Convention | Example |
|------------|---------|
| Kebab-case directory name | `data-analysis-workflow` |
| Short and descriptive | `sql-data-analysis`, `python-code-reviewer` |
| Action- or domain-oriented | `respond-to-jira-ticket`, `stash` |
| Unique across all three groups | one `structure-review`, not one per group |

Avoid generic names such as `helper` and `utils`. Don't shorten a name because the group prefix already carries the domain — `/craft:review` reads well in the menu and badly everywhere the name appears alone, including agent preloads and downstream `CLAUDE.md` files.

Renaming, removing, or regrouping a released skill requires the corresponding change in both catalogs, in every agent that preloads it, and in the group README.
