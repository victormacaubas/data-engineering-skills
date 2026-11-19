# Tasks

## 1. Preparation

- [ ] 1.1 Search `agents/` for each agent that loads `sql-data-analysis` or `python-engineering-standards`, read the current prompting guide for each model that loads them, and list the points that apply; verify that the list is in the session before any file is written
- [ ] 1.2 Load `skill-creator`, enter plan mode, and show the user the planned text for the SQL skill files; verify by the user's approval in the session
- [ ] 1.3 In the same plan, show the user the planned text for the Python skill files; verify by the user's approval in the session

## 2. SQL standard: rewrite comparison

- [ ] 2.1 Read the vendor documentation for `except all` and for an order-independent aggregate hash in Snowflake, BigQuery, Redshift, Postgres, DuckDB, Trino, and Spark SQL; verify that each dialect option that the reference file will name has a documentation link in the session
- [ ] 2.2 Write `skills/data/sql-data-analysis/references/rewrite-comparison.md` with the signed-union pattern from design Decision 2, the low-cost checks from Decision 3, the normalizations from Decision 4, the intended-difference filter from Decision 5, and the idempotency steps from Decision 6; verify by running the pattern in DuckDB on two small relations that differ by one dropped row, one added row, one duplicate count, and one row with a null value, with the three differences in the result and the null row absent
- [ ] 2.3 In `SKILL.md` *Check The Plan Before Presenting*, add the short rule from design Decision 1 with a pointer to the reference file; verify that the rule names both directions, duplicate counts, normalization, intended differences, and the report
- [ ] 2.4 In `references/expensive-patterns.md`, replace the "row-count or `except` comparison" sentence and update the `except` entry in the smaller traps; verify by `grep -n "except" skills/data/sql-data-analysis/references/expensive-patterns.md` that no sentence gives a set difference as a sufficient check
- [ ] 2.5 In `SKILL.md`, add the idempotency check to the incremental guidance; verify that the text says what to report when no development schema is available
- [ ] 2.6 In `SKILL.md` *Response Pattern*, add the result item from design Decision 7; verify that the item names the three counts, the compared input, and the "did not run" case
- [ ] 2.7 In `SKILL.md` *Output Standard*, make "mention the ones that would help" specific with the invariants from design Decision 8; verify that the rule against tests without a request is unchanged
- [ ] 2.8 Read `skills/data/README.md` and both catalog descriptions for `data`; update them only if a statement about the skill is now wrong; verify that both catalogs parse as JSON and are in parity

## 3. Python standard: property-based tests and flaky tests

- [ ] 3.1 Read the Hypothesis documentation for settings profiles and the derandomized setting; verify that the setting names for the configuration example have a documentation link in the session
- [ ] 3.2 In `SKILL.md` *Testing*, add the property-based test rule from design Decision 9 adjacent to the edge-case list; verify that the four kinds of law are named and that the edge-case list is unchanged
- [ ] 3.3 In `SKILL.md` *Testing*, add the rule for a project that does not declare the library; verify that the rule says "recommend" and does not direct a new dependency
- [ ] 3.4 In `references/tooling.md`, add the profile configuration from design Decision 10 to the pytest example; verify by running a sample property-based test two times with that configuration in a scratch project, with the same generated inputs in the two runs
- [ ] 3.5 In `SKILL.md` *Testing*, add the flaky-test rule from design Decision 11 with the clause about production retries; verify that the retry section for production code is unchanged
- [ ] 3.6 In `references/concurrency.md`, add the marker requirement to the stress-test sentence; verify that the sentence says that the default test command does not select the test
- [ ] 3.7 Read the pre-commit documentation for hook stages and for the installation of a pre-push hook; verify that the stage name and the install option for the hook example have a documentation link in the session
- [ ] 3.8 In the pytest example of `references/tooling.md`, add the marker expression from design Decision 14 for the `integration` lane and the timing-dependent lane, and give the explicit command for the integration lane; verify in a scratch project that the default test command selects neither lane and that the command with the `integration` marker selects the integration test
- [ ] 3.9 In the *pre-commit* section of `references/tooling.md`, replace the sentence that leaves slow checks to CI with the three tiers from design Decision 13, and add the pre-push hook and the install instruction to the example; verify in a scratch repository that a commit runs only the fast hooks and that a push runs the gate before it completes, and by `grep -n "to CI" skills/craft/python-engineering-standards/references/tooling.md` that no sentence leaves the type check or the suite to CI
- [ ] 3.10 Read *Testing* and the mypy sentence in `SKILL.md` against the three tiers and the default-run lanes; update a sentence only if it conflicts; verify that no sentence in the skill calls a marker excluded from the default run while the configuration selects it
- [ ] 3.11 Read `skills/craft/README.md` and both catalog descriptions for `craft`; update them only if a statement about the skill is now wrong; verify that both catalogs parse as JSON and are in parity

## 4. Live checks

- [ ] 4.1 In a new session with the SQL skill loaded, ask for an optimization of a query whose obvious rewrite changes a duplicate count; verify that the response gives the signed-union comparison and does not describe the rewrite as verified without a result
- [ ] 4.2 In the same session, ask for a rewrite that must remove a join fan-out; verify that the response lists the removed duplicates as intended and filters only those
- [ ] 4.3 In a new session with the Python skill loaded, ask for a serializer and a parser in a project that declares Hypothesis, then in a project that does not; verify a round-trip property-based test in the first case, and a recommendation with example-based tests in the second
- [ ] 4.4 In a session with the Python skill loaded, ask for a fix to a test that fails one time in ten; verify that the response looks for the cause and adds no rerun, sleep, or skip
- [ ] 4.5 In a session with the Python skill loaded, ask for the hook and pytest configuration of a new project; verify that the response gives fast hooks on commit, the gate before a push, the same gate in CI, and a default run that deselects the `integration` marker
- [ ] 4.6 Run `openspec validate standards-verification-rules --strict`; verify that it reports no error

## Workflow follow-up

- Examine `design.md` for decisions that bind future changes and promote them to `docs/adr/` before the archive. `docs/adr/` does not exist, so ask the user first.
- Archive the change with `/opsx:archive`.
- Copy the archived change to the vault inbox as `openspec-standards-verification-rules-data-engineering-skills/` and tell the user to run `/process-inbox`.
