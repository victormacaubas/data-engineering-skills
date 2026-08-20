# Dispatching the implementer — briefing playbook

This playbook is what the **orchestrator** does to brief a worker well. It does **not** restate
`agents/implementer.md` — the worker already knows its own method, command allow/forbid lists,
and output template. Everything here is orchestrator-side: what to supply, what to resolve
before dispatch, and how to read the result.

## Before you dispatch

**Hand over the plan source explicitly.**
- OpenSpec: resolve it yourself first — `openspec status --change "<name>" --json` and
  `openspec instructions apply --change "<name>" --json` — then give the worker the change
  directory `openspec/changes/<name>/` and the exact `contextFiles` paths from that JSON. Do not
  let the worker guess filenames across schemas. If only some specs apply, name them so it does
  not over-read. The worker's OpenSpec access is read-only and unenriched (`openspec list`,
  `openspec show`, `openspec validate` — no `status` or `instructions`), so you must supply the
  resolved paths.
- Plain plan: paste it inline or give a file path. Include acceptance criteria and decisions made
  in conversation — the worker interprets what you give it literally and cannot ask follow-ups.
- Session-only plan-mode plan: externalize it to a scratch file first (see SKILL.md) and pass
  the absolute path.

**Resolve unknowns before you arrive.** The worker is told to *trust the orchestrator's research*
and will not independently verify what you provide. If you hand it an unknown, it guesses or
halts. `../SKILL.md` → *Pre-flight → Close the unknowns* is the checklist; run it before you get
here. At dispatch time, state in the prompt every syntax, contract, and data fact the slice
depends on rather than instructing the worker to find it.

**Bound the slice.** Give explicit task numbers ("tasks 3–7", "the auth-middleware items"), never
"implement the plan." An unbounded slice makes the worker pick its own scope and defeats
orchestration.

**Own separation for parallel runs.** If you dispatch more than one worker at once, give each a
*disjoint* slice **and** an explicit may-touch / must-not-touch file list. Workers detect and
report visible overlap but will not carve up work for you — that is your responsibility. When two
workers edit a shared file, you create a merge collision.

**Resolve correctness-risk ambiguity first.** Settle anything touching externally visible
behavior, data models, security, migrations, or API contracts before dispatch. The worker halts
on these instead of guessing, so an unresolved issue returns as `blocking: true` and costs a round
trip. You may leave implementation-style ambiguity (naming, file placement, which local pattern)
to the worker; it follows and records the surrounding convention.

**State the verification bar.** Name the exact command the slice must pass ("must pass `uv run pytest tests/auth`", "`uv run mypy` clean"). The worker runs it and reports the outcome. Without a bar, it verifies loosely.

**Type the slice first.** The worker handles deterministic edits well. For slices that need shell
execution the worker cannot do — lockfile regen, codegen, migrations, dependency installs — run
that work in the main loop first or pre-approve the exact commands. Do not make an approval-gated
command the worker's core action. It has no human to approve it mid-task and will fail fast into a
handoff.

**Pre-declare dependencies.** Workers cannot add or upgrade deps. Add new dependencies to the
lock/config and install them *before* dispatch (this is the pre-flight gate in SKILL.md).

## After the worker returns

**Read `Concurrency notes` and `Handoff to orchestrator` first**, before reviewing code. The
handoff contains commands the worker was forbidden from running and progress you must record.
Concurrency notes flag pre-existing modified files and merge risks with parallel workers.

**Resolve every `blocking: true`** in `Tasks not completed` and `Questions for orchestrator` before
you re-dispatch work that depends on it. Non-blocking items are follow-ups; they do not gate the
next dispatch.

**Run the handed-off commands.** These are commands forbidden to the worker: dependency installs,
`terraform init`, git commits. Run them in the main loop.

**Spot-check the status.** A `complete` with a `Pre-existing failures` note is fine — the worker
correctly isolated a failure that predates its slice. A `complete` that glosses over a failure the
diff plausibly caused is not. Read the diff and confirm before you trust it.

**Then tick the tasks.** You are the single writer of the tracking artifact (`tasks.md`, a
checklist, plan-mode task list). The worker never touches it, which prevents parallel workers from
colliding on the tracking file. Record exactly the tasks the worker actually finished and verified.

**For an OpenSpec change, validate afterward.** `openspec validate "<name>" --strict --json`
catches spec/task drift that a code diff review would miss, so run it whenever the tracked task
list changes.

## Cross-reference

Plan-source resolution, plan externalization, the pre-flight gate, the drift check, and the
closing gate's entry condition and signal test are in `../SKILL.md`. This file owns the dispatch
briefing and the after-return loop for a single slice.
