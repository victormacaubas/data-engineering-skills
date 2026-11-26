## Purpose

Defines how a `code-audit` pass is limited to named dimensions, and how a later pass builds on an earlier artifact: what a re-review reads, what it records for each earlier finding, and where its verdict comes from.

## Requirements

### Requirement: An audit can be limited to named dimensions
`code-audit` SHALL accept a focus of one or more dimensions. It SHALL raise findings for those dimensions only. A dimension that was not reviewed SHALL have no score, and the overall score SHALL use the reviewed dimensions only. The artifact SHALL show which dimensions were reviewed.

#### Scenario: Focus of four dimensions
- **WHEN** the request limits the audit to security, correctness, performance, and error handling
- **THEN** the artifact has findings for those four dimensions only, and the architecture and readability dimensions have no score

#### Scenario: Overall score with a focus
- **WHEN** two of the six dimensions were not reviewed
- **THEN** the overall score is the weighted mean of the four reviewed dimensions, and the formula line shows that divisor

#### Scenario: No focus
- **WHEN** the request gives no focus
- **THEN** the audit reviews the six dimensions as before

### Requirement: A re-review reads the earlier findings and the fix diff only
When the request gives an earlier artifact and asks if its findings were fixed, `code-audit` SHALL NOT do the full review again. It SHALL examine each finding of the earlier artifact, and the diff from the commit of that artifact to the current tree. It SHALL keep the dimension focus of the earlier artifact unless the request gives a different focus.

#### Scenario: Code outside the fix diff
- **WHEN** a file in the original scope has no earlier finding and is not in the fix diff
- **THEN** the re-review does not review that file again

#### Scenario: Focus is kept
- **WHEN** the earlier artifact had a focus of four dimensions and the request gives no focus
- **THEN** the re-review uses the same four dimensions

#### Scenario: Earlier artifact is not found
- **WHEN** the request names an earlier artifact that does not exist
- **THEN** the skill says so and does not report a first review as a re-review

### Requirement: Each earlier finding gets a state and its evidence
For each finding of the earlier artifact, the re-review SHALL record one state: `fixed`, `partially-fixed`, `not-fixed`, `waived`, or `superseded`. It SHALL record the evidence for the state. When the finding has a verification command that the skill is permitted to run, the re-review SHALL run it. A report from the worker that made the fix SHALL NOT be evidence.

#### Scenario: Finding is fixed
- **WHEN** the excerpt of a finding is not in the tree and its verification command passes
- **THEN** the state is `fixed`, and the evidence names the command and its result

#### Scenario: Finding is not fixed
- **WHEN** the excerpt of a finding is in the tree with no change
- **THEN** the state is `not-fixed`

#### Scenario: Code was removed
- **WHEN** other work deleted the function that a finding is in
- **THEN** the state is `superseded`

#### Scenario: Recorded decision not to fix
- **WHEN** the earlier artifact holds a `wontfix` or `deferred` resolution with a note for a finding
- **THEN** the state is `waived`, and the evidence gives the note

#### Scenario: Verification command cannot run
- **WHEN** the verification command of a finding needs the application to start
- **THEN** the re-review does not run it, decides the state from the code, and says that the command did not run

### Requirement: The fix diff gets a normal review
The re-review SHALL review the fix diff with the same method as a first review, in the dimension focus. A defect that the fix adds SHALL be a new finding with an identifier that no earlier finding has.

#### Scenario: Fix adds a defect
- **WHEN** a fix for one finding adds a catch-all handler that hides an error
- **THEN** the re-review artifact has a new finding for the handler

#### Scenario: Fix deletes a test
- **WHEN** a fix makes a check pass because it deletes the test
- **THEN** the re-review raises that as a finding

### Requirement: A re-review writes a new artifact
The re-review SHALL write a new artifact and SHALL NOT edit the earlier one. The new artifact SHALL name the earlier artifact and SHALL hold the state of each earlier finding. Its open findings SHALL be the earlier findings with state `not-fixed` or `partially-fixed`, and the new findings. Its verdict and its scores SHALL come from those open findings.

#### Scenario: Each finding is fixed
- **WHEN** each earlier finding is `fixed`, `waived`, or `superseded`, and the fix diff has no new blocking finding
- **THEN** the verdict is not `request_changes`

#### Scenario: A blocking finding stays open
- **WHEN** one earlier High finding is `not-fixed`
- **THEN** the new artifact holds that finding with its earlier identifier, and the verdict is `request_changes`

#### Scenario: Earlier artifact is unchanged
- **WHEN** the re-review ends
- **THEN** the earlier artifact has the same content as before

### Requirement: The comparison option stays
`code-audit` SHALL continue to do a full review with a "since last review" note when the user asks for a comparison with the last review. The skill SHALL say when a comparison applies and when a re-review applies.

#### Scenario: User asks for a comparison
- **WHEN** the user asks to compare the code against the last review
- **THEN** the skill does a full review and adds the note

#### Scenario: User asks if the findings were fixed
- **WHEN** the user or an orchestrator gives an earlier artifact and asks if its findings were fixed
- **THEN** the skill does a re-review

### Requirement: The rendered report shows the focus and the re-review states
The markdown report that `code-audit` renders on request SHALL show a dimension with no score as not reviewed, and SHALL show the state and the evidence of each earlier finding. The renderer SHALL read an artifact that has neither.

#### Scenario: Re-review artifact
- **WHEN** the renderer reads a re-review artifact with a focus of four dimensions
- **THEN** the report shows two dimensions as not reviewed and has a section with the state of each earlier finding

#### Scenario: Artifact from an earlier schema
- **WHEN** the renderer reads an artifact with six scores and no re-review data
- **THEN** it renders the report without an error

### Requirement: The code-auditor brief and receipt carry the focus and the re-review
Every `code-auditor` variant SHALL accept a focus of one or more dimensions and the path of an earlier artifact in its brief. Its receipt SHALL state the mode (`review`, `comparison`, or `re-review`) and the dimensions that were reviewed. For a re-review, the receipt SHALL state the count of earlier findings in each state.

#### Scenario: Brief with an earlier artifact
- **WHEN** the brief gives the path of an earlier artifact and asks if its findings were fixed
- **THEN** the agent does a re-review, and its receipt has the mode `re-review` and the count for each state

#### Scenario: Brief with a focus
- **WHEN** the brief limits the audit to four dimensions
- **THEN** the receipt names those four dimensions

#### Scenario: The three variants agree
- **WHEN** a user compares the input contract and the receipt template of the Claude, Codex, and Cursor variants
- **THEN** the three have the same fields
