---
name: context-gather
description: Load session context from multiple sources in parallel — Jira tickets, Confluence pages, Obsidian vault notes, and optional codebase exploration — then deliver a structured briefing. Use whenever the user starts a session by pointing at external sources ("read the ticket", "read vault note X and this confluence page", "gather context for this work"), or when they list Jira keys, Confluence URLs, vault paths, or directories to explore in any combination. Also use when the user says "spin up explorers" alongside source references, or any variant of "load context from these sources."
---

# Context Gather

Load context from multiple sources in parallel at session start, then deliver a structured briefing so the user can begin work immediately. This replaces the manual ritual of sequentially reading tickets, pages, notes, and spinning up explorers one by one.

## Inputs

The user provides some combination of:

- **Jira tickets** — keys like `PROJ-1234` or full URLs
- **Confluence pages** — URLs or page IDs
- **Vault notes** — relative paths within the Obsidian vault (e.g., `Initiatives/some-project` or `Concepts/some-topic`)
- **Directories to explore** — paths to codebases or subdirectories where codebase-explorer agents should be dispatched

Not all are required. The user might provide just a ticket, or a ticket + vault note, or all four. Work with what you're given.

## Execution

### Step 1: Parse the request

Identify each source from the user's message. Normalize:
- Jira: extract the ticket key from URLs or accept bare keys
- Confluence: extract page IDs from URLs, or accept raw page IDs
- Vault: resolve paths relative to the vault location defined in your global CLAUDE.md
- Directories: accept absolute paths or paths relative to the current working directory

### Step 2: Dispatch reads in parallel

Fire all source reads simultaneously — do not wait for one to finish before starting the next.

**Jira tickets** — fetch via the Jira MCP.

**Confluence pages** — fetch via the Confluence MCP.

**Vault notes** — read directly with the Read tool.

**Codebase exploration** — dispatch `codebase-explorer` agents for the requested directories. Follow the subagent orchestration rules.

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

---

## Synthesis

<2-4 sentences tying the sources together: what's the work, what's the current state, what context matters for this session.>
```

Adjust the structure to match what was actually provided — skip sections for source types the user didn't request.

## Guardrails

- **Never write files.** This skill only reads and reports. No CLAUDE.md generation, no notes, no artifacts.
- **Never modify sources.** Don't comment on tickets, edit pages, or update vault notes.
- **Stop early on errors.** If a source can't be read (wrong ticket key, page not found, vault path doesn't exist), report the error clearly in the briefing rather than silently skipping it. The user often catches wrong references early ("sorry the correct note is this one") — surface the problem so they can correct it.
- **Don't over-summarize.** The user wants enough detail to verify the right sources were loaded. Include specifics — ticket status, key names, decision points — not vague abstractions.
