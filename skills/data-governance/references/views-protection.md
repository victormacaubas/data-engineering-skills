# Data Protection Views — Column Reference

## MASKING_POLICIES

| Column | Type | Description |
|--------|------|-------------|
| POLICY_NAME | VARCHAR | Masking policy name |
| POLICY_ID | NUMBER | System-generated identifier |
| POLICY_SCHEMA_ID | NUMBER | Schema identifier |
| POLICY_SCHEMA | VARCHAR | Schema name |
| POLICY_CATALOG_ID | NUMBER | Database identifier |
| POLICY_CATALOG | VARCHAR | Database name |
| POLICY_OWNER | VARCHAR | Owning role |
| POLICY_SIGNATURE | VARCHAR | Argument type signature |
| POLICY_RETURN_TYPE | VARCHAR | Return data type |
| POLICY_BODY | VARCHAR | Policy definition SQL |
| POLICY_COMMENT | VARIANT | Comments |
| CREATED | TIMESTAMP_LTZ | Creation time |
| LAST_ALTERED | TIMESTAMP_LTZ | Last modification time |
| DELETED | TIMESTAMP_LTZ | Deletion time |
| OWNER_ROLE_TYPE | VARCHAR | Owner type (ROLE or APPLICATION) |
| OPTIONS | VARIANT | EXEMPT_OTHER_POLICIES setting |

**Latency:** up to 2 hours. **Retention:** 365 days.

---

## ROW_ACCESS_POLICIES

| Column | Type | Description |
|--------|------|-------------|
| POLICY_NAME | VARCHAR | Row access policy name |
| POLICY_ID | NUMBER | System-generated identifier |
| POLICY_SCHEMA_ID | NUMBER | Schema identifier |
| POLICY_SCHEMA | VARCHAR | Schema name |
| POLICY_CATALOG_ID | NUMBER | Database identifier |
| POLICY_CATALOG | VARCHAR | Database name |
| POLICY_OWNER | VARCHAR | Owning role |
| POLICY_SIGNATURE | VARCHAR | Argument type signature |
| POLICY_RETURN_TYPE | VARCHAR | Return data type |
| POLICY_BODY | VARCHAR | Policy definition SQL |
| POLICY_COMMENT | VARIANT | Comments |
| CREATED | TIMESTAMP_LTZ | Creation time |
| LAST_ALTERED | TIMESTAMP_LTZ | Last modification time |
| DELETED | TIMESTAMP_LTZ | Deletion time |
| OWNER_ROLE_TYPE | VARCHAR | Owner type (ROLE or APPLICATION) |
| OPTIONS | VARIANT | EXEMPT_OTHER_POLICIES setting |

**Latency:** up to 2 hours. **Retention:** 365 days.

---

## POLICY_REFERENCES

| Column | Type | Description |
|--------|------|-------------|
| POLICY_DB | VARCHAR | Policy database |
| POLICY_SCHEMA | VARCHAR | Policy schema |
| POLICY_ID | NUMBER | System-generated identifier |
| POLICY_NAME | VARCHAR | Policy name |
| POLICY_KIND | VARCHAR(17) | Policy type: MASKING_POLICY, ROW_ACCESS_POLICY, AGGREGATION_POLICY, PROJECTION_POLICY, NETWORK_POLICY, STORAGE_LIFECYCLE_POLICY |
| REF_DATABASE_NAME | VARCHAR | Object database |
| REF_SCHEMA_NAME | VARCHAR | Object schema |
| REF_ENTITY_NAME | VARCHAR | Object name (table/view) |
| REF_ENTITY_DOMAIN | VARCHAR | Object type |
| REF_COLUMN_NAME | VARCHAR | Column name (for column-level policies) |
| REF_ARG_COLUMN_NAMES | VARCHAR | NULL for column-level masking |
| TAG_DATABASE | VARCHAR | Tag database (if policy assigned via tag) |
| TAG_SCHEMA | VARCHAR | Tag schema (if policy assigned via tag) |
| TAG_NAME | VARCHAR | Tag name (if policy assigned via tag) |
| POLICY_STATUS | VARCHAR | ACTIVE, MULTIPLE_MASKING_POLICY_ASSIGNED_TO_THE_COLUMN, COLUMN_IS_MISSING_FOR_SECONDARY_ARG, COLUMN_DATATYPE_MISMATCH_FOR_SECONDARY_ARG |

**Latency:** up to 2 hours. **Retention:** 365 days.

**POLICY_STATUS values:**
- `ACTIVE` — single policy correctly assigned
- `MULTIPLE_MASKING_POLICY_ASSIGNED_TO_THE_COLUMN` — conflict (multiple policies on same column)
- `COLUMN_IS_MISSING_FOR_SECONDARY_ARG` — conditional policy references missing column
- `COLUMN_DATATYPE_MISMATCH_FOR_SECONDARY_ARG` — conditional policy has type mismatch

---

## TAGS

| Column | Type | Description |
|--------|------|-------------|
| TAG_ID | NUMBER | System-generated identifier |
| TAG_NAME | VARCHAR | Tag name |
| TAG_SCHEMA_ID | NUMBER | Schema identifier |
| TAG_SCHEMA | VARCHAR | Schema name |
| TAG_DATABASE_ID | NUMBER | Database identifier |
| TAG_DATABASE | VARCHAR | Database name |
| TAG_OWNER | VARCHAR | Owning role |
| TAG_COMMENT | VARCHAR | Comment |
| ALLOWED_VALUES | VARIANT | Allowed values for the tag |
| CREATED | TIMESTAMP_LTZ | Creation time |
| LAST_ALTERED | TIMESTAMP_LTZ | Last modification time |
| DELETED | TIMESTAMP_LTZ | Deletion time |
| OWNER_ROLE_TYPE | VARCHAR | Owner type |

**Latency:** up to 2 hours. **Retention:** 365 days.

---

## TAG_REFERENCES

| Column | Type | Description |
|--------|------|-------------|
| TAG_DATABASE | VARCHAR | Database where tag is defined |
| TAG_SCHEMA | VARCHAR | Schema where tag is defined |
| TAG_ID | NUMBER | System-generated identifier (NULL for system tags) |
| TAG_NAME | VARCHAR | Tag key |
| TAG_VALUE | VARCHAR | Tag value |
| OBJECT_DATABASE | VARCHAR | Object database (empty if account-level) |
| OBJECT_SCHEMA | VARCHAR | Object schema (empty if db-level) |
| OBJECT_ID | NUMBER | Object identifier |
| OBJECT_NAME | VARCHAR | Object name (or parent table for columns) |
| OBJECT_DELETED | TIMESTAMP_LTZ | Object deletion time |
| DOMAIN | VARCHAR | Object domain (TABLE, VIEW, COLUMN, WAREHOUSE, etc.) |
| COLUMN_ID | NUMBER | Column identifier (if column) |
| COLUMN_NAME | VARCHAR | Column name (if column) |
| APPLY_METHOD | VARCHAR | CLASSIFIED, MANUAL, PROPAGATED, NULL, or NONE |

**Latency:** up to 2 hours. **Retention:** 365 days.

**Notes:**
- Does NOT show inherited tags — only direct assignments
- Deleted columns are excluded
- `APPLY_METHOD` distinguishes auto-classification from manual tagging

---

## DATA_CLASSIFICATION_LATEST

| Column | Type | Description |
|--------|------|-------------|
| TABLE_ID | NUMBER | Table identifier |
| TABLE_NAME | VARCHAR | Table name |
| SCHEMA_ID | NUMBER | Schema identifier |
| SCHEMA_NAME | VARCHAR | Schema name |
| DATABASE_ID | NUMBER | Database identifier |
| DATABASE_NAME | VARCHAR | Database name |
| RESULT | VARIANT | Classification result JSON (per-column) |
| STATUS | VARCHAR | CLASSIFIED or REVIEWED |
| TRIGGER_TYPE | VARCHAR | MANUAL or AUTO CLASSIFICATION |
| LAST_CLASSIFIED_ON | TIMESTAMP_LTZ | Last successful classification |
| LAST_CLASSIFICATION_ATTEMPT | TIMESTAMP_LTZ | Last attempt (if > LAST_CLASSIFIED_ON, it failed) |
| ERROR_MESSAGE | VARCHAR | Error from failed attempt |

**Latency:** up to 3 hours. **Retention:** as long as the table exists.

**RESULT column structure** (parse with LATERAL FLATTEN):
```
{
  "COLUMN_NAME": {
    "privacy_category": "IDENTIFIER" | "QUASI_IDENTIFIER" | "SENSITIVE" | null,
    "semantic_category": "EMAIL" | "PHONE_NUMBER" | "NAME" | "ADDRESS" | ...,
    "alternates": [...]
  }
}
```

**Requires:** Enterprise Edition or higher.
