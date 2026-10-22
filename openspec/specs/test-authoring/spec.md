## Purpose

Separates test writing from implementation: a dedicated `test-author` agent writes tests from the scenarios it is given (for a change, its spec scenarios before any code exists), the `implementer` makes them pass without editing them, and `orchestrate` sequences the two and rules on disputes.

## Requirements

### Requirement: test-author agent definitions
The repository SHALL provide a `test-author` custom agent with same-name Claude Code, Codex, and Cursor CLI variants. The Claude Code variant SHALL pin model `claude-haiku-5-5[1m]` and effort `high`.

#### Scenario: Variants exist
- **WHEN** a user lists the repository's agents
- **THEN** `agents/claude/test-author.md`, `agents/codex/test-author.toml`, and `agents/cursor/test-author.md` exist, each with `name` set to `test-author`

#### Scenario: Claude model and effort
- **WHEN** a user reads the Claude Code variant's frontmatter
- **THEN** `model` is `claude-haiku-5-5[1m]` and `effort` is `high`

### Requirement: Tests are written from the scenarios in the brief
`test-author` SHALL take its scenarios and named seams from its brief and SHALL write tests for exactly those scenarios. An OpenSpec change's spec scenarios are one source; the brief MAY supply scenarios from any other source.

#### Scenario: Scenarios from an OpenSpec change
- **WHEN** the brief points `test-author` at a change's spec scenarios
- **THEN** it triages and writes tests for those scenarios and no others

#### Scenario: Scenarios from another source
- **WHEN** the brief supplies scenarios that do not come from an OpenSpec change
- **THEN** the same triage, seam, lean-suite, and expected-outcome rules apply, and no OpenSpec change is required

### Requirement: Every scenario is triaged
`test-author` SHALL sort every scenario it receives into exactly one of: testable through a public seam, verified by a command, manual, or blocked. It SHALL write tests only for testable scenarios and SHALL report the others with their category.

#### Scenario: Testable scenario
- **WHEN** a scenario's behavior can be exercised through a seam the brief or plan names
- **THEN** `test-author` writes a test for it

#### Scenario: Command-verified scenario
- **WHEN** a scenario is checked by a validation command such as a plugin validator, a schema check, or a catalog parity check
- **THEN** `test-author` writes no test for it and reports the command that verifies it

#### Scenario: Manual or documentation scenario
- **WHEN** a scenario can only be confirmed by reading documentation or by a person in a live session
- **THEN** `test-author` writes no test for it and reports it as manual

#### Scenario: Placeholder in an asserted value
- **WHEN** a scenario's test would assert on a name the brief or plan leaves as a placeholder, such as `/<command>`
- **THEN** `test-author` writes no test for it, reports it as blocked with the placeholder quoted, and does not guess a value

### Requirement: Tests target named public seams only
`test-author` SHALL exercise behavior only through public seams the brief or plan names (entry points, commands, hooks, tool names, identifiers, output formats) and SHALL NOT invent module, function, or class names that neither states.

#### Scenario: Seam named
- **WHEN** the brief or plan names the hook, command, or entry point a scenario goes through
- **THEN** the test drives that seam and asserts on observable output

#### Scenario: Seam not named
- **WHEN** neither the brief nor the plan names a seam through which a scenario can be exercised
- **THEN** `test-author` reports the scenario as blocked with the missing seam described, and writes no test that imports an invented name

### Requirement: Suite stays lean
`test-author` SHALL write one test per testable scenario, merging inputs of the same path into a single parameterized test, and SHALL NOT write tests that trace to no scenario, tests on internals, or fixtures used by only one test unless that fixture is test infrastructure. Fixtures SHALL build objects only through named public seams.

#### Scenario: Several inputs on one path
- **WHEN** a scenario lists several inputs that exercise the same behavior
- **THEN** they appear as cases of one parameterized test, not as separate tests

#### Scenario: Behavior with no scenario
- **WHEN** `test-author` notices behavior worth testing that no scenario covers
- **THEN** it writes no test for it and reports the gap as a suggested scenario

### Requirement: test-author owns the test tree
`test-author` SHALL be the only worker that creates or edits test files, `conftest.py`, fixtures, fakes, fixture data, and test-runner configuration. It SHALL NOT edit production code. Every variant SHALL state this in its instructions. On Claude Code, the optional `agent-write-guard` mod SHALL enforce the production-code boundary for `Edit`, `Write`, and `NotebookEdit` when installed.

#### Scenario: A test needs a new fixture
- **WHEN** a test needs shared setup
- **THEN** `test-author` adds it to the test tree

#### Scenario: A test would need production code changed
- **WHEN** a scenario cannot be tested without a change to production code, such as a missing injection point
- **THEN** `test-author` reports the needed change and does not make it

#### Scenario: Claude test-author edits production code with the mod installed
- **WHEN** the Claude Code `test-author` attempts to edit `src/service.py` and `agent-write-guard` is installed
- **THEN** the call is denied and the model sees a reason telling it to report the needed production change

### Requirement: New tests are checked against the expected outcome
The brief SHALL state the expected outcome of the new tests, `fail` or `pass`. `test-author` SHALL run every test it wrote, record the command and outcome, and list every test whose outcome differs from the expected one with what it observed. It SHALL NOT edit a test only to make its outcome match.

#### Scenario: Expected fail, all fail
- **WHEN** the brief expects `fail` and every new test fails or errors
- **THEN** the report records the command and outcome and lists no unexpected outcomes

#### Scenario: Expected fail, a test passes
- **WHEN** the brief expects `fail` and a new test passes
- **THEN** the report lists it as an unexpected outcome, so the orchestrator can decide whether it is vacuous or the behavior already exists

#### Scenario: Expected pass, a test fails
- **WHEN** the brief expects `pass` and a new test fails
- **THEN** the report lists it as an unexpected outcome with the observed failure, and the test is left as written

#### Scenario: No expected outcome in the brief
- **WHEN** the brief states no expected outcome
- **THEN** `test-author` runs the tests, reports their raw outcomes without classifying them, and flags the missing expectation

### Requirement: Task-to-test selector map
When the brief assigns scenarios to plan tasks, `test-author`'s report SHALL map each task to the exact command that runs only that task's tests. Task identifiers SHALL NOT appear in test code.

#### Scenario: Implementer verifies its slice
- **WHEN** the orchestrator dispatches an implementer for tasks 2.2 and 2.3
- **THEN** the brief carries the selector commands for those tasks from the `test-author` report
- **AND** the implementer's verification runs those selectors rather than the whole new suite

#### Scenario: Brief without tasks
- **WHEN** the brief assigns scenarios to no tasks
- **THEN** the report omits the map and gives one command that runs all the new tests

#### Scenario: No plan ids in tests
- **WHEN** a user reads a test `test-author` wrote
- **THEN** it names the behavior it asserts and contains no task number, decision id, or plan reference

### Requirement: Implementer does not write tests
The `implementer` SHALL NOT create or edit files in the test tree. Every variant SHALL state the rule in its instructions, and no variant SHALL carry a frontmatter hook for it. On Claude Code, the optional `agent-write-guard` mod SHALL enforce it for `Edit`, `Write`, and `NotebookEdit` when installed, denying the call with a reason directing the model to the dispute channel.

#### Scenario: Claude implementer writes a Python test file
- **WHEN** the Claude Code implementer attempts to write `tests/test_x.py` and `agent-write-guard` is installed
- **THEN** the call is denied and the model sees a reason naming `test-author` and the `Disputed tests` field

#### Scenario: Claude implementer writes a TypeScript test file
- **WHEN** the Claude Code implementer attempts to write `src/foo.test.ts` and `agent-write-guard` is installed
- **THEN** the call is denied with the same reason

#### Scenario: Claude implementer writes production code
- **WHEN** the Claude Code implementer writes a non-test file such as `src/foo.ts`
- **THEN** the call is not blocked

#### Scenario: Claude implementer frontmatter carries no hook
- **WHEN** a user reads `agents/claude/implementer.md`
- **THEN** its frontmatter has no `hooks` field

#### Scenario: Other sessions are unaffected
- **WHEN** the main session or any agent other than `implementer` and `test-author` writes a test file
- **THEN** no test-tree rule applies

#### Scenario: Mixed files
- **WHEN** a file holds both test and non-test content, such as a dbt `schema.yml` or the pytest section of `pyproject.toml`
- **THEN** the implementer leaves the test content alone by instruction, on every platform

### Requirement: Disputed tests channel
The `implementer` report and receipt SHALL include a `Disputed tests` field listing each test it believes is wrong, with the test's selector, the scenario it covers, and the reason. A task blocked only by a disputed test SHALL be reported as not completed with `blocking: true`.

#### Scenario: Implementer believes a test is wrong
- **WHEN** a test assigned to the implementer's slice fails and the implementer believes the test, not the code, is wrong
- **THEN** it leaves the test unchanged, lists it under `Disputed tests` with its reason, and does not weaken the code to fit

#### Scenario: Nothing disputed
- **WHEN** the implementer has no disputed tests
- **THEN** the field reads `_none_`

### Requirement: Orchestrate sequences test-author and implementers
For a change, the `orchestrate` skill SHALL check before dispatching `test-author` that every testable scenario has a named seam and that no value a test asserts on is a placeholder. It SHALL dispatch `test-author` for the whole change, with expected outcome `fail`, before any implementer. It SHALL pass each implementer the selectors for its tasks, and rule on every disputed test by sending it back to `test-author` or the code back to the implementer.

#### Scenario: Whole change in one pass
- **WHEN** the orchestrator builds a change with several tasks
- **THEN** `test-author` covers every testable scenario in the change before the first implementer dispatch, in one dispatch or one batch split by capability

#### Scenario: Plan task verification clauses
- **WHEN** a task in the plan carries a clause such as "Verify with a test that ..."
- **THEN** the orchestrator passes that clause to `test-author` as a scenario, not to the implementer as an instruction to write a test

#### Scenario: Expected outcome briefed
- **WHEN** the orchestrator dispatches `test-author` for a change
- **THEN** the brief states expected outcome `fail`

#### Scenario: Placeholder found in pre-flight
- **WHEN** the pre-flight finds a placeholder in a value a test would assert on
- **THEN** the orchestrator settles the value before dispatching `test-author`

#### Scenario: Implementer reports a disputed test
- **WHEN** an implementer receipt lists a disputed test
- **THEN** the orchestrator decides whether the test or the code is wrong, and dispatches `test-author` to fix the test or the implementer to fix the code

#### Scenario: Prerequisites documented
- **WHEN** a user reads the `flow` catalog descriptions, the `flow` README, or the dependency list in `AGENTS.md`
- **THEN** `test-author` is listed among the agents `/flow:orchestrate` requires
