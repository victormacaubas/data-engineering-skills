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
- Each commit made through the orchestrator can be queried for its verification.
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

The orchestrator finds the gate command in this order:

1. The command that the project `AGENTS.md` or `CLAUDE.md` names as the definition of done.
2. A `check` or `test` target in the `Makefile`.
3. The test suite and the configured linters and type checks.

When the orchestrator finds none, the build is unverified. The orchestrator runs the close checks itself. It already runs handed-off commands. A failure at close opens a new slice, and the round limit applies to it.

The close run occurs one time for each build, not for each slice.

### Decision 8: The stamp is a git trailer

Format: `Verified: <check>, <check>` or `Verified: none`. The trailer goes in the trailer block of the commit message.

A user can list it with `git log --format='%h %(trailers:key=Verified,valueonly)'`.

The value lists only the checks that passed at close on the committed tree. When the project has a `verify` skill and the skill ran, the value names it. The article names no format, so this format is a decision of this repository.

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
- [A reader trusts the stamp too much] → The stamp records which checks ran. It does not state that the change is correct. The orchestrate text says this in one sentence.
- [The close run is slow on a large repository] → It runs one time for each build.
- [The three variants drift again] → The `verification-infrastructure` change adds a validation command. This change includes a manual diff task.
- [A fixed seed hides a defect that a different seed finds] → The decision prefers a reproducible gate. A project can run a non-fixed profile outside the build loop.

## Migration Plan

1. Apply the skill edits, then the agent edits.
2. Agents install as symlinks, so an edit in the checkout applies to the next session.
3. Marketplace users get the skill change at their next plugin update.
4. Rollback: revert the commit. No data or configuration migrates.
