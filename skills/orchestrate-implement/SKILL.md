---
name: orchestrate-implement
description: The write phase of session orchestration — drive the `implementer` worker to write code against a bounded plan instead of coding inline on the main session. Use whenever a plan is ready to build - "implement the plan", "apply the OpenSpec change <name>", "dispatch the implementer", "orchestrate this", "build tasks 3–7", or right after a plan-mode plan is approved and you want it built by a worker. This is the only orchestration skill that writes code and ticks tasks. Not for trivial single-file edits — those are faster done inline.
---

# Orchestrate: Implement

The **write phase** of session orchestration. The main session plans, reviews, and ticks tasks; the `implementer` worker (a fresh context window on a capable model) writes the code. Keeping deterministic edits in the worker keeps the orchestrator's context free for judgment. This is the only orchestration skill that mutates — its mirror, `orchestrate-gather`, reads and reports.

**Escape hatch:** a trivial, single-file, low-risk edit is faster inline. Don't pay the dispatch ceremony for a one-line fix.

## Re-establish the plan source on entry

Do not trust an in-context summary of the plan — a long session may have compacted it away, and this skill must run correctly when re-invoked mid-loop. On entry, resolve the plan source and read it fresh:

1. **An OpenSpec change directory** — `openspec/changes/<name>/`. Read `tasks.md`, `proposal.md`, `design.md`, and the spec files; they carry intent and acceptance criteria that task titles compress. This is the richest source.
2. **A pasted plan or a file path** — read the file fresh rather than relying on what was quoted earlier; treat pasted text as the plan.
3. **A session-only plan-mode plan** — lives only in the session's context and was never written to a file. Externalize it before dispatch (next section).

## Externalize a session-only plan before dispatch

A fresh-context worker cannot read the session. Write the plan to a scratch file outside the working tree (e.g. `/tmp/orchestrate-implement/<change-slug>-plan.md`) — the full plan: task slices, acceptance criteria, and any in-conversation decisions the worker needs — and pass the **explicit absolute path** in the dispatch prompt. The worker's guardrails allow reading paths provided in the dispatch. Clean up the scratch file after the dispatch loop for that plan finishes, not earlier — you may re-dispatch (partial results, a follow-up slice), and deleting it early pulls the source out from under a later worker.

## Pre-flight: provision what the worker can't

Before dispatch, scan the slice for anything the worker is forbidden from provisioning, and do it first — otherwise the worker halts with a handoff:

- **A working environment to test in** → If none exists, **ask the user** how to handle it — create one, or dispatch without a test bar (worker verifies by inspection only) — rather than dispatching a worker whose verification step is doomed to fail.
- **New dependencies** → declare them in the project's lock/config and install now. The worker may only `uv sync` deps already declared; it cannot add, upgrade, or install undeclared ones.
- **Terraform** → run `terraform init` yourself (downloads providers, creates `.terraform/`). The worker may only run `validate` and `fmt`.
- **Validation tooling the verification bar names** (linter, type checker, test runner) → make it runnable now. The worker runs checks; it can't provision them.
- **Shell-heavy setup** (lockfile regeneration, codegen, migrations) → run it up front, so the worker's core action is deterministic edits, not gated shell calls.

If a gate item can't be satisfied (e.g. a dependency decision needs the user), stop and surface it — do not dispatch a worker into an environment where its slice can't complete.

## Drift check before dispatch

The plan was written against the code as it was. Confirm it still matches before handing it to a worker that will trust it literally. Small or local plan: read the files the plan names yourself. Large or unfamiliar surface: dispatch a bounded `codebase-explorer` to map the area and report drift. Resolve any drift — update the plan or the dispatch — *before* dispatch; the worker will not re-verify your research, so a stale instruction becomes a wrong edit.

## Dispatch loop

**Read `references/dispatch-implementer.md` at dispatch time** — it is the full briefing and after-return playbook, kept there so it can be pulled in fresh after a mid-loop compaction. Two invariants live here because they gate everything:

- **Bound every slice** with explicit task numbers ("tasks 3–7") — never "implement the plan."
- **You are the single writer of task tracking.** The worker never touches `tasks.md`, checklists, or plan/spec docs — that's what keeps parallel workers from colliding on the tracking artifact. Tick tasks only after reading the worker's handoff, resolving `blocking: true` items, running handed-off commands, and spot-checking the reported status; the playbook has the full sequence.

## Guardrails

- **Never `git commit` / `git push` unless the user asks.** If on the default branch, branch first.
- **Cede the deciding phase.** If the plan isn't settled yet, that's conversation, not this skill. Don't force a half-baked plan into a dispatch.
- **Hand back on blocking questions.** When a worker returns a `blocking: true` you can't resolve from the code or the plan, surface it to the user rather than guessing on their behalf.
- **Don't delegate research.** Resolve specific syntax/API shapes before dispatch — yourself, or via a gather action (`orchestrate-gather`). The worker trusts what you provide and won't verify it.
