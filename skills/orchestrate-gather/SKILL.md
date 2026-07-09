---
name: orchestrate-gather
description: The read-only gather phase of session orchestration — dispatch read-only workers (codebase-explorer, researcher) and read sources (Jira tickets, Confluence pages, Obsidian vault notes) in parallel, then deliver a structured briefing. Use at session start when the user points at sources ("read the ticket", "read vault note X and this confluence page", "gather context for this work", lists Jira keys / Confluence URLs / vault paths / directories, or says "spin up explorers"). Also use mid-conversation when a knowledge gap warrants a dedicated worker — an unfamiliar code area to map, syntax or API facts to verify against docs, or multiple sources to cross-check. Not for lookups the session can do itself in one tool call, like reading a single known file or vault note.
---

# Orchestrate: Gather

The **read-only gather phase** of session orchestration. Dispatch read-only workers and read sources in parallel, then deliver a structured briefing so the user can act — replacing the manual ritual of reading tickets, pages, and notes one by one. Gather is on-tap: a big parallel load to orient at session start, or a single bounded question when a knowledge gap opens mid-decision.

**This skill mutates nothing.** Anything that writes files or ticks tasks is the implement phase (`orchestrate-implement`).

## Fast path: a single mid-decision question

For one bounded question mid-conversation, skip the briefing scaffold entirely:

1. Classify it — code question → dispatch `codebase-explorer`; web/docs question → dispatch `researcher` — unless a single fetch of a known URL answers it, in which case do that inline. The researcher earns its keep when the answer needs searching or synthesis across sources; a lone `WebFetch` of a URL you already have does not. Brief any worker per the dispatch contract below.
2. Answer directly from the result. Done.

Everything below is the session-start path.

## Re-establish state on entry

Re-read the named sources fresh each time this skill fires — from disk, the vault, or the source systems — rather than trusting an earlier in-context summary. A long session may have compacted the details away, and a source may have changed since it was last read.

## Inputs

The user provides some combination of:

- **Jira tickets** — keys like `PROJ-1234`, or URLs (extract the key)
- **Confluence pages** — URLs or page IDs
- **Vault notes** — paths relative to the vault location defined in your global CLAUDE.md (if no vault location is defined there, ask the user)
- **Directories to explore** — where `codebase-explorer` agents should be dispatched

Work with whatever subset you're given.

## Execution

Fire all reads simultaneously — Jira via the Jira MCP, Confluence via the Confluence MCP, vault notes via the Read tool, exploration and research via workers. Do not wait for one read to finish before starting the next.

Once all reads return, deliver the briefing:

```
## Sources loaded

### Jira: PROJ-1234 — <ticket summary>
### Confluence: <page title>
### Vault: <note-path>
### Exploration: <directory>
### Research: <question>

---

## Synthesis

<2-4 sentences tying the sources together: what's the work, what's the current state, what context matters for this session.>
```

Keep each source section to 3–5 sentences, and skip sections for source types the user didn't request. For tickets: status, assignee, key details. For pages and notes: key points and decisions captured. For exploration: architecture, key files, patterns. For research: the direct answer, with confidence and sources.

## Dispatch contract

The workers (`codebase-explorer`, `researcher`) carry their own method and output templates — don't restate them. This contract covers only what the orchestrator supplies and the value only the orchestrator can add.

### Inputs to supply

- **`codebase-explorer`** — a target directory, plus optionally a focus area, a depth limit, and explicit questions. A *focus area is not a question* — the agent only fills its `Direct answers` section for questions you ask explicitly, so if you need a specific answer, ask it as a question.
- **`researcher`** — one bounded question plus constraints (official-docs-only, compare X vs Y, number of sources). Resolve syntax/API/version questions here during gather so the implement phase doesn't re-research them.

### Orchestrator-only value-adds

The agents can't see the whole picture or each other. You provide what they can't self-provide:

- **Decompose first, then count agents** — don't fill slots just because they exist. Split an area only when it's too large for one agent to read exhaustively.
- **Prioritize source-of-truth over derivative areas**; skip tests on orientation passes. Slice by information cluster over directory when they diverge.
- **Own the shared-context split.** Assign cross-cutting files (root config, shared modules, parent dir) to exactly ONE agent; tell the others "folder-local only" plus a one-line summary of that shared area — otherwise every agent re-reads it.
- **Pre-glob exhaustive file lists into the prompt**: "Read ALL N files listed below — no sampling." State the output shape ("2–3 sentence summary per file") and add a cross-boundary line ("produces X consumed by [area]").
- **Always give an exhaustiveness cue.** Never say "explore" without one — agents read ambiguity as permission to stop early.

### Acting on returns

- `Confidence: low` → widen the scope, re-dispatch, or flag the gap in the briefing rather than presenting it as settled.
- Read `Assumptions`; verify any that materially affect the work. Pause on blocking questions before proceeding.
- After a multi-agent exploration, synthesize cross-agent flows yourself — the agents can't see each other's output. Trace the main end-to-end paths across their boundaries and flag contract seams, places where a rename in one layer would silently break another.

For the orchestration invariants (never busy-poll; wait on task notifications), follow your global CLAUDE.md.

## After the briefing: hand back

Gather ends at the briefing. If no concrete plan exists yet, return control to the user for the deciding conversation — don't propose a plan. Gather makes context available; it doesn't decide what to do with it.

## Guardrails

- **Never write files or modify sources.** No notes, no artifacts, no ticket comments, no page edits.
- **Stop early on errors.** If a source can't be read (wrong ticket key, page not found, bad vault path), surface it clearly rather than silently skipping — the user often catches wrong references early.
- **Don't over-summarize.** Include specifics — ticket status, key names, decision points — so the user can verify the right sources were loaded.
