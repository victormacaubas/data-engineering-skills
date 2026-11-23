# Spec Delta

## Purpose

Defines the integrity rules that the `code-audit` and `structure-review` skills share: who is responsible for a finding, which version of a rule judges a change, which commit a result belongs to, and when a repeated problem becomes a rule.

## ADDED Requirements

### Requirement: Findings in a diff-scoped review carry an origin
When the review scope is a diff, each `code-audit` finding and each `structure-review` fix-list item SHALL carry an origin. The origin SHALL be `introduced` when the change added or modified the defective lines, or when the change causes the defect. It SHALL be `pre-existing` when the defect is on the base and the change does not cause it. When the scope has no base, the origin SHALL be `not-assessed`.

#### Scenario: Defect in an added line
- **WHEN** a finding is anchored to a line that the change added
- **THEN** its origin is `introduced`

#### Scenario: Old defect near the change
- **WHEN** a finding is anchored to an unchanged line and the change does not make the line wrong or newly reachable
- **THEN** its origin is `pre-existing`

#### Scenario: Change exposes an old defect
- **WHEN** the change sends new input to unchanged code that is unsafe for that input
- **THEN** the finding has origin `introduced`, and its explanation says how the change causes the defect

#### Scenario: Scope without a base
- **WHEN** the review scope is a list of paths or the full repository
- **THEN** each finding has origin `not-assessed`

#### Scenario: Origin is not clear
- **WHEN** the reviewer cannot decide between the two origins
- **THEN** it uses `introduced`

### Requirement: Pre-existing defects stay visible
In a diff-scoped review, `code-audit` SHALL report a load-bearing defect in unchanged code as a finding with origin `pre-existing`. It SHALL NOT report it only as a note. `structure-review` SHALL continue to raise a problem that predates the change in a module that the change touches, and SHALL mark its origin.

#### Scenario: Load-bearing old defect in code-audit
- **WHEN** unchanged code that the change calls has a correctness defect
- **THEN** the artifact contains a finding for it with origin `pre-existing` and an excerpt anchor

#### Scenario: Old defect that is not load-bearing
- **WHEN** an old defect is in a part of the file that the change does not touch and does not call
- **THEN** `code-audit` in diff scope does not report it

#### Scenario: Large module opened by a change
- **WHEN** a change touches a module that already did four jobs before the change
- **THEN** `structure-review` raises the module with origin `pre-existing`

### Requirement: Pre-existing findings do not decide the verdict
A verdict of `request_changes` SHALL need a minimum of one blocking item with origin `introduced` or `not-assessed`. `code-audit` SHALL calculate its dimension scores and its overall score from findings with origin `introduced` or `not-assessed` only. Each report SHALL state the count of `pre-existing` findings separately.

#### Scenario: Only an old Critical defect
- **WHEN** the one Critical finding of a `code-audit` review has origin `pre-existing`
- **THEN** the verdict is not `request_changes` because of it, and the report shows the finding and its severity

#### Scenario: Scores exclude old defects
- **WHEN** a review has two `introduced` findings and three `pre-existing` findings
- **THEN** the scores use the two `introduced` findings, and the report states three `pre-existing` findings

#### Scenario: Structure verdict with old debt only
- **WHEN** each `structure-review` fix-list item has origin `pre-existing`
- **THEN** the verdict is not `request_changes`

### Requirement: The rendered audit report separates pre-existing findings
The markdown report that `code-audit` renders on request SHALL show the origin of each finding and SHALL put `pre-existing` findings in a section apart from the others. The renderer SHALL read an artifact that has no origin field and SHALL show its findings as `not-assessed`.

#### Scenario: Artifact with both origins
- **WHEN** the renderer reads an artifact with `introduced` and `pre-existing` findings
- **THEN** the report has one section for each group

#### Scenario: Artifact from the earlier schema
- **WHEN** the renderer reads a 2.1 artifact with no origin field
- **THEN** it renders the report without an error and shows each finding as `not-assessed`

### Requirement: Rules come from the base when the change edits them
In a diff-scoped review, when a rule source at the head is different from the same rule source at the base, the reviewer SHALL judge the change by the base version. A rule source that the change adds SHALL NOT permit a deviation in the same change. Rule sources are project instruction files, architecture documents, ADRs, the rule registry, linter, formatter, and type-checker configuration, import contracts, and the gate definition.

#### Scenario: Change adds an ADR that permits its own deviation
- **WHEN** a change breaks a layer rule and adds an ADR that permits the break
- **THEN** the reviewer reports the break as a finding and says that the change also adds the ADR

#### Scenario: Change relaxes a lint rule
- **WHEN** a change disables a lint rule and adds code that the rule forbids
- **THEN** the reviewer judges the code by the base configuration

#### Scenario: Rule sources are unchanged
- **WHEN** no rule source is different between the base and the head
- **THEN** the reviewer reads the rule sources from the working tree

#### Scenario: OpenSpec artifacts of the change
- **WHEN** the change includes its own OpenSpec proposal, design, and delta specs
- **THEN** the reviewer reads them from the working tree as the statement of intent

#### Scenario: No base is available
- **WHEN** the scope has no base, or the directory is not a git repository
- **THEN** the reviewer reads the rule sources from the working tree and states that in its output

### Requirement: Rule changes are listed for a person
When a change adds, edits, or deletes a rule source, the review output SHALL list each such file with one line that says what the edit permits or forbids. The `code-audit` artifact SHALL hold the list as data. The `structure-review` report SHALL hold it as a section.

#### Scenario: Change edits the project instruction file
- **WHEN** a change edits `AGENTS.md`
- **THEN** the review output lists `AGENTS.md` and says what the edit permits or forbids

#### Scenario: No rule source changed
- **WHEN** a change edits no rule source
- **THEN** the list is empty and the output says so

### Requirement: The default base is the repository default branch
When the user gives no base, each review skill SHALL use the default branch of the repository as the base. When it cannot find the default branch, it SHALL use `main`. The output SHALL state the base that was used.

#### Scenario: Default branch is not main
- **WHEN** the default branch of the repository is `develop` and the user gives no base
- **THEN** the review uses `develop` as the base

#### Scenario: User gives a base
- **WHEN** the user names a base
- **THEN** the review uses that base

#### Scenario: Default branch cannot be found
- **WHEN** the repository has no remote and no recorded default branch
- **THEN** the review uses `main` and states the base in its output

### Requirement: A review result is bound to one commit
Each review skill SHALL record the commit and the state of the working tree when the review starts. Before it writes its output, it SHALL compare them with the current commit and state. When they are different, it SHALL mark the output as stale and SHALL state the two commits. The output files of the review skills SHALL NOT count as a change.

#### Scenario: Commit lands during the review
- **WHEN** a new commit is made after the review starts and before the output is written
- **THEN** the output is marked stale and names the start commit and the current commit

#### Scenario: Working tree edited during the review
- **WHEN** a tracked file changes after the review starts and the commit is the same
- **THEN** the output is marked stale

#### Scenario: Nothing changed
- **WHEN** the commit and the working tree are the same at the start and at the end
- **THEN** the output is not marked stale

#### Scenario: The review writes its own report
- **WHEN** the only new files are under the output directories of the review skills
- **THEN** the output is not marked stale

### Requirement: A stale review does not clear a block
The `orchestrate` skill SHALL NOT accept a review as the review of the current change when the review output is marked stale, or when the commit of the review is not the current commit. It SHALL dispatch the review again.

#### Scenario: Stale re-review
- **WHEN** a re-review returns `approve` and its output is marked stale
- **THEN** the orchestrator does not clear the block and dispatches the re-review again

#### Scenario: Fix lands after an approval
- **WHEN** a slice changes code after a review approved the change
- **THEN** the orchestrator does not report the change as reviewed until a review of the new commit returns

### Requirement: The verdict states its reason
Each review output SHALL state the reason for its verdict in one sentence and SHALL name the findings or fix-list items that decide it.

#### Scenario: Request for changes
- **WHEN** a `code-audit` verdict is `request_changes`
- **THEN** the artifact has a reason that names the blocking finding identifiers

#### Scenario: Approval with comments
- **WHEN** a verdict is `approve_with_comments`
- **THEN** the reason says why no finding blocks

### Requirement: A lesson becomes a rule after two occurrences
`structure-review` SHALL propose a new rule only when the same problem occurred in a minimum of two changes and its trigger can be read from a diff. The proposal SHALL state the trigger, the check, and the changes in which the problem occurred. The reviewer SHALL NOT write the rule.

#### Scenario: Second occurrence
- **WHEN** a problem in this change is also in an earlier review report
- **THEN** the report proposes a rule with its trigger, its check, and the two sources

#### Scenario: First occurrence
- **WHEN** a problem has no earlier occurrence
- **THEN** the report gives the fix for the instance and proposes no rule

#### Scenario: Trigger cannot be read from a diff
- **WHEN** a repeated problem can only be seen with knowledge that is not in a diff
- **THEN** the report proposes no rule and says why

### Requirement: Reviewer receipts carry origin, rule changes, and stale state
Every variant of the `code-auditor` and `structure-reviewer` agents SHALL state in its receipt the count of findings for each origin, the list of rule sources that the change edits, the base that was used, and the stale state.

#### Scenario: Receipt of a diff-scoped review
- **WHEN** a reviewer agent returns from a diff-scoped review
- **THEN** its receipt has the counts for each origin, the rule changes or `_none_`, the base, and the stale state

#### Scenario: The three variants agree
- **WHEN** a user compares the receipt templates of the Claude, Codex, and Cursor variants of one reviewer
- **THEN** the three templates have the same fields
