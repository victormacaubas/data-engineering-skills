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

1. **An OpenSpec change directory**: `openspec/changes/<name>/`. Resolve it through the CLI, not filename convention. If you do not know the name, use `openspec list --json` to see what is active. `openspec status --change "<name>" --json` returns `schemaName`, `changeRoot`, and per-artifact progress. `openspec instructions apply --change "<name>" --json` returns `contextFiles`: the concrete paths for *this* schema, not assumed `tasks.md`/`proposal.md`/`design.md` paths (other schemas use different artifact names). Read those paths. They preserve intent and acceptance criteria that task titles compress, making them the richest source. Resolve rather than guess. If the change lives in a **store** (a standalone OpenSpec repo registered on this machine), run `openspec store list --json` for its id and pass `--store <id>` on every command above.
2. **A plan file**: a path you were given, or `~/.claude/plans/<name>.md` if a plan-mode plan was approved this session.
3. **A plan that exists nowhere on disk**: settled in conversation, never written to a file. Externalize it before dispatch (next section).

Then read only material you do not already hold reliably. **Re-read when:**

- The plan predates a compaction, or you cannot state its task list and acceptance criteria without hedging.
- You have not read it: the user pointed you to a change directory another person authored.
- It's the task-tracking artifact (`tasks.md` under spec-driven, or whatever `contextFiles` resolved for this schema). Always re-read: re-run `openspec status --change "<name>" --json` for the progress summary, and open the file itself for full task text, because it's mutable tracking state that a prior loop iteration or a parallel session may have changed since.

**Don't re-read when you authored the artifacts this session and nothing has written to them since.** You already retain the intent, trade-offs, and acceptance criteria at full fidelity. Re-reading a `design.md` you wrote twenty minutes ago wastes the context this skill protects. Say so in one line and move on.

Test whether your understanding of the plan is *stale*, not whether this skill just fired.

## The run folder

Everything this skill writes lives in `.orchestrate/<slug>/` at the repo root. `<slug>` is the OpenSpec change name, the plan file's basename, or a short kebab-case name for a session-only plan. It holds a session-only `plan.md` (next section) and one `implementer` report per slice.

Before the first dispatch, make sure `.orchestrate/.gitignore` exists containing `*`; create it if not. The `implementer` also creates it when missing. The folder then stays out of `git status`, out of a worker's overlap check, and out of a reviewer's diff, without editing the repo's own `.gitignore`.

Keep the folder until *Closing the build* resolves. A re-dispatch for a partial slice and the closing review both read from it.

## Externalize a session-only plan before dispatch

**Only for plan source 3.** An OpenSpec change or a plan file already is the written plan. Never copy it into a scratch file, and never create one to hold decisions taken in conversation; *Pre-flight → Record what you settled* says where those go.

A fresh-context worker cannot read the session. Write the full plan to `.orchestrate/<slug>/plan.md`: tasks, acceptance criteria, and the decisions the worker needs. Pass its path in the dispatch.

It is the only written statement of the change's intended result, so the closing review is handed its path too. That is why it lives as long as the run folder, not just the dispatch loop.

## Pre-flight

Make three checks in one pass over the scope before you dispatch, then record what they settled. Scope each to something the `implementer` genuinely cannot do or know; do not perform checks when you already have the answer.

### Provision what the worker can't

Scan the slice for anything the worker is forbidden from provisioning, and do it first. Otherwise, the worker halts with a handoff:

- **A working environment to test in** → If none exists, **ask the user** how to handle it (create one, or dispatch without a test bar, where the worker verifies by inspection only) rather than dispatching a worker whose verification step is doomed to fail.
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

Resolve any drift (update the plan or the dispatch) *before* dispatch.

### Close the unknowns

The `implementer` is told to trust your research and will not verify it. Resolve anything it would have to guess now:

- **A syntax or API shape you're not certain of**: a Terraform resource's arguments, a library's call signature, a version's behavior. Dispatch `researcher`, or check the docs yourself.
- **A convention or contract living outside the plan**: how a sibling module does this, what shape the upstream caller expects, what a Confluence page or ticket says the acceptance criteria actually are. Dispatch `pathfinder`.
- **A fact about data you're about to transform**: a column's real type, whether a table is populated, how many rows a filter actually matches. Dispatch `pathfinder` with the query, or run it yourself.

`references/dispatch-readers.md` defines the briefing contract for both workers and the fast path for one bounded question. Reading is the inexpensive half of orchestration. Dispatch freely here: an unknown that reaches the `implementer` returns as a guess or `blocking: true`, and either costs a full round trip.

### Record what you settled

Pre-flight and conversation settle things the plan source doesn't say. Route each one by what it changes:

- **It changes intent** (scope, behavior, a design choice) → edit it into the plan source before dispatch: the change's design or tasks artifact, the plan file, or `plan.md`. The worker reads the plan whole, and the closing review checks the code against it. A decision held anywhere else reads as a violation to both.
- **Only the dispatch needs it** (a resolved API shape, a data fact, the file split between parallel slices) → the brief's `Not in the plan` line.

Nothing else gets a file.

## Slice the scope

Do the dispatch thinking once, here, for the whole bounded scope, then dispatch from the result. **Read `references/dispatch-implementer.md` now**: its contract defines what a brief carries.

- **Cut slices along task groups.** Merge two groups when a task's check needs the other group's output.
- **Mark dependencies.** A slice that edits a file another slice edits, or needs its output, is blocked by it. Slices with disjoint files go in the same batch, each with the other's paths as `Must not touch`.
- **Write every brief now.** A brief carries only what the plan source lacks, so for a well-specified OpenSpec change it is about three lines. Dispatching then needs no fresh deliberation.

### Show progress in the harness task list

Mirror the slices into the harness's built-in task list (`TaskCreate`/`TaskUpdate` in Claude Code, `update_plan` in Codex, the todo tool in Cursor) so the user sees live progress. It is a view of the tracking artifact, never a second record.

- **Create the list in one message:** one entry per slice (`Slice A: capture and state (tasks 2.1–2.4)`), plus one per open pre-flight item or step only you can run (a live end-to-end check, a final `openspec validate`). Then add the blocked-by links where the tool supports them.
- **One entry per slice, not per task.** Per-task ticks stay in the tracking artifact.
- **`in_progress`** in the message that dispatches the slice.
- **`completed`** in the same message that ticks the slice's tasks in the tracking artifact, never on a worker's report alone. A `partial` or `blocked` slice stays open, retitled with its blocker (`Slice B … — blocked: 3.2 command name`).
- **Keep it in step** when the scope changes mid-build (a re-slice, a review fix list): update the entries rather than letting the list drift from the artifact.

Workers have no task tools, so the list stays single-writer like the artifact it mirrors.

## Dispatch loop

Send each slice's brief from *Slice the scope* as the dispatch prompt. `references/dispatch-implementer.md` also holds the after-return playbook; `references/dispatch-readers.md` covers briefing a read-only worker (`pathfinder`, `researcher`) when the build hits a gap. Two invariants gate everything:

- **Bound every slice** with explicit task numbers ("tasks 3–7"), never "implement the plan."
- **You are the single writer of task tracking.** The worker never touches `tasks.md`, checklists, or plan/spec docs; that's what keeps parallel workers from colliding on the tracking artifact. Tick tasks only after reading the worker's receipt, resolving `blocking: true` items, running handed-off commands, and spot-checking the reported status; the playbook has the full sequence.

### Dispatch as one batch, synthesize once

When a step needs several workers on independent assignments, emit **all** of their dispatches in a single message. Never dispatch, comment, then dispatch again: staggered starts stagger the returns, and every return arrives as a separate turn you then have to resist filling.

Before the batch, write one line per worker naming it and its scope. Nothing more. No hypotheses, no expected findings, no reasoning about what the code probably does. Anything you assert before the evidence lands is something you may have to retract in front of the user.

The returns wake you one at a time. **On a partial return, the whole turn is recording, not reasoning:** note that the worker is back (`pathfinder (auth) back — 2 of 3`), tick tasks that worker actually verified and update its task-list entry, log a `blocking: true` to resolve later. Then stop. No summary of the finding, no conclusion drawn from it, no revised plan, no answer to the user's question.

The batch is a barrier: reasoning on return 1 of 3 is usually voided by return 2, so the next substantive thing you say comes after the last worker is back.

One return justifies breaking the barrier: one that makes the rest of the batch moot, whether a `blocking: true` you cannot resolve or a finding that invalidates the other assignments. Say that in one line and stop the remaining work rather than synthesizing around it.

Wait on the task notification for each return. Never poll, sleep-and-check, or start a `Monitor`; a waiter adds cost without value.

### Keep the loop moving

Run straight through the bounded scope. When a batch is fully back and its tasks are ticked, and the scope still has open tasks that nothing blocks, put the status note in the same message as the next dispatch. A message with no tool call ends your turn, and the build stops there until the user asks you to continue.

Three endings leave owed work undone. Don't use them:

- A summary of the finished slices that closes by announcing the next dispatch ("next I'll send tasks 8–10") without sending it.
- An offer to continue unless the user would prefer otherwise.
- A list of decisions for the user when, by your own account, none of them blocks the next slice. Put your recommendation next to each one and keep dispatching whatever doesn't depend on the answer.

Ending a turn while workers in the batch are still running is waiting, not stopping; that is what a partial-return turn does. Otherwise, stop only when nothing can move without the user: a `blocking: true` you can't resolve from the code or the plan, a pre-flight item that needs their decision, or every task in scope ticked, which moves you to *Closing the build*. Before ending any turn, re-read the tracking artifact: open tasks in scope with no stated blocker mean the turn isn't over. The task list shows the same thing at a glance: an open entry with no blocker in its title is owed work. This does not override asking before risky or destructive actions.

## Closing the build

The build is finished once you complete the last slice's after-return work: read the receipt, resolve `blocking: true` items, run handed-off commands, and tick tasks. Ask one question: should someone review this change's *shape* before it goes further?

Offer a review only when the signals below apply; a prompt that is usually noise trains users to dismiss it. Default to silence.

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

When the user agrees, or asks for a review directly, **read `references/dispatch-reviewer.md`** and dispatch `structure-reviewer` under its contract. It covers information only you can provide (the written statement of intent, what the build touched, and decisions that never reached the design), the response to a `request_changes` fix list, and the re-review path.

### Clean up the run folder

Once the review question has resolved (answered, or never raised) and every task in scope is ticked, ask once in one line: "Remove `.orchestrate/<slug>/`?" On yes, run `<skill-dir>/scripts/cleanup.sh <slug>` from the repo root. On no, leave it.

Never ask while the build is stopped on a blocker; a later session resumes from those reports. Review reports in `.structure-review/` are not part of the run folder and outlive the build on purpose. The script never touches them.

## Guardrails

- **Never `git commit` / `git push` unless the user asks.** If on the default branch, branch first.
- **Cede the deciding phase.** If the plan is not settled, that is conversation, not this skill. Do not force a half-baked plan into a dispatch.
- **Hand back on blocking questions.** When a worker returns a `blocking: true` you can't resolve from the code or the plan, surface it to the user rather than guessing on their behalf.
- **Dispatch a batch in one message.** All workers for one step, one message, one line of preamble naming each scope. Dispatch-comment-dispatch staggers the returns and invites narration between them.
- **Don't reason on a partial return.** Record it and stop. Synthesis happens once, after the last worker in the batch is back.
- **Don't build a waiter.** No `Monitor`, no polling loop. Notifications only.
- **Don't stop with owed work.** Open tasks in scope and no blocker means dispatch the next slice, not a summary that announces it.
- **Never hand the `implementer` an unknown.** It will not research or verify. See *Pre-flight → Close the unknowns*.
- **Don't externalize a plan that's already on disk.** Only a session-only plan gets `plan.md`. Settled decisions go into the plan source or the brief.
- **Don't re-read what you already hold.** Re-establish context only when your understanding is stale. Re-reading your own artifacts uses the context this skill protects.
