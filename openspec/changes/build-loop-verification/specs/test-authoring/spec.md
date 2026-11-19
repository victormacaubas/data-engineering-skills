# Spec Delta

## ADDED Requirements

### Requirement: Property-based tests for law scenarios
`test-author` SHALL write a property-based test when a scenario states a law (round-trip, invariant, idempotency, or equivalence) and the project declares a property-testing library. The test SHALL give the same result on each run. When the project declares no such library, `test-author` SHALL write an example-based test for the cases that the scenario states and SHALL report the missing library. It SHALL NOT add a dependency.

#### Scenario: Round-trip scenario with a library declared
- **WHEN** a scenario states that decode of encode returns the input, and the project declares a property-testing library
- **THEN** `test-author` writes one property-based test for that scenario

#### Scenario: No library declared
- **WHEN** a scenario states an invariant and the project declares no property-testing library
- **THEN** `test-author` writes an example-based test for the stated cases, reports the missing library, and adds no dependency

#### Scenario: Repeatable runs
- **WHEN** the same property-based test runs two times on unchanged code
- **THEN** the two runs generate the same inputs and give the same result

#### Scenario: Scenario states no law
- **WHEN** a scenario gives specific inputs and outputs and states no law
- **THEN** `test-author` writes an example-based test and no property-based test

### Requirement: Differential tests use a named oracle
When the brief names an oracle, an input source, the normalization, and the approved differences for a scenario, `test-author` SHALL write a test that gives the same inputs to the oracle and to the new implementation and compares the normalized outputs. The oracle SHALL be an existing implementation that the brief names. The code under test SHALL NOT be the source of an expected value.

#### Scenario: Oracle named
- **WHEN** the brief names the old implementation as the oracle and gives an input source
- **THEN** `test-author` writes a test that compares the new output with the oracle output for those inputs

#### Scenario: No oracle named
- **WHEN** a scenario says that new behavior must match old behavior and the brief names no oracle
- **THEN** `test-author` reports the scenario as blocked and writes no test

#### Scenario: Approved difference
- **WHEN** the brief lists a difference as approved
- **THEN** the difference is recorded as test data with its reason, and the test ignores that difference only

#### Scenario: Difference that is not approved
- **WHEN** the new implementation and the oracle give different normalized outputs for an input, and the difference is not approved
- **THEN** the test fails and shows the input and the two outputs

### Requirement: Orchestrate briefs differential scenarios
For each scenario that requires new behavior to match existing behavior, the `orchestrate` skill SHALL give `test-author` the oracle seam, the input source, the normalization, and the approved differences. When the plan does not state them, the orchestrator SHALL get them before it dispatches `test-author`.

#### Scenario: Plan states the oracle
- **WHEN** a migration task names the old function as the reference
- **THEN** the `test-author` brief contains the oracle seam, the input source, the normalization, and the approved differences

#### Scenario: Plan does not state the oracle
- **WHEN** a scenario says "same results as before" and the plan names no reference implementation
- **THEN** the orchestrator settles the oracle in pre-flight before it dispatches `test-author`

### Requirement: Flaky tests are fixed or deleted
`test-author` SHALL NOT use a skip marker, an expected-failure marker, a sleep, or a retry to make a test pass. When a test is reported as flaky, `test-author` SHALL find the cause and fix the test. When it cannot find the cause, it SHALL delete the test and SHALL report the reason and the scenario that has no test.

#### Scenario: Cause found
- **WHEN** a flaky test depends on test order and `test-author` finds that dependency
- **THEN** `test-author` removes the dependency and the test gives the same result on each run

#### Scenario: Cause not found
- **WHEN** `test-author` cannot find why a test gives different results
- **THEN** it deletes the test, and its report states the reason and names the scenario that has no test

#### Scenario: No markers that hide a failure
- **WHEN** a user reads a test that `test-author` wrote or changed for a flaky report
- **THEN** the test has no skip marker, no expected-failure marker, no sleep, and no retry

#### Scenario: Deleted test is not a pass
- **WHEN** `test-author` deletes a flaky test
- **THEN** the orchestrator records the scenario as not covered in the tracking artifact and in the closing summary
