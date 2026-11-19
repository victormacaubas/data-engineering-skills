# Spec Delta

## Purpose

Defines how the build loop proves that a slice works: which checks count, how many fix rounds are permitted, what a later round receives, how unverified work is recorded, how a build closes, and how a commit records its verification.

## ADDED Requirements

### Requirement: Fix rounds are limited to three for each slice
The `orchestrate` skill SHALL count the fix rounds for each slice. A round is one worker dispatch that returns while a required check of the slice still fails. After the third round, the orchestrator SHALL stop work on that slice and SHALL give it to the user. It SHALL continue the slices that do not depend on the stopped slice.

#### Scenario: Third round fails
- **WHEN** the third dispatch for a slice returns and the slice selector still fails
- **THEN** the orchestrator does not dispatch a fourth round and gives the slice to the user

#### Scenario: Independent slices continue
- **WHEN** one slice reaches the limit and another slice does not depend on it
- **THEN** the orchestrator continues the other slice

#### Scenario: Round count is recorded
- **WHEN** a dispatch returns with a required check that still fails
- **THEN** the orchestrator records the new round count for that slice in the tracking artifact

#### Scenario: Dispute rounds count
- **WHEN** a disputed test sends a slice back to `test-author` or to the `implementer`, and the selector still fails after the return
- **THEN** that dispatch counts as one round for the slice

#### Scenario: User restarts a stopped slice
- **WHEN** the user tells the orchestrator to continue a stopped slice
- **THEN** the orchestrator sets the round count for that slice to zero and dispatches again

### Requirement: Workers limit their own fix attempts
Every `implementer` and `test-author` variant SHALL stop after three attempts to fix the same failing check. The worker SHALL then return with a status that is not complete, and its report SHALL list each attempt with the change it made and the result.

#### Scenario: Third attempt fails
- **WHEN** an `implementer` makes a third attempt to fix one failing selector and the selector still fails
- **THEN** it stops, reports the slice as not complete, and lists the three attempts

#### Scenario: A different check fails
- **WHEN** a fix makes the first check pass and a different check then fails
- **THEN** the attempt count starts again for the different check

### Requirement: A hand-back states its reason
When the orchestrator gives a slice or a review to the user because a limit was reached, its message SHALL state the failing command, the last failing output, the change that each round made, the reason that the workers cannot resolve it, and the decision that the user must make.

#### Scenario: Slice at the round limit
- **WHEN** a slice reaches the limit of three rounds
- **THEN** the message to the user contains the five items, and the user does not need the diff to find the reason

### Requirement: A re-dispatch carries the earlier rounds
For the second and each later round of a slice, the brief SHALL give the path of each earlier report for that slice and the failing output of the last round. Each round SHALL write its report to a path that contains the round number. A later round SHALL NOT overwrite an earlier report.

#### Scenario: Second round brief
- **WHEN** the orchestrator dispatches the second round for a slice
- **THEN** the brief names the first-round report and includes the output of the check that failed

#### Scenario: Reports are kept
- **WHEN** three rounds have run for a slice
- **THEN** three report files exist for that slice, one for each round

### Requirement: The implementer runs a real check on every platform
Every `implementer` variant SHALL run a check that exercises each change: the selector tests that cover it, the changed command, or the type check on the changed modules when the project configures one. A syntax-only check, or a check command that did not start, SHALL NOT count. When no such check can run, the variant SHALL report the slice as not complete and SHALL state why.

#### Scenario: Codex and Cursor carry the rule
- **WHEN** a user reads the Verification step of the Codex or Cursor `implementer`
- **THEN** it contains the same real-check rule as the Claude variant

#### Scenario: Only a syntax check ran
- **WHEN** the only check that an `implementer` ran is a syntax check
- **THEN** its report does not show the slice as complete

### Requirement: A slice with no executed check is recorded as unverified
When a worker is dispatched without a test bar, or reports that no check that exercises the change ran, the orchestrator SHALL record the slice as `unverified` in the tracking artifact. The closing summary SHALL list each unverified slice. The orchestrator SHALL NOT describe an unverified slice as verified.

#### Scenario: Dispatch without a test bar
- **WHEN** no working test environment exists and the user selects a dispatch without a test bar
- **THEN** the slice is built, and the tracking artifact marks it `unverified`

#### Scenario: Closing summary lists unverified slices
- **WHEN** a build closes with one unverified slice
- **THEN** the closing summary names that slice as unverified

### Requirement: The build closes with a full check run
Before it reports a build as finished, the orchestrator SHALL run the project gate command one time. When the project has no gate command, it SHALL run the full test suite and the configured linters and type checks. It SHALL also run each command that `test-author` reported for a command-verified scenario. The closing summary SHALL state each command and its result.

#### Scenario: Gate passes
- **WHEN** every task is ticked and the gate command passes
- **THEN** the closing summary states the gate command and its pass result

#### Scenario: Gate fails
- **WHEN** the gate command fails at close
- **THEN** the orchestrator does not report the build as finished and opens a slice for the failure

#### Scenario: Command-verified scenarios
- **WHEN** the `test-author` report lists a command for a command-verified scenario
- **THEN** the orchestrator runs that command at close and states its result

#### Scenario: No gate and no suite
- **WHEN** the project has no gate command, no test suite, and no configured linter
- **THEN** the closing summary states that no check was found and records the build as unverified

### Requirement: A commit records how it was verified
When the user asks the orchestrator to commit the changes of a build, the commit message SHALL contain a `Verified:` trailer. The value SHALL list the checks that ran and passed at close on the committed tree, or SHALL be `none`. The orchestrator SHALL NOT commit without a request from the user.

#### Scenario: Gate passed at close
- **WHEN** the gate command passed at close and the user asks for a commit
- **THEN** the commit message contains a `Verified:` trailer that names the gate command

#### Scenario: Nothing was verified
- **WHEN** the build is recorded as unverified and the user asks for a commit
- **THEN** the commit message contains `Verified: none`

#### Scenario: Tree changed after the close run
- **WHEN** files changed after the close run and before the commit
- **THEN** the orchestrator runs the close checks again before it writes the trailer

#### Scenario: Unverified commits can be found
- **WHEN** a user lists the `Verified` trailer of each commit with `git log`
- **THEN** each commit made by the orchestrator shows its checks or `none`

### Requirement: Gate configuration is not changed to pass a check
Every `implementer` variant SHALL NOT change linter, formatter, type-checker, import-contract, pre-commit, CI, or gate-command configuration to make a check pass, unless its task names that change. It SHALL report a configuration change that it thinks is necessary. After each slice, the orchestrator SHALL examine the changed paths for gate configuration and SHALL rule on each change that no task names.

#### Scenario: A lint rule blocks the slice
- **WHEN** a lint rule fails on new code and the task does not name a configuration change
- **THEN** the `implementer` fixes the code or reports the rule, and does not edit the lint configuration

#### Scenario: The task names the change
- **WHEN** a task tells the `implementer` to add a rule to the lint configuration
- **THEN** the `implementer` makes that change

#### Scenario: Orchestrator finds an unrequested change
- **WHEN** the changed paths of a slice include gate configuration that no task names
- **THEN** the orchestrator does not tick the task until it accepts the change and records it, or has it reverted

### Requirement: A flaky test goes to the dispute channel
Every `implementer` variant SHALL NOT run a test again and again until it passes. When the same test gives different results on identical runs, the `implementer` SHALL list it under `Disputed tests` with the reason `flaky` and the output of a passing run and a failing run. The orchestrator SHALL send a flaky test to `test-author`.

#### Scenario: Test passes on the second run
- **WHEN** a selector test fails, the `implementer` changes nothing, and the test passes on the next run
- **THEN** the `implementer` lists the test as `flaky` with the two outputs and does not report the slice as complete

#### Scenario: Orchestrator rules on a flaky test
- **WHEN** an `implementer` receipt lists a test as `flaky`
- **THEN** the orchestrator dispatches `test-author` with the two outputs

### Requirement: Review rounds are limited to three
The orchestrator SHALL count the closing reviews of a change that return `request_changes`. After the third such verdict, it SHALL stop the review loop and SHALL give the change to the user with the reason.

#### Scenario: Third request for changes
- **WHEN** the third review of the same change returns `request_changes`
- **THEN** the orchestrator does not dispatch more fix slices for the review and gives the change to the user
