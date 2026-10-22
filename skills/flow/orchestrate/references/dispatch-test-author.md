# Dispatching the test-author — briefing playbook

The `test-author` carries its own triage method, test rules, command allow/forbid lists, and output
template; don't restate them. It writes tests only, never production code.

## The dispatch contract

**The brief supplies the scenarios and the seams.** The worker reads what you point it at but has
no other source for seams or settled values, so anything pre-flight settled outside the plan goes
in the brief. Write it during *Write the tests first* in `../SKILL.md`.

```
Scenarios: <change dir and spec paths, or the list>                          always
Expected outcome: fail | pass                                                always
Report to: .orchestrate/<slug>/test-author[-<capability>].md                 always
Task map: <task id → scenarios, incl. quoted "Verify with a test" clauses>   when tasks exist
Seams / settled values: <ones pre-flight settled outside the plan>           when any exist
Capability scope + Must not touch: <other workers' test files>               split batches only
Not in the plan: <resolved facts>                                            when any exist
```

For an OpenSpec change whose design names its seams, the brief is the first three lines plus the
task map. For example:

```
Scenarios: openspec/changes/add-mods-group-snowflake-panel/specs/
Expected outcome: fail
Report to: .orchestrate/add-mods-group-snowflake-panel/test-author.md
Task map: 2.1 → <scenario names>; 2.2 → "Verify with a test that <behavior>"
```

## Filling the slots

**Expected outcome.** `fail` for a change not yet built, since no code exists. `pass` when the
behavior is already built and the tests pin it. Without one, the worker reports raw outcomes and
flags the gap, which leaves the classification to you.

**Task map.** Map each task id to the scenarios it covers, and quote any "Verify with a test that
..." clause verbatim as a scenario. The worker returns one selector command per task, which is what
the implementer briefs carry. Task ids stay out of the test code.

**Capability split.** For a large change, give each worker one capability, its own report name, and
the other workers' test files as `Must not touch`. Overlapping fixtures or `conftest.py` edits are a
merge collision, so split along files, not along scenarios within one file.

## After the worker returns

**Read the receipt, not the report.** It carries the status, the triage counts, the run command, and
the lists below. Open the report when the status is `partial` or `blocked`, or when the map of tasks
to selectors is needed: the receipt gives one run command, and the per-task `Task-to-selector map`
lives in the report.

- **Blocked scenarios** → settle the seam or value, record it (`../SKILL.md` → *Record what you
  settled*), and re-dispatch only those scenarios.
- **Unexpected outcomes** under `fail` (a test passes) → decide whether the test is vacuous
  (re-dispatch with the reason) or the behavior already exists (note it; no code task is needed).
  Under `pass`, a failing test is a finding about the code or the test; rule on it the same way.
- **Needed production changes** → into the plan source if they change intent, otherwise into the
  brief of the implementer that owns the code.
- **Files modified** outside the test tree → a boundary breach. Revert it or rule on it; the
  production-code boundary is held by the agent's prompt only.
- **Suggested scenarios** → offer them to the user. Adding a scenario changes intent, so it is
  theirs to accept.
- **Selector map** → copy each task's selectors into the brief of the implementer that owns it
  (`dispatch-implementer.md`).

Completing `test-author` ticks no tasks.

## Refusals

On Claude Code `test-author` runs on Haiku 5.5, whose safety classifiers can decline
security-adjacent work (auth, input validation tests) and return no receipt. Resending the same brief
usually draws the same refusal: split the flagged scenarios out or reword them, and surface it to
the user if it persists.

## Re-dispatch for disputes

When you rule that a disputed test is wrong (`../SKILL.md` → *Rule on disputed tests*), the brief
carries the `Disputed tests` entries, your ruling, and the expected outcome the corrected tests
should produce. Usually that is `pass`, because the implementer's code for the task already exists.
Then send the slice back to the implementer to re-run its selectors.
