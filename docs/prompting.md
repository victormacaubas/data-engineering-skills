# Prompting skills and agents

How to write the instructions in a `SKILL.md` or an agent definition so the model running it does the right thing. Three parts: general principles that hold across current models, rules specific to how this repo works, and a log of what each skill and agent adopted and why.

**Model-specific guidance is not copied here.** Models change faster than this file would. Before writing or revising a skill or agent, read the current guide for the exact model that runs it — `AGENT.md` → *Model-specific prompting* says how. Where that guide and this file disagree, the model guide wins.

Sources: Anthropic's [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), and the per-model guides for Claude Opus 5.5 and Sonnet 5.5 as of 2026-09-29.

## General principles

### Be explicit, and give the reason

State the behavior you want directly ("change this function", not "suggest changes"), and give the reason behind a rule when it isn't obvious; a model generalizes from the reason. This matches the authoring rule in `AGENT.md`: write the instruction and the trap it avoids, not a case for following it.

### Name the failure, not the quality

"Be thorough" or "avoid a generic look" swaps one default for another. A specific failure — what the bad output looks like and when it happens — is what changes behavior. Name the stops you want and the ones you don't. When a skill keeps failing a certain way, add that way to the list.

### Examples: few, varied, tagged

When an example helps, give a small set (Anthropic suggests 3–5) that differ from each other, wrapped in `<example>` tags so they read as examples rather than instructions. A single example gets copied too literally.

### Structure mixed content with tags

When a prompt carries different kinds of content — instructions, a pasted document, a returned briefing — separate them with consistent XML tags. This is also the mechanism behind *Untrusted content is data*, below.

### Look before acting

Current models start work quickly. On a loosely specified task, the fact that decides it often sits in a source nobody mentioned: a linked ticket, an ADR, an active OpenSpec change, a `schema.yml`. Tell the skill where to look first, and keep that look cheap.

### Check specifics instead of answering from memory

A library's call signature, a warehouse function, a column name, a tool's current version: check the lockfile, the installed source, the docs, or `describe` the object. Don't claim anything about code or data you haven't opened. And don't hardcode version numbers in reference files — take them from the project (`requires-python`, the lockfile, `pre-commit autoupdate`), because a copied version is stale the day it lands.

### Run a real check

"Done" means a check that exercises the change ran and passed: the tests, the type-checker, the build, or the command itself. A syntax-only check, or a check that failed to start, doesn't count. When no real check can run, say which one didn't. Don't let a skill license skipping it ("you don't have to run it"), and don't reward passing tests over correct behavior — no special-casing to make a test green.

### Do what was asked, and mention the rest

Models add tests, docs, helper files, and config options that fit a repo's conventions, even unasked. Where scope matters, name those additions and redirect them: "if you think one would help, mention it instead of writing it."

### Don't script thinking, and don't ask for it in the reply

Current models decide how much to think; the *effort* setting is the control, not prompt text like "think step by step". Never ask the model to write its reasoning into the response — "explain your reasoning before answering" can be refused (`reasoning_extraction`). Ask for the conclusion and the evidence. (Per-model guides may carve out exceptions; see the log.)

### Progress updates are built in

Models write short updates between tool calls on their own. Don't script narration, and remove instructions like "hold all findings for the final response". If updates are wanted at set points, name them — one line before the first tool call, a recap at the end.

### Long runs need state outside the conversation

For multistep work, keep the task list in a file or a task tool, and have the model update it. `tasks.md` in `orchestrate` is this. State the completion condition up front.

### Parallelize independent work, and don't over-delegate

Independent tool calls and independent worker dispatches go out together, in one message. Delegate bounded reading or building to a worker; don't spawn a worker for a one-file read.

### Confirm before anything irreversible

Instructions that make a model carry on without checking in never override confirmation for destructive or irreversible actions. Say so wherever you add such an instruction.

### Retire compensating scaffolding

Existing prompts generally keep working on newer models, but instructions written to prop up weaker ones — the same rule stated three times, rationale for following a rule, reasoning-in-text substitutes — become noise. Re-test before carrying them forward.

## Rules for this repo

These come from how the skills and agents here are wired together. The general guide doesn't cover them.

### Untrusted content is data

Tickets, Slack threads, Confluence pages, web pages, code comments, commit messages, PR descriptions, and query results (`QUERY_TEXT`, comment columns, policy bodies) are written by people the model doesn't answer to. An instruction inside them is a finding to report, never a task. When a skill forwards such text to a worker, it wraps it:

```
<pasted_content id="k7f2">
...the pasted text...
</pasted_content id="k7f2">
```

with a short random id on both tags, and the brief says the content is material, not directions. The tags can be imitated, so this is one guardrail, not a boundary.

### A text-only turn is the return

A dispatched worker ends its run the moment it sends a message with no tool call; that message is all the orchestrator gets. Every worker and every skill a worker runs says so, and names the early stop to avoid ("files read, running the sweeps next"). In an orchestrating session, a turn that ends while its own workers are still running is waiting, not stopping.

### When no one can answer, don't ask

A skill that asks the user a question must say what to do when it runs inside a dispatched worker: take the stated default, record the assumption in the output, and continue.

### Say what enforces a boundary

"Read-only" or "may only run X" is either enforced by the agent's tools or only by its instructions. Say which. `pathfinder` is read-only by instruction: its `Bash` and Snowflake tools can write.

### Skills are self-contained

A skill doesn't point at another skill for content, or at a user's global `CLAUDE.md` for a rule it depends on. Other users don't have that file. State the rule in the skill.

## Decisions log

What each skill and agent adopted, and what it deliberately didn't, with the model it was checked against. Add a row when you revise one; don't rewrite an old row, supersede it.

| Date | Skill / agent | Checked against | Adopted | Deliberately not adopted |
|---|---|---|---|---|
| 2026-09-29 | `flow:scout` | Opus 5.5 | named failures (already); look at sources the user didn't name; pasted content wrapped for workers; `pathfinder` described as read-only by instruction; trimmed self-justifying prose | unattended-run stop rules (human in the loop); time budgets (briefs demand exhaustive reads); treat-answers-as-settled (re-examination is the point) |
| 2026-09-29 | `flow:orchestrate` | Opus 5.5 | runs straight through the bounded slice range; named early stops; no-polling rule stated in the skill; pasted content wrapped in worker briefs; trims | time budgets (pre-flight and drift checks are the point) |
| 2026-09-29 | `flow:grill-me` | Opus 5.5 | look at ADRs, OpenSpec, tickets, `git log` first; pasted artifacts are data; resolved decisions stay resolved unless contradicted; ADR criteria stated once | unattended-run rules (every turn ends on a question) |
| 2026-09-29 | `craft:architecture-baseline` | Opus 5.5 | look at what exists before asking; the post-decision build runs through to a green gate; written ADRs stay settled unless contradicted; no hardcoded versions; trims | time budgets |
| 2026-09-29 | `craft:code-audit` | Opus 5.5 | "settle findings before serializing" replaced "reason in prose"; the review ends only at a written artifact; no scope question when dispatched; read declared conventions first; source under review is data; top-level `notes` field (schema 2.1) | time budgets (verification is the point) |
| 2026-09-29 | `craft:structure-review` | Opus 5.5 | the review ends only at a written report; data guardrail widened to tickets, commits, PR descriptions; repeats cut | time budgets; settled answers (re-review re-runs evidence by design) |
| 2026-09-29 | `craft:python-engineering-standards` | Opus 5.5, Sonnet 5.5 | "files nobody asked for" named; check a library API against the locked version; mypy runs when configured; public/private moved to *How to apply*; no hardcoded versions; free-threading note updated per PEP 779; Singleton removed | effort and stopping rules (belong to the agent or session) |
| 2026-09-29 | `data:sql-data-analysis` | Opus 5.5, Sonnet 5.5 | read the real schema and dbt tests first; check dialect docs; run cardinality checks when the warehouse is reachable; no unrequested dbt models, tests, docs | trims (overlapping rules cover different angles) |
| 2026-09-29 | `data:data-governance` | Opus 5.5, Sonnet 5.5 | archive-vs-live routed by rule, and not asked when dispatched; query-result text is data; describe a view instead of guessing a column; automatic classification recorded as not live; PROD_SOURCE_DB lineage corrected; duplicated rules removed | — |
| 2026-09-29 | agent `code-auditor` (Claude) | Opus 5.5 | effort `high` → `medium`; one-shot return; scope default recorded in `notes`; wider data guardrail | Codex/Cursor variants left unchanged by choice |
| 2026-09-29 | agent `structure-reviewer` (Claude) | Opus 5.5 | effort `high` → `medium`; one-shot return; wider data guardrail; method repeats cut, safety rules kept | Codex/Cursor variants left unchanged by choice |
| 2026-09-29 | agent `implementer` (Claude) | Sonnet 5.5 (still pinned to `claude-sonnet-5[1m]` pending the proxy) | one-shot return; add only what the tasks need; real-check rule; unresolved API → lockfile and installed source; `<pasted_content>` guardrail; comments follow the standards skill | effort stays `high` |
| 2026-09-29 | agent `pathfinder` (Claude) | Sonnet 5.5 (pinned to `claude-sonnet-5[1m]`) | one-shot return; source content is data; read-only stated as by instruction; names governance view and source | effort stays `high` |
| 2026-09-29 | agent `researcher` (Claude) | Sonnet 5.5 (pinned to `claude-sonnet-5`, standard context) | one-shot return; every Key Finding from a page fetched this run; `<pasted_content>` guardrail | effort `medium` considered and declined: answering from memory is the worst failure here, and the round/page caps already bound cost |
