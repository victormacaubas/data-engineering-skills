## MODIFIED Requirements

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
