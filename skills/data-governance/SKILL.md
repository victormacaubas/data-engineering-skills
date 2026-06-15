---
name: data-governance
description: Deep reference for querying Snowflake's SNOWFLAKE.ACCOUNT_USAGE schema to answer data governance questions — masking policies, row access policies, classification, tags, access history, role/grant hierarchies, login auditing, and query auditing. Use this skill whenever the user asks about Snowflake governance, security posture, data access patterns, policy coverage, role analysis, user auditing, classification status, or any question that requires querying ACCOUNT_USAGE views via the Snowflake MCP. Also use when the user mentions masking, tagging, RBAC, access history, login history, or policy references in a Snowflake context.
---

# Snowflake ACCOUNT_USAGE Governance Skill

You have access to the Snowflake MCP tool (`mcp__snowflake__run_snowflake_query`). This skill teaches you which views to query and how to write effective governance queries against `SNOWFLAKE.ACCOUNT_USAGE`.

## How to Use This Skill

When the user asks a governance question:

1. **Ask which data source to use** (see below)
2. Identify which views/tables answer the question (use the Intent → View mapping below)
3. Show the query with a one-line explanation of what it does
4. Run the query via the Snowflake MCP
5. Summarize the results in plain language, highlighting anything that looks unusual or noteworthy

## Data Source: Archive vs Live Views

There are two sources for account_usage data:

| Source | Path | Type | Freshness | Speed |
|--------|------|------|-----------|-------|
| **Archive** | `GOVERNANCE_DB.ACCOUNT_USAGE_ARCHIVE.<view_name>` | Tables | Refreshed weekly | Fast (tables, no view overhead) |
| **Live** | `SNOWFLAKE.ACCOUNT_USAGE.<view_name>` | Views | Up to 2-3 hours latency | Slower (views over internal metadata) |

The archive tables have the same schema and column names as the live views. They're materialized once a week, so they won't have the very latest data but queries return much faster.

**Temporal routing — assess the time period first:**

Live views retain only 365 days of data. Before choosing a source, look at when the events you're investigating occurred:

- **Within the last 10 months:** safe to use live views — data is well within retention.
- **10–12 months ago:** use live views, but you're near the retention edge. If results come back empty or suspiciously sparse for a query that should have data, fall back to archive immediately.
- **Older than 12 months:** go directly to archive tables. Live views cannot have this data — don't waste a query round-trip on them.

This applies to time-scoped views like QUERY_HISTORY, ACCESS_HISTORY, and LOGIN_HISTORY. Metadata views (TABLES, COLUMNS, ROLES, GRANTS_TO_ROLES, etc.) retain current state plus deletion records regardless of age — those are fine to query live.

**Mid-investigation pivot:** The user's initial framing may point to a recent timeframe, but your queries might reveal that the actual root event happened much earlier (e.g., user says "stopped working in June" but you discover the table was dropped 16 months ago). When this happens, re-evaluate immediately — if the newly discovered event falls outside the 365-day window, switch to archive tables for that line of inquiry without waiting for the user to suggest it. State what you found and why you're switching sources.

**If the time period is within retention, ask the user:**
> "Should I query the archive tables (`GOVERNANCE_DB.ACCOUNT_USAGE_ARCHIVE`) for faster results, or the live views (`SNOWFLAKE.ACCOUNT_USAGE`) for the most current data?"

**Rules:**
- If the user says archive, prefix all table references with `GOVERNANCE_DB.ACCOUNT_USAGE_ARCHIVE.`
- If the user says live (or needs real-time data), prefix with `SNOWFLAKE.ACCOUNT_USAGE.`
- If an archive query fails (table not found, permission error, etc.), **automatically fall back to the live view** and let the user know: "Archive query failed, falling back to SNOWFLAKE.ACCOUNT_USAGE."
- If the user already told you which source to use earlier in the conversation, don't ask again.
- If you routed directly to archive based on temporal reasoning, tell the user why: "The event is older than 12 months, so I'm querying the archive tables directly (live views only retain 365 days)."

## Critical Caveats

| Fact | Detail |
|------|--------|
| **Latency** | Most views have up to 2-hour latency. ACCESS_HISTORY is up to 3 hours. QUERY_HISTORY is up to 45 minutes. DATA_CLASSIFICATION_LATEST is up to 3 hours. |
| **Retention** | 365 days for all views. |
| **Required privilege** | The querying role needs IMPORTED PRIVILEGES on the SNOWFLAKE database (typically ACCOUNTADMIN, or a custom role with the grant). |
| **Performance** | Always filter on time columns (`QUERY_START_TIME`, `EVENT_TIMESTAMP`, `CREATED_ON`, etc.) to avoid full scans. Use narrow date ranges. |
| **Failed queries** | ACCESS_HISTORY does NOT log failed queries. Check QUERY_HISTORY for those. |
| **Tag inheritance** | TAG_REFERENCES does NOT show inherited tags — only direct assignments. |
| **Enterprise features** | ACCESS_HISTORY and DATA_CLASSIFICATION require Enterprise Edition or higher. |

## Intent → View Mapping

Use this to pick the right view(s) for the user's question:

| User intent | Primary view(s) | Join with |
|---|---|---|
| Who accessed what data? | `ACCESS_HISTORY` | `QUERY_HISTORY` (for query text) |
| What masking policies exist? | `MASKING_POLICIES` | — |
| Where are masking policies applied? | `POLICY_REFERENCES` (filter `POLICY_KIND = 'MASKING_POLICY'`) | `MASKING_POLICIES` |
| What row access policies exist? | `ROW_ACCESS_POLICIES` | — |
| Where are row access policies applied? | `POLICY_REFERENCES` (filter `POLICY_KIND = 'ROW_ACCESS_POLICY'`) | — |
| What columns/tables are unprotected? | `COLUMNS` + LEFT JOIN `POLICY_REFERENCES` (where null) | `TABLES` |
| What tags exist? | `TAGS` | — |
| What objects are tagged? | `TAG_REFERENCES` | — |
| What's classified? | `DATA_CLASSIFICATION_LATEST` | `TAG_REFERENCES` |
| What roles exist and who owns them? | `ROLES` | — |
| What privileges does a role have? | `GRANTS_TO_ROLES` | — |
| What roles does a user have? | `GRANTS_TO_USERS` | `USERS` |
| Who logged in and when? | `LOGIN_HISTORY` | — |
| Failed login attempts? | `LOGIN_HISTORY` (filter `IS_SUCCESS = 'NO'`) | — |
| What queries did a user run? | `QUERY_HISTORY` | — |
| What DDL changed policies/tags? | `ACCESS_HISTORY` → `OBJECT_MODIFIED_BY_DDL` column | — |
| Network policies? | `NETWORK_POLICIES` | `NETWORK_RULES`, `NETWORK_RULE_REFERENCES` |
| Users with no MFA? | `USERS` (filter `HAS_MFA = FALSE`) | — |
| Dormant users? | `USERS` + `LOGIN_HISTORY` | — |
| Privilege escalation? | `GRANTS_TO_ROLES` (filter `GRANT_OPTION = TRUE`) | — |

## Core Governance Views

### Security & Access Control

| View | Purpose | Key time column |
|------|---------|-----------------|
| `USERS` | All user accounts, status, auth config | `CREATED_ON` |
| `ROLES` | All roles (account, database, app) | `CREATED_ON` |
| `GRANTS_TO_ROLES` | Privileges granted to roles | `CREATED_ON` |
| `GRANTS_TO_USERS` | Roles assigned to users | `CREATED_ON` |
| `LOGIN_HISTORY` | Authentication events | `EVENT_TIMESTAMP` |
| `SESSIONS` | Session metadata | — |
| `NETWORK_POLICIES` | Network access rules | `CREATED_ON` |

### Data Protection

| View | Purpose | Key time column |
|------|---------|-----------------|
| `MASKING_POLICIES` | Dynamic data masking definitions | `CREATED` |
| `ROW_ACCESS_POLICIES` | Row-level security definitions | `CREATED` |
| `POLICY_REFERENCES` | Policy-to-object assignments | — (no time col, but POLICY_STATUS is key) |
| `TAGS` | Tag definitions | `CREATED` |
| `TAG_REFERENCES` | Tag-to-object assignments | — |
| `DATA_CLASSIFICATION_LATEST` | Auto/manual classification results | `LAST_CLASSIFIED_ON` |

### Auditing

| View | Purpose | Key time column |
|------|---------|-----------------|
| `ACCESS_HISTORY` | Who read/wrote what objects | `QUERY_START_TIME` |
| `QUERY_HISTORY` | All queries executed | `START_TIME` |

## Common Query Patterns

### 1. Columns missing masking policies

```sql
SELECT
    c.TABLE_CATALOG AS database_name,
    c.TABLE_SCHEMA AS schema_name,
    c.TABLE_NAME,
    c.COLUMN_NAME,
    c.DATA_TYPE
FROM SNOWFLAKE.ACCOUNT_USAGE.COLUMNS c
LEFT JOIN SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES pr
    ON pr.REF_DATABASE_NAME = c.TABLE_CATALOG
    AND pr.REF_SCHEMA_NAME = c.TABLE_SCHEMA
    AND pr.REF_ENTITY_NAME = c.TABLE_NAME
    AND pr.REF_COLUMN_NAME = c.COLUMN_NAME
    AND pr.POLICY_KIND = 'MASKING_POLICY'
WHERE pr.POLICY_NAME IS NULL
    AND c.DELETED IS NULL
    AND c.TABLE_SCHEMA != 'INFORMATION_SCHEMA'
ORDER BY c.TABLE_CATALOG, c.TABLE_SCHEMA, c.TABLE_NAME;
```

### 2. Sensitive columns (classified) without masking

```sql
SELECT
    dcl.DATABASE_NAME,
    dcl.SCHEMA_NAME,
    dcl.TABLE_NAME,
    f.key AS column_name,
    f.value:privacy_category::STRING AS privacy_category,
    f.value:semantic_category::STRING AS semantic_category
FROM SNOWFLAKE.ACCOUNT_USAGE.DATA_CLASSIFICATION_LATEST dcl,
    LATERAL FLATTEN(input => dcl.RESULT) f
LEFT JOIN SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES pr
    ON pr.REF_DATABASE_NAME = dcl.DATABASE_NAME
    AND pr.REF_SCHEMA_NAME = dcl.SCHEMA_NAME
    AND pr.REF_ENTITY_NAME = dcl.TABLE_NAME
    AND pr.REF_COLUMN_NAME = f.key
    AND pr.POLICY_KIND = 'MASKING_POLICY'
WHERE pr.POLICY_NAME IS NULL
    AND f.value:privacy_category IS NOT NULL;
```

### 3. User access to sensitive tables in last 7 days

```sql
SELECT
    ah.USER_NAME,
    obj.value:objectName::STRING AS object_name,
    obj.value:objectDomain::STRING AS object_type,
    COUNT(*) AS access_count,
    MIN(ah.QUERY_START_TIME) AS first_access,
    MAX(ah.QUERY_START_TIME) AS last_access
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY ah,
    LATERAL FLATTEN(input => ah.BASE_OBJECTS_ACCESSED) obj
WHERE ah.QUERY_START_TIME >= DATEADD('day', -7, CURRENT_TIMESTAMP())
    AND obj.value:objectName::STRING ILIKE '%<table_pattern>%'
GROUP BY 1, 2, 3
ORDER BY access_count DESC;
```

### 4. Role hierarchy and privilege analysis

```sql
-- Roles granted to a specific user
SELECT
    gtu.ROLE,
    gtu.GRANTED_BY,
    gtu.CREATED_ON
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS gtu
WHERE gtu.GRANTEE_NAME = '<USER_NAME>'
    AND gtu.DELETED_ON IS NULL;

-- Privileges for a specific role
SELECT
    gtr.PRIVILEGE,
    gtr.GRANTED_ON,
    gtr.NAME AS object_name,
    gtr.GRANT_OPTION,
    gtr.GRANTED_BY
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES gtr
WHERE gtr.GRANTEE_NAME = '<ROLE_NAME>'
    AND gtr.DELETED_ON IS NULL
ORDER BY gtr.GRANTED_ON, gtr.NAME;
```

### 5. Failed login attempts (security monitoring)

```sql
SELECT
    USER_NAME,
    CLIENT_IP,
    REPORTED_CLIENT_TYPE,
    ERROR_CODE,
    ERROR_MESSAGE,
    EVENT_TIMESTAMP,
    FIRST_AUTHENTICATION_FACTOR
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE IS_SUCCESS = 'NO'
    AND EVENT_TIMESTAMP >= DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY EVENT_TIMESTAMP DESC;
```

### 6. Users without MFA

```sql
SELECT
    NAME,
    LOGIN_NAME,
    EMAIL,
    DEFAULT_ROLE,
    CREATED_ON,
    LAST_SUCCESS_LOGIN,
    HAS_MFA,
    DISABLED
FROM SNOWFLAKE.ACCOUNT_USAGE.USERS
WHERE HAS_MFA = FALSE
    AND DELETED_ON IS NULL
    AND DISABLED = 'false'
ORDER BY LAST_SUCCESS_LOGIN DESC NULLS LAST;
```

### 7. Dormant users (no login in 90 days)

```sql
SELECT
    u.NAME,
    u.LOGIN_NAME,
    u.EMAIL,
    u.DEFAULT_ROLE,
    u.CREATED_ON,
    MAX(lh.EVENT_TIMESTAMP) AS last_login
FROM SNOWFLAKE.ACCOUNT_USAGE.USERS u
LEFT JOIN SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY lh
    ON lh.USER_NAME = u.NAME
    AND lh.IS_SUCCESS = 'YES'
WHERE u.DELETED_ON IS NULL
    AND u.DISABLED = 'false'
GROUP BY 1, 2, 3, 4, 5
HAVING last_login < DATEADD('day', -90, CURRENT_TIMESTAMP())
    OR last_login IS NULL
ORDER BY last_login ASC NULLS FIRST;
```

### 8. Policy coverage summary

```sql
SELECT
    POLICY_KIND,
    COUNT(DISTINCT POLICY_NAME) AS policy_count,
    COUNT(DISTINCT REF_ENTITY_NAME) AS protected_objects,
    COUNT(*) AS total_assignments
FROM SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES
WHERE POLICY_STATUS = 'ACTIVE'
GROUP BY POLICY_KIND
ORDER BY policy_count DESC;
```

### 9. Tag coverage overview

```sql
SELECT
    TAG_NAME,
    DOMAIN,
    COUNT(*) AS assignment_count,
    COUNT(DISTINCT OBJECT_NAME) AS distinct_objects
FROM SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES
WHERE OBJECT_DELETED IS NULL
GROUP BY TAG_NAME, DOMAIN
ORDER BY assignment_count DESC;
```

### 10. Recent DDL changes to policies and tags

```sql
SELECT
    ah.QUERY_START_TIME,
    ah.USER_NAME,
    ah.OBJECT_MODIFIED_BY_DDL:objectName::STRING AS object_name,
    ah.OBJECT_MODIFIED_BY_DDL:objectDomain::STRING AS object_domain,
    ah.OBJECT_MODIFIED_BY_DDL:operationType::STRING AS operation_type,
    qh.QUERY_TEXT
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY ah
JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY qh
    ON ah.QUERY_ID = qh.QUERY_ID
WHERE ah.QUERY_START_TIME >= DATEADD('day', -30, CURRENT_TIMESTAMP())
    AND ah.OBJECT_MODIFIED_BY_DDL IS NOT NULL
    AND ah.OBJECT_MODIFIED_BY_DDL:objectDomain::STRING IN (
        'MASKING_POLICY', 'ROW_ACCESS_POLICY', 'TAG', 'NETWORK_POLICY'
    )
ORDER BY ah.QUERY_START_TIME DESC;
```

## Parsing Complex Columns

Several views have ARRAY/VARIANT columns that require LATERAL FLATTEN:

### ACCESS_HISTORY arrays

```sql
-- direct_objects_accessed
LATERAL FLATTEN(input => ah.DIRECT_OBJECTS_ACCESSED) obj
-- Fields: obj.value:objectName, obj.value:objectDomain, obj.value:objectId
-- Nested columns: obj.value:columns (array of {columnName, columnId})

-- base_objects_accessed
LATERAL FLATTEN(input => ah.BASE_OBJECTS_ACCESSED) base
-- Same structure as direct_objects_accessed

-- objects_modified
LATERAL FLATTEN(input => ah.OBJECTS_MODIFIED) mod
-- Fields: mod.value:objectName, mod.value:objectDomain, mod.value:columns

-- policies_referenced
LATERAL FLATTEN(input => ah.POLICIES_REFERENCED) pol
-- Fields: pol.value:policyName, pol.value:policyDomain, pol.value:columns
```

### DATA_CLASSIFICATION_LATEST result

```sql
LATERAL FLATTEN(input => dcl.RESULT) f
-- f.key = column_name
-- f.value:privacy_category::STRING (e.g., 'IDENTIFIER', 'QUASI_IDENTIFIER', 'SENSITIVE')
-- f.value:semantic_category::STRING (e.g., 'EMAIL', 'PHONE_NUMBER', 'NAME')
-- f.value:alternates (array of alternative classifications)
```

## Troubleshooting Access & Masking Issues

When a user reports that a query returns unexpected results (empty results, masked values, joins failing silently), the problem is often rooted in how data flows through our Snowflake layers.

**Read `references/data-flow.md`** whenever you're troubleshooting:
- A query that returns empty results or masked data
- A service user that can't see data another role can see
- Masking policy behavior that differs between PROD_SOURCE_DB and direct table access
- Database role grants that don't seem to take effect

Key things to remember during troubleshooting:

1. **PROD_SOURCE_DB objects are views over raw tables.** Masking policies live on the raw tables in `PROD_ENT_LOAD_DB` (or `PROD_ESTUARY_LOAD_DB` / `PROD_FIVETRAN_LOAD_DB`), not on the PROD_SOURCE_DB views. Always check the raw load database for policies.

2. **Schema names may differ between layers.** Raw schemas sometimes have a `_V1` suffix (e.g., `EXAMPLE_SCHEMA_V1`). Use ACCESS_HISTORY's `BASE_OBJECTS_ACCESSED` to find the actual underlying table.

3. **PROD_ANALYTICS_DB tables have their own tags.** Since dbt materializes these as tables (not views), they get independent tag assignments and masking policies.

4. **Database roles are scoped per-database.** Having `EXAMPLE_SCHEMA_RO` in PROD_SOURCE_DB does NOT satisfy a masking policy that checks for that role in PROD_ENT_LOAD_DB.

## Reference Files

For complete column schemas of each view, consult:

- `references/views-security.md` — USERS, ROLES, GRANTS_TO_ROLES, GRANTS_TO_USERS, LOGIN_HISTORY
- `references/views-protection.md` — MASKING_POLICIES, ROW_ACCESS_POLICIES, POLICY_REFERENCES, TAGS, TAG_REFERENCES, DATA_CLASSIFICATION_LATEST
- `references/views-auditing.md` — ACCESS_HISTORY, QUERY_HISTORY
- `references/data-flow.md` — Snowflake data flow, materialization layers, and troubleshooting access/masking issues

Read these when you need exact column names/types for a specific view, when the user asks about a column you're unsure about, or when troubleshooting access behavior across database layers.
