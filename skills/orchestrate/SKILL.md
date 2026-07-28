---
name: orchestrate
description: Drive workers to build a bounded plan instead of coding inline on the main session — the `implementer` to write code, `pathfinder` or `researcher` to close what it would otherwise have to guess. Use whenever a plan is ready to build - "implement the plan", "apply the OpenSpec change <name>", "dispatch the implementer", "orchestrate this", "build tasks 3–7", or right after a plan-mode plan is approved and you want it built by a worker. Also use mid-build when a slice needs an unknown resolved — a syntax or API shape, a convention outside the plan, a fact about the data — or when the plan may have drifted from the code. Not for trivial single-file edits.
---

# Orchestrate

The main session plans, reviews, and ticks tasks; workers do the bounded work in fresh context windows. The `implementer` writes code; `pathfinder` and `researcher` close gaps the build runs into. Keeping deterministic edits and bulk reading in workers keeps the orchestrator's context free for judgment.

Dispatch runs in both directions, but writing is one-way: the main session is the **single writer of task tracking**, always.

**Escape hatch:** a trivial, single-file, low-risk edit is faster inline. Don't pay the dispatch ceremony for a one-line fix.

## Resolve the plan source on entry

First, name the plan source. It is one of:

1. **An OpenSpec change directory** — `openspec/changes/<name>/`: `tasks.md`, `proposal.md`, `design.md`, and the spec files. They carry intent and acceptance criteria that task titles compress. The richest source.
2. **A plan file** — a path you were given, or `~/.claude/plans/<name>.md` if a plan-mode plan was approved this session.
3. **A plan that exists nowhere on disk** — settled in conversation, never written to a file. Externalize it before dispatch (next section).

Then read only what you don't already hold reliably. **Re-read when:**

- The plan predates a compaction, or you can't quote its task list and acceptance criteria without hedging.
- You never read it — the user pointed you at a change directory someone else authored.
- It's `tasks.md`. Always re-read this one: it's mutable tracking state that a prior loop iteration or a parallel session may have ticked since.

**Don't re-read when you authored the artifacts this session and nothing has written to them since.** You already hold the intent, the trade-offs, and the acceptance criteria at full fidelity — re-reading a `design.md` you wrote twenty minutes ago buys nothing and costs the context you're trying to protect. Say so in one line and move on.

The test is whether your grip on the plan is *stale*, not whether this skill just fired.

## Externalize a session-only plan before dispatch

A fresh-context worker cannot read the session. Write the plan to a scratch file outside the working tree (e.g. `/tmp/orchestrate/<change-slug>-plan.md`) — the full plan: task slices, acceptance criteria, and any in-conversation decisions the worker needs — and pass the **explicit absolute path** in the dispatch prompt. The worker's guardrails allow reading paths provided in the dispatch. Clean up the scratch file after the dispatch loop for that plan finishes, not earlier — you may re-dispatch (partial results, a follow-up slice), and deleting it early pulls the source out from under a later worker.

## Pre-flight

Three checks, one pass over the slice before you dispatch. Each is scoped to what the `implementer` genuinely can't do or can't know — none of them is a ritual to perform when the answer is already in hand.

### Provision what the worker can't

Scan the slice for anything the worker is forbidden from provisioning, and do it first — otherwise the worker halts with a handoff:

- **A working environment to test in** → If none exists, **ask the user** how to handle it — create one, or dispatch without a test bar (worker verifies by inspection only) — rather than dispatching a worker whose verification step is doomed to fail.
- **New dependencies** → declare them in the project's lock/config and install now. The worker may only `uv sync` deps already declared; it cannot add, upgrade, or install undeclared ones.
- **Terraform** → run `terraform init` yourself (downloads providers, creates `.terraform/`). The worker may only run `validate` and `fmt`.
- **Validation tooling the verification bar names** (linter, type checker, test runner) → make it runnable now. The worker runs checks; it can't provision them.
- **Shell-heavy setup** (lockfile regeneration, codegen, migrations) → run it up front, so the worker's core action is deterministic edits, not gated shell calls.

If a gate item can't be satisfied (e.g. a dependency decision needs the user), stop and surface it — do not dispatch a worker into an environment where its slice can't complete.

### Check for drift

The plan was written against the code as it was. The worker will trust it literally, so a stale instruction becomes a wrong edit. But the check scales to the *risk of drift*, not to the size of the plan:

- **You read the files while planning and nothing has touched them since** → no check needed. `git status` on the paths the plan names is enough to confirm that, and it's one command instead of N file reads.
- **The plan is older than the session, or someone else has been in the tree** → read the files the plan names yourself.
- **The surface is large or unfamiliar** → dispatch a bounded `pathfinder` to map it and report drift. Brief it per `references/dispatch-readers.md`.

Resolve any drift — update the plan or the dispatch — *before* dispatch.

### Close the unknowns

The `implementer` is told to trust your research and won't verify it. Anything it would have to guess at, resolve now:

- **A syntax or API shape you're not certain of** — a Terraform resource's arguments, a library's call signature, a version's behavior. Dispatch `researcher`, or check the docs yourself.
- **A convention or contract living outside the plan** — how a sibling module does this, what shape the upstream caller expects, what a Confluence page or ticket says the acceptance criteria actually are. Dispatch `pathfinder`.
- **A fact about data you're about to transform** — a column's real type, whether a table is populated, how many rows a filter actually matches. Dispatch `pathfinder` with the query, or run it yourself.

`references/dispatch-readers.md` has the briefing contract for both workers, plus the fast path for a single bounded question. Reading is the cheap half of orchestration — dispatch freely here, because an unknown that reaches the `implementer` comes back as a guess or a `blocking: true`, and either one costs a full round trip.

## Dispatch loop

**Read `references/dispatch-implementer.md` at dispatch time** — it is the full briefing and after-return playbook, kept there so it can be pulled in fresh after a mid-loop compaction. Its counterpart `references/dispatch-readers.md` covers briefing a read-only worker (`pathfinder`, `researcher`) when the build hits a gap. Two invariants live here because they gate everything:

- **Bound every slice** with explicit task numbers ("tasks 3–7") — never "implement the plan."
- **You are the single writer of task tracking.** The worker never touches `tasks.md`, checklists, or plan/spec docs — that's what keeps parallel workers from colliding on the tracking artifact. Tick tasks only after reading the worker's handoff, resolving `blocking: true` items, running handed-off commands, and spot-checking the reported status; the playbook has the full sequence.

## Guardrails

- **Never `git commit` / `git push` unless the user asks.** If on the default branch, branch first.
- **Cede the deciding phase.** If the plan isn't settled yet, that's conversation, not this skill. Don't force a half-baked plan into a dispatch.
- **Hand back on blocking questions.** When a worker returns a `blocking: true` you can't resolve from the code or the plan, surface it to the user rather than guessing on their behalf.
- **Never hand the `implementer` an unknown.** It won't research and won't verify — see *Pre-flight → Close the unknowns*.
- **Don't re-read what you already hold.** Re-establishing context is for stale grip, not for ceremony. The context you burn re-reading your own artifacts is the context this skill exists to protect.
