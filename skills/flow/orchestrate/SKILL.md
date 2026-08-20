---
name: orchestrate
description: Have workers build a bounded plan instead of coding inline in the main session: use `implementer` to write code and `pathfinder` or `researcher` to close gaps that would otherwise require guesses. Use when a plan is ready to build - "implement the plan", "apply the OpenSpec change <name>", "dispatch the implementer", "orchestrate this", "build tasks 3–7", or right after a plan-mode plan is approved and you want a worker to build it. Use it mid-build when a slice needs an unknown resolved - a syntax or API shape, a convention outside the plan, a fact about the data - or when the plan may have drifted from the code. Not for trivial single-file edits.
---

# Orchestrate

The main session plans, reviews, and ticks tasks; workers handle bounded work in fresh context windows. The `implementer` writes code. `pathfinder` and `researcher` close gaps in the build. Send deterministic edits and bulk reading to workers to keep the orchestrator's context free for judgment.

Dispatch runs in both directions, but task tracking is one-way: the main session is **always the single writer of task tracking**.

**Escape hatch:** handle a trivial, single-file, low-risk edit inline. Do not use the dispatch ceremony for a one-line fix.

## Resolve the plan source on entry

First, identify the plan source. It is one of:

1. **An OpenSpec change directory** — `openspec/changes/<name>/`. Resolve it through the CLI, not filename convention. If you do not know the name, use `openspec list --json` to see what is active. `openspec status --change "<name>" --json` returns `schemaName`, `changeRoot`, and per-artifact progress. `openspec instructions apply --change "<name>" --json` returns `contextFiles`: the concrete paths for *this* schema, not assumed `tasks.md`/`proposal.md`/`design.md` paths (other schemas use different artifact names). Read those paths. They preserve intent and acceptance criteria that task titles compress, making them the richest source. Resolve rather than guess. If the change lives in a **store** (a standalone OpenSpec repo registered on this machine), run `openspec store list --json` for its id and pass `--store <id>` on every command above.
2. **A plan file** — a path you were given, or `~/.claude/plans/<name>.md` if a plan-mode plan was approved this session.
3. **A plan that exists nowhere on disk** — settled in conversation, never written to a file. Externalize it before dispatch (next section).

Then read only material you do not already hold reliably. **Re-read when:**

- The plan predates a compaction, or you cannot state its task list and acceptance criteria without hedging.
- You have not read it — the user pointed you to a change directory another person authored.
- It's the task-tracking artifact (`tasks.md` under spec-driven, or whatever `contextFiles` resolved for this schema). Always re-read: re-run `openspec status --change "<name>" --json` for the progress summary, and open the file itself for full task text — it's mutable tracking state that a prior loop iteration or a parallel session may have changed since.

**Don't re-read when you authored the artifacts this session and nothing has written to them since.** You already retain the intent, trade-offs, and acceptance criteria at full fidelity. Re-reading a `design.md` you wrote twenty minutes ago wastes the context this skill protects. Say so in one line and move on.

Test whether your understanding of the plan is *stale*, not whether this skill just fired.

## Externalize a session-only plan before dispatch

A fresh-context worker cannot read the session. Write the full plan to a scratch file outside the working tree (e.g. `/tmp/orchestrate/<change-slug>-plan.md`): task slices, acceptance criteria, and any in-conversation decisions the worker needs. Pass the **explicit absolute path** in the dispatch prompt. The worker's guardrails allow it to read paths provided in the dispatch.

Clean up the scratch file only once *Closing the build* has resolved, not when the dispatch loop ends. Two later steps still need it: a re-dispatch for partial results or a follow-up slice, and the closing gate, which gives its path to a reviewer as the only written statement of the change's intended result. Deleting it early removes the source from both.

## Pre-flight

Make three checks in one pass over the slice before you dispatch. Scope each to something the `implementer` genuinely cannot do or know; do not perform checks when you already have the answer.

### Provision what the worker can't

Scan the slice for anything the worker is forbidden from provisioning, and do it first. Otherwise, the worker halts with a handoff:

- **A working environment to test in** → If none exists, **ask the user** how to handle it — create one, or dispatch without a test bar (worker verifies by inspection only) — rather than dispatching a worker whose verification step is doomed to fail.
- **New dependencies** → declare them in the project's lock/config and install now. The worker may only `uv sync` deps already declared; it cannot add, upgrade, or install undeclared ones.
- **Terraform** → run `terraform init` yourself (downloads providers, creates `.terraform/`). The worker may only run `validate` and `fmt`.
- **Validation tooling the verification bar names** (linter, type checker, test runner) → make it runnable now. The worker runs checks; it can't provision them.
- **Shell-heavy setup** (lockfile regeneration, codegen, migrations) → run it up front, so the worker's core action is deterministic edits, not gated shell calls.

If you cannot satisfy a gate item (for example, a dependency decision needs the user), stop and surface it. Do not dispatch a worker into an environment where its slice cannot complete.

### Check for drift

The plan was written against the code as it was. The worker trusts it literally, so a stale instruction produces a wrong edit. Scale the check to the *risk of drift*, not the size of the plan:

- **You read the files while planning and nothing has touched them since** → no check is needed. `git status` on the paths named in the plan confirms that with one command instead of N file reads.
- **The plan is older than the session, or someone else has been in the tree** → read the files the plan names yourself.
- **The surface is large or unfamiliar** → dispatch a bounded `pathfinder` to map it and report drift. Brief it per `references/dispatch-readers.md`.

Resolve any drift — update the plan or the dispatch — *before* dispatch.

### Close the unknowns

The `implementer` is told to trust your research and will not verify it. Resolve anything it would have to guess now:

- **A syntax or API shape you're not certain of** — a Terraform resource's arguments, a library's call signature, a version's behavior. Dispatch `researcher`, or check the docs yourself.
- **A convention or contract living outside the plan** — how a sibling module does this, what shape the upstream caller expects, what a Confluence page or ticket says the acceptance criteria actually are. Dispatch `pathfinder`.
- **A fact about data you're about to transform** — a column's real type, whether a table is populated, how many rows a filter actually matches. Dispatch `pathfinder` with the query, or run it yourself.

`references/dispatch-readers.md` defines the briefing contract for both workers and the fast path for one bounded question. Reading is the inexpensive half of orchestration. Dispatch freely here: an unknown that reaches the `implementer` returns as a guess or `blocking: true`, and either costs a full round trip.

## Dispatch loop

**Read `references/dispatch-implementer.md` at dispatch time.** It contains the full briefing and after-return playbook, so you can pull it in fresh after a mid-loop compaction. `references/dispatch-readers.md` covers briefing a read-only worker (`pathfinder`, `researcher`) when the build hits a gap. Two invariants gate everything:

- **Bound every slice** with explicit task numbers ("tasks 3–7") — never "implement the plan."
- **You are the single writer of task tracking.** The worker never touches `tasks.md`, checklists, or plan/spec docs — that's what keeps parallel workers from colliding on the tracking artifact. Tick tasks only after reading the worker's handoff, resolving `blocking: true` items, running handed-off commands, and spot-checking the reported status; the playbook has the full sequence.

## Closing the build

The build is finished once you complete the last slice's after-return work: read the handoff, resolve `blocking: true` items, run handed-off commands, and tick tasks. Ask one question: should someone review this change's *shape* before it goes further?

Offer a review when the signals below apply. This skill runs on most builds, including one-line fixes. A prompt that is usually noise trains users to dismiss it, including when it matters. Default to silence.

### Signals worth offering on

You can assess each without a fresh read of the tree.

- **More than one slice was dispatched.** Independent workers make locally sensible choices, and shape drift accumulates in the seams between them.
- **A new module or package appeared.** Its boundaries are being set now, and they're cheapest to move before anything imports it.
- **A touched module grew past the point where you'd want to read it whole.** Run one `wc -l` on paths you already hold.
- **A worker's handoff mentioned copying a helper, introducing an abstraction, or following a test pattern.** Each is a shape decision from a worker that could not see the rest of the change.
- **The plan source was an OpenSpec change.** It has a stated design to check the implementation against, which is the richest thing a review of this kind can have.

A single-slice change to existing files, with no new module or shape note in the handoff, needs nothing. End the skill.

### Making the offer

Ask once in one line, then accept the answer. Do not argue, raise it again later in the same build, or turn a decline into a smaller version of the same question. If the user says no, the build is done.

When the user agrees — or asks for a review directly — **read `references/dispatch-reviewer.md`** and dispatch `structure-reviewer` under its contract. It covers information only you can provide (the written statement of intent, what the build touched, and decisions that never reached the design), the response to a `request_changes` fix list, and the re-review path. It sits outside this file because the gate fires at the end of a build, when a compaction is most likely to have lost the detail.

## Guardrails

- **Never `git commit` / `git push` unless the user asks.** If on the default branch, branch first.
- **Cede the deciding phase.** If the plan is not settled, that is conversation, not this skill. Do not force a half-baked plan into a dispatch.
- **Hand back on blocking questions.** When a worker returns a `blocking: true` you can't resolve from the code or the plan, surface it to the user rather than guessing on their behalf.
- **Never hand the `implementer` an unknown.** It will not research or verify — see *Pre-flight → Close the unknowns*.
- **Don't re-read what you already hold.** Re-establish context only when your understanding is stale. Re-reading your own artifacts uses the context this skill protects.
