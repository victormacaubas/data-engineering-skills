## Purpose

An optional Claude Code mod that holds the hard write boundaries between the `implementer` and `test-author` agents: it denies each one's file edits on the other's side of the test tree, and leaves every other agent and the main session alone.

## ADDED Requirements

### Requirement: Test tree definition
The mod SHALL treat a path as in the test tree when, relative to the session's working directory, it matches any of `**/tests/**`, `**/__tests__/**`, `**/conftest.py`, `**/test_*.py`, `**/*_test.py`, `**/*.test.ts`, `**/*.spec.ts`. A path outside the session's working directory SHALL NOT be guarded by either rule.

#### Scenario: Nested test directory
- **WHEN** a guarded agent's call targets `pkg/sub/tests/data/fixture.json`
- **THEN** the mod treats it as in the test tree

#### Scenario: Test file beside production code
- **WHEN** a guarded agent's call targets `src/foo.test.ts`
- **THEN** the mod treats it as in the test tree

#### Scenario: Path outside the working directory
- **WHEN** a guarded agent's call targets a file under `/tmp`
- **THEN** neither rule applies and the call proceeds

### Requirement: implementer cannot edit the test tree
While installed, the mod SHALL deny every `Edit`, `Write`, and `NotebookEdit` call made from an `implementer` subagent whose target path is in the test tree. The deny reason SHALL name `test-author` and the `Disputed tests` field.

#### Scenario: implementer writes a Python test
- **WHEN** an `implementer` subagent calls `Write` on `tests/test_x.py`
- **THEN** the call is denied and the model sees a reason naming `test-author` and `Disputed tests`

#### Scenario: implementer edits a fixture file
- **WHEN** an `implementer` subagent calls `Edit` on `conftest.py`
- **THEN** the call is denied with the same reason

#### Scenario: implementer edits a notebook in the test tree
- **WHEN** an `implementer` subagent calls `NotebookEdit` on `tests/check.ipynb`
- **THEN** the call is denied with the same reason

#### Scenario: implementer writes production code
- **WHEN** an `implementer` subagent calls `Write` on `src/foo.ts`
- **THEN** the call proceeds unchanged

### Requirement: test-author cannot edit production code
While installed, the mod SHALL deny every `Edit`, `Write`, and `NotebookEdit` call made from a `test-author` subagent whose target path is inside the working directory and is not in the test tree, not under `.orchestrate/`, and not a test-runner config file (`pytest.ini`, `pyproject.toml`, `setup.cfg`, `tox.ini`, or a `jest.config.*`, `vitest.config.*`, or `playwright.config.*` file). The deny reason SHALL direct the model to report the needed production change instead.

#### Scenario: test-author writes a test
- **WHEN** a `test-author` subagent calls `Write` on `tests/test_x.py`
- **THEN** the call proceeds unchanged

#### Scenario: test-author writes its report
- **WHEN** a `test-author` subagent calls `Write` on `.orchestrate/my-change/test-author.md`
- **THEN** the call proceeds unchanged

#### Scenario: test-author edits runner config
- **WHEN** a `test-author` subagent calls `Edit` on `pyproject.toml`
- **THEN** the call proceeds unchanged

#### Scenario: test-author edits production code
- **WHEN** a `test-author` subagent calls `Edit` on `src/service.py`
- **THEN** the call is denied and the model sees a reason telling it to report the needed production change

### Requirement: Only the two agents are guarded
The mod SHALL apply its rules only to calls made from a subagent whose type is exactly `implementer` or `test-author`. Calls from the main session, including a session started with `--agent implementer`, and from any other agent SHALL proceed unchanged. Calls to tools other than `Edit`, `Write`, and `NotebookEdit` SHALL proceed unchanged.

#### Scenario: Main session writes a test
- **WHEN** the main session calls `Write` on `tests/test_x.py`
- **THEN** the call proceeds unchanged

#### Scenario: Another agent writes production code
- **WHEN** a `structure-reviewer` subagent calls `Write` on `src/foo.py`
- **THEN** the call proceeds unchanged

#### Scenario: implementer writes through Bash
- **WHEN** an `implementer` subagent calls `Bash`
- **THEN** the mod does not inspect or deny the call

### Requirement: Unknown agents are let through
When the mod cannot determine the calling subagent's type, because the agent is not in the session's agent list or the lookup fails, it SHALL let the call proceed and SHALL write the reason to the debug log.

#### Scenario: Agent not in the list
- **WHEN** a call carries an agent id that the session's agent list does not contain
- **THEN** the call proceeds unchanged and a debug-log line records the unknown id

#### Scenario: Lookup fails
- **WHEN** listing the session's agents throws
- **THEN** the call proceeds unchanged and a debug-log line records the error

### Requirement: The mod is optional
The agents SHALL work without the mod: their instructions state both boundaries on every platform, and no agent definition SHALL reference the mod as a dependency. The mod SHALL be listed in the Claude Code catalog only.

#### Scenario: Mod not installed
- **WHEN** a user runs the Claude Code `implementer` without the mod
- **THEN** the agent launches and runs, bounded by its instructions only

#### Scenario: Cursor catalog
- **WHEN** the Cursor CLI catalog is read
- **THEN** it does not list `agent-write-guard`
