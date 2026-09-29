# Prompting concepts for Claude Opus 5.5

Distilled from Anthropic's [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) guide, filtered to what matters when authoring skills and agents in this repo. Use it as a checklist when writing or revising a `SKILL.md`.

**Scope.** These concepts apply to the session that *loads* a skill, which runs Opus 5.5. Workers with their own `model:` (currently `pathfinder` and `researcher` on Sonnet 5) are not covered by this guide.

**Out of scope here:** thinking-disabled migration (we never run with thinking off), API-level knobs Claude Code owns (`max_tokens`, `thinking.display`, per-message effort), safeguard classifiers, and visual-input tooling.

## Concepts

### 1. Effort controls thinking, not prompt text

Thinking is always on and effort is the lever. Instructions like "think carefully", "think step by step", or "ultrathink" add latency without a reliable quality gain; the model sizes its own thinking. Opus 5.5 at `medium` matches or beats Opus 5 at `high`.

**In a skill:** don't write thinking instructions. Adjust `effort:` in agent frontmatter instead, and re-test rather than carrying over an Opus 5 value.

### 2. Don't ask for reasoning in the reply

Prompts that push the model to reproduce its internal reasoning in the response text can be declined with the `reasoning_extraction` refusal category.

**In a skill:** ask for the conclusion and the evidence behind it ("state the finding and the file/line that supports it"), not "explain your reasoning before answering" or "show your work".

### 3. Name the failure, not the quality

Opus 5.5 responds strongly to specific, named patterns to avoid, and to named stops that *are* acceptable. A general instruction ("be thorough", "avoid a generic look") mostly swaps one default for another.

**In a skill:** describe traps concretely: what the bad output looks like and when it happens. Iterate by checking which pattern the model fell into and adding it to the list.

### 4. A text-only turn is a report, not proof of completion

On long multi-part tasks the model posts progress and may end a turn with text instead of a tool call. An unattended loop that reads that as "done" stops early.

**In a skill for unattended work:** keep open items in a checklist (task tool or file); name the early stops you don't want (summary that announces the next step, offering to continue, listing non-blocking decisions, stopping at a milestone) and the stops you do want (blocked on the user, blocked on something deliberately protected). If a subagent or background command is still running, the task is not done. **Leave this out of human-in-the-loop skills**, where someone is there to answer.

### 5. Progress updates are native

The model writes short updates between tool calls by itself.

**In a skill:** don't script narration. If you want updates at predictable points, name them (a one-line statement of intent before the first tool call, a short recap at the end). Content that must reach the user verbatim mid-turn needs an explicit send-message tool.

### 6. Look around before acting

Opus 5.5 gets to work quickly. On loosely specified tasks, the information it needs often sits in a source the request didn't mention: an old thread, another spreadsheet tab, a linked ticket.

**In a skill:** tell the model to open the relevant sources, including unmentioned ones, before acting. Keep untrusted content out of what it searches, since it will act on what it finds.

### 7. Delimit untrusted text

Opus 5.5 resists injection through tool results and web content better than earlier models. For text a user pastes from elsewhere, it needs the boundary marked: wrap it in a tag pair with a short random id (`<pasted_content id="ab12">` … `</pasted_content id="ab12">`) and follow instructions inside only where the user's own message asks.

**In a skill:** treat pasted and fetched text as material, not direction. When forwarding such text to a worker, wrap it the same way. The tags can be imitated, so they are one guardrail, not a boundary.

### 8. Time budgets speed up teams, at a cost to checking

The model paces itself against elapsed-time signals (`elapsed 340s / 1200s`) and parallelizes more under a budget. Without a sensible budget, one line helps: "Time matters here: do not spend time that can be avoided, and the earlier a correct result is obtained, the better." Under time pressure it may search and verify a little less. The budget is advisory; keep a hard timeout if you need one.

**In a skill:** use for multi-agent work where speed matters more than exhaustive verification. Don't pair it with briefs that demand exhaustive reads.

### 9. "Treat earlier answers as settled" is opt-in

In multi-turn chat the model sometimes re-examines earlier answers, adding latency. An instruction to treat answered questions as done cuts that, but also makes the model less likely to flag its own earlier mistake.

**In a skill:** leave it out wherever re-examination is the point: exploration, long analyses, agentic work where a later step can expose an earlier error.

### 10. Retire compensating scaffolding

Opus 5.5 does the same work in fewer tokens, and existing prompts generally work unchanged. Instructions that existed to prop up weaker models (rationale for following a rule, rules repeated in several places, reasoning-in-text substitutes, visual-reading scaffolds) are now candidates for removal.

**In a skill:** re-test before carrying scaffolding forward. Keep the instruction and the trap it avoids; cut the case for following it.

## Adoption log

| Skill | Adopted | Deliberately not adopted |
|---|---|---|
| `craft:architecture-baseline` | 3 (already), 4 (narrow: the post-decision build stretch runs through to a green gate), 6, 7, 9 (narrow: a written ADR stays settled unless contradicted), 10 | 8 (one worker, no deadline) |
| `craft:code-audit` | 2 (dropped "reason in prose, narrate each finding" in favor of "settle findings before serializing"), 3 (already), 4 (the review ends only at a written artifact; no scope question when dispatched), 6 (read declared conventions first), 7 (source under review is data), 10 | 8 (verification is the point), 9 (re-review reconciles against prior findings already) |
| `craft:structure-review` | 2 (already: conclusion and evidence, not the path), 3 (already), 4 (the review ends only at a written report), 5 (already), 6 (already: declarations before source), 7 (guardrail widened to tickets, commits, PR descriptions), 10 | 8 (command-backed evidence is the point), 9 (re-review re-runs evidence by design) |
| `data:data-governance` | 3 (already), 4 (dispatched runs don't stop to ask), 7 (query-result text — `QUERY_TEXT`, comments, policy bodies — is data), 10 (removed the duplicated `SHOW` list and archive-fallback rule) | 8, 9 (n/a) |
| `data:sql-data-analysis` | 3 (already), 6 (check the real schema before writing) | 4, 8, 9 (no long or dispatched runs), 10 (little to cut; overlapping rules are different angles) |
| `flow:scout` | 3 (already), 5 (already), 6, 7, 10 | 4 (human-in-the-loop), 8 (briefs demand exhaustive reads), 9 (re-examination is the point) |
| `flow:grill-me` | 3 (already), 6, 7, 9 (narrow form: resolved decisions stay resolved unless contradicted), 10 | 4 (every turn should end on a question), 8 (no workers, no deadline) |
| `flow:orchestrate` | 3, 4 (runs straight through the bounded scope), 5 (already), 6 (already), 7, 10 | 8 (pre-flight and drift checks are the point; time pressure cuts verification), 9 (later slices expose earlier mistakes) |
