# Proposal

## Why

The two standards skills do not give a reliable method to verify a change against known-good behavior. `data:sql-data-analysis` tells the writer to check a rewrite with "a row-count or `except` comparison", but `except` removes duplicate rows, so a rewrite that changes row multiplicity can pass. `craft:python-engineering-standards` has a hand-written list of edge cases and no rule for property-based tests or for flaky tests. It also tells the writer to "leave slow checks (mypy, the full test suite) to CI", and its pytest example calls the `integration` marker "excluded from default runs" but does not deselect it.

The Anthropic article "How the Claude Code team thinks about verification" (2026-11-16) recommends differential tests for rewrites, property-based tests for edge cases, a strict rule for flaky tests, and a local run of the tests, the build, and the linter before a pull request. A SQL rewrite and a model migration are the most frequent places where these apply in data engineering work.

## What Changes

- Replace the rewrite check in `data:sql-data-analysis` with a comparison that works in both directions and counts duplicate rows.
- Add normalization rules and a list of intended differences to that comparison.
- Add a run-twice check for incremental and merge logic.
- Make the response state what the comparison returned, or state that it did not run.
- Make the skill name the invariants that are candidate tests for a dbt model. The rule that the skill adds no test without a request stays.
- Add a property-based test rule to the Testing section of `craft:python-engineering-standards`.
- Add a flaky-test rule to the same section: no skip, no sleep, no retry until the test passes.
- Replace "leave slow checks to CI" in the Python standard with three tiers: fast checks on each commit, the full gate on the local machine before a push or a pull request, and the same gate in CI.
- Make the pytest example of the Python standard deselect the `integration` marker in the default run.

No change is **BREAKING**.

## Capabilities

### New Capabilities

- `sql-rewrite-validation`: how the SQL standard verifies that a rewrite, an optimization, or a migrated model returns the correct rows.
- `python-testing-standards`: the test rules of the Python standard for property-based tests, flaky tests, the test lanes of the default run, and the point at which each check runs.

### Modified Capabilities

None.

## Impact

- Edited skill files: `skills/data/sql-data-analysis/SKILL.md` (Query Contract, Correctness Rules, Check The Plan Before Presenting, Response Pattern), `skills/data/sql-data-analysis/references/expensive-patterns.md` (opening paragraph and the `except` entry in the smaller traps).
- New reference file: `skills/data/sql-data-analysis/references/rewrite-comparison.md`.
- Edited skill files: `skills/craft/python-engineering-standards/SKILL.md` (Testing), `references/tooling.md` (pytest configuration example and the pre-commit section), `references/concurrency.md` (the stress-test sentence).
- New living specs at archive: `openspec/specs/sql-rewrite-validation/spec.md`, `openspec/specs/python-testing-standards/spec.md`.
- No change to catalogs: no skill is added, renamed, or moved.
- No change to agents. The Claude `implementer` preloads the Python standard, so its behavior follows the new rules.
- Related change: `build-loop-verification` gives the `test-author` agent the same property-test and flaky-test rules. Each file states its rules in full, because a skill does not point at an agent or at a different skill.
- Related change: `verification-infrastructure` puts the same three tiers and the same marker correction in `craft:architecture-baseline`.
