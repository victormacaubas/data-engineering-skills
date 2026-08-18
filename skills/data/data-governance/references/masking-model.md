# Column Masking Model — How Masking Decides What to Return

This file explains the *mechanism* behind dynamic data masking in our Snowflake account: how a tag turns into a masked value, how to read the classification of a column, and how to unmask one. Read it whenever you need to explain **why** a value came back masked, interpret a sentinel value a user is seeing, or answer "how do I let role/team X see column Y."

It is the companion to `data-flow.md`. They answer different questions:
- **`data-flow.md`** — *where* across the four database layers tags and policies live, and how a policy on a raw load table still applies when you query a downstream view.
- **This file** — *how* a single tag + masking policy actually evaluates per query, and the two levers that change the outcome.

> **Scope.** This describes the masking mechanism so you can query and reason about it. The operational machinery that *stamps* tags onto columns (the tag-applying stored procedure, its execution modes, the orchestration DAGs, and any dbt post-hook delivery) lives in the governance infrastructure repo and is out of scope here. Also keep classification-source claims neutral: assume there is no live automatic-classification feed unless you confirm one, so don't describe one as active.

## Tagging ≠ masking: two layers glued once

The most important thing to internalize: **applying a tag does not mask anything by itself.** Masking is the product of two independent layers that are wired together exactly once, centrally.

- **Layer 1 — tag-based masking policies (defined once, in Terraform).** There is a single tag, `GOVERNANCE_DB.DATA_MASKING.DATA_PROTECTION_CLASSIFICATION`, and **15 masking policies** in the `GOVERNANCE_DB.DATA_MASKING` schema — one per datatype (`TEXT`, `NUMBER`, `FLOAT`, `BOOLEAN`, `DATE`, `TIME`, `TIMESTAMP`, `TIMESTAMP_TZ`, `TIMESTAMP_LTZ`, `VARIANT`, `ARRAY`, `OBJECT`, `BINARY`, `GEOGRAPHY`, `GEOMETRY`). Each policy is bound to the tag via a `snowflake_tag_masking_policy_association`. Once a masking policy is associated to a tag, **any column that receives that tag automatically gets the matching-datatype policy applied.** Masking policies are never attached to columns directly.
- **Layer 2 — the tag value on the column.** All that remains is to put the correct classification *value* on the correct column (`ALTER TABLE ... MODIFY COLUMN ... SET TAG DATA_PROTECTION_CLASSIFICATION = '<value>'`). Masking then happens "for free" because of the Layer 1 association.

Practical consequence for governance questions: **"is this column masked?" reduces to "does it carry `DATA_PROTECTION_CLASSIFICATION`, and at what value?"** — which you read from `TAG_REFERENCES` (see "Querying masking state" below).

## The four-level classification scheme

`DATA_PROTECTION_CLASSIFICATION` allows exactly four values, least to most sensitive:

| Value | Sensitivity | Unmasked for |
|-------|-------------|--------------|
| `PUBLIC` | lowest | everyone with read access |
| `INTERNAL` | low | everyone with read access |
| `CONFIDENTIAL` | high | holders of the schema's `_RO_CONFIDENTIAL` role (and above) |
| `RESTRICTED` | highest | holders of the schema's `_RO_RESTRICTED` role |

`PUBLIC` and `INTERNAL` are **not** sensitive — the policy returns the real value to anyone who can read the column. `CONFIDENTIAL` and `RESTRICTED` are gated by a database role derived from the schema.

### Access-role ladder (per schema)

Each governed schema has a ladder of database roles, each inheriting the one below it:

- `<SCHEMA>_SCHEMA_RO` — sees `PUBLIC` + `INTERNAL` unmasked.
- `<SCHEMA>_SCHEMA_RO_CONFIDENTIAL` — additionally sees `CONFIDENTIAL`; inherits `RO`.
- `<SCHEMA>_SCHEMA_RO_RESTRICTED` — additionally sees `RESTRICTED`; inherits `RO_CONFIDENTIAL`.
- `<SCHEMA>_SCHEMA_RW` — write; inherits `RO_RESTRICTED`.

Database-level `_RO` / `_RW` roles aggregate the per-schema roles.

## How a policy evaluates (the CASE logic)

Every one of the 15 policies shares the same three-branch shape (this is the live `POLICY_BODY`, datatype aside):

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

When a value is masked, what the user sees depends on the column's datatype. These are verified from the live policy bodies:

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

So if a user reports `-99999` on a numeric join key, `'sanitized'` in a text column, or a `3000-12-01` timestamp, that is **masking firing** — the column is `CONFIDENTIAL`/`RESTRICTED` and the session lacks the matching unmask role. Note `DATE` masks to `NULL`, not the `3000-12-01` sentinel used by the timestamp types.

### Why the unmask role is derived from the schema

The role name is built dynamically with `CURRENT_SCHEMA()`, which is why **one policy works across every database and schema** — there's no need for a per-schema policy. The `COALESCE(..., 'INVALID_ROLE_NAME')` guard exists because `CURRENT_SCHEMA()` evaluates to null at policy-creation time under `IS_DATABASE_ROLE_IN_SESSION`, and a null role name would error.

A sharp consequence: a **new schema with no matching `_SCHEMA_RO_CONFIDENTIAL` / `_SCHEMA_RO_RESTRICTED` database roles** leaves any `CONFIDENTIAL`/`RESTRICTED` data in it permanently masked for *everyone* — the policy looks for a role that doesn't exist. New schemas need the role scaffolding, not just the tags. (See `data-flow.md` for how the role is resolved in the *base table's* database when querying through a downstream view.)

## Two levers to unmask a column

When asked "how do I let X see column Y," there are two distinct levers — pick based on whether the data *is* actually sensitive:

1. **Lower the classification** — set the column's `DATA_PROTECTION_CLASSIFICATION` to `INTERNAL`. Because `PUBLIC`/`INTERNAL` bypass the role check entirely, this is a true **declassification**: the column becomes visible to *everyone* with schema read access, not just one role. Use when the column was over-classified and isn't really sensitive. (Typically done through a governance manual-classification table with a validity window and a ticket reference, then re-applied — the operational details live in the governance infrastructure repo.)
2. **Grant the unmask role** — grant the requester `<SCHEMA>_SCHEMA_RO_CONFIDENTIAL` (or `_RESTRICTED`). The column stays sensitive; only that role/person gains the ability to see it. Use when the data really is sensitive but a specific consumer is authorized.

Lever 1 changes the data's classification for all readers; lever 2 grants a specific principal access without changing the classification. Be deliberate about which one a request actually calls for.

## Querying masking state

Tie the model back to the views the main skill documents:

- **What classification does a column carry?** Query `TAG_REFERENCES` for `TAG_NAME = 'DATA_PROTECTION_CLASSIFICATION'` on the column. Remember `TAG_REFERENCES` shows **direct assignments only — not inherited tags**, so a column relying on an inherited (table/schema/database-level) tag won't appear here even though masking still fires; use `SYSTEM$GET_TAG_ON_CURRENT_COLUMN` semantics in mind when reasoning about inheritance.
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
