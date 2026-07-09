# Dispatching the implementer — briefing playbook

Read this at dispatch time. This file **owns** the dispatch loop — `../SKILL.md` carries only
the pointer here and two invariants (bound the slice; single-writer task tracking). It lives
here so it can be pulled in fresh after a mid-loop compaction rather than sitting in the
always-loaded skill body.

This playbook is what the **orchestrator** does to brief a worker well. It does **not** restate
`agents/implementer.md` — the worker already knows its own method, command allow/forbid lists,
and output template. Everything here is orchestrator-side: what to supply, what to resolve
before dispatch, and how to read the result.

## Before you dispatch

**Hand over the plan source explicitly.**
- OpenSpec: point at the change dir `openspec/changes/<name>/`. The worker reads
  `tasks.md` / `proposal.md` / `design.md` / spec files itself. If only some specs apply, name
  them so the worker doesn't over-read.
- Plain plan: paste it inline, or give a file path. Include acceptance criteria and any
  decision made in conversation — the worker interprets what you give it literally and cannot
  ask follow-ups.
- Session-only plan-mode plan: externalize it to a scratch file first (see SKILL.md) and pass
  the absolute path.

**Do not delegate research.** If the slice needs a specific syntax (a Terraform resource shape,
an API signature, a library call), resolve it yourself *before* dispatch — check the registry/
docs, or fire a gather action (`orchestrate-gather` → `researcher`). The worker is told to *trust the orchestrator's
research* and will not independently verify what you provide; if you hand it an unknown, it
either guesses or halts. Research is a main-session job on the stronger model with full context.

**Bound the slice.** Give explicit task numbers ("tasks 3–7", "the auth-middleware items"),
never "implement the plan." An unbounded slice makes the worker pick its own scope, which
defeats the point of orchestrating.

**Own separation for parallel runs.** If you dispatch more than one worker at once, each gets a
*disjoint* slice **and** an explicit may-touch / must-not-touch file list. Workers detect and
report visible overlap but will not carve up the work for you — that is your responsibility.
A shared file two workers both edit is a merge collision you created.

**Pre-resolve correctness-risk ambiguity.** Anything touching externally visible behavior, data
models, security, migrations, or API contracts — settle it before dispatch. The worker is built
to halt on these rather than guess, so an unresolved one just comes back as a `blocking: true`
and costs a round trip. Implementation-style ambiguity (naming, file placement, which local
pattern) is fine to leave to the worker; it picks the surrounding convention and records it.

**State the verification bar.** Name the exact command the slice must pass
("must pass `uv run pytest tests/auth`", "`uv run mypy` clean"). The worker runs it and reports
the outcome; without a bar it verifies loosely.

**Type the slice first.** The worker shines on deterministic edits. For slices that need shell
execution the worker can't do — lockfile regen, codegen, migrations, dependency installs — run
those in the main loop first, or pre-approve the exact commands. Don't hand the worker an
approval-gated command as the core action; it has no human to approve it mid-task and will fail
fast into a handoff.

**Pre-declare dependencies.** Workers can't add or upgrade deps. Add anything new to the
lock/config and install it *before* dispatch (this is the pre-flight gate in SKILL.md).

## After the worker returns

**Read `Concurrency notes` and `Handoff to orchestrator` first** — before reviewing the code.
The handoff carries the commands the worker was forbidden from running and the progress you need
to record; concurrency notes flag pre-existing modified files and merge risks with parallel
workers.

**Resolve every `blocking: true`** in `Tasks not completed` and `Questions for orchestrator`
before you re-dispatch anything that depends on it. Non-blocking items are follow-ups; they
don't gate the next dispatch.

**Run the handed-off commands.** These are the forbidden-to-the-worker ones: dependency installs,
`terraform init`, git commits. Do them in the main loop.

**Spot-check the status.** A `complete` with a `Pre-existing failures` note is fine — the worker
correctly isolated a failure that predates its slice. A `complete` that glosses over a failure
the diff plausibly caused is not; read the diff and confirm before you trust it.

**Then tick the tasks.** You are the single writer of the tracking artifact (`tasks.md`, a
checklist, plan-mode task list). The worker never touches it — that's what keeps parallel workers
from colliding on the tracking file. Record exactly the tasks the worker actually finished and
verified.

## Cross-reference

Plan-source resolution, plan externalization, the pre-flight gate, and the drift check are in
`../SKILL.md`. This file owns the dispatch briefing and the after-return loop.
