## Context

The repository distributes eleven skills through two Git-backed marketplace catalogs. Each entry names a plugin and points its `source` at the matching `skills/<name>/` directory, which holds `SKILL.md` at its root. Claude Code loads that as a single-skill plugin whose name comes from the catalog entry, and `strict: false` means no `plugin.json` is required.

Claude Code namespaces plugin skills as `<plugin-name>:<skill-name>`, and the namespace is mandatory — it exists to keep plugin skills from colliding with personal, project, and enterprise skills. With one plugin per skill, both halves are the same word.

Two consequences motivate this change. The visible one is `/data-governance:data-governance`. The load-bearing one is that `agents/claude/{code-auditor,implementer,structure-reviewer}.md` preload a skill by bare name, which no longer resolves; Claude Code skips an unresolvable preload and logs a warning to the debug log rather than failing the agent.

## Goals / Non-Goals

**Goals:**

- Give each skill a prefix that names the domain it belongs to.
- Keep every skill under `skills/`, and keep its directory name and frontmatter `name` unchanged.
- Preserve the `skills/in-progress/` and `skills/deprecated/` exclusion and the existing graduation flow.
- Keep custom agents out of every plugin package.
- Correct the three silently-failing agent preloads.
- Repair the Cursor fallback installer, which the layout change breaks.
- Make the group-membership constraint explicit, so a future regrouping is recognised as breaking.

**Non-Goals:**

- Shortening skill names to exploit the new prefix.
- Preserving per-skill install granularity within a group.
- Automatic migration for existing installs.
- Publishing to either platform's public marketplace.

## Decisions

### 1. Three domain plugins: `craft`, `flow`, `data`

| Plugin | Skills | Invocation |
|---|---|---|
| `craft` | `architecture-baseline`, `python-engineering-standards`, `code-audit`, `structure-review` | `/craft:structure-review` |
| `flow` | `grill-me`, `scout`, `orchestrate`, `write-ticket`, `stash` | `/flow:orchestrate` |
| `data` | `data-governance`, `sql-data-analysis` | `/data:sql-data-analysis` |

`craft` is how code gets written and checked. `flow` is how work gets driven from idea to ticket. `data` is the warehouse surface.

**Why three:** every group has at least two members. Four or more groups produced singletons, which reintroduces the redundancy this change exists to remove.

**Alternative considered:** one umbrella plugin, `/de:structure-review`. Rejected — one prefix over eleven unrelated skills carries no information, and it makes the whole catalog a single install.

**Alternative considered:** splitting `craft` into `standards` and `review`. Rejected — it strands `architecture-baseline` and reduces `data` to one member.

### 2. The group directory is the plugin root

```text
skills/
  craft/
    architecture-baseline/    SKILL.md, references/
    code-audit/
    python-engineering-standards/
    structure-review/
  flow/
    grill-me/  orchestrate/  scout/  stash/  write-ticket/
  data/
    data-governance/  sql-data-analysis/
  in-progress/                unchanged, not cataloged
  deprecated/                 unchanged, not cataloged
```

Each catalog entry sources its group directory and lists its members explicitly:

```json
{
  "name": "craft",
  "source": "./skills/craft",
  "skills": [
    "./architecture-baseline",
    "./code-audit",
    "./python-engineering-standards",
    "./structure-review"
  ],
  "strict": false
}
```

The `skills` array is required rather than optional here. Claude Code's default scan looks for a `skills/` directory *under the plugin root*, and `skills/craft/` has no such subdirectory, so nothing loads without the explicit list. Paths are relative to the plugin root and must start with `./`. Claude Code takes each skill's invocation name from the frontmatter `name` in its `SKILL.md`, so the suffix is stable regardless of packaging.

**Why the group directory rather than the repository root:** a marketplace entry whose `source` is `./` also works — with a root source, an explicit `skills` array becomes the complete set for that entry and sibling directories don't load, which is the documented pattern for several entries sharing one `skills/` folder. It was rejected on two counts. The plugin root would be the repository root, so `agents/` falls inside every plugin package, and keeping it out would depend on suppressing the default agent scan — a mechanism this repository would then be relying on to honour a rule it states absolutely. And a root source copies the entire repository into the plugin cache once per plugin, putting `skills/in-progress/`, `skills/deprecated/`, and `openspec/` on every user's disk three times over. A group-directory root copies only that group.

**Alternative considered:** symlinks from a new top-level `plugins/<group>/skills/` into an unmoved `skills/<name>/`. Claude Code does dereference a symlink resolving elsewhere inside the same marketplace, and the documentation names this as the way a meta-plugin shares skills. Rejected because it adds a second directory tree to keep in sync for no gain over a plain move, breaks `claude --plugin-dir` local testing (cross-directory symlinks are skipped outside a marketplace install), and needs Developer Mode or `mklink /D` on Windows.

**Alternative considered:** a `"skills": ["../../skills/structure-review"]` array with no move. Rejected because it does not work — a copied plugin cannot reference files outside its own root, and paths traversing out are not copied into the cache.

### 3. Nesting is consistent with what `skills/` already does

`skills/in-progress/` and `skills/deprecated/` already establish that `skills/` holds category directories rather than only skills. Adding `craft/`, `flow/`, and `data/` extends that convention instead of introducing one. The rule in `CLAUDE.md` that skills live only under `skills/` stays true, and `docs/authoring.md`'s graduation step changes from `mv skills/in-progress/<name> skills/<name>` to `mv skills/in-progress/<name> skills/<group>/<name>` plus a line in each catalog's `skills` array.

The cost is that adding a skill to a group is now two catalog edits rather than one, and a skill present on disk but absent from the array loads nowhere. That is a real failure mode, so catalog validation gains a check that the array members and the group directory's contents agree exactly.

### 4. Skill names do not change

Every directory name and every frontmatter `name` stays as it is. The restructure is already breaking; renaming skills in the same change makes two breaking surfaces at once and would invalidate every downstream `CLAUDE.md` that names an inherited standard.

### 5. Agent preloads use the namespaced identifier

```yaml
skills:
  - craft:structure-review
```

All three affected agents preload skills that land in `craft`.

**Why the unprefixed form is not kept alongside it:** listing both would double-inject the content for anyone who still has a legacy `~/.claude/skills/` copy. The namespaced form alone is correct for a plugin install, and removing the legacy install is already documented.

**Consequence, and the main ongoing cost of this change:** an agent preload now encodes group membership. Moving `sql-data-analysis` from `data` to `craft` later would break every preload and every downstream `CLAUDE.md` naming it, and it would break silently, because a missing preload is a debug-log warning. This becomes a `CLAUDE.md` rule and a spec requirement, since nothing checks it mechanically.

### 6. The Cursor fallback installer keeps bare skill names

`scripts/install-cursor-skills.sh` discovers `skills/*/` one level deep and requires `SKILL.md` in each. Under the grouped layout it finds `craft`, `flow`, `data`, `in-progress`, and `deprecated`, none of which has a `SKILL.md`, so it silently installs nothing. It needs two-level discovery with the two non-release directories excluded.

It installs into `~/.cursor/skills/<name>/`, which is a plain skills location rather than a plugin, so those skills invoke unprefixed — `/python-engineering-standards`, not `/craft:python-engineering-standards`. That difference is deliberate and gets documented rather than removed: the fallback exists for environments where plugin imports are blocked, and flattening groups into the target directory keeps it simple. Skill names are unique across groups, so the flat target has no collisions; catalog validation enforces that uniqueness.

`--skills all|name[,name...]` keeps working on bare skill names. `--group craft|flow|data[,...]` is added as a convenience, mutually exclusive with an explicit `--skills` list.

### 7. Cursor packaging is verified, not assumed

The Cursor catalog gets the same three entries and sources. Whether Cursor CLI honours a `skills` array in a marketplace entry is not documented well enough to assume. Task 2.5 resolves it against a real install before the change is archived. If the array is unsupported, the fallbacks in order are: add a `.cursor-plugin/plugin.json` per group declaring the same paths; failing that, nest each group's members under `skills/<group>/skills/` so the default scan finds them.

## Risks / Trade-offs

- **Group membership is public API.** Mitigated by a spec requirement and a `CLAUDE.md` rule, not by tooling. Accepted.
- **Per-skill install is gone within a group.** Installing `data` installs both data skills. Accepted; the groups are small.
- **A skill can exist on disk and load nowhere** if the catalog array misses it. Mitigated by the catalog/directory agreement check in task 1.4.
- **Every existing user reinstalls.** Eleven uninstalls, three installs, documented under migration. No automatic cleanup, consistent with the repository's non-destructive migration rule.
- **Git history for eleven directories moves.** Use `git mv` so rename detection holds.

## Migration Plan

1. `git mv` the eleven skill directories into their group directories.
2. Rewrite both catalogs and correct the three agent preloads in the same commit, so no catalog ever names a plugin root that does not exist and no agent is left pointing at a stale identifier.
3. Fix `scripts/install-cursor-skills.sh` in the same commit, since the move breaks it.
4. Document the uninstall-and-reinstall path in `README.md`, alongside the existing legacy-skill cleanup guidance.
5. Do not remove or rewrite anyone's installed plugins.

## Open Questions

- Does Cursor CLI honour a `skills` array in a marketplace entry, or does it need a per-group `.cursor-plugin/plugin.json`? Resolved by task 2.5.
- Should `skills/<group>/` carry a one-line `README.md` naming what belongs in the group? Proposed yes — it is the only place the grouping rationale would otherwise live outside this change.
