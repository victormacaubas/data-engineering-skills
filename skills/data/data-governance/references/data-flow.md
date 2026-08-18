# Snowflake Data Flow & Materialization Workflow

## Overview

Data flows through four layers in Snowflake before reaching end users. Each layer has different characteristics for governance: where tags are applied, where masking policies take effect, and which roles have access.

## The Four Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Raw Source Tables (ingestion)                         │
│  PROD_ENT_LOAD_DB / PROD_ESTUARY_LOAD_DB / PROD_FIVETRAN_LOAD_DB│
│  - Tables loaded by ingestion pipelines                         │
│  - Masking policies applied via tags HERE                       │
│  - Only Data Platform roles have direct access                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ views reference raw tables
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Enterprise Views                                      │
│  PROD_ENT_DB                                                    │
│  - Views that read from Layer 1 raw tables                      │
│  - Inherit masking behavior from the underlying raw tables      │
│  - No independent tags/policies at this layer                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ dbt materializes from these views
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: dbt Prep / Source Objects                             │
│  PROD_SOURCE_DB                                                 │
│  - dbt prep and source-layer models                             │
│  - Inherit masking behavior from upstream views/tables           │
│  - This is what most analysts and service users query            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ dbt builds analytics models
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Analytics Models                                      │
│  PROD_ANALYTICS_DB                                              │
│  - dbt analytics models materialized as TABLES                  │
│  - Tags and masking policies applied directly HERE              │
│  - Broadly accessible to analyst and service roles              │
└─────────────────────────────────────────────────────────────────┘
```

## Where Tags & Masking Policies Are Applied

Tags and masking policies are applied at two layers:

| Layer | Database | Object type | Tags applied? | Why |
|-------|----------|-------------|---------------|-----|
| 1 (Raw) | `PROD_ENT_LOAD_DB`, `PROD_ESTUARY_LOAD_DB`, `PROD_FIVETRAN_LOAD_DB` | Tables | Yes | Source of truth for raw data governance |
| 2 (Enterprise) | `PROD_ENT_DB` | Views | No | Views inherit from Layer 1 |
| 3 (Prep) | `PROD_SOURCE_DB` | Views/tables (dbt) | No | Inherits from upstream |
| 4 (Analytics) | `PROD_ANALYTICS_DB` | Tables (dbt) | Yes | Independent materialization, needs its own tags |

## Schema Naming Conventions

The raw load databases sometimes use versioned schema names (e.g., `EXAMPLE_SCHEMA_V1` instead of `EXAMPLE_SCHEMA`). The downstream views in `PROD_SOURCE_DB` abstract this away, so users query `prod_source_db.example_schema.clients` but the base table is actually `PROD_ENT_LOAD_DB.EXAMPLE_SCHEMA_V1.CLIENTS`.

When troubleshooting, always check ACCESS_HISTORY to see the actual `BASE_OBJECTS_ACCESSED` — don't assume the schema name in the user's query matches the raw table schema.

## Implications for Troubleshooting

### Masking policy inheritance through views

When a user queries `PROD_SOURCE_DB` (Layer 3), the masking policies from Layer 1 raw tables still apply. The policy evaluates in the context of the **base table's database** (e.g., `PROD_ENT_LOAD_DB`), not the view's database.

This means:
- `IS_DATABASE_ROLE_IN_SESSION()` checks for database roles in the raw load database
- `CURRENT_SCHEMA()` evaluates to the raw table's schema (which may have a `_V1` suffix)
- A role that has access to `PROD_SOURCE_DB` schemas may still get masked values if it lacks the corresponding database role in `PROD_ENT_LOAD_DB`

### Where to look for masking policies

When a query against `PROD_SOURCE_DB` returns masked data:

1. **Check POLICY_REFERENCES for the raw load database** — not PROD_SOURCE_DB
   ```sql
   -- The views in PROD_SOURCE_DB don't have policies directly
   -- Look at the underlying tables in PROD_ENT_LOAD_DB
   SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES
   WHERE REF_DATABASE_NAME = 'PROD_ENT_LOAD_DB'
     AND REF_SCHEMA_NAME = '<schema_name>'  -- may have _V1 suffix
     AND REF_ENTITY_NAME = '<table_name>';
   ```

2. **Use ACCESS_HISTORY to find the real base table** — the schema name in the user's query might not match:
   ```sql
   SELECT obj.value:objectName::STRING AS base_object
   FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY ah,
       LATERAL FLATTEN(input => ah.BASE_OBJECTS_ACCESSED) obj
   WHERE ah.QUERY_ID = '<query_id>';
   ```

3. **For PROD_ANALYTICS_DB**, policies are applied directly on the tables — check there:
   ```sql
   SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES
   WHERE REF_DATABASE_NAME = 'PROD_ANALYTICS_DB'
     AND REF_SCHEMA_NAME = '<schema>'
     AND REF_ENTITY_NAME = '<table>';
   ```

### Common pitfalls

| Symptom | Likely cause | Where to look |
|---------|-------------|---------------|
| Query returns empty results (not an error) | A WHERE clause column is masked, causing filters to fail | Check tags on filter columns in the raw load DB |
| Join produces no matches | A join key column is masked to a sentinel value | Check masking policies on join columns at Layer 1 |
| Query works with secondary roles but not primary | Primary role lacks a database role in the raw load DB | Check `IS_DATABASE_ROLE_IN_SESSION` requirements in the masking policy body |
| PROD_SOURCE_DB query masked but direct PROD_ENT_LOAD_DB query is not | View inheritance behaves differently than direct access for tag resolution | Check `SYSTEM$GET_TAG_ON_CURRENT_COLUMN` behavior and database role grants |

### Database role scoping

Database roles are scoped per-database. A role named `EXAMPLE_SCHEMA_RO` in `PROD_SOURCE_DB` is a **different** role than `EXAMPLE_SCHEMA_RO` in `PROD_ENT_LOAD_DB`. When masking policies on raw tables use `IS_DATABASE_ROLE_IN_SESSION()`, they check for the role in the raw load database — not in PROD_SOURCE_DB.

To verify which database roles a service user has in the correct database:
```sql
SELECT NAME, PRIVILEGE, GRANTED_ON
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
WHERE GRANTEE_NAME = '<ROLE_NAME>'
  AND DELETED_ON IS NULL
  AND GRANTED_ON = 'DATABASE_ROLE'
  AND NAME ILIKE '%<schema_pattern>%';
```
