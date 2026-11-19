# Spec Delta

## Purpose

Defines how the `sql-data-analysis` skill verifies that a rewritten query, an optimized query, or a migrated model returns the same rows as the original, with the exception of differences that the request intends.

## ADDED Requirements

### Requirement: A rewrite is compared with the original in both directions
When the skill rewrites existing SQL and the result must stay the same, it SHALL give a comparison that finds rows that are only in the original, rows that are only in the rewrite, and rows that occur a different number of times. The comparison SHALL treat two null values in the same column as equal.

#### Scenario: Rewrite drops rows
- **WHEN** the rewrite returns fewer rows than the original
- **THEN** the comparison shows the rows that are only in the original

#### Scenario: Rewrite adds rows
- **WHEN** the rewrite returns rows that the original does not return
- **THEN** the comparison shows the rows that are only in the rewrite

#### Scenario: Rewrite changes duplicate counts
- **WHEN** a join in the rewrite returns one row two times and the original returns it one time
- **THEN** the comparison shows the row with the two counts

#### Scenario: Null values in compared columns
- **WHEN** the original and the rewrite return the same row with a null value in one column
- **THEN** the comparison does not show the row as a difference

#### Scenario: Set difference is not sufficient
- **WHEN** a user reads the rewrite guidance of the skill
- **THEN** it does not give a set difference that removes duplicates as a sufficient check

### Requirement: Normalization is stated
The skill SHALL state each normalization that the comparison applies before it compares rows. A column that is excluded from the comparison SHALL be named with the reason.

#### Scenario: Load timestamp column
- **WHEN** the two results have a load timestamp that is different on each run
- **THEN** the comparison excludes that column, and the response names the column and the reason

#### Scenario: Floating-point values
- **WHEN** the two results have floating-point aggregates
- **THEN** the comparison rounds them to a stated precision

#### Scenario: No normalization
- **WHEN** the comparison applies no normalization
- **THEN** the response says that the comparison uses all columns as they are

### Requirement: Intended differences are listed and excluded exactly
When the request intends the rewrite to return different rows, the skill SHALL list each intended difference. The comparison SHALL exclude those differences only. The skill SHALL report each other difference as a defect.

#### Scenario: Bug fix that removes duplicate rows
- **WHEN** the request is to remove a join fan-out and the rewrite returns each order one time
- **THEN** the response lists the removed duplicates as intended, and the comparison shows no other difference

#### Scenario: Difference that is not intended
- **WHEN** the comparison shows a difference that is not in the list
- **THEN** the response reports it as a defect and does not present the rewrite as equivalent

### Requirement: Incremental logic is checked for idempotency
For incremental or merge logic, the skill SHALL give a check that runs the load two times on the same input and compares the table after the first run with the table after the second run. The check SHALL use the same comparison as a rewrite.

#### Scenario: Second run adds rows
- **WHEN** the second run on the same input adds rows to the table
- **THEN** the check shows the added rows, and the response reports that the load is not idempotent

#### Scenario: Second run changes nothing
- **WHEN** the second run on the same input leaves the table the same
- **THEN** the response reports the check and its result

### Requirement: The response reports the result of the comparison
When the skill can query the warehouse, it SHALL run the comparison and SHALL report the counts that it returned. When it cannot, it SHALL give the comparison query and SHALL state that the comparison did not run. It SHALL NOT describe a rewrite as verified when the comparison did not run.

#### Scenario: Warehouse access is available
- **WHEN** the skill can run queries
- **THEN** the response states the count of rows only in the original, rows only in the rewrite, and rows with a different count

#### Scenario: No warehouse access
- **WHEN** the skill cannot run queries
- **THEN** the response gives the comparison query and says that it did not run

### Requirement: The compared input is stated
The skill SHALL state the input that the comparison used: the full relation, or a sample with its filter. For a large relation, it SHALL do a low-cost check before the row-level comparison.

#### Scenario: Sample of a large table
- **WHEN** the comparison uses one date partition of a large table
- **THEN** the response names the partition filter

#### Scenario: Low-cost check first
- **WHEN** the relation is large
- **THEN** the skill compares row counts or an aggregate fingerprint first, and does the row-level comparison when they are different or when the user asks for it

### Requirement: Invariants are named as candidate tests
For a dbt model, the skill SHALL name the invariants that the model must keep, such as the unique grain and the keys that are not null. It SHALL NOT add a test or a `schema.yml` entry that the request did not ask for.

#### Scenario: New model with a stated grain
- **WHEN** the skill writes a model with one row for each order
- **THEN** the response names the uniqueness of the order key as a candidate test and adds no test file

#### Scenario: Request asks for tests
- **WHEN** the request asks for tests with the model
- **THEN** the skill writes the tests for the named invariants
