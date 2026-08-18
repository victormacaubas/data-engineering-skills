## Why

Claude Code namespaces every plugin-provided skill as `<plugin-name>:<skill-name>`, with no opt-out. Because each marketplace entry currently sources a single `skills/<name>/` directory, the plugin name and the skill name are the same string, so every skill invokes as `/structure-review:structure-review`.

The redundancy is cosmetic. The defect it exposes is not. Three Claude agents preload skills by bare name — `skills: [structure-review]` — and a bare name does not resolve to a plugin-provided skill. Claude Code skips an unresolvable preload and logs only to the debug log, so `structure-reviewer`, `code-auditor`, and `implementer` currently run without the skill each one exists to run, and nothing surfaces the failure.

Grouping the eleven skills into three domain plugins gives each skill a prefix that carries information, and forces the broken preload identifiers to be corrected in the same change.

## What Changes

- **BREAKING**: Replace the eleven per-skill marketplace plugins with three domain plugins — `craft`, `flow`, and `data`. Skills invoke as `/craft:structure-review`, `/flow:orchestrate`, `/data:sql-data-analysis`.
- **BREAKING**: Move each skill directory one level, from `skills/<name>/` to `skills/<group>/<name>/`. Each group directory becomes a plugin root.
- **BREAKING**: Existing users uninstall the eleven per-skill plugins and install three domain plugins. No automatic migration.
- Replace catalog auto-correspondence with an explicit `skills` array per entry, listing each member relative to the group's plugin root.
- Keep every skill's directory name and frontmatter `name` unchanged, so the second half of each identifier is stable.
- Correct the `skills:` preload identifiers in `agents/claude/{code-auditor,implementer,structure-reviewer}.md` to `craft:<skill>`, and the prose in both platform variants that names each skill.
- Fix `scripts/install-cursor-skills.sh`, whose one-level discovery finds no skills under the grouped layout, and add group-based selection.
- Record that a skill's group membership is part of its public invocation name, so moving a skill between groups is a breaking rename rather than a tidy-up.
- Update `README.md`, `docs/authoring.md`, `docs/agents.md`, `agents/README.md`, and `CLAUDE.md` for the grouped layout, the graduation flow, and the namespaced invocation form.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-install`: Distribute skills as three domain-grouped marketplace plugins whose roots are group directories, and repair the Cursor fallback installer for the grouped layout.
- `skill-authoring`: Require every release-ready skill to live under a group directory and be listed in both catalogs' `skills` arrays.
- `agent-install`: Require agent skill preloads to use plugin-namespaced identifiers.
- `repo-scaffold`: Describe the grouped `skills/` layout, the namespaced invocation form, and the group-membership constraint.

## Impact

- Affected manifests: `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json` drop from eleven entries to three, each gaining a `skills` array.
- Affected source layout: `skills/<name>/` becomes `skills/<group>/<name>/` for all eleven release-ready skills. `skills/in-progress/` and `skills/deprecated/` are unchanged. `agents/` is unchanged.
- Affected agents: three Claude agent definitions whose preloads are currently failing silently, plus prose in their Cursor variants.
- Affected scripts: `scripts/install-cursor-skills.sh` discovery, selection, and help text.
- Affected documentation: `README.md`, `docs/authoring.md`, `docs/agents.md`, `agents/README.md`, `CLAUDE.md`.

## Non-goals

- Renaming any skill. `/craft:structure-review`, not `/craft:review`.
- Changing what any skill does. The `architecture-baseline` and `structure-review` content edits requested alongside this work are separate and unaffected.
- Using the repository root as a plugin source, which would ship `agents/` inside every plugin.
- Distributing custom agents through plugins.
- Deleting anyone's existing per-skill plugin installations automatically.
