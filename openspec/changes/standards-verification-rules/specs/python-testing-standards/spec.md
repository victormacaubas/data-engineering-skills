# Spec Delta

## Purpose

Defines the test rules of the `python-engineering-standards` skill that keep a test suite honest: when a property-based test is necessary, how it stays repeatable, what a writer does with a flaky test, which tests the default run selects, and when the full gate runs.

## ADDED Requirements

### Requirement: Property-based tests for code with a law
The Python standard SHALL direct the writer to add a property-based test when code has a law: a round-trip, an invariant, idempotency, or equivalence with a simpler implementation. The hand-written tests for named edge cases SHALL stay.

#### Scenario: Serializer and parser
- **WHEN** the writer adds a function that serializes a record and a function that parses it
- **THEN** the standard directs a property-based test that parse of serialize returns the record

#### Scenario: Optimized function
- **WHEN** the writer replaces a slow function with a fast one that must give the same result
- **THEN** the standard directs a property-based test that compares the two functions on generated inputs

#### Scenario: Idempotent operation
- **WHEN** the writer adds a normalization or a retry-safe write
- **THEN** the standard directs a property-based test that a second application changes nothing

#### Scenario: Named edge cases
- **WHEN** the code has known edge cases such as empty input or duplicate keys
- **THEN** the standard still directs an explicit test for each one

#### Scenario: Code with no law
- **WHEN** the code has no round-trip, invariant, idempotency, or equivalence to state
- **THEN** the standard does not direct a property-based test

### Requirement: Property-based tests are repeatable in the default run
The Python standard SHALL direct a configuration in which a property-based test generates the same inputs on each default run. It MAY describe a second profile with new inputs on each run for use outside the gate.

#### Scenario: Two default runs
- **WHEN** the default test command runs two times on unchanged code
- **THEN** each property-based test gives the same result in the two runs

#### Scenario: Search profile
- **WHEN** a writer wants more generated inputs than the default run uses
- **THEN** the standard names a separate profile that is not part of the gate

### Requirement: The standard does not add a test dependency without a request
When the project does not declare a property-testing library, the Python standard SHALL direct the writer to recommend the library and to write example-based tests for the stated cases. It SHALL NOT direct the writer to add the dependency.

#### Scenario: Library is not declared
- **WHEN** the project dependencies do not include a property-testing library
- **THEN** the writer recommends it to the user and adds no dependency

#### Scenario: Library is declared
- **WHEN** the project dependencies include a property-testing library
- **THEN** the writer uses it

### Requirement: Flaky tests are fixed or deleted
The Python standard SHALL forbid a skip marker, an expected-failure marker, a sleep, or an automatic rerun as a method to make a test pass. It SHALL direct the writer to find and fix the cause of a flaky test. When the cause cannot be found, it SHALL direct the writer to delete the test and to record the reason.

#### Scenario: Test fails one time in ten
- **WHEN** a test gives different results on identical runs
- **THEN** the standard directs the writer to find the cause, and not to add a rerun or a sleep

#### Scenario: Cause cannot be found
- **WHEN** the writer cannot find the cause
- **THEN** the standard directs the writer to delete the test and to record why and which behavior now has no test

#### Scenario: Production retries are not affected
- **WHEN** production code retries a transient error
- **THEN** the retry rules of the standard for production code apply as before

### Requirement: Timing-dependent tests stay out of the default run
The Python standard SHALL direct that a test whose result depends on thread timing or on load, such as a stress test, has a marker and does not run in the default test command.

#### Scenario: Stress test with many threads
- **WHEN** the writer adds a stress test for a concurrency defect
- **THEN** the test has a marker, and the default test command does not select it

### Requirement: The default test run deselects integration tests
The pytest configuration that the Python standard gives SHALL deselect the tests with the `integration` marker in the default run. The standard SHALL give the explicit command that selects the integration lane.

#### Scenario: Default run with an integration test present
- **WHEN** a project uses the configuration of the standard, has one test with the `integration` marker, and runs the default test command
- **THEN** the run does not select that test

#### Scenario: Integration lane
- **WHEN** a contributor runs the test command with the `integration` marker selected
- **THEN** the run selects the integration tests

#### Scenario: Description and configuration agree
- **WHEN** a user reads the pytest example of the standard
- **THEN** each marker that the text calls excluded from the default run is deselected by the configuration

### Requirement: The full gate runs locally before a push
The Python standard SHALL direct three tiers of checks: fast checks on each commit, the full gate on the local machine before a push or a pull request, and the same gate in CI. The full gate SHALL include the type check and the default test run. The standard SHALL NOT describe CI as the first place where the type check or the test suite runs.

#### Scenario: Commit
- **WHEN** a contributor makes a commit in a project that uses the hook configuration of the standard
- **THEN** only the fast checks run

#### Scenario: Push
- **WHEN** a contributor pushes in a project that uses the hook configuration of the standard
- **THEN** the full gate runs on the local machine before the push completes

#### Scenario: CI
- **WHEN** CI runs for a pushed change
- **THEN** it runs the same gate that ran on the local machine

#### Scenario: No sentence leaves the suite to CI only
- **WHEN** a user reads the hook guidance of the standard
- **THEN** no sentence tells the writer to leave the type check or the full test suite to CI

#### Scenario: Project with no gate command
- **WHEN** the project has no single gate command
- **THEN** the standard directs the type check and the default test command as the local run before a push
