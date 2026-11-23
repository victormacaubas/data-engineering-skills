# Spec Delta

## ADDED Requirements

### Requirement: implementer gate-configuration rule
The mod SHALL have a rule for `Edit`, `Write`, and `NotebookEdit` calls from an `implementer` subagent whose target path, relative to the working directory of the session, matches any of `**/ruff.toml`, `**/.ruff.toml`, `**/mypy.ini`, `**/.mypy.ini`, `**/.importlinter`, `**/.pre-commit-config.yaml`. The rule SHALL NOT match `pyproject.toml`, a `Makefile`, or a CI workflow file.

#### Scenario: implementer edits the linter configuration
- **WHEN** an `implementer` subagent calls `Edit` on `ruff.toml`
- **THEN** the gate-configuration rule matches the call

#### Scenario: implementer edits pyproject.toml
- **WHEN** an `implementer` subagent calls `Edit` on `pyproject.toml`
- **THEN** the gate-configuration rule does not match the call

#### Scenario: test-author edits the linter configuration
- **WHEN** a `test-author` subagent calls `Edit` on `ruff.toml`
- **THEN** the gate-configuration rule does not match, and the production-code rule for `test-author` applies as before

#### Scenario: Main session edits the linter configuration
- **WHEN** the main session calls `Edit` on `ruff.toml`
- **THEN** the call proceeds unchanged

### Requirement: The gate-configuration rule has a mode
The user SHALL be able to set the gate-configuration rule to `off`, `observe`, or `enforce` through the configuration of the plugin. The default SHALL be `observe`. The test-tree rule for `implementer` and the production-code rule for `test-author` SHALL have no mode and SHALL deny as before.

#### Scenario: Default mode
- **WHEN** the user has set no mode
- **THEN** the gate-configuration rule is in `observe` mode

#### Scenario: Mode off
- **WHEN** the mode is `off` and an `implementer` subagent calls `Edit` on `ruff.toml`
- **THEN** the call proceeds unchanged and nothing is recorded

#### Scenario: Mode enforce
- **WHEN** the mode is `enforce` and an `implementer` subagent calls `Edit` on `ruff.toml`
- **THEN** the call is denied, and the model sees a reason that tells it to report the configuration change that it needs

#### Scenario: Existing rules are not affected
- **WHEN** the mode is `off` and an `implementer` subagent calls `Write` on `tests/test_x.py`
- **THEN** the call is denied as before

### Requirement: Observe mode records and does not deny
In `observe` mode, the mod SHALL let a matching call proceed and SHALL record one line that the person can read in the session. The line SHALL state the agent type, the tool, the path, and that the call would be denied in `enforce` mode.

#### Scenario: Matching call in observe mode
- **WHEN** the mode is `observe` and an `implementer` subagent calls `Write` on `.pre-commit-config.yaml`
- **THEN** the call proceeds, and one recorded line names `implementer`, `Write`, the path, and the rule

#### Scenario: Call that does not match
- **WHEN** the mode is `observe` and an `implementer` subagent calls `Write` on `src/foo.py`
- **THEN** the call proceeds and nothing is recorded

### Requirement: An invalid mode uses the default
When the configured mode is not `off`, `observe`, or `enforce`, the gate-configuration rule SHALL be in `observe` mode. Claude Code replaces a stored value outside the declared options with the default and reports the invalid value. The mod SHALL NOT have a second check of the value.

#### Scenario: Unknown value
- **WHEN** the configured mode is `block`
- **THEN** the gate-configuration rule is in `observe` mode
