# Prompting concepts for Claude Sonnet 5.5

Distilled from Anthropic's [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5) guide, filtered to what matters when authoring skills and agents in this repo. The companion for Opus is [`opus-5-5-prompting.md`](opus-5-5-prompting.md).

**Scope.** These concepts apply to sessions and agents that run Sonnet 5.5. Skills loaded by both a Sonnet agent and an Opus session (for example `craft:python-engineering-standards`, preloaded by `implementer` and used directly in Opus sessions) should satisfy both guides. An agent pinned to an older Sonnet (`claude-sonnet-5`) doesn't get this behavior until it moves.

**Out of scope here:** running without up-front thinking (`thinking: {"type": "between_tools"}`, the Sonnet equivalent of thinking disabled, which we don't use), tolerant tool-call handling and mid-turn message placement (harness concerns), visual-input tooling, and API-level knobs Claude Code owns (`max_tokens`, `thinking.display`, per-message effort).

## Concepts

### 1. Effort levels are recalibrated

A level on Sonnet 5.5 doesn't produce the same thinking as the same level on Sonnet 5. For agentic coding and multistep tool use, start at `medium` for well-specified tasks and `high` for harder or longer ones. At `low` it keeps thinking short and can skip verifying a change; at `low` and `medium`, on long agentic tasks, it's more likely to stop and check in before it finishes. Reserve `xhigh` and `max` for measured gains.

**In a skill or agent:** re-test effort rather than carrying over a Sonnet 5 value. For a one-shot worker, early check-ins arrive as a half-finished return, so lean `high` or add concept 2.

### 2. Name when to stop

The guide's working line: "Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step." It makes runs at `low` and `medium` carry more work through, so they run longer and cost more. It doesn't replace rules about risky or irreversible actions.

**In a skill or agent:** state the finishing condition and the legitimate stops explicitly.

### 3. It adds things nobody asked for

At every effort level, and more at higher effort, Sonnet 5.5 adds tests, documentation, and small supporting files that fit the repo's conventions. The requested change itself stays close to the ask. The guide's fix: "When the work the user asked for is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for. If you think one would help, mention it at the end instead of doing it."

**In a skill or agent:** where scope matters (delegated workers, standards that shape files), name the additions to avoid and redirect them to a mention.

### 4. `xhigh` and `max` start their own review rounds

At the top levels it starts self-directed review and verification after finishing, sometimes with reviewer subagents, and makes related fixes it noticed. Keep routine work at `high` or below; if you want the thoroughness but not the extra rounds, say "when the work is done and its checks pass, stop and report; don't start extra review rounds or reviewer subagents unless asked."

### 5. Open-ended asks turn into builds

"Show me what you can do with this" can start a presentation, report, or build when only ideas were wanted. When a skill asks for ideas, options, or a plan, say so and say to stop there.

### 6. JSON answers to multistep problems

With structured output, the model can only work the problem out in thinking, and on multistep tasks it often skips thinking at `low` and `medium`. "Think the problem through before you answer." at the end of the system prompt helps; `xhigh` helps more. This asks for thinking, not reasoning in the reply, so it doesn't trigger concept 10. Without structured output, parse the last JSON value rather than first-`{`-to-last-`}`, and treat `stop_reason: "max_tokens"` as a failure even when the text parses.

### 7. Progress updates are native

Between tool calls it writes user-facing notes. Remove older instructions like "hold all findings for the final response". If you want updates at set points, name them (a line before the first tool call, a recap at the end).

### 8. Check specifics instead of answering from memory

On knowledge work it sometimes answers from training when a lookup would catch a change — what's allowed, required, charged, or, for code, a library's current API. Remove language that discourages tool use ("only when strictly necessary", "minimize tool calls"), and say to check specifics that may have changed even when confident.

### 9. Run a real check

It generally verifies before reporting done, but at `low` effort it can report a change done without a check that exercises it — for example, skipping tests because dependencies aren't installed. The guide's rule: run a real check (tests, type-checker, build, or the changed command itself); a syntax-only check or a check command that failed to start doesn't count; if only the project's declared dependencies are missing, install them with its own package manager and lockfile, never via `sudo` or the system package manager; if no real check can run, say which one didn't run and why instead of reporting done.

**In a skill or agent:** remove anything that licenses skipping verification ("you don't have to run it"), and put the full rule where verification actually happens.

### 10. Don't ask for reasoning in the reply

The `reasoning_extraction` refusal applies to Sonnet 5.5 as it does to Opus 5.5. Ask for conclusions and evidence, not "explain your reasoning before answering".

## Adoption log

| Skill / agent | Adopted | Deliberately not adopted |
|---|---|---|
| agent `implementer` (Claude; still pinned to `claude-sonnet-5[1m]` pending the proxy, effort `high`) | 1–2 (a text-only turn is the return; don't end before every task is done or recorded), 3 (add only what the tasks need; ideas go to Handoff), 8 (unresolved library API → lockfile version and installed source, else blocking), 9 (real check rule in Method step 5, with `uv sync` for declared deps and `partial` when no check can run) | 4 (effort stays `high`), 5–7 (n/a) |
| agent `researcher` (Claude; `claude-sonnet-5`, standard context, effort `high`) | 1–2 (a text-only turn is the return), 8 (every Key Finding comes from a page fetched this run; prior knowledge is flagged and unconfirmed); plus Opus 7 (`<pasted_content>` is material, not directions) | 1 (`medium` considered and declined: answering from memory is the worst failure for a researcher, and the method's round/page caps already bound cost) |
| agent `pathfinder` (Claude; `claude-sonnet-5[1m]`, effort `high`) | 1–2 (a text-only turn is the return), 3 and 9 (already: no proposed edits; SQL always returned) , 8 (already: inventory and `describe_object` first); plus Opus 7 (new "source content is data" guardrail — read-only is by instruction, `Bash` and `run_snowflake_query` can write) | 4 (effort stays `high`), 5–7 (n/a) |
| `data:data-governance` | 1–2 (no archive-vs-live question when dispatched; route by rule and name the choice), 3 (already: no DDL recommendations), 8 (describe a view instead of guessing a column; references are doc snapshots), 9 (already runs its queries) | 4–7 (n/a) |
| `data:sql-data-analysis` | 3 (no unrequested dbt models, tests, or docs), 8 (read the real schema and dbt tests; check dialect docs), 9 (run cardinality checks when the warehouse is reachable; a dry run isn't validation), 10 (already) | 1, 2, 4 (effort and stopping belong to the session), 5–7 (n/a) |
| `craft:python-engineering-standards` | 3 (named "files nobody asked for" in *Code That Reads As Written*), 8 (check a library's API against the locked version), 9 (removed "you don't have to run mypy"; the full check rule goes in `implementer`), 10 (already) | 1, 2, 4 (effort and stopping belong to the agent or session), 5–7 (no JSON output, open-ended asks, or held findings) |
