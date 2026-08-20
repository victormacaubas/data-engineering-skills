# Briefing a read-only worker — the explore-phase contract

Read this at dispatch time. Keeping it outside the skill body lets you pull it in fresh mid-session,
after the conversation has moved on or context has compacted.

The workers carry their own methods and output templates; do not restate them. This file covers what
*you* supply and the value only you can add. Produce a briefing you can act on without re-reading
the sources. Once you re-read them, the dispatch has bought you nothing: you paid for the brief,
wait, and synthesis, then still put the sources in your context.

Manage this risk: dispatching is roughly token-neutral compared with reading the material yourself,
so its value depends on keeping the material out of your working set. A vague brief that sends you
back to the sources leaves you worse off than never dispatching. Brief tightly.

## Inputs to supply

**`pathfinder`**: provide the target sources (directory, file path, Jira key, Confluence page ID or URL,
Snowflake object), plus optionally:

- A focus area: "the auth flow", "how this module handles retries".
- A depth limit: "top-level only", "this page, don't follow links".
- Explicit questions. **A focus area is not a question**: the worker fills its `Direct answers`
  section only for questions asked outright. If you need an answer rather than a map, phrase it as
  one.

For a Snowflake governance question, supply the view names or SQL yourself. You have the
`data-governance` reference and the stronger model. The worker executes and compresses; it does not
rediscover the authoritative `ACCOUNT_USAGE` view.

**`researcher`**: provide one bounded question and constraints: official-docs-only, compare X vs Y,
or the number of sources you want. Keep each dispatch to one question; a two-part question comes
back with one part answered well.

## Value-adds only you can provide

The workers cannot see the whole picture or each other.

- **Decompose first, then count agents.** Do not fill slots because they exist. Split an area only
  when one worker cannot cover it exhaustively.
- **Own the shared-context split.** Assign cross-cutting material (root config, shared modules, the
  parent directory) to exactly ONE worker. Tell the others "folder-local only" plus a one-line
  summary of that shared area. Otherwise, every worker re-reads it and you pay N times for one file.
- **Prioritize source-of-truth over derivative areas.** Skip tests during an orientation pass. Slice
  by information cluster rather than directory when the two diverge.
- **Pre-glob exhaustive file lists into the prompt**: "Read ALL N files listed below — no sampling."
  State the output shape you want ("2–3 sentences per file") and add a cross-boundary line
  ("produces X, consumed by <area>") so the pieces can be reconciled later.
- **Always give an exhaustiveness cue.** Never say "explore" without one. Workers read ambiguity as
  permission to stop early, and you will not know they stopped.

## Acting on returns

- **Read `Assumptions` before the findings.** Verify any assumption that would change the
  conversation's direction. A worker that assumed `legacy/` was out of scope may have skipped what
  you asked about.
- **Pause on `blocking: true`.** Answering these would change the briefing's accuracy. Resolve them
  before you build on the finding.
- **`Confidence: low`**: widen the scope and re-dispatch, or carry the gap forward explicitly as an
  open question. Never restate a low-confidence finding as settled fact. In an exploration session,
  that puts a wrong premise into the decision.
- **Synthesize across workers yourself.** After a parallel pass, no worker has seen another's output.
  Trace end-to-end paths across their boundaries and flag contract seams: places where a rename in
  one layer would silently break another.
- **Read the SQL, not just the numbers.** `pathfinder` returns every query verbatim. A wrong filter
  is far easier to spot in the query than the result.
- **Fold the finding into the conversation.** State what it means for the decision at hand rather
  than pasting the briefing back to the user.

For the orchestration invariants (never busy-poll; wait on task notifications), follow your global
CLAUDE.md.

## Cross-reference

`../SKILL.md` defines the stance, readiness test, and end of the phase. The build-phase counterpart
is `orchestrate/references/dispatch-readers.md`, which covers the same two workers from the other
side: closing unknowns so the `implementer` never has to guess.
