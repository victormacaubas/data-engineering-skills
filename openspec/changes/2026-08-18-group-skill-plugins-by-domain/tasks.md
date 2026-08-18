## 1. Grouped Skill Layout

- [x] 1.1 Create `skills/craft/`, `skills/flow/`, and `skills/data/`, each with a one-line `README.md` naming what belongs in the group.
- [x] 1.2 `git mv` each release-ready skill into its group, preserving directory names, `SKILL.md`, and every `references/`, `scripts/`, and `assets/` subdirectory: craft ← architecture-baseline, python-engineering-standards, code-audit, structure-review; flow ← grill-me, scout, orchestrate, write-ticket, stash; data ← data-governance, sql-data-analysis.
- [x] 1.3 Confirm `skills/in-progress/` and `skills/deprecated/` are untouched and still excluded from both catalogs.
- [x] 1.4 Verify no `SKILL.md` body or frontmatter `name` changed in the move, and that `git` recorded renames rather than delete/add pairs.
- [x] 1.5 Grep the moved skills and their `references/` for now-stale relative paths or `skills/<name>` self-references.

## 2. Marketplace Catalogs

- [x] 2.1 Replace the eleven entries in `.claude-plugin/marketplace.json` with `craft`, `flow`, and `data`, each sourcing `./skills/<group>`, carrying an explicit `skills` array of `./<skill-name>` paths, keeping `strict: false`, and describing the group rather than a single skill.
- [x] 2.2 Apply the same three entries to `.cursor-plugin/marketplace.json` in its native schema.
- [x] 2.3 Carry each skill's agent prerequisites into the owning group's description, since `architecture-baseline`, `orchestrate`, and `scout` no longer have entries of their own.
- [x] 2.4 Parse both catalogs and verify: identical plugin names and member sets; every `skills` path resolves to a directory containing `SKILL.md`; the array members and the group directory contents agree exactly with no extras or omissions; no repository-root source; no `in-progress` or `deprecated` member; skill names unique across all three groups.
- [ ] 2.5 Register the marketplace in Claude Code and confirm each group installs, that its skills invoke as `/<group>:<skill-name>`, and that no repository custom agent is exposed. Repeat in Cursor CLI; if a marketplace-entry `skills` array is not honoured, add a per-group `.cursor-plugin/plugin.json` declaring the same paths and record the deviation in `design.md`.

## 3. Agent Skill References

- [x] 3.1 Change the `skills:` preload in `agents/claude/code-auditor.md` to `craft:code-audit`, `agents/claude/implementer.md` to `craft:python-engineering-standards`, and `agents/claude/structure-reviewer.md` to `craft:structure-review`.
- [x] 3.2 Update the prose in those three files that names each skill, and the matching prose in their `agents/cursor/` variants, to the namespaced form where the platform supports it.
- [x] 3.3 Update `agents/README.md` with the namespaced preload identifiers, and state that the prefix is the marketplace plugin name and that an unresolvable preload is skipped with only a debug-log warning.
- [ ] 3.4 Launch each of the three Claude agents and confirm from the transcript or debug log that its skill content is actually preloaded — the failure this change exists to fix is silent, so an install that merely succeeds proves nothing.

## 4. Cursor Fallback Installer

- [x] 4.1 Change `discover_skills` in `scripts/install-cursor-skills.sh` to walk `skills/*/*/` for directories containing `SKILL.md`, excluding `in-progress/` and `deprecated/`, and record each skill's group alongside its name.
- [x] 4.2 Keep `--skills all|name[,name...]` operating on bare skill names, and keep the flat `~/.cursor/skills/<name>/` target so fallback skills stay unprefixed.
- [x] 4.3 Add `--group craft|flow|data[,...]`, mutually exclusive with an explicit `--skills` list, erroring on an unknown group and listing the valid ones.
- [x] 4.4 Update the usage text and preserve symlink-first behaviour, `--copy`, repo-symlink refresh without backup, timestamped backups for non-repository targets, and the invalid-name error listing available skills.
- [x] 4.5 Run `bash -n scripts/install-cursor-skills.sh`, then exercise all-skills, subset, group, invalid-name, invalid-group, conflicting-flags, copy, and `CURSOR_SKILLS_DIR` cases against a temporary target.

## 5. Documentation

- [x] 5.1 Rewrite the `README.md` install section for three plugins: `/plugin install craft@data-engineering-skills`, the `/<group>:<skill-name>` invocation form, and the group-to-skill table.
- [x] 5.2 Add a migration note covering uninstalling the eleven per-skill plugins and installing the three groups, alongside the existing legacy-skill cleanup guidance, and state that nothing is removed automatically.
- [x] 5.3 Update the `README.md` agent-prerequisite table and the Cursor fallback section for grouped paths and the new `--group` flag.
- [x] 5.4 Update `docs/authoring.md`: new skills are created at `skills/<group>/<name>/`, graduation moves from `skills/in-progress/<name>/` into a group, and both catalog `skills` arrays must gain the member.
- [x] 5.5 Update `docs/agents.md` and `CLAUDE.md` for the namespaced preload form, the grouped directory layout, and the rule that group membership is part of a skill's public name so regrouping is a breaking change requiring its own OpenSpec change.
- [x] 5.6 Confirm no document still shows an eleven-entry catalog, a `skills/<name>/` release path, or a bare-name skill reference.

## 6. End-to-End Verification

- [ ] 6.1 From a clean Claude Code profile, register the marketplace, install all three plugins, and confirm all eleven skills appear under `/` with their expected prefixes and none appears twice.
- [ ] 6.2 Confirm no `in-progress` or `deprecated` skill is installed, and that no plugin cache entry contains `agents/`.
- [ ] 6.3 Run `structure-review` and `code-audit` through their agents end to end and confirm each produces its normal report, proving the preload resolved.
- [ ] 6.4 Run strict OpenSpec validation and review the final diff for accidental content edits inside moved `SKILL.md` files, repository-root sources, or exposed agents. *(Diff reviewed and clean: `git status -M` shows pure renames for 9 of 11 skills, and the only two `RM` entries are `architecture-baseline` and `structure-review`, whose content edits were requested separately. Strict `openspec validate` still to run — the CLI was unavailable in the implementing environment.)*
