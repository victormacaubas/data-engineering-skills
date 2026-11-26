# Design

## Context

See `proposal.md` for the motivation. This section gives the current state that shapes the approach.

SQL standard (`skills/data/sql-data-analysis/`):

- `references/expensive-patterns.md:3` says "check the rewrite returns the same rows before you swap it in: run a row-count or `except` comparison when you can query the warehouse". The same file says that `except` "deduplicates the result".
- `SKILL.md:96` gives a cardinality check and says "explain proves the query parses, not that its grain is right".
- `SKILL.md:25` describes incremental models as "reruns that produce the same result" and gives no check.
- `SKILL.md:50` says "Don't add models, tests, or `schema.yml` docs it didn't ask for; mention the ones that would help".
- `SKILL.md:213` says "run the validation queries when you can query the warehouse and report what they returned".

Python standard (`skills/craft/python-engineering-standards/`):

- `SKILL.md:432-435` covers fixtures, fakes, the `integration` marker, and a hand-written list of edge cases.
- `SKILL.md:298` covers retries in production code.
- `references/concurrency.md:323` recommends "a stress test with hundreds of threads".
- The skill has no text on property-based tests or flaky tests.
- `references/tooling.md:122` says "Run fast checks on every commit; leave slow checks (mypy, the full test suite) to CI". The hook example has ruff and detect-secrets only.
- The pytest example in `references/tooling.md` has `addopts = "-ra --strict-markers"` and describes the `integration` marker as "excluded from default runs". pytest does not deselect a marker unless the command or `addopts` has a marker expression, so the default run selects the integration tests.

Constraints from `AGENTS.md`:

- A skill and its `references/` contain all that is necessary to follow it.
- A skill body states the instruction and the trap that it prevents. It contains no commentary about the skill.
- A significant change to a skill uses `skill-creator` and plan mode. An edit to an existing `SKILL.md` needs the user's confirmation.

## Goals / Non-Goals

**Goals:**

- A rewrite that changes duplicate counts cannot pass the comparison.
- A reader of a response knows if the comparison ran and what it returned.
- The Python standard gives one clear rule for a flaky test.
- CI is not the first place where the type check and the test suite run.
- The default test run selects only the tests that need no credentials.

**Non-Goals:**

- No automatic generation of dbt tests.
- No test suite in the commit hook. The commit hook stays fast.
- No hook or setting that is specific to one coding tool, such as a Claude Code Stop hook. The standard applies to any tool.
- No change to `skills/in-progress/python-data-analysis`.
- No end-to-end test guidance. The architecture baseline owns the test lanes of a project.
- No statement that a specific SQL function is available in a specific warehouse without a check of the vendor documentation.

## Decisions

### Decision 1: The rule is in SKILL.md and the query is in a reference file

`SKILL.md` gets a short rule in *Check The Plan Before Presenting*: compare a rewrite in both directions with duplicate counts, state the normalization, list intended differences, report the result. The query pattern goes in a new file, `references/rewrite-comparison.md`.

The opening paragraph of `expensive-patterns.md` and its `except` entry change to point at the new reference file. They are in the same skill, so the skill stays self-contained.

Alternative: put the query in `SKILL.md`. The file is the part that always loads, and the pattern is necessary only for a rewrite.

### Decision 2: The comparison pattern

The default pattern is a signed union with a group:

```sql
select <columns>, sum(side) as net_count
from (
  select <columns>, 1 as side from original
  union all
  select <columns>, -1 as side from rewrite
) as both_sides
group by <columns>
having sum(side) <> 0
```

A positive `net_count` is a row that the original has more times. A negative value is a row that the rewrite has more times. The reference file replaces `net_count` with two per-side counts, `original_count` and `rewrite_count`, so that the report can give the three counts separately.

Reasons:

- It counts duplicates. A row that occurs two times on one side and one time on the other side is in the result.
- `group by` puts null values in one group, so no null-safe join is necessary.
- It uses only standard SQL.

Alternative: `except` in the two directions. It removes duplicates.

Alternative: `except all`. It is correct, but not every dialect has it. The reference file names it as an option where the active dialect documents it.

Alternative: a full outer join on all columns. It needs a null-safe comparison for each column, and the syntax differs by dialect.

### Decision 3: A low-cost check comes first on a large relation

Row counts on the two sides are the first check. Where the dialect has an order-independent aggregate hash, the reference file names it as the second check. The row-level comparison runs when a low-cost check shows a difference, or when the user asks for it.

A count or a hash that is equal is evidence, not proof. The response says which check ran.

### Decision 4: Normalization

The reference file lists the permitted normalizations:

- Row order needs no normalization. The pattern does not depend on it.
- Round floating-point values to a stated precision.
- Exclude a column that is different on each run, such as a load timestamp or a generated key. Name the column and the reason.
- Trim or change case only when the request says that the difference does not matter.

Each normalization goes in the response. A normalization that is not stated can hide a defect.

### Decision 5: Intended differences

The response lists each intended difference as a predicate or as a short description with a count. The comparison adds a filter that excludes those rows only. The remaining result must be empty. A row that remains is a defect.

This is the "approved changes" list of the article in a form that fits a query.

### Decision 6: The idempotency check

For incremental and merge logic, the check is:

1. Run the load on a fixed input in a development schema.
2. Copy the target table.
3. Run the load again on the same input.
4. Compare the copy with the target table with the pattern from Decision 2.

The check needs write access to a development schema. When the skill has no such access, the response gives the steps and says that the check did not run.

### Decision 7: The response states the result

*Response Pattern* gets one item: for a rewrite, state the three counts, the input that was compared, the normalization, and the intended differences. When the comparison did not run, give the query and say so. The word "verified" is not used for a comparison that did not run.

### Decision 8: dbt invariants are named, not added

`SKILL.md:50` stays. The phrase "mention the ones that would help" gets a specific form: name the invariants of the model. Examples are the unique grain, the keys that are not null, an accepted range, and row-count parity with the source. The skill writes the tests when the request asks for them.

### Decision 9: The property-based test rule in the Python standard

The rule goes in *Testing*, adjacent to the edge-case list. It names the four kinds of law with one short example each. The edge-case list stays, because a named edge case documents intent and a generated input does not.

The library for Python is Hypothesis. When the project does not declare it, the writer recommends it. A new dependency is a decision of the project, and the architecture baseline treats it as an ADR.

### Decision 10: Repeatable runs

The default profile uses the derandomized setting of Hypothesis, so each default run generates the same inputs. `references/tooling.md` gets a short configuration example. A second profile with new inputs can run outside the gate.

The implementer checks the exact setting names in the Hypothesis documentation before the write.

Alternative: new inputs on each run in the gate. A test can then fail with no code change, which is a flaky test by the rule in Decision 11.

### Decision 11: The flaky-test rule

*Testing* gets one rule: no skip marker, no expected-failure marker, no sleep, and no rerun plugin as a method to make a test pass. Find the cause. When the cause cannot be found, delete the test and record the reason and the behavior that has no test.

The retry rules at `SKILL.md:298` are for production code and do not change. The rule says this in one clause, so a reader does not apply it to production retries.

The stress-test sentence in `references/concurrency.md` gets a marker requirement. A stress test depends on timing, so it does not run in the default test command.

### Decision 12: Authoring process

- What loads each skill: the SQL standard loads in the main session. The Python standard loads in the main session and in the `implementer` (`claude-sonnet-5-5` preload on Claude, by name on Codex `gpt-5.6-terra` and Cursor `kimi-k3`). The implementer confirms this with a search of `agents/` before the write.
- Each skill edit uses `skill-creator` and plan mode. The user confirms the planned text before the write.
- The `test-author` agent gets equivalent rules in `build-loop-verification`. Each file states its rules in full.

### Decision 13: Three tiers of checks

The sentence at `references/tooling.md:122` is replaced with three tiers:

1. On each commit: the fast hooks that the example has now (ruff, ruff-format, detect-secrets).
2. Before a push or a pull request: the full gate on the local machine. The gate is the one gate command of the project. When the project has no gate command, it is the type check and the default test command.
3. In CI: the same gate, as the check that a contributor cannot skip.

The hook example gets one local hook at the pre-push stage that runs the gate. The install instruction is updated so that the pre-push hook is installed. The stage is `pre-push`. The local hooks use `language: unsupported`, the name pre-commit 4.4 gives to `system`. `default_install_hook_types: [pre-commit, pre-push]` makes a plain `pre-commit install` install the push hook, and `default_stages: [pre-commit]` keeps the fast hooks off the push.

The article says that an agent that pushes before it tests locally "has spent shared review and CI time when it could have caught the bug itself". The middle tier is the part that the current text does not have.

Alternative: put the type check and the suite in the commit hook. A slow commit hook is bypassed, and a slow check is run less frequently.

Alternative: a hook of one coding tool that runs the tests when the agent stops. It covers only sessions of that tool. The standard applies to Python work in any tool.

When the default suite is too slow to run before a push, the standard directs the writer to move slow tests to a marked lane. It does not direct the writer to remove the tier.

The sentence at `SKILL.md:136` about mypy on changed code stays. It is the check during the work. The gate before a push is the check of the full change.

### Decision 14: The default run deselects the marked lanes

The pytest example changes to `addopts = "-ra --strict-markers -m 'not integration and not stress'"`. The explicit lane is `pytest -m integration`. A marker expression on the command line replaces the expression from `addopts`. The implementer confirms this in a scratch project before the write.

The marker for timing-dependent tests from Decision 11 is `stress`. It goes into the same expression, `-m 'not integration and not stress'`, so the default run deselects the two lanes. A scratch project on pytest 9.2.0 confirmed that `-m integration` on the command line replaces the expression from `addopts`.

The description of the marker and the configuration then agree. Today the text says "excluded from default runs", and the configuration does not exclude.

Alternative: change only the description. The gate would then need credentials, or would fail on a machine that has none. A gate that fails for a reason outside the change teaches the writer to ignore it.

## Risks / Trade-offs

- [The row-level comparison is expensive on a large table] → Decision 3 puts a low-cost check first and permits a stated sample.
- [An equal count or hash is read as proof] → The response names the check that ran. The reference file says that an equal fingerprint is evidence only.
- [A writer adds property-based tests where no law exists] → The rule applies only to the four kinds of law.
- [The derandomized profile finds fewer defects] → The second profile is available outside the gate.
- [The skill names a dialect feature that does not exist] → The reference file gives the standard pattern as the default. Each dialect option is checked against vendor documentation in the tasks.
- [SKILL.md grows] → The query pattern is in a reference file. The Python rule is a small number of lines in an existing section.
- [A contributor bypasses a slow pre-push gate] → The default run deselects the slow lanes. CI runs the same gate.
- [A project that depends on the current default run stops running its integration tests] → The change is in the example of the standard, not in an existing project. The standard names the explicit command for the integration lane.
- [The marker expression on the command line does not replace the one in `addopts`] → A task confirms the behavior in a scratch project before the write.

## Migration Plan

1. Apply the SQL skill edits and add the reference file.
2. Apply the Python skill edits.
3. Marketplace users get the changes at their next plugin update.
4. Rollback: revert the commit.
