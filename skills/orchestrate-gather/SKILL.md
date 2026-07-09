---
name: orchestrate-gather
description: The read-only gather phase of session orchestration — dispatch read-only workers (codebase-explorer, researcher) and read sources (Jira tickets, Confluence pages, Obsidian vault notes) in parallel, then deliver a structured briefing. Use at session start when the user points at sources ("read the ticket", "read vault note X and this confluence page", "gather context for this work", lists Jira keys / Confluence URLs / vault paths / directories, or says "spin up explorers"), AND mid-conversation whenever a knowledge gap opens - "how does the current code do X", "check that terraform/API syntax is right", "verify Y before we decide", "read up on Z", "look into how this is wired". Reach for it any time you need to load or verify context from external sources before acting, even if the user doesn't say "gather."
---

# Orchestrate: Gather

The **read-only gather phase** of session orchestration. Dispatch read-only workers and read sources in parallel, then deliver a structured briefing so the user can act. This replaces the manual ritual of sequentially reading tickets, pages, and notes, and spinning up explorers one by one.

Gather is **on-tap**, not a session-start ceremony. Two moments, same mode:

- **At session start** — a big parallel load: several tickets, pages, notes, and directories at once, to orient before any work.
- **Mid-decision** — a single bounded question when a knowledge gap opens: "how does the current code do X", "is this Terraform syntax right", "what does that Confluence page actually say". You're mid-conversation, hit something you don't know, and fire one focused read.

Both are the same capability at different scope. Don't treat gather as something that only happens once.

**This skill mutates nothing.** It dispatches read-only workers, reads sources, and reports. It writes no files, edits no sources, and ticks no tasks. If the work needs writes, that's the implement phase — a different skill. Gather refuses to do implement's job.

## Re-establish state on entry

Re-read the named sources fresh each time this skill fires — from disk, the vault, or the source systems (Jira/Confluence MCPs) — rather than trusting an earlier in-context summary. A long session may have compacted away the details, and a source may have changed since it was last read. Re-deriving state on entry is what lets gather run correctly at session start OR after compaction, the same way the OpenSpec skills re-derive state from the CLI on every entry.

## Inputs

The user provides some combination of:

- **Jira tickets** — keys like `PROJ-1234` or full URLs
- **Confluence pages** — URLs or page IDs
- **Vault notes** — relative paths within the Obsidian vault (e.g., `Initiatives/some-project` or `Concepts/some-topic`)
- **Directories to explore** — paths to codebases or subdirectories where `codebase-explorer` agents should be dispatched
- **A bounded question** — mid-decision, one focused thing to find out (in code via `codebase-explorer`, or on the web via `researcher`)

Not all are required. The user might provide just a ticket, a ticket + vault note, all four, or a single mid-conversation question. Work with what you're given.

## Execution

### Step 1: Parse the request

Identify each source or question. Normalize:
- Jira: extract the ticket key from URLs or accept bare keys
- Confluence: extract page IDs from URLs, or accept raw page IDs
- Vault: resolve paths relative to the vault location defined in your global CLAUDE.md
- Directories: accept absolute paths or paths relative to the current working directory
- Bounded question: decide whether it's a code question (dispatch `codebase-explorer`) or a web/docs question (dispatch `researcher`)

### Step 2: Dispatch reads in parallel

Fire all source reads simultaneously — do not wait for one to finish before starting the next.

**Jira tickets** — fetch via the Jira MCP.

**Confluence pages** — fetch via the Confluence MCP.

**Vault notes** — read directly with the Read tool.

**Codebase exploration** — dispatch `codebase-explorer` agents. **Web/docs lookups** — dispatch `researcher` agents. See the dispatch contract below for how to brief them.

### Step 3: Deliver the briefing

Once all reads return, present the results in this structure:

```
## Sources loaded

### Jira: PROJ-1234 — <ticket summary>
<Status, assignee, key details from the ticket description. 3-5 sentences max.>

### Confluence: <page title>
<Key points from the page. What decisions or context does it contain? 3-5 sentences max.>

### Vault: <note-path>
<Summary of the note's content — goals, status, decisions captured. 3-5 sentences max.>

### Exploration: <directory>
<Findings from codebase-explorer agents — architecture, key files, patterns.>

### Research: <question>
<Findings from researcher agents — the direct answer, with confidence and sources.>

---

## Synthesis

<2-4 sentences tying the sources together: what's the work, what's the current state, what context matters for this session.>
```

Adjust the structure to match what was actually provided — skip sections for source types the user didn't request. For a single mid-decision question, a short direct answer is enough; skip the full briefing scaffold.

## Dispatch contract (read-only workers)

The worker agents (`codebase-explorer`, `researcher`) already carry their own method and rigid output template. This contract **complements** them — it does not restate their templates. It covers only what the orchestrator supplies, the value the orchestrator adds that the worker can't, and which return fields gate your next move.

### Inputs to supply

- **`codebase-explorer`** — a target directory, plus optionally a focus area ("auth flow", "data ingestion"), a depth limit, and explicit questions. Note: a *focus area is not a question* — the agent only fills its `Direct answers` section for questions you ask explicitly. If you need a specific answer, ask it as a question. With no focus, the agent defaults to architecture + entry points + conventions.
- **`researcher`** — one bounded question plus constraints (official-docs-only, compare X vs Y, number of sources). Resolve syntax/API/version questions here during gather, so the later implement phase has the answer and doesn't re-research it.

### Orchestrator-only value-adds

The agents can't see the whole picture or each other. You provide what they can't self-provide:

- **Decompose first, then count agents** — don't fill slots just because they exist.
- **Prioritize source-of-truth over derivative areas**; skip tests on orientation passes. Slice by "information cluster" over directory when they diverge. **Split any 20+ file area in two.**
- **Own the shared-context split.** Assign cross-cutting files (root config, shared module, parent dir) to exactly ONE agent; tell the others "folder-local only" plus a one-line summary of that shared area. Otherwise every agent re-reads them.
- **Pre-glob exhaustive file lists into the prompt**: "Read ALL N files listed below — no sampling." State the output shape ("2–3 sentence summary per file") and add a cross-boundary line ("produces X consumed by [area]" / "consumes Y from [area]").
- **Always give an exhaustiveness cue.** Never say "explore" without one — Sonnet-class agents read ambiguity as permission to stop early.

### Return fields that gate your next action

- **`Confidence`** — if `low`, widen the scope, re-dispatch, or flag the gap in the briefing rather than presenting it as settled.
- **`Assumptions`** — read them; verify any that materially affect the work.
- **`Questions for human — blocking: true`** — pause and resolve these before proceeding. `blocking: false` are useful follow-ups that don't block.
- **After results, synthesize cross-agent flows yourself.** The agents can't see each other's output. Trace 3–5 end-to-end paths across their boundaries and flag contract seams — places where a rename in one layer would silently break another.

For the orchestration invariants (never busy-poll; wait on task notifications), follow your global CLAUDE.md — they're not restated here.

## After the briefing: hand back to decide

Gather ends at the briefing. Once the sources are loaded and no concrete plan yet exists, return control to the user for the deciding conversation (brainstorming, pressure-testing, scoping). Don't propose a plan and don't invoke or sequence any decision tooling — that's the user's phase, and those tools trigger on their own when the user reaches for them. Gather's job is to make the context available, not to decide what to do with it.

## Guardrails

- **Never write files.** This skill only reads and reports. No CLAUDE.md generation, no notes, no artifacts.
- **Never modify sources.** Don't comment on tickets, edit pages, or update vault notes.
- **Stop early on errors.** If a source can't be read (wrong ticket key, page not found, vault path doesn't exist), report the error clearly rather than silently skipping it. The user often catches wrong references early ("sorry, the correct note is this one") — surface the problem so they can correct it.
- **Don't over-summarize.** The user wants enough detail to verify the right sources were loaded. Include specifics — ticket status, key names, decision points — not vague abstractions.
