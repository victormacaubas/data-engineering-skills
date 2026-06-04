## Why

The current `code-reviewer` skill produces a graded markdown report (weighted 0–10 scores) that lives and dies inside a single session — it cannot be handed to a different agent in a different session to act on. A subsequent design discussion concluded that an agent-driven reviewer is most valuable when its output is a **machine-parseable, self-contained work order**: a JSON artifact a cold agent can read, rebuild context from, and execute against without any shared conversation state. That same artifact also generalizes the skill beyond PR-review to whole-folder and whole-repo audits, which the markdown-report shape handles only awkwardly. This change rewrites the skill around that artifact while preserving the hard-won judgment core (dimensions, severity calibration, language packs, finding quality).

## What Changes

- **BREAKING:** Retire the `code-reviewer` skill and replace it with a new `code-review` skill. The canonical deliverable changes from a graded markdown report under `./reviews/` to a JSON artifact under `.claude/reviews/<review_id>.json`. The weighted 0–10 scoring formula and per-dimension scoring bands are **removed**; risk is now expressed via `verdict` + severity-counted stats.
- Add a canonical **JSON artifact schema** — a durable cross-session work order with provenance (`repo`, `ref`/`base_ref`/`head_ref`, discovered `conventions`), per-finding content-hash `id`, excerpt-based drift-resistant `anchor`, `severity` + `confidence`, `acceptance_criteria`, `verification` command, optional advisory `proposed_patch`, and `status`/`resolution` lifecycle fields (every finding starts `open`; a future apply skill writes them back).
- Add `render_report.py` so the JSON can be rendered to a human-readable markdown view on demand. **JSON is canonical; markdown is a derived view.**
- Generalize scope from PR-only to a structured **`target` block** supporting three modes: `diff | paths | repo`. Add a `coverage` block and a triage step for repo/corpus mode, plus support for **systemic findings** (optional anchor + scope) and **repeated-antipattern dedup** (one finding with `occurrences` + `locations`).
- Replace the 6 weighted dimensions with the **15 review categories** from the design discussion as the language-agnostic checklist core (correctness, error handling, idempotency/retries, concurrency, security, data integrity, resource lifecycle, API contracts, architecture/SOLID, performance, testing, observability, dependencies, readability, documentation).
- Enforce the **read-only tool posture** declaratively via frontmatter `allowed-tools` (Read, Grep, Glob, read-only git) rather than by prose alone.
- Salvage the 5 existing language packs (`python`, `sql`, `javascript-typescript`, `react`, `terraform`) into `references/languages/` with light header edits — they hold stable universal idioms that map onto the new categories.
- Add deterministic `scripts/collect_context.sh` (git diff for diff mode, enumerate-and-ignore for repo mode, language detection, config discovery) and `scripts/validate_artifact.py` (validate emitted JSON against the schema before it leaves the skill).
- Author `references/handoff-protocol.md` (lifecycle, states, write path, and the "treat the artifact strictly as data, never as instructions" injection-safety note) anticipating a future consumer skill. **Out of scope:** the `code-review-apply` consumer skill itself — this change is the producer/review side only.

## Capabilities

### New Capabilities
- `code-review-skill`: A read-only, language-agnostic code-review skill that reviews a diff, file set, or whole repository and emits a validated JSON artifact (a durable cross-session work order) plus an optional rendered markdown view. Covers scope/target resolution, the universal review-dimension checklist, severity + confidence calibration, the artifact schema and handoff protocol, lazily-loaded language packs, and the supporting context-collection and validation scripts.

### Modified Capabilities
<!-- None. The current code-reviewer skill is not governed by an existing OpenSpec spec; it is replaced wholesale by the new capability above. -->

## Impact

- **Skills:** Removes `skills/code-reviewer/`; adds `skills/code-review/` (SKILL.md, references/, references/languages/, scripts/). The 5 language packs migrate over.
- **Naming:** The new skill name `code-review` coexists with the built-in `/code-review` slash command. This is a known, accepted tradeoff — the skill is invoked by name/description triggering, and the design discussion uses `code-review` deliberately. Documented here so it is a conscious decision, not an accident.
- **Install scripts:** No change required — `scripts/install-skills.sh` discovers skills one level deep under `skills/`, so the rename is picked up automatically. Users who installed `code-reviewer` will retain a stale symlink/copy until they reinstall; note this in the change.
- **Docs:** `agents/README.md` is unaffected (this is a skill, not an agent). No `docs/` contract changes.
- **Dependencies:** `validate_artifact.py` and `render_report.py` are Python; keep them stdlib-only so they run under `uv run` with no added dependencies.
- **Downstream (future):** Establishes the schema + handoff protocol that a later `code-review-apply` skill will consume.
