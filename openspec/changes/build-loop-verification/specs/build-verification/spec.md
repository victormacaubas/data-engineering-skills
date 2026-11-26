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

### Requirement: Terraform static checks count as a real check
For a Terraform module, every `implementer` variant SHALL count `terraform validate` after `terraform init`, and the `tflint`, `checkov`, or `trivy` checks that the project configures, as the real check. `terraform fmt` alone SHALL NOT count.

#### Scenario: Terraform module with no tests
- **WHEN** a slice changes a Terraform module that has no tests, and `terraform validate` passes after `terraform init`
- **THEN** the check counts as a real check, and the orchestrator does not record the slice as `unverified`

#### Scenario: Terraform format check only
- **WHEN** the only Terraform check that an `implementer` ran is `terraform fmt`
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
Before it reports a build as finished, the orchestrator SHALL run one time the gate that the project instructions declare. It SHALL also run each command that `test-author` reported for a command-verified scenario. It SHALL NOT run a command that the project instructions reserve for the user. It SHALL give each such command to the user, and SHALL record it as a passed check only when the user runs it and confirms the result. The closing summary SHALL state each command and its result.

#### Scenario: Gate passes
- **WHEN** every task is ticked and the gate command passes
- **THEN** the closing summary states the gate command and its pass result

#### Scenario: Gate fails
- **WHEN** the gate command fails at close
- **THEN** the orchestrator does not report the build as finished and opens a slice for the failure

#### Scenario: Command-verified scenarios
- **WHEN** the `test-author` report lists a command for a command-verified scenario
- **THEN** the orchestrator runs that command at close and states its result

#### Scenario: Command reserved for the user
- **WHEN** the project instructions say that the user runs `terraform plan`
- **THEN** the orchestrator does not run that command at close

#### Scenario: Plan that the user runs
- **WHEN** the project instructions say that the user runs `terraform plan`, and the user runs it at close and confirms that the plan agrees with the intended change
- **THEN** the orchestrator records `terraform plan (user)` as a passed check

#### Scenario: User does not run the plan
- **WHEN** the orchestrator gives the user `terraform plan` at close and the user does not run it
- **THEN** the closing summary states that no plan ran, and the plan is not a passed check

#### Scenario: No check to run
- **WHEN** the project declares no gate, the orchestrator finds no command to propose, and the project has no `verify` skill
- **THEN** the closing summary states that no check was found and records the build as unverified

### Requirement: A gate that the project does not declare needs approval
When the project instructions declare no gate, the orchestrator SHALL look for a `check` or `test` target, a test suite, and configured linters and type checks. It SHALL NOT run a command that it finds without approval from the user. It SHALL ask one time for each build and SHALL name each command. Without approval, the build SHALL have no gate.

#### Scenario: User approves a found gate
- **WHEN** the project declares no gate, the `Makefile` has a `test` target, and the user approves it
- **THEN** the orchestrator runs that target at close and states its result

#### Scenario: User does not approve
- **WHEN** the user does not approve the found commands
- **THEN** the orchestrator runs none of them, and the closing summary says that no gate ran

#### Scenario: The question shows how to remove it
- **WHEN** the orchestrator asks for approval of a found gate
- **THEN** the question names each command and says that a declaration in the project instructions removes the question

#### Scenario: One question for each build
- **WHEN** the close run occurs a second time in the same build
- **THEN** the orchestrator uses the first answer and does not ask again

#### Scenario: Declared gate
- **WHEN** the project `AGENTS.md` names one command as the definition of done
- **THEN** the orchestrator runs that command at close with no question

### Requirement: The close run follows the project verify skill
When the project has a `verify` skill, the orchestrator SHALL follow its steps one time at close, after the gate and the command-verified scenarios pass. The closing summary SHALL state the verify command, the evidence, and the result. When the project has no `verify` skill, the closing summary SHALL say so.

#### Scenario: Verify flow passes
- **WHEN** the gate passes and the project has `.claude/skills/verify/SKILL.md`
- **THEN** the orchestrator follows the skill, and the closing summary states the verify command and its pass result

#### Scenario: Verify flow fails
- **WHEN** the verify flow does not satisfy its pass condition
- **THEN** the orchestrator does not report the build as finished and opens a slice for the failure

#### Scenario: Gate fails before the verify flow
- **WHEN** the gate command fails at close
- **THEN** the orchestrator does not run the verify flow in that close run

#### Scenario: Verify flow cannot start
- **WHEN** the verify flow cannot start for a reason outside the change
- **THEN** the closing summary records verify as `not run` with the reason, and does not record a pass

#### Scenario: No verify skill
- **WHEN** the project has no `verify` skill
- **THEN** the close run has the gate and the command-verified scenarios only, and the closing summary says that no verify skill was found

### Requirement: A commit records how it was verified
When the verification trailers are enabled and the user asks the orchestrator to commit the changes of a build, the commit message SHALL contain a `Verified:` trailer. The value SHALL list the checks that ran and passed at close on the committed tree, or SHALL be `none`. The value SHALL name `verify` only when the verify flow ran and passed at close. The orchestrator SHALL NOT commit without a request from the user.

#### Scenario: Gate passed at close
- **WHEN** the trailers are enabled, the gate command passed at close, and the user asks for a commit
- **THEN** the commit message contains a `Verified:` trailer that names the gate command

#### Scenario: Nothing was verified
- **WHEN** the trailers are enabled, the build is recorded as unverified, and the user asks for a commit
- **THEN** the commit message contains `Verified: none`

#### Scenario: Tree changed after the close run
- **WHEN** files changed after the close run and before the commit
- **THEN** the orchestrator runs the close checks again before it writes the trailer

#### Scenario: Unverified commits can be found
- **WHEN** a user lists the `Verified` trailer of each commit with `git log`
- **THEN** each commit that the orchestrator made with the trailers enabled shows its checks or `none`

#### Scenario: Verify passed at close
- **WHEN** the trailers are enabled, the gate and the verify flow passed at close, and the user asks for a commit
- **THEN** the `Verified:` trailer names the gate command and `verify`

#### Scenario: Verify was not run
- **WHEN** the trailers are enabled, the verify flow was recorded as `not run`, and the user asks for a commit
- **THEN** the `Verified:` trailer does not name `verify`

### Requirement: The verification trailers are opt-in
The orchestrator SHALL add the verification trailers to a commit only when the project instructions say that commits carry them, or when the user asks for them. In all other cases, the commit message SHALL have no verification trailer. The closing summary SHALL state the verification result in each case.

#### Scenario: Project enables the trailers
- **WHEN** the definition of done in the project `AGENTS.md` says that commits carry the `Verified:` trailer and the user asks for a commit
- **THEN** the commit message has the trailer

#### Scenario: Project turns the trailers off
- **WHEN** the definition of done in the project instructions says that commits carry no verification trailer and the user asks for a commit
- **THEN** the commit message has no verification trailer

#### Scenario: User asks for the trailers
- **WHEN** the project instructions do not name the trailer and the user asks for a commit with the verification trailers
- **THEN** the commit message has the trailer

#### Scenario: Trailers are not enabled
- **WHEN** the project instructions do not name the trailer and the user asks for a commit
- **THEN** the commit message has no `Verified:` trailer and no `Unverified:` trailer

#### Scenario: Summary without a trailer
- **WHEN** a build closes in a project that does not enable the trailers
- **THEN** the closing summary states each check and its result, and each unverified slice

### Requirement: The closing summary states the trailer state
The closing summary of each build SHALL have one line that states if the verification trailers are enabled for the project. The line SHALL give the reason: the project instructions enable them, the user asked for them, the project instructions turn them off, or no source names them.

#### Scenario: No source names the trailers
- **WHEN** a build closes in a project whose instructions do not name the trailers, and the user did not ask for them
- **THEN** the closing summary says that the trailers are not enabled and that no source names them

#### Scenario: Project enables the trailers
- **WHEN** a build closes in a project whose definition of done enables the trailers
- **THEN** the closing summary says that the trailers are enabled by the project instructions

#### Scenario: Project turns the trailers off
- **WHEN** a build closes in a project whose definition of done says that commits carry no verification trailer
- **THEN** the closing summary says that the project instructions turn the trailers off

### Requirement: A commit names its unverified slices
When the verification trailers are enabled and one or more slices of the build are recorded as `unverified`, the commit message SHALL also contain an `Unverified:` trailer that names each such slice. A commit with no unverified slice SHALL have no `Unverified:` trailer.

#### Scenario: Gate passed and one slice is unverified
- **WHEN** the gate passed at close, one slice is recorded as `unverified`, and the user asks for a commit
- **THEN** the commit message has a `Verified:` trailer that names the gate and an `Unverified:` trailer that names the slice

#### Scenario: Each slice is verified
- **WHEN** no slice of the build is recorded as `unverified`
- **THEN** the commit message has no `Unverified:` trailer

#### Scenario: Commits with unverified slices can be found
- **WHEN** a user lists the `Unverified` trailer of each commit with `git log`
- **THEN** each commit that has an unverified slice shows the names of its slices

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
Every `implementer` variant SHALL NOT run a test again and again until it passes. When the same test gives different results on identical runs, the `implementer` SHALL list it under `Disputed tests` with the reason `flaky` and the output of a passing run and a failing run. The orchestrator SHALL run the test again to confirm. It SHALL send a flaky test to `test-author`, or back to the `implementer` when the cause is in production code. The orchestrator SHALL NOT delete a flaky test itself.

#### Scenario: Test passes on the second run
- **WHEN** a selector test fails, the `implementer` changes nothing, and the test passes on the next run
- **THEN** the `implementer` lists the test as `flaky` with the two outputs and does not report the slice as complete

#### Scenario: Orchestrator rules on a flaky test
- **WHEN** an `implementer` receipt lists a test as `flaky`
- **THEN** the orchestrator runs the selector again and dispatches `test-author` with the two outputs

#### Scenario: Cause in production code
- **WHEN** the outputs or the diff show that a flaky test fails because the code under test keeps state between calls
- **THEN** the orchestrator sends the slice back to the `implementer` and does not dispatch `test-author` to delete the test

### Requirement: Review rounds are limited to three
The orchestrator SHALL count the closing reviews of a change that return `request_changes`. After the third such verdict, it SHALL stop the review loop and SHALL give the change to the user with the reason.

#### Scenario: Third request for changes
- **WHEN** the third review of the same change returns `request_changes`
- **THEN** the orchestrator does not dispatch more fix slices for the review and gives the change to the user
