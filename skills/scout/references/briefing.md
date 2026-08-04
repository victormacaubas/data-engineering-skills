# Briefing a read-only worker — the explore-phase contract

Read this at dispatch time. It lives here rather than in the skill body so it can be pulled in fresh
mid-session, after the conversation has moved on or context has compacted.

The workers carry their own method and output templates — don't restate them. Everything here is
what *you* supply, and the value only you can add. Your goal is a briefing you can act on without
re-reading the sources, because the moment you re-read them the dispatch has bought you nothing —
you've paid the brief, the wait, and the synthesis, and still put the sources in your context.

That's the real risk to manage here: a dispatch is roughly token-neutral against reading the
material yourself, so its whole value is that the material stays out of your working set. A vague
brief that forces you to go look anyway is strictly worse than never dispatching. Brief tightly.

## Inputs to supply

**`pathfinder`** — the target sources (directory, file path, Jira key, Confluence page ID or URL,
Snowflake object), plus optionally:

- A focus area — "the auth flow", "how this module handles retries".
- A depth limit — "top-level only", "this page, don't follow links".
- Explicit questions. **A focus area is not a question**: the worker fills its `Direct answers`
  section only for questions asked outright. If you need an answer rather than a map, phrase it as
  one.

For a Snowflake governance question, supply the view names or the SQL yourself. You hold the
`data-governance` reference and the stronger model; the worker is there to execute and compress, not
to rediscover which `ACCOUNT_USAGE` view is authoritative.

**`researcher`** — one bounded question plus constraints: official-docs-only, compare X vs Y, how
many sources you want. Keep it to one question per dispatch; a two-part question comes back with one
part answered well.

## Value-adds only you can provide

The workers can't see the whole picture and can't see each other.

- **Decompose first, then count agents.** Don't fill slots because they exist. Split an area only
  when it's genuinely too large for one worker to cover exhaustively.
- **Own the shared-context split.** Assign cross-cutting material — root config, shared modules, the
  parent directory — to exactly ONE worker. Tell the others "folder-local only" plus a one-line
  summary of that shared area. Otherwise every worker re-reads it and you pay N times for one file.
- **Prioritize source-of-truth over derivative areas.** Skip tests on an orientation pass. Slice by
  information cluster rather than by directory when the two diverge.
- **Pre-glob exhaustive file lists into the prompt**: "Read ALL N files listed below — no sampling."
  State the output shape you want ("2–3 sentences per file") and add a cross-boundary line
  ("produces X, consumed by <area>") so the pieces can be reconciled later.
- **Always give an exhaustiveness cue.** Never say "explore" without one — workers read ambiguity as
  permission to stop early, and you won't know they stopped.

## Acting on returns

- **Read `Assumptions` before the findings.** Verify any assumption that would change the direction
  of the conversation. A worker that assumed `legacy/` was out of scope may have skipped the thing
  you were asking about.
- **Pause on `blocking: true`.** These would change the briefing's accuracy if answered. Resolve
  before you build on the finding.
- **`Confidence: low`** — widen the scope and re-dispatch, or carry the gap forward explicitly as an
  open question. Never restate a low-confidence finding as settled fact; in an exploration session
  that's how a wrong premise gets baked into the decision.
- **Synthesize across workers yourself.** After a parallel pass, no worker has seen another's output.
  Trace the end-to-end paths across their boundaries and flag contract seams — places where a rename
  in one layer would silently break another.
- **Read the SQL, not just the numbers.** `pathfinder` returns every query verbatim. A wrong filter
  is far easier to spot in the query than in the result.
- **Fold the finding into the conversation.** Say what it means for the decision at hand rather than
  pasting the briefing back at the user.

For the orchestration invariants — never busy-poll, wait on task notifications — follow your global
CLAUDE.md.

## Cross-reference

`../SKILL.md` owns the stance, the readiness test, and where the phase ends. The build-phase
counterpart to this file is `orchestrate/references/dispatch-readers.md`, which covers the same two
workers from the other side: closing unknowns so the `implementer` never has to guess.
