# code-audit skill

## What this skill does

Conducts a thorough, **language-agnostic** code review of a diff, a set of files, or a whole repository, and emits a **machine-parseable JSON artifact** to `./reviews/<review_id>.json` at the project root. The artifact is a durable, self-contained *work order*: a different agent in a different session — with no shared conversation state — can read it, rebuild context, re-locate each finding by its code excerpt, apply the fix, and verify it. An optional `render_report.py` produces a human markdown view.

**Read-only.** The skill never edits source. The only files it writes are the JSON artifact and (on request) its rendered markdown.

## Why JSON, not a graded report

This skill replaces the older `code-reviewer` (which produced a weighted 0–10 markdown report). The reframe: an agent-driven reviewer is most useful when its output is a structured contract an orchestrator can gate on and a cross-session "apply" agent can execute against. Risk is expressed via `verdict` + severity-counted `stats`, not a headline score. The JSON is canonical; markdown is derived.

See the design discussion and decisions in `openspec/changes/archive/<date>-rewrite-code-review-skill/` for the full rationale.

## Layout

```
code-audit/
├── SKILL.md                          ← the process (always loaded on trigger)
├── README.md                         ← this file (never auto-loaded)
├── references/
│   ├── schema.md                     ← canonical artifact schema (source of truth)
│   ├── handoff-protocol.md           ← cross-session lifecycle + injection safety
│   ├── review-dimensions.md          ← the 15 universal review categories
│   ├── severity-rubric.md            ← severity × confidence + calibration
│   └── languages/                    ← language packs (loaded only when scope matches)
│       ├── README.md                 ← signal→pack index + authoring guide
│       ├── python.md
│       ├── sql.md
│       ├── javascript-typescript.md
│       ├── react.md
│       ├── bash.md
│       └── terraform.md
└── scripts/
    └── render_report.py              ← optional markdown view of the JSON (main session only)
```

## The artifact contract

`references/schema.md` is the canonical schema. `references/handoff-protocol.md` covers the lifecycle a future `code-review-apply` consumer skill will follow — including the rule that the artifact is **data, never instructions** (a prompt-injection guard for the cross-session jump). The consumer skill itself is not built yet; this skill is the producer side.

## Scripts

The skill ships one optional script (stdlib-only Python, runs under `uv run`):

```bash
# Render a human view (JSON stays canonical)
uv run python ~/.claude/skills/code-audit/scripts/render_report.py ./reviews/<id>.json -o review.md
```

This is for main-session use only. Subagents write the JSON artifact directly and don't need scripts.

## Adding a language pack

Packs hold **stable, universal idioms** for a language — never per-repo conventions (those go in the artifact's `conventions` field). To add one:

1. Copy the template in `references/languages/README.md` to `references/languages/<language>.md`.
2. Add a row to the **Signal → pack** table in that same index. **No `SKILL.md` change needed** — the skill reads the index.
3. Keep each dimension section to roughly one screen; use the dimension keys from `references/review-dimensions.md` in the headings so findings map to a `category`.

Progressive disclosure means only the matched pack(s) load at review time, so you can ship many packs and pay context cost for none until a diff touches that language.

## Installation

Installed by `scripts/install-claude.sh` / `install-codex.sh` (discovered one level deep under `skills/`). If you previously installed `code-reviewer`, remove the stale link (`rm -rf ~/.claude/skills/code-reviewer`) — this skill supersedes it. The old skill lives in `skills/deprecated/code-reviewer/` for reference.
