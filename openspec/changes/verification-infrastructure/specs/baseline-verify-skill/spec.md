# Spec Delta

## Purpose

Defines what "verified" means in a project that starts from the `architecture-baseline` skill: a `verify` skill that starts the real program and checks one flow, a gate that needs no credentials, and a gate that runs on the local machine before a push, so that "done" means that the change ran and that CI is not the first check.

## ADDED Requirements

### Requirement: The baseline generates a project verify skill
The `architecture-baseline` skill SHALL write a skill named `verify` at `.claude/skills/verify/SKILL.md` in the target project. It SHALL write the skill in the same run that writes the gate and the project `AGENTS.md`.

#### Scenario: Baseline for a new project
- **WHEN** the baseline completes for a new project
- **THEN** `.claude/skills/verify/SKILL.md` exists in that project

#### Scenario: Verify skill already exists
- **WHEN** the target project already has `.claude/skills/verify/SKILL.md`
- **THEN** the baseline shows the planned change and writes only after the person confirms

### Requirement: The verify skill runs the real program
The generated skill SHALL state how to start the program through its declared entry point, one flow to drive with a fixed input, the evidence to capture, and the condition for a pass. The skill SHALL NOT be only a second run of the gate or of the test suite.

#### Scenario: Command-line tool
- **WHEN** the project is a command-line tool
- **THEN** the skill gives the command to run on a fixed input, the output to capture, and the expected exit status and output

#### Scenario: Data pipeline
- **WHEN** the project is a pipeline
- **THEN** the skill gives the run on fixture data, and the row count and the grain to check in the output

#### Scenario: Service
- **WHEN** the project is a service
- **THEN** the skill gives the local start command, one request to send, and the response to expect

#### Scenario: Evidence is reported
- **WHEN** a session follows the generated skill
- **THEN** its report contains the command that ran and the output that the skill says to capture

### Requirement: The verify skill does not invent a command
When the project has no entry point that runs at baseline time, the generated skill SHALL state the declared entry point and SHALL state that the first feature change must make the flow run. It SHALL NOT contain a command that the design document or the person did not give.

#### Scenario: No code exists
- **WHEN** the baseline runs before the first feature and the design document names the entry point
- **THEN** the skill names that entry point and says that the flow does not run until the first feature change

#### Scenario: Design document names no entry point
- **WHEN** the design document does not say how the program starts
- **THEN** the baseline asks the person and does not guess

### Requirement: The generated AGENTS.md names the gate and the verify skill
The project `AGENTS.md` that the baseline writes SHALL name the gate command and the `verify` skill together as the definition of done. It SHALL give the path of the skill file, so that a tool other than Claude Code can follow the same steps.

#### Scenario: Definition of done
- **WHEN** a contributor reads the generated `AGENTS.md`
- **THEN** it says that a change is done when the gate passes and the verify flow passes

#### Scenario: Tool that does not load Claude Code skills
- **WHEN** a session in a different tool reads the generated `AGENTS.md`
- **THEN** it finds the path of the verify skill file and can follow its steps

### Requirement: The generated AGENTS.md records the trailer decision
The `architecture-baseline` skill SHALL ask the person if commits in the project carry verification trailers. It SHALL write the answer in the definition of done of the generated `AGENTS.md`, for a yes and for a no. For a yes, the line SHALL give the format of the trailers. The baseline SHALL NOT write an answer that the person did not give.

#### Scenario: Person answers yes
- **WHEN** the person says that commits carry verification trailers
- **THEN** the definition of done has a line that says so and gives the format of the `Verified:` and `Unverified:` trailers

#### Scenario: Person answers no
- **WHEN** the person says that commits carry no verification trailer
- **THEN** the definition of done has a line that says so

#### Scenario: No default
- **WHEN** the person has not answered the question
- **THEN** the baseline asks, and does not write a line for a yes or for a no

#### Scenario: One location
- **WHEN** a contributor reads the generated `AGENTS.md`
- **THEN** the trailer line is in the same section as the gate command and the verify skill path

### Requirement: The baseline does not say that the gate proves the program runs
The `architecture-baseline` skill and the files that it generates SHALL describe the gate as static checks and tests. They SHALL NOT state that the gate proves that the program runs.

#### Scenario: Review bar text
- **WHEN** a user reads the review bar in the skill and in a generated `AGENTS.md`
- **THEN** no sentence says that the gate proves that the code runs

### Requirement: The baseline explains when the verify skill runs
The `architecture-baseline` skill SHALL tell the person that Claude Code runs a project skill named `verify` before a commit, and that other tools depend on the line in `AGENTS.md`.

#### Scenario: Hand-over to the person
- **WHEN** the baseline reports what it wrote
- **THEN** the report says when the verify skill runs in Claude Code and what other tools do

### Requirement: The gate does not select integration tests
The pytest configuration that the baseline writes SHALL deselect the tests with the `integration` marker in the default run. The gate SHALL use the default run. The baseline SHALL give the explicit command for the integration lane.

#### Scenario: Gate on a machine with no credentials
- **WHEN** the project has a test with the `integration` marker and the gate runs on a machine with no credentials
- **THEN** the gate does not select that test

#### Scenario: Integration lane
- **WHEN** a contributor runs the test command with the `integration` marker selected
- **THEN** the run selects the integration tests

#### Scenario: Registry test stays in the gate
- **WHEN** the gate runs
- **THEN** the default run selects the rules registry test

#### Scenario: Description and configuration agree
- **WHEN** a user reads the pytest block that the baseline writes
- **THEN** each marker that the text calls excluded from the default run is deselected by the configuration

### Requirement: The gate runs locally before a push
The baseline SHALL declare three tiers of checks: fast checks on each commit, the gate on the local machine before a push or a pull request, and the same gate command in CI. The hook configuration that the baseline writes SHALL run the gate before a push. The generated `AGENTS.md` SHALL tell the contributor to run the gate before a push. The baseline SHALL NOT describe CI as the first place where the type check or the tests run.

#### Scenario: Commit in a baseline project
- **WHEN** a contributor makes a commit in a project with the hook configuration of the baseline
- **THEN** only the fast hooks run

#### Scenario: Push in a baseline project
- **WHEN** a contributor pushes in a project with the hook configuration of the baseline
- **THEN** the gate command runs on the local machine before the push completes

#### Scenario: CI runs the same command
- **WHEN** CI runs for a pushed change
- **THEN** it runs the gate command, not a separate list of steps

#### Scenario: Generated AGENTS.md
- **WHEN** a contributor reads the definition of done in the generated `AGENTS.md`
- **THEN** it says to run the gate on the local machine before a push or a pull request

#### Scenario: No sentence leaves the checks to CI only
- **WHEN** a user reads the gate and CI guidance of the baseline
- **THEN** no sentence tells the writer to leave the type check or the tests to CI
