# Design

## Context

See `proposal.md` for the motivation. This section gives the current state that shapes the approach.

- `skills/flow/orchestrate/SKILL.md:143` says "keep a disputed task open until its selector passes". The stop list at `:169` has no condition for repeated failure. The guardrail "Don't stop with owed work" pushes the loop to continue.
- The implementer brief in `references/dispatch-implementer.md` has no slot for an earlier report. The report path is fixed for each slice.
- `SKILL.md:56` permits a dispatch "without a test bar, where the worker verifies by inspection only".
- The Claude `implementer` has a real-check rule in its Verification step. The Codex and Cursor variants do not.
- `agents/claude/test-author.md:69` forbids an expected value "computed the way the production code computes it". Line `:72` requires deterministic tests.
- The `agent-write-guard` mod guards the test tree only. It does not examine `Bash`, and `pyproject.toml` holds dependencies and gate configuration together.
- Effort values are not in scope. `openspec/specs/test-authoring/spec.md`, the agent file, and `agents/README.md` all give effort `high` for the Claude `test-author`.

Constraints from `AGENTS.md`:

- A significant change to a skill uses `skill-creator` and plan mode. An edit to an existing `SKILL.md` needs the user's confirmation.
- Each agent has three variants with the same role. The writer reads the prompting guide of the exact model that runs each variant.
- A skill body states the instruction and the trap. It contains no commentary about the skill.

## Goals / Non-Goals

**Goals:**

- A failing check cannot hold the loop open without limit.
- A person who receives a stopped slice can decide without the diff.
- In a project that enables the trailers, each commit made through the orchestrator can be queried for its verification.
- The close run does not run a command that the project did not declare, unless the user approves it.
- The three variants of each agent state the same verification rules.

**Non-Goals:**

- No commit gate that blocks a commit. The article describes one, but Claude Code documents no mechanism for it.
- No end-to-end test with a browser or a simulator. The projects that use these agents are services, pipelines, and command-line tools.
- No change to the red-first gate, the authorship split, or the dispute channel. These already go further than the article.
- No change to the effort of the `test-author` agent.
- No new dependency in a project that uses the agents.

## Decisions

### Decision 1: The limit has two levels

The orchestrator counts dispatch rounds for each slice. Each worker counts its attempts on the same failing check. Each limit is three.

The orchestrator cannot see inside one worker run. A worker cannot see across dispatches. One level alone leaves the other loop open.

Alternative: a limit in the orchestrator only. A worker could then repeat a fix many times in one run.

Alternative: one total limit of three attempts across the two levels. This needs the worker to know the round number and makes the count hard to audit.

### Decision 2: The definition of a round

A round is one worker dispatch for a slice that returns while a required check of the slice still fails. A dispatch that follows a ruling on a disputed test counts for the slice that the test blocks. A dispatch that stops on a permission denial or a broken environment is not a round. The existing denial limits apply to it.

The orchestrator writes the count beside the task in the tracking artifact. The tracking artifact stays single-writer.

The figure three comes from the article. The Anthropic code review article uses the same figure for review rounds.

### Decision 3: The limit is a stated blocker

A slice at the limit gets a blocker in its tracking entry. The rule "open tasks in scope with no stated blocker mean the turn isn't over" stays true without a new exception. The stop list at `SKILL.md:169` gets the limit as one more condition. The sentence at `:143` changes to "until its selector passes or the slice reaches the round limit".

The user can restart a stopped slice. The count then starts at zero.

### Decision 4: The hand-back has five fixed items

The items are: the failing command, the last failing output, the change that each round made, the reason that the workers cannot resolve it, and the decision that the user must make. The earlier reports supply the first three items.

Alternative: free text. The person must then read the diff to find the reason.

### Decision 5: One report file for each round

The first round keeps the current report name. Each later round adds a suffix: `-r2`, `-r3`. The brief for a later round names the earlier files and contains the failing output.

`scripts/cleanup.sh` removes the full `.orchestrate/<slug>/` directory, so the added files need no cleanup change.

### Decision 6: Unverified is a recorded state

The option at `SKILL.md:56` stays. Some repositories have no environment in which a test can run. The orchestrator records the slice as `unverified`, and the closing summary lists it.

Alternative: forbid a dispatch without a test bar. This stops work that the user has accepted. The article records "none" for the same reason.

### Decision 7: The close run

The orchestrator runs only a gate that it has authority to run. There are two cases.

A declared gate is the command, or the list of commands, that the project `AGENTS.md` or `CLAUDE.md` names as the definition of done or as the checks to run before a commit or a push. The orchestrator runs a declared gate with no question. It does not run a command that the project instructions reserve for the user, such as a command that needs credentials.

When the project declares no gate, the orchestrator looks for a found gate, in this order:

1. A `check` or `test` target in the `Makefile`.
2. The test suite and the configured linters and type checks.

It does not run a found gate without approval. It asks the user one time for each build. The question names each command and says that a declaration in the project instructions removes the question. On approval, the orchestrator runs the found gate. Without approval, the build has no gate.

A command that the orchestrator finds can have an effect that its name does not show. A `test` target can start containers and drop a database, and a test suite can connect to a real service. The project instructions are the statement of the project owner that a command is safe to run.

Alternative: run a found gate with no question. This design had that order before. An examination of nine repositories on 2026-11-20 found a `test` target that builds a container stack and replaces a database, and a test suite that drops the tables of the default database when it runs outside its container.

Alternative: never run a found gate. A project with a test suite and no instruction file would then always close as unverified.

The orchestrator runs the close checks itself. It already runs handed-off commands. A failure at close opens a new slice, and the round limit applies to it.

After the gate and the command-verified scenarios pass, the orchestrator looks for a project `verify` skill: the file `.claude/skills/verify/SKILL.md`, or a verify skill path that the project `AGENTS.md` or `CLAUDE.md` names. When the file exists, the orchestrator follows its steps one time and records the command and the evidence that the skill says to capture. The low-cost checks run first, so the verify flow does not run while the gate fails.

A verify flow that does not satisfy its pass condition is a failure at close. A verify flow that cannot start for a reason outside the change is recorded as `not run` with the reason. It is not a pass and not a failure.

When no gate ran and the project has no verify skill, the build is unverified.

The condition is the file, not the `verification-infrastructure` change. A project can have a `verify` skill from any source.

The close run occurs one time for each build, not for each slice.

Alternative: the `implementer` runs the verify flow for each slice. The program frequently does not run until the last slice, and a slow check for each slice is run less.

Alternative: rely on the Claude Code behavior that runs a project `verify` skill before a commit. The orchestrator commits only on request, so a build that closes with no commit gets no verify run. Codex and Cursor do not have this behavior, and a failure at commit time has no slice and no round count.

### Decision 8: The stamp is an opt-in git trailer

The orchestrator adds the verification trailers only when one of two conditions is true:

- The project `AGENTS.md` or `CLAUDE.md` says that commits carry the `Verified:` trailer.
- The user asks for the trailers. A request with the commit request counts, and a standing instruction of the user counts.

In all other cases, the commit has no verification trailer. The closing summary states the verification result in each case, so the user has the information without the trailer.

The project line has one location: the definition of done in the project instructions, adjacent to the declared gate. The close run reads that section for the gate, so the orchestrator reads the gate and the trailer decision in one step. The section can also say that commits carry no verification trailer. That statement turns the trailers off for the project.

The closing summary of each build has one line with the state of the trailers and the reason: the project instructions enable them, the user asked for them, the project instructions turn them off, or no source names them. A missing line in the project instructions is then visible at each build, and the user does not assume a trailer that is not there.

No skill in this change writes the project line. The `verification-infrastructure` change makes `craft:architecture-baseline` write it for a new project. For an existing project, a person adds it.

A trailer is in the history that a team reads. `Verified: none` on a commit in a shared repository records something that the team did not agree to record. The project makes this decision, not the skill.

Format: `Verified: <check>, <check>` or `Verified: none`. The trailer goes in the trailer block of the commit message.

The value lists only the checks that passed at close on the committed tree. It names `verify` when the verify flow of Decision 7 ran and passed in that close run. A verify flow that was recorded as `not run` is not in the value. The article names no format, so this format is a decision of this repository.

When one or more slices of the build are recorded as `unverified`, the commit also gets `Unverified: <slice>, <slice>`. The gate can pass while no check exercises a slice. With `Verified:` alone, the commit then states a verification that the slice did not have.

A user can list the two with `git log --format='%h %(trailers:key=Verified,valueonly) %(trailers:key=Unverified,valueonly)'`.

Alternative: the trailers on each commit, with no opt-in. A commit in a shared repository then gets a line that the team did not select.

Alternative: no `Verified:` trailer when a slice is unverified. The commit then does not show the checks that did pass.

Alternative: git notes. Notes are not pushed by default.

Alternative: a sentence in the commit body. A tool cannot query it reliably.

### Decision 9: The Claude text is the source for the port

The real-check sentences in `agents/claude/implementer.md` step 5 are copied to the Codex and Cursor variants. Only command names change. The writer reads the prompting guide for each model before the port.

### Decision 10: Gate configuration is protected by instruction and by a diff check

A path rule cannot protect `pyproject.toml`, because the file also holds dependencies. The `implementer` gets an instruction and a report field. The orchestrator runs `git diff --name-only` for the slice and compares the result with the gate-configuration paths:

- the tool sections of `pyproject.toml` for the linter, the type checker, and the import contracts
- `ruff.toml`, `mypy.ini`, `.importlinter`, `.pre-commit-config.yaml`
- the gate target of the `Makefile`
- CI workflow files

For a mixed file, the orchestrator reads the changed hunks. It rules on an unrequested change as it rules on a disputed test: accept and record, or revert through the `implementer`.

The pytest section stays with `test-author`, as the `test-authoring` spec states.

The `verification-infrastructure` change adds an optional mod rule for the dedicated files. This change does not need it.

### Decision 11: Property-based tests

The trigger is a scenario that states a law in words. The four kinds are round-trip, invariant, idempotency, and equivalence. `test-author` does not infer a law that no scenario states. It reports the law as a suggested scenario, as the "Suite stays lean" requirement already directs.

The library must be in the project dependencies already: Hypothesis for Python, fast-check for JavaScript and TypeScript, proptest for Rust. `test-author` owns the test tree, not the dependency set.

The test uses the fixed-seed or derandomized setting of the library. The rule "Make tests deterministic" stays true, and the red-first gate stays reproducible.

Alternative: a new seed on each run. This finds more defects over time, but a selector can then pass in one round and fail in the next with no code change. That result is a flaky test by the definition in Decision 13.

One scenario gives one property-based test.

### Decision 12: Differential tests and the oracle

The anti-tautology rule at `test-author.md:69` gets one named exception. An expected value can come from a different implementation that the brief names. It cannot come from the code under test.

The brief gets four slots for a differential scenario: the oracle seam, the input source, the normalization, and the approved differences. The input source is a fixture file, a generator, or the path of a sample extract. Approved differences are a data file in the test tree. Each entry has a reason. The test ignores those entries only.

The brief states the expected outcome as it does today: `fail` when the new implementation does not exist, `pass` for a refactor.

When the brief names no oracle, the scenario is `blocked`. This agrees with the rule against invented names.

### Decision 13: Flaky tests

A test is flaky when identical runs with no code change give different results. The `implementer` can run a failed test one more time to confirm this. That run detects the condition. It is not a retry until the test passes.

The `implementer` lists the test under `Disputed tests` with the reason `flaky` and the two outputs. The orchestrator sends it to `test-author`. `test-author` fixes the cause, or deletes the test and reports the reason. The orchestrator records the scenario as not covered. A deleted test is not a pass.

### Decision 14: The review limit

The orchestrator counts `request_changes` verdicts for the same change. The third verdict stops the loop. The hand-back uses the five items from Decision 4, with the open fix-list items as the failing output.

### Decision 15: Authoring process

- `flow:orchestrate` loads in the main session. The edit uses `skill-creator` and plan mode, and the user confirms the planned text before the write.
- Models to read guides for: `claude-sonnet-5-5` (Claude `implementer`), `claude-haiku-5-5` (Claude and Cursor `test-author`), `gpt-5.6-terra` (Codex `implementer`), `gpt-5.6-luna` (Codex `test-author`), `kimi-k3` (Cursor `implementer`).
- New text goes into the existing sections. No section is added that describes the agent or the skill.

## Risks / Trade-offs

- [The limit stops a slice that a fourth round can fix] → The user can restart the slice. The hand-back contains what the user needs to decide.
- [A small model writes weak properties] → The trigger is a law that the scenario states. A live check in the tasks runs the Claude `test-author` on a round-trip scenario.
- [The agent prompts grow in six files] → New text goes into existing sections. A diff of the changed sections across variants is a task.
- [A reader trusts the stamp too much] → The stamp records which checks ran. It does not state that the change is correct. The orchestrate text says this in one sentence. The `Unverified:` trailer names the slices that no check exercised.
- [A project with no declared gate gets a question at each close] → The question says that one line in the project instructions removes it.
- [A worker runs the test suite by its own verification rule before the close run] → Not solved in this change. The approval rule applies to the close run of the orchestrator. A project with a suite that is not safe to run must say so in its instructions.
- [The close run is slow on a large repository] → It runs one time for each build.
- [The verify flow is slow or needs a local service] → It runs one time for each build, after the gate passes. A flow that cannot start is recorded as `not run` with the reason.
- [The three variants drift again] → The `verification-infrastructure` change adds a validation command. This change includes a manual diff task.
- [A fixed seed hides a defect that a different seed finds] → The decision prefers a reproducible gate. A project can run a non-fixed profile outside the build loop.

## Migration Plan

1. Apply the skill edits, then the agent edits.
2. Agents install as symlinks, so an edit in the checkout applies to the next session.
3. Marketplace users get the skill change at their next plugin update.
4. Rollback: revert the commit. No data or configuration migrates.
