## Context

The user runs complex planning on a strong model (Opus/Fable) in the main session and treats that session as an orchestrator: it gathers context via read-only subagents, chats to decide, then dispatches write-work to an `implementer` subagent rather than coding inline. The dispatch playbook for both halves currently lives as ~29 lines in global CLAUDE.md and causes friction: always-loaded cost, and soft-suggestion framing that lets pre-flight steps get skipped.

Two prior findings shaped this design:

1. **`context-gather` already works** as the read-only half, but is framed as a session-start briefing tool rather than an on-tap capability.
2. **The opsx skill family** (explore/propose/apply/sync/archive) demonstrates the pattern to copy: every skill re-establishes state from the CLI on entry and never trusts conversational memory, and boundaries are drawn at *mutation target* (explore writes nothing, propose writes artifacts, apply writes code + ticks tasks, sync writes main specs, archive moves dirs). Each skill's guardrails are a refusal to do the adjacent skill's job.

The worker agents (`codebase-explorer`, `researcher`, `implementer`) are already heavily specified with their own input contracts, methods, and rigid output templates. `implementer.md` in particular states "Trust the orchestrator's research" and carries an explicit forbidden-command list.

## Goals / Non-Goals

**Goals:**
- Move the dispatch playbook out of always-loaded memory into two skills that load only when orchestration happens.
- Make the write-phase a forcing function (a gate), not a suggestion.
- Make both skills survive context compaction (stateless on entry).
- Keep each skill's dispatch contract thin — complement the worker bodies, don't duplicate them.

**Non-Goals:**
- The skills do NOT drive the deciding phase. Brainstorming/pressure-testing stays as conversation; no skill names or sequences `grill-me` / `openspec-explore`.
- No merge into a single "orchestrate" skill. The whole point is the mutation-target split.
- No install-script changes (skills are discovered one level deep; rename + new dir needs no script edit).
- No automatic hook to route plan-mode approval into the implement skill (deferred; verbal handoff for now).

## Decisions

**Decision 1: Two skills, cut at mutation target (not one phased skill).**
The compaction property forces this. A single skill's body can be summarized away on a long session, taking the pre-flight gate and dispatch discipline with it. Two skills, each re-invocable and stateless on entry, mirror why opsx is five skills rather than one. Alternative considered: one `orchestrate` skill with internal phases — rejected because it recreates the compaction fragility and trends toward a god-skill.

**Decision 2: Rename `context-gather` → `orchestrate-gather` in place.**
Preserves the tuned phase-1 content and existing triggers; widens the description to fire on mid-decision gaps, not just session start. Alternative: retire and author two fresh skills — rejected as needless churn that discards tuned content.

**Decision 3: Deciding phase is ceded to conversation, unnamed.**
If a skill names the decision tools, the model starts trying to invoke and sequence them — the god-skill creep. Framing it as "chat with the user to decide" cedes the middle cleanly; the decision skills trigger on their own descriptions. Alternative: an `orchestrate-decide` skill — rejected; `grill-me`/`openspec-explore` already own it.

**Decision 4: Both skills re-establish state from disk on entry.**
Copied directly from opsx. `orchestrate-implement` resolves the plan source from disk (OpenSpec change dir / pasted path / session-only plan-mode plan) and reads it fresh. This is what makes re-invocation after compaction safe.

**Decision 5: Externalize the session-only plan-mode plan before dispatch.**
A plan-mode plan lives only in session context; a fresh-context worker cannot see it. So before the first dispatch, the plan must be written to a scratch file. This is not a nice-to-have — it is the analogue of opsx's `openspec status --json`: the durable source the worker reads.

**Decision 6: Dispatch contracts complement, not duplicate, the worker bodies.**
Because the workers are already fully specified, each skill's contract carries only: (a) inputs to supply (mirroring the worker's input contract), (b) orchestrator-only value-adds the worker can't self-provide, (c) which return fields gate the next action. Duplicating the worker's method/template would drift when the agent file changes.

**Decision 7: The pre-flight gate is the mirror of `implementer.md`'s forbidden-command list.**
The worker cannot add/upgrade deps, cannot `terraform init`, cannot install undeclared packages. The gate is exactly "do the things the worker is forbidden from doing, first." This creates a real coupling: a `## Keep in sync` pointer to `agents/implementer.md` goes in the skill so the gate doesn't silently drift when the agent's forbidden list changes.

**Decision 8: Heavy implementer-dispatch detail in `references/`.**
The implement contract is longer and most likely to be compacted mid-loop, so its full briefing playbook lives in `references/dispatch-implementer.md`, pulled in at dispatch time and re-readable after compaction. The gather contract is compact enough to stay in the SKILL.md body.

**Decision 9: One OpenSpec change, not two.**
The two skills share one rationale (mutation-target cut, stateless-on-entry, decide-as-conversation), one CLAUDE.md edit, and a coupled rename. They can't be reviewed or archived independently. Tasks are partitioned internally instead.

**Decision 10: Skill authoring runs through `skill-creator` + plan mode.**
Per repo CLAUDE.md, and no existing SKILL.md is overwritten without explicit confirmation.

## Risks / Trade-offs

- **Gate/forbidden-list drift** → the `## Keep in sync` pointer to `agents/implementer.md` in the skill; called out in tasks as a checked step.
- **Two skills to invoke instead of one** → mitigated by the shared `orchestrate-` prefix (discoverable as a pair) and by each firing on its own trigger; the on-tap framing means gather is invoked naturally when a gap opens, not as a ceremony.
- **Redundant detail loaded when only one phase is needed** → accepted; the ergonomic + compaction wins dominate, and `references/` keeps the implement body lean until dispatch time.
- **Verbal handoff into implement is load-bearing** (no hook) → accepted for now; if muscle-memory inline-coding proves a recurring problem, add a post-plan hook via `update-config` in a later change.
- **Global CLAUDE.md is outside the repo** → the trimmed invariant block is edited manually and documented in tasks; it is not installed by any script.

## Migration Plan

1. Rename `skills/context-gather/` → `skills/orchestrate-gather/`; reframe content as on-tap read-only + fold in the read-only dispatch contract.
2. Author `skills/orchestrate-implement/SKILL.md` + `references/dispatch-implementer.md` via `skill-creator` + plan mode.
3. Trim global CLAUDE.md lines 1-29 to invariants + skill pointer.
4. Verify install scripts still discover both skills one level deep (no script change expected).

Rollback: restore `skills/context-gather/`, remove `skills/orchestrate-implement/`, restore the original CLAUDE.md block from git/backup.

## Open Questions

- Exact scratch-file location/naming convention for the externalized plan-mode plan (inside the working tree, per implementer guardrails — resolve during skill authoring).
- Whether the drift check (plan vs current code) is a documented step the orchestrator runs inline or a bounded explorer dispatch — likely inline for small plans, explorer for large; settle in the SKILL.md.
