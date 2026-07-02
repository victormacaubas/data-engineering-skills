# GOVERNANCE_DB.DATA_MASKING Views — Column Reference

Custom views in `GOVERNANCE_DB.DATA_MASKING` that drive the classification-to-tag pipeline. These are **not** Snowflake system views — they are maintained internally.

## DATA_CLASSIFICATIONS_TO_APPLY

The **final merged view** consumed by the tag-applying procedure. Resolves precedence (manual > auto > default) and produces one row per column with its effective classification.

| Column | Type | Description |
|--------|------|-------------|
| REF_DATABASE | VARCHAR | Target database |
| REF_SCHEMA | VARCHAR | Target schema |
| REF_TABLE | VARCHAR | Target table |
| REF_COLUMN | VARCHAR | Target column |
| DATA_CLASSIFICATION | VARCHAR(100) | Effective classification: CONFIDENTIAL, INTERNAL, PUBLIC, or RESTRICTED |
| CLASSIFICATION_SOURCE | VARCHAR | Which branch resolved: MANUAL, AUTOMATIC, or DEFAULT |

**Precedence logic:**
1. Metadata columns (`_SDC%`, `_FIVETRAN%`, MariaDB system-version timestamps) are forced to `INTERNAL` regardless of classification.
2. If a valid manual override exists → use it (`CLASSIFICATION_SOURCE = 'MANUAL'`).
3. Else if automatic classification exists → use it (`CLASSIFICATION_SOURCE = 'AUTOMATIC'`).
4. Else → default to `CONFIDENTIAL` (`CLASSIFICATION_SOURCE = 'DEFAULT'`).

**Scope:** only BASE TABLEs in PROD_ENT_LOAD_DB, PROD_FIVETRAN_LOAD_DB, PROD_ENT_TRANSFORM_DB, PROD_SOURCE_DB, PROD_ANALYTICS_DB, PROD_MODERN_TREASURY_DB, PROD_VWO_LOAD_DB, PROD_REPORTING_DB, PROD_ENT_ARCHIVE_DB, PROD_ESTUARY_LOAD_DB. Views and temp tables (`_TEMP%`) are excluded.

---

## DATA_CLASSIFICATIONS_MANUAL

Manual classification overrides with validity windows. When a row exists here with `VALID_FROM <= now() < VALID_TO`, it takes precedence over automatic classification.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| REF_DATABASE | VARCHAR(1000) | NO | Target database |
| REF_SCHEMA | VARCHAR(1000) | NO | Target schema |
| REF_TABLE | VARCHAR(1000) | NO | Target table |
| REF_COLUMN | VARCHAR(1000) | NO | Target column |
| DATA_CLASSIFICATION | VARCHAR(100) | NO | Classification value (typically INTERNAL or CONFIDENTIAL) |
| REQUESTER_USER | VARCHAR(100) | NO | Who requested the override |
| VALID_FROM | TIMESTAMP_NTZ | NO | Start of validity window |
| VALID_TO | TIMESTAMP_NTZ | YES | End of validity (NULL = open-ended, never expires) |

**Usage:** to declassify a column (e.g., over-classified as CONFIDENTIAL when it should be INTERNAL), insert a row here. The `_TO_APPLY` view picks it up on the next tag-applying run.

---

## Common queries

```sql
-- What classification will be applied to a specific column?
SELECT *
FROM GOVERNANCE_DB.DATA_MASKING.DATA_CLASSIFICATIONS_TO_APPLY
WHERE REF_DATABASE = 'PROD_ENT_LOAD_DB'
  AND REF_SCHEMA = 'MY_SCHEMA'
  AND REF_TABLE = 'MY_TABLE'
  AND REF_COLUMN = 'MY_COLUMN';

-- All columns defaulting to CONFIDENTIAL (no auto or manual classification)
SELECT REF_DATABASE, REF_SCHEMA, REF_TABLE, REF_COLUMN
FROM GOVERNANCE_DB.DATA_MASKING.DATA_CLASSIFICATIONS_TO_APPLY
WHERE CLASSIFICATION_SOURCE = 'DEFAULT'
  AND REF_DATABASE = '<db>'
ORDER BY REF_SCHEMA, REF_TABLE, REF_COLUMN;

-- Current manual overrides (active validity window)
SELECT *
FROM GOVERNANCE_DB.DATA_MASKING.DATA_CLASSIFICATIONS_MANUAL
WHERE CURRENT_TIMESTAMP()::TIMESTAMP_NTZ >= VALID_FROM
  AND CURRENT_TIMESTAMP()::TIMESTAMP_NTZ < COALESCE(VALID_TO, '2050-01-01'::TIMESTAMP_NTZ);
```
