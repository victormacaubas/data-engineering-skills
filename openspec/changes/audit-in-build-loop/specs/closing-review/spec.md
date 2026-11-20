# Spec Delta

## Purpose

Defines how the `orchestrate` skill offers, dispatches, and closes the reviews at the end of a build: which reviews it offers and when, how the structure review and the defect audit share one tree and one fix round, and when a block is cleared.

## ADDED Requirements

### Requirement: A defect audit is offered only on a signal
At the close of a build, the `orchestrate` skill SHALL offer a defect audit only on an audit signal. The signals are: a slice recorded as `unverified` in a project with a working test environment, a scenario recorded as not covered, a slice at a trust boundary, a slice that adds retry, concurrency, or cache logic, and a slice that needed more than one fix round. The orchestrator SHALL NOT read the tree again to find a signal.

#### Scenario: Unverified slice
- **WHEN** a build closes in a project with a working test environment and the tracking artifact marks one slice as `unverified`
- **THEN** the orchestrator offers a defect audit and names that slice as the signal

#### Scenario: Project with no test environment
- **WHEN** each slice was dispatched without a test bar because the project has no working test environment
- **THEN** the `unverified` record of those slices is not an audit signal

#### Scenario: Slice at a trust boundary
- **WHEN** a task of the plan says that a slice builds a SQL statement from user input
- **THEN** the orchestrator offers a defect audit and names that slice as the signal

#### Scenario: Slice needed two fix rounds
- **WHEN** the round count of one slice is two or more
- **THEN** the orchestrator offers a defect audit and names that slice as the signal

#### Scenario: No audit signal
- **WHEN** a build closes with each slice verified, each scenario covered, and no other audit signal
- **THEN** the orchestrator does not offer a defect audit

### Requirement: The reviews are offered in one question
When a signal applies for the structure review, for the defect audit, or for the two, the orchestrator SHALL ask one question in one line. The line SHALL name each review that has a signal, with the signal. The user SHALL be able to select the structure review, the audit, the two, or none. The orchestrator SHALL NOT ask again in the same build after an answer.

#### Scenario: Signals for the two reviews
- **WHEN** a build with three slices adds a module and has one `unverified` slice, in a project with a working test environment
- **THEN** the orchestrator asks one question that names the structure review and the audit, each with its signal

#### Scenario: Signal for the audit only
- **WHEN** a build with one slice has an audit signal and no structure signal
- **THEN** the question names the audit only

#### Scenario: No signal
- **WHEN** no signal applies for the structure review or for the audit
- **THEN** the orchestrator asks no review question

#### Scenario: User selects one of two
- **WHEN** the question names the two reviews and the user selects the audit
- **THEN** the orchestrator dispatches `code-auditor` only and does not ask about the structure review again

#### Scenario: User declines
- **WHEN** the user answers no
- **THEN** the orchestrator dispatches no reviewer and the build is done

### Requirement: A direct request needs no signal
When the user asks for a defect audit or for a structure review, the orchestrator SHALL dispatch that reviewer without the signal test.

#### Scenario: User asks for an audit
- **WHEN** the user asks for a defect audit of a build that has no audit signal
- **THEN** the orchestrator dispatches `code-auditor`

### Requirement: Reviews run at close on one tree
The orchestrator SHALL dispatch a reviewer only after the close run has no failure. It SHALL dispatch the selected reviewers together, for the same commit and the same state of the working tree. It SHALL NOT dispatch `code-auditor` for one slice during the dispatch loop. It SHALL NOT dispatch a worker while a review round runs.

#### Scenario: Close run fails
- **WHEN** the gate command fails at close
- **THEN** the orchestrator does not offer or dispatch a review until a close run has no failure

#### Scenario: Two reviews selected
- **WHEN** the user selects the structure review and the audit
- **THEN** the orchestrator dispatches the two reviewers in one step, and each receipt states the same commit

#### Scenario: Slice returns during the build
- **WHEN** a slice returns and other slices are open
- **THEN** the orchestrator does not dispatch `code-auditor`

#### Scenario: No worker during a review round
- **WHEN** a reviewer is running
- **THEN** the orchestrator does not dispatch an `implementer` or a `test-author`

### Requirement: The audit in the loop is limited to four dimensions
When the orchestrator dispatches `code-auditor` at close, the brief SHALL limit the audit to the security, correctness, performance, and error-handling dimensions. The brief SHALL give the paths that the build changed, the base, the slices recorded as `unverified`, and the scenarios that have no test. The brief SHALL NOT list the defects that the orchestrator expects.

#### Scenario: Brief for the audit
- **WHEN** the orchestrator dispatches `code-auditor` at close
- **THEN** the brief names the four dimensions, the changed paths, the base, the `unverified` slices, and the scenarios with no test

#### Scenario: No suspicions in the brief
- **WHEN** the orchestrator thinks that one function has a defect
- **THEN** the brief does not say so

### Requirement: The blocking items of the reviews form one slice set
When one or more selected reviewers return `request_changes`, the orchestrator SHALL wait for each selected reviewer. It SHALL then make one slice set from the structure fix list and from the audit findings that decide the audit verdict. It SHALL keep the rank of the structure fix list and the severity order of the audit findings. Items that change the same file SHALL NOT go to two workers at the same time.

#### Scenario: Two reviewers request changes
- **WHEN** the structure review and the audit each return `request_changes`
- **THEN** the orchestrator makes one slice set that contains the structure fix list and the blocking audit findings

#### Scenario: One reviewer is not back
- **WHEN** the audit returns `request_changes` and the structure review has not returned
- **THEN** the orchestrator dispatches no fix slice

#### Scenario: Two items in one file
- **WHEN** a structure item and an audit finding change the same file
- **THEN** the two items are in one slice, or in slices that run in sequence

#### Scenario: Findings that do not block
- **WHEN** the audit returns findings that do not decide its verdict
- **THEN** the orchestrator lists them in the closing summary and does not build them without a request from the user

### Requirement: Each selected reviewer reads the tree again after a fix round
After the fix slices of a review round return and a close run has no failure, the orchestrator SHALL dispatch each selected reviewer again as a re-review, with the path of its earlier output. A reviewer that had no open item SHALL review the fix diff only. The block SHALL be cleared only when each selected reviewer returns a verdict that is not `request_changes` for the current tree.

#### Scenario: Audit requested changes and structure review approved
- **WHEN** the fix slices for the audit findings return
- **THEN** the orchestrator dispatches the audit as a re-review of its findings, and the structure review as a review of the fix diff

#### Scenario: Worker report is not a clearance
- **WHEN** an `implementer` reports that each finding is fixed
- **THEN** the orchestrator does not clear the block until the re-review returns

#### Scenario: Block cleared
- **WHEN** each selected reviewer returns `approve` or `approve_with_comments` for the current tree
- **THEN** the orchestrator clears the block

### Requirement: A stale audit does not clear a block
The orchestrator SHALL NOT accept an audit artifact as the audit of the current change when the artifact is marked stale, or when its commit is not the current commit. It SHALL dispatch the audit again. That dispatch SHALL NOT count as a review round.

#### Scenario: Stale audit that approves
- **WHEN** an audit returns `approve` and its artifact is marked stale
- **THEN** the orchestrator does not clear the block and dispatches the audit again

### Requirement: A review round counts for the change
A review round is one dispatch of the selected reviewers. A round in which one or more reviewers return `request_changes` SHALL count one time for the change. After the third such round, the orchestrator SHALL stop the review loop and SHALL give the change to the user with the open items of each reviewer.

#### Scenario: Two reviewers request changes in one round
- **WHEN** the structure review and the audit each return `request_changes` in the same round
- **THEN** the round count for the change increases by one

#### Scenario: Third round requests changes
- **WHEN** the third round has one or more `request_changes` verdicts
- **THEN** the orchestrator dispatches no more fix slices for the reviews and gives the change to the user

### Requirement: The agent prerequisites name code-auditor
Each place in the repository that lists the agents that `/flow:orchestrate` requires SHALL name `code-auditor`.

#### Scenario: Catalog description
- **WHEN** a user reads the `flow` description in the Claude Code catalog or in the Cursor catalog
- **THEN** the agents listed for `orchestrate` include `code-auditor`

#### Scenario: Contributor guidance
- **WHEN** a contributor reads the dependency list in `AGENTS.md` and the `orchestrate` row in the `flow` README
- **THEN** each of the two names `code-auditor`
