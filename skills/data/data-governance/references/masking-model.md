# Column Masking Model — How Masking Decides What to Return

This file explains the *mechanism* behind dynamic data masking in our Snowflake account: how a tag produces a masked value, how to read a column's classification, and how to unmask a column. Read it when you need to explain **why** a value came back masked, interpret a sentinel value a user sees, or answer "how do I let role/team X see column Y."

This file and `data-flow.md` answer different questions:
- **`data-flow.md`** — *where* tags and policies live across the four database layers, and how a policy on a raw load table still applies when you query a downstream view.
- **This file** — *how* a single tag + masking policy evaluates per query, and the two levers that change the outcome.

> **Scope.** This describes the masking mechanism so you can query and reason about it. The governance infrastructure repo contains the operational machinery that *stamps* tags onto columns: the tag-applying stored procedure, its execution modes, the orchestration DAGs, and any dbt post-hook delivery. That machinery is out of scope here. Keep classification-source claims neutral: assume there is no live automatic-classification feed unless you confirm one, and do not describe one as active.

## Tagging ≠ masking: two layers glued once

**Applying a tag does not mask anything by itself.** Masking depends on two independent layers that are connected once, centrally.

- **Layer 1 — tag-based masking policies (defined once, in Terraform).** One tag, `GOVERNANCE_DB.DATA_MASKING.DATA_PROTECTION_CLASSIFICATION`, has **15 masking policies** in the `GOVERNANCE_DB.DATA_MASKING` schema — one per datatype (`TEXT`, `NUMBER`, `FLOAT`, `BOOLEAN`, `DATE`, `TIME`, `TIMESTAMP`, `TIMESTAMP_TZ`, `TIMESTAMP_LTZ`, `VARIANT`, `ARRAY`, `OBJECT`, `BINARY`, `GEOGRAPHY`, `GEOMETRY`). Each policy is bound to the tag via a `snowflake_tag_masking_policy_association`. Once a masking policy is associated with a tag, **any column that receives that tag automatically gets the matching-datatype policy applied.** Masking policies are never attached to columns directly.
- **Layer 2 — the tag value on the column.** Set the correct classification *value* on the correct column (`ALTER TABLE ... MODIFY COLUMN ... SET TAG DATA_PROTECTION_CLASSIFICATION = '<value>'`). The Layer 1 association then applies masking automatically.

For governance questions, answer **"is this column masked?"** by checking whether it carries `DATA_PROTECTION_CLASSIFICATION` and at what value. Read that value from `TAG_REFERENCES` (see "Querying masking state" below).

## The four-level classification scheme

`DATA_PROTECTION_CLASSIFICATION` allows exactly four values, least to most sensitive:

| Value | Sensitivity | Unmasked for |
|-------|-------------|--------------|
| `PUBLIC` | lowest | everyone with read access |
| `INTERNAL` | low | everyone with read access |
| `CONFIDENTIAL` | high | holders of the schema's `_RO_CONFIDENTIAL` role (and above) |
| `RESTRICTED` | highest | holders of the schema's `_RO_RESTRICTED` role |

The policy treats `PUBLIC` and `INTERNAL` as **not** sensitive and returns the real value to anyone who can read the column. `CONFIDENTIAL` and `RESTRICTED` require a database role derived from the schema.

### Access-role ladder (per schema)

Each governed schema has a ladder of database roles, each inheriting the one below it:

- `<SCHEMA>_SCHEMA_RO` — sees `PUBLIC` + `INTERNAL` unmasked.
- `<SCHEMA>_SCHEMA_RO_CONFIDENTIAL` — additionally sees `CONFIDENTIAL`; inherits `RO`.
- `<SCHEMA>_SCHEMA_RO_RESTRICTED` — additionally sees `RESTRICTED`; inherits `RO_CONFIDENTIAL`.
- `<SCHEMA>_SCHEMA_RW` — write; inherits `RO_RESTRICTED`.

Database-level `_RO` / `_RW` roles aggregate the per-schema roles.

## How a policy evaluates (the CASE logic)

All 15 policies share the same three-branch shape (this is the live `POLICY_BODY`, apart from datatype):

```sql
CASE
  WHEN SYSTEM$GET_TAG_ON_CURRENT_COLUMN(
         'GOVERNANCE_DB.DATA_MASKING.DATA_PROTECTION_CLASSIFICATION'
       ) IN ('PUBLIC', 'INTERNAL')
    THEN val                                 -- not sensitive → real value
  WHEN IS_DATABASE_ROLE_IN_SESSION(
         COALESCE(
           CONCAT_WS('_', CURRENT_SCHEMA(), 'SCHEMA_RO',
             SYSTEM$GET_TAG_ON_CURRENT_COLUMN(
               'GOVERNANCE_DB.DATA_MASKING.DATA_PROTECTION_CLASSIFICATION')),
           'INVALID_ROLE_NAME')
       )
    THEN val                                 -- caller holds the unmask role → real value
  ELSE <sentinel>                            -- otherwise → masked sentinel
END
```

1. If the column's tag value is `PUBLIC` or `INTERNAL`, return the real value outright.
2. Otherwise, build a role name like `MYSCHEMA_SCHEMA_RO_CONFIDENTIAL` from the current schema + the tag value, and return the real value if the querying session is in that database role.
3. Otherwise, return a datatype-specific **sentinel**.

### Sentinel (masked) values

When a value is masked, the returned value depends on the column's datatype. These values are verified from the live policy bodies:

| Datatype | Masked value |
|----------|--------------|
| `TEXT` | `'sanitized'` |
| `NUMBER` | `-99999` |
| `FLOAT` | `-99999` (as float) |
| `TIMESTAMP` (NTZ) | `'3000-12-01'` |
| `TIMESTAMP_TZ` | `'3000-12-01'` (tz) |
| `TIMESTAMP_LTZ` | `'3000-12-01'` (ltz) |
| `DATE` | `NULL` |
| `BOOLEAN`, `VARIANT`, `ARRAY`, `OBJECT`, `BINARY`, `TIME`, `GEOGRAPHY`, `GEOMETRY` | `NULL` |

If a user reports `-99999` on a numeric join key, `'sanitized'` in a text column, or a `3000-12-01` timestamp, masking is active: the column is `CONFIDENTIAL`/`RESTRICTED` and the session lacks the matching unmask role. `DATE` masks to `NULL`, not the `3000-12-01` sentinel used by the timestamp types.

### Why the unmask role is derived from the schema

The role name is built dynamically with `CURRENT_SCHEMA()`, so **one policy works across every database and schema** without a per-schema policy. The `COALESCE(..., 'INVALID_ROLE_NAME')` guard exists because `CURRENT_SCHEMA()` evaluates to null at policy-creation time under `IS_DATABASE_ROLE_IN_SESSION`, and a null role name would error.

A **new schema with no matching `_SCHEMA_RO_CONFIDENTIAL` / `_SCHEMA_RO_RESTRICTED` database roles** leaves any `CONFIDENTIAL`/`RESTRICTED` data in it permanently masked for *everyone* because the policy looks for a role that does not exist. New schemas need the role scaffolding as well as the tags. (See `data-flow.md` for how the role is resolved in the *base table's* database when querying through a downstream view.)

## Two levers to unmask a column

When asked "how do I let X see column Y," choose between two levers based on whether the data *is* actually sensitive:

1. **Lower the classification** — set the column's `DATA_PROTECTION_CLASSIFICATION` to `INTERNAL`. Because `PUBLIC`/`INTERNAL` bypass the role check entirely, this is a true **declassification**: the column becomes visible to *everyone* with schema read access, not just one role. Use when the column was over-classified and isn't really sensitive. (Typically done through a governance manual-classification table with a validity window and a ticket reference, then re-applied — the operational details live in the governance infrastructure repo.)
2. **Grant the unmask role** — grant the requester `<SCHEMA>_SCHEMA_RO_CONFIDENTIAL` (or `_RESTRICTED`). The column stays sensitive; only that role/person gains the ability to see it. Use when the data really is sensitive but a specific consumer is authorized.

Lever 1 changes the data's classification for all readers; lever 2 grants a specific principal access without changing the classification. Choose the lever that matches the request.

## Querying masking state

Use the views documented in the main skill:

- **What classification does a column carry?** Query `TAG_REFERENCES` for `TAG_NAME = 'DATA_PROTECTION_CLASSIFICATION'` on the column. `TAG_REFERENCES` shows **direct assignments only — not inherited tags**, so a column relying on an inherited (table/schema/database-level) tag will not appear here even though masking still fires. Keep `SYSTEM$GET_TAG_ON_CURRENT_COLUMN` semantics in mind when reasoning about inheritance.
- **Where do masking policies resolve?** Query `POLICY_REFERENCES` filtered to `POLICY_KIND = 'MASKING_POLICY'` for the object. The `TAG_NAME`/`TAG_SCHEMA`/`TAG_DATABASE` columns confirm the policy was assigned via the tag rather than directly.
- **What does a policy actually do?** Read `MASKING_POLICIES.POLICY_BODY` for the CASE shown above.
- **Which database roles does a principal hold (to satisfy the unmask check)?** See the database-role grant query in `data-flow.md` — and note the role must exist in the **base table's** database, which may differ from the database the user queried.

```sql
-- Classification value(s) directly assigned on a table's columns
SELECT OBJECT_NAME AS table_name, COLUMN_NAME, TAG_VALUE, APPLY_METHOD
FROM SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES
WHERE TAG_NAME = 'DATA_PROTECTION_CLASSIFICATION'
  AND OBJECT_DATABASE = '<db>'
  AND OBJECT_SCHEMA = '<schema>'
  AND OBJECT_NAME = '<table>'
  AND DOMAIN = 'COLUMN'
  AND OBJECT_DELETED IS NULL
ORDER BY COLUMN_NAME;
```
