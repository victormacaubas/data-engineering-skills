# Authoring a skill

Skills are authored once under `skills/` and released as separate plugins in the Claude Code and Cursor CLI Git-backed catalogs.

## Use `skill-creator`

For a new skill or a significant change to an existing one, enter plan mode and use the repository's `skill-creator` skill. Do not write a new `SKILL.md` from scratch or overhaul one without an approved plan.

Never overwrite an existing `SKILL.md` without explicit confirmation:

1. Read the current file.
2. Explain what will change and why.
3. Wait for confirmation before editing.

## Package layout

Use a kebab-case directory name:

```text
skills/my-new-skill/
├── SKILL.md          # Required
├── scripts/          # Optional helpers
├── assets/           # Optional templates or static files
└── references/       # Optional supporting material
```

`SKILL.md` and its sibling directories must be self-contained. A skill must not point to another repository skill for content. The skill directory is the plugin package boundary: files outside it, including top-level custom agents, are not installed with the plugin.

## Write `SKILL.md`

A useful skill states:

- what it does and when it should run;
- the ordered method;
- the expected output;
- safety and scope guardrails;
- any platform or external-service prerequisites.

Keep instructions plain and testable. Put long reference material in `references/` and executable helpers in `scripts/`.

## Keep work in progress out of the catalogs

Skills that are not ready to release belong under `skills/in-progress/`:

```bash
mkdir -p skills/in-progress/my-new-skill
```

Neither marketplace catalog may list `skills/in-progress/` or `skills/deprecated/`. Use the skill-creator evaluation workflow and client-supported local testing while iterating. Marketplace installs are explicit snapshots from Git, not live symlinks to the checkout.

## Graduate a skill

Graduation is more than moving the directory. Complete all of these steps:

1. Move the package to the immediate release-ready level:

   ```bash
   mv skills/in-progress/my-new-skill skills/my-new-skill
   ```

2. Add a `my-new-skill` entry to `.claude-plugin/marketplace.json`.
3. Add the matching `my-new-skill` entry to `.cursor-plugin/marketplace.json`.
4. Point each native catalog entry at the skill-local source `./skills/my-new-skill`, never at the repository root.
5. Keep the plugin names and source paths aligned between the catalogs.
6. If the skill dispatches custom agents, name those separate prerequisites in both catalog descriptions and the root README. Do not bundle `agents/` into the plugin.
7. Validate and load the package in both Claude Code and Cursor CLI before release.

Do not add a fixed plugin version unless platform validation requires one. Git supplies the update identity, so routine skill edits do not require hand-maintained version bumps.

## Validate the release

At minimum, verify:

- both marketplace files parse as JSON;
- both catalogs expose the same plugin-name and skill-source set;
- every source is one immediate `skills/<name>/` directory containing `SKILL.md`;
- no entry points at the repository root, `skills/in-progress/`, or `skills/deprecated/`;
- installing the plugin includes only its `SKILL.md` and local supporting files;
- installing the plugin does not expose top-level custom agents;
- agent-dependent skill descriptions identify the exact separately installed agents;
- a representative install works from each Git-backed marketplace.

After changing a released skill, use `/plugin` in each client to refresh or update the marketplace and installed plugin before testing. An existing marketplace installation does not update immediately when the checkout changes.

## Naming conventions

| Convention | Example |
|------------|---------|
| Kebab-case directory and plugin name | `data-analysis-workflow` |
| Short and descriptive | `sql-data-analysis`, `python-code-reviewer` |
| Action- or domain-oriented | `respond-to-jira-ticket`, `stash` |

Avoid generic names such as `helper` and `utils`. Renaming or removing a released skill requires the corresponding change in both catalogs.
