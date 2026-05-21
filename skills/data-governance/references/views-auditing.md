# Auditing Views — Column Reference

## ACCESS_HISTORY

| Column | Type | Description |
|--------|------|-------------|
| QUERY_ID | VARCHAR | Query identifier (joins with QUERY_HISTORY) |
| QUERY_START_TIME | TIMESTAMP_LTZ | Statement start time (UTC) |
| USER_NAME | VARCHAR | User who issued the query |
| DIRECT_OBJECTS_ACCESSED | ARRAY | Objects directly named in the query |
| BASE_OBJECTS_ACCESSED | ARRAY | All base objects needed for execution |
| OBJECTS_MODIFIED | ARRAY | Objects involved in write operations |
| OBJECT_MODIFIED_BY_DDL | OBJECT | DDL operation details |
| POLICIES_REFERENCED | ARRAY | Enforced policies on accessed objects |
| PARENT_QUERY_ID | VARCHAR | Parent job query ID |
| ROOT_QUERY_ID | VARCHAR | Root job query ID |
| EVENT_SOURCE | VARCHAR | snowflake_sql or horizon_irc |
| ADDITIONAL_PROPERTIES | VARIANT | Operational metadata |

**Latency:** up to 3 hours. **Retention:** 365 days.
**Requires:** Enterprise Edition or higher.

### Array column structures

**DIRECT_OBJECTS_ACCESSED / BASE_OBJECTS_ACCESSED:**
```json
[{
  "objectId": 12345,
  "objectName": "DB.SCHEMA.TABLE",
  "objectDomain": "TABLE",
  "columns": [
    {"columnId": 1, "columnName": "COL1"},
    {"columnId": 2, "columnName": "COL2"}
  ]
}]
```

**OBJECTS_MODIFIED:**
```json
[{
  "objectId": 12345,
  "objectName": "DB.SCHEMA.TABLE",
  "objectDomain": "TABLE",
  "columns": [
    {"columnId": 1, "columnName": "COL1"}
  ]
}]
```

**OBJECT_MODIFIED_BY_DDL:**
```json
{
  "objectId": 12345,
  "objectName": "DB.SCHEMA.POLICY_NAME",
  "objectDomain": "MASKING_POLICY",
  "operationType": "CREATE"
}
```

**POLICIES_REFERENCED:**
```json
[{
  "policyName": "DB.SCHEMA.MASK_EMAIL",
  "policyDomain": "MASKING_POLICY",
  "columns": [
    {"columnName": "EMAIL"}
  ]
}]
```

### Key limitations
- Failed queries are NOT logged (use QUERY_HISTORY)
- Intermediate views between base and direct objects are not shown
- Stream operations not logged
- Replication data movement not logged
- Snowflake-internal views (ACCOUNT_USAGE, ORGANIZATION_USAGE) not logged
- Records may be truncated when exceeding size limits

### Performance tips
- Always filter on `QUERY_START_TIME`
- Use narrow date ranges (start with 1-7 days)
- When joining with QUERY_HISTORY, filter both sides on time

---

## QUERY_HISTORY

| Column | Type | Description |
|--------|------|-------------|
| QUERY_ID | VARCHAR | Query identifier |
| QUERY_TEXT | VARCHAR | SQL text (truncated at 100K chars) |
| DATABASE_NAME | VARCHAR | Database context |
| SCHEMA_NAME | VARCHAR | Schema context |
| QUERY_TYPE | VARCHAR | DML type (SELECT, INSERT, CREATE_TABLE, etc.) |
| SESSION_ID | NUMBER | Session identifier |
| USER_NAME | VARCHAR | User who ran the query |
| ROLE_NAME | VARCHAR | Active role |
| WAREHOUSE_NAME | VARCHAR | Execution warehouse |
| WAREHOUSE_SIZE | VARCHAR | Warehouse size |
| WAREHOUSE_TYPE | VARCHAR | STANDARD or SNOWPARK_OPTIMIZED |
| CLUSTER_NUMBER | NUMBER | Cluster that ran the query |
| QUERY_TAG | VARCHAR | Query tag (if set) |
| EXECUTION_STATUS | VARCHAR | success, fail, or incident |
| ERROR_CODE | NUMBER | Error code on failure |
| ERROR_MESSAGE | VARCHAR | Error message (truncated at 5K chars) |
| START_TIME | TIMESTAMP_LTZ | Start time |
| END_TIME | TIMESTAMP_LTZ | End time |
| TOTAL_ELAPSED_TIME | NUMBER | Duration in milliseconds |
| BYTES_SCANNED | NUMBER | Bytes scanned |
| ROWS_PRODUCED | NUMBER | Rows returned |
| COMPILATION_TIME | NUMBER | Compilation time (ms) |
| EXECUTION_TIME | NUMBER | Execution time (ms) |
| QUEUED_PROVISIONING_TIME | NUMBER | Time queued for warehouse (ms) |
| QUEUED_OVERLOAD_TIME | NUMBER | Time queued due to overload (ms) |
| TRANSACTION_BLOCKED_TIME | NUMBER | Time blocked by transactions (ms) |
| OUTBOUND_DATA_TRANSFER_CLOUD | VARCHAR | Cloud target for data transfer |
| OUTBOUND_DATA_TRANSFER_REGION | VARCHAR | Region target for data transfer |
| OUTBOUND_DATA_TRANSFER_BYTES | NUMBER | Bytes transferred |
| CREDITS_USED_CLOUD_SERVICES | FLOAT | Cloud services credits |
| RELEASE_VERSION | VARCHAR | Snowflake release |
| EXTERNAL_FUNCTION_TOTAL_INVOCATIONS | NUMBER | External function calls |
| EXTERNAL_FUNCTION_TOTAL_SENT_ROWS | NUMBER | Rows sent to external functions |
| EXTERNAL_FUNCTION_TOTAL_RECEIVED_ROWS | NUMBER | Rows received from external functions |
| IS_CLIENT_GENERATED_STATEMENT | BOOLEAN | Client-generated (e.g., driver metadata) |
| QUERY_HASH | VARCHAR | Query hash (for grouping similar queries) |
| QUERY_HASH_VERSION | NUMBER | Hash algorithm version |
| QUERY_PARAMETERIZED_HASH | VARCHAR | Parameterized query hash |
| QUERY_PARAMETERIZED_HASH_VERSION | NUMBER | Parameterized hash version |

**Latency:** up to 45 minutes. **Retention:** 365 days.

### Performance tips
- Always filter on `START_TIME`
- For auditing, combine with ACCESS_HISTORY via `QUERY_ID`
- Canceled queries: `ERROR_MESSAGE` contains 'SQL execution canceled' (not reflected in `EXECUTION_STATUS`)
- Short hybrid-table-only queries may not appear — use AGGREGATE_QUERY_HISTORY
