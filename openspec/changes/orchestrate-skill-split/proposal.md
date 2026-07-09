## Why

The session-orchestration playbook (how the main-session agent dispatches read-only explorers and write-workers) currently lives as ~29 lines of always-loaded global CLAUDE.md. This is the wrong home: it pays context cost in every session even when no orchestration happens, and the model reads a bullet list as soft suggestions rather than an executable checklist — so pre-flight steps (uv env ready, deps installed, terraform init'd) get skipped and dispatches fail. The `context-gather` skill already proves the phase-1 half works as a skill; the phase-2 (implementation dispatch) half has no skill and no forcing function.

## What Changes

- **BREAKING** Rename the `context-gather` skill to `orchestrate-gather`, reframing it from a session-start briefing tool into an on-tap read-only dispatch skill (invoked at session start OR mid-decision whenever a knowledge gap opens). Its trigger description widens accordingly.
- Add a new `orchestrate-implement` skill covering the write phase: pre-flight environment gate, plan-vs-code drift check, implementer dispatch loop, and task ticking.
- Cut the two skills at **mutation target**: `orchestrate-gather` mutates nothing (read-only), `orchestrate-implement` mutates code + task tracking. Each refuses the other's job.
- Make both skills **stateless on entry** — each re-establishes state from disk (plan source, current code, artifacts) rather than trusting conversational continuity, so they survive context compaction the way the opsx skills do.
- Give each skill a **thin dispatch contract** that complements the worker agent bodies (`codebase-explorer`, `researcher`, `implementer`) rather than duplicating them: what inputs to supply, orchestrator-only value-adds, and which return fields gate the next action.
- `orchestrate-implement`'s pre-flight gate mirrors `implementer.md`'s forbidden-command list (declare deps in lock first, `terraform init` first, install validation libs) and carries a keep-in-sync pointer to `agents/implementer.md`.
- `orchestrate-implement` resolves the plan source from disk on entry (OpenSpec change dir / pasted path / session-only plan-mode plan) and externalizes a session-only plan-mode plan to a scratch file before dispatch so the fresh-context worker can read it.
- Move heavy implementer-dispatch detail into a `references/` file, pulled in at dispatch time (re-readable after compaction).
- Shrink CLAUDE.md lines 1-29 to only the invariants that must survive regardless of which skill is loaded (orchestrator role, never busy-poll, wait on notifications, workers never touch task tracking) plus a pointer to both skills. The how-to-brief-each-worker detail leaves memory and lives with its skill.
- The "decide" phase between gather and implement stays as plain conversation, named by neither skill (no skill sequences `grill-me` / `openspec-explore`).

## Capabilities

### New Capabilities
- `session-orchestration`: How the main-session orchestrator dispatches work to subagents across a session lifecycle — the read-only gather skill, the write-phase implement skill, the mutation-target boundary between them, the stateless-on-entry requirement, the per-skill dispatch contracts, and the reduced CLAUDE.md invariant set.

### Modified Capabilities
<!-- None. The skill-authoring capability governs how skills are built, not which skills exist; this change adds a new skill and renames one without changing the authoring contract. -->

## Impact

- **Skills**: `skills/context-gather/` renamed to `skills/orchestrate-gather/`; new `skills/orchestrate-implement/` with a `references/` subdir.
- **Global memory**: `~/.claude/CLAUDE.md` lines 1-29 replaced with a trimmed invariant block + skill pointer. (Outside the repo; edited manually, not installed.)
- **Coupling**: `orchestrate-implement`'s pre-flight gate is derived from `agents/implementer.md`'s forbidden-command list — a documented sync point.
- **Authoring process**: skill work goes through `skill-creator` + plan mode per repo CLAUDE.md; SKILL.md rewrites require explicit confirmation before overwrite.
- **No install-script changes**: install scripts already discover skills one level deep under `skills/`; a rename + new dir needs no script change.
