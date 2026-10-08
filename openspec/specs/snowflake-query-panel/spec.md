## Purpose

A Claude Code mod that shows, in a pane, the SQL that the main session and its subagents run through the snowflake-raw MCP server, with each query's agent, status, and outcome.

## Requirements

### Requirement: Captures snowflake-raw queries only
The mod SHALL record every call to the `mcp__snowflake-raw__sql_exec_tool` tool made by the main session or any subagent, and SHALL NOT record calls to any other tool. The mod SHALL NOT change, delay beyond recording, or refuse a call, and SHALL NOT run Snowflake queries of its own.

#### Scenario: Main session runs a query
- **WHEN** the main session calls the snowflake-raw SQL tool
- **THEN** the panel shows a row for that call with its SQL

#### Scenario: Another tool runs SQL
- **WHEN** an agent runs SQL through any other tool, such as `Bash`
- **THEN** the panel shows no row for it

#### Scenario: Query result reaches the model unchanged
- **WHEN** a captured query finishes
- **THEN** the agent that called it receives the same result it would without the mod

### Requirement: Each query has a status that follows its call
Each row SHALL show the query as running from when its call starts until it finishes, then as succeeded, with its Snowflake query id, row count, and duration, or as failed, with the error. A row SHALL be updated only by its own call, even when several calls run at the same time and finish in any order.

#### Scenario: Query succeeds
- **WHEN** a captured call returns a result set
- **THEN** its row shows succeeded, the query id, the row count, and the elapsed time

#### Scenario: Query fails
- **WHEN** a captured call returns an error
- **THEN** its row shows failed and the error text

#### Scenario: Concurrent queries finish out of order
- **WHEN** three subagents each run several queries at once and they finish in an order different from the one they started in
- **THEN** every row ends with its own call's outcome
- **AND** no row is lost or shows another call's outcome

### Requirement: Rows are attributed to the agent that ran them
Each row SHALL name the agent loop that made the call: the main session, or the subagent by its type and its name or description, so that several subagents of the same type are told apart. When the agent is not one the session lists, the row SHALL show a short form of its id.

#### Scenario: Three pathfinders run queries
- **WHEN** three `pathfinder` subagents with different descriptions each run a query
- **THEN** the panel shows three distinct agent labels

#### Scenario: Unlisted agent runs a query
- **WHEN** a call comes from an agent loop the session does not list
- **THEN** its row is labelled with a short form of the loop's id

### Requirement: Rows are grouped by agent and capped at ten
The panel SHALL group rows under their agent and SHALL keep only the ten most recently started queries for the session, dropping the oldest when an eleventh starts. Query history SHALL NOT persist past the session.

#### Scenario: Eleventh query starts
- **WHEN** ten queries are recorded and another starts
- **THEN** the oldest recorded query is removed and the new one is shown

#### Scenario: New session starts
- **WHEN** a new Claude Code session starts
- **THEN** the panel holds no queries from an earlier session

### Requirement: Rows expand to the full SQL
Each row SHALL show a shortened form of its SQL and SHALL expand to the full statement when the person selects it, collapsing again when selected a second time.

#### Scenario: Person expands a long query
- **WHEN** the person selects a row whose SQL is longer than the row
- **THEN** the full SQL is shown under it

### Requirement: Pane opens on the first query and can be opened by hand
The mod SHALL open its pane when the first captured query of the session starts, and SHALL provide a slash command that opens it. When an automatic open leaves the pane undrawn, the mod SHALL show a toast saying how to see it.

#### Scenario: First query on a wide terminal
- **WHEN** the first captured query starts and the terminal is wide enough for a pane the mod opens on its own
- **THEN** the pane is drawn

#### Scenario: First query on a narrow terminal
- **WHEN** the first captured query starts and the pane is left undrawn
- **THEN** a toast tells the person to widen the terminal or run the slash command

#### Scenario: Person runs the slash command
- **WHEN** the person runs the mod's slash command
- **THEN** the pane is drawn at the current terminal width

### Requirement: Past queries stay visible under a summary line
The pane SHALL show a summary line above the grouped rows, with the number of queries recorded and either how many are running or the outcome of the most recent. Finished queries SHALL stay in the grouped view and stay expandable after every query has finished.

#### Scenario: Last running query finishes
- **WHEN** the last running query finishes
- **THEN** the summary line shows the number of queries recorded and the outcome of the most recent
- **AND** every recorded query is still listed under its agent

#### Scenario: Person expands a past query
- **WHEN** no query is running and the person selects a finished row
- **THEN** its full SQL is shown under it

#### Scenario: Queries are running
- **WHEN** one or more captured queries are running
- **THEN** the summary line shows how many are running
