# Security & Access Control Views — Column Reference

## USERS

| Column | Type | Description |
|--------|------|-------------|
| USER_ID | NUMBER | System-generated identifier |
| NAME | VARCHAR | Unique user identifier |
| CREATED_ON | TIMESTAMP_LTZ | Account creation time (UTC) |
| DELETED_ON | TIMESTAMP_LTZ | Account deletion time (UTC) |
| LOGIN_NAME | VARCHAR | Login credential name |
| DISPLAY_NAME | VARCHAR | UI display name |
| FIRST_NAME | VARCHAR | First name |
| LAST_NAME | VARCHAR | Last name |
| EMAIL | VARCHAR | Email address |
| MUST_CHANGE_PASSWORD | BOOLEAN | Password change required on next login |
| HAS_PASSWORD | BOOLEAN | Whether password exists |
| COMMENT | VARCHAR | User comment |
| DISABLED | VARIANT | Account disabled status |
| SNOWFLAKE_LOCK | VARIANT | Temporary lock status |
| DEFAULT_WAREHOUSE | VARCHAR | Default warehouse on login |
| DEFAULT_NAMESPACE | VARCHAR | Default database/schema on login |
| DEFAULT_ROLE | VARCHAR | Default role on login |
| EXT_AUTHN_DUO | BOOLEAN | Duo Security enabled |
| EXT_AUTHN_UID | VARCHAR | Duo authorization ID |
| HAS_MFA | BOOLEAN | MFA enrollment status |
| BYPASS_MFA_UNTIL | TIMESTAMP_LTZ | MFA bypass expiry |
| LAST_SUCCESS_LOGIN | TIMESTAMP_LTZ | Last successful login (UTC) |
| EXPIRES_AT | TIMESTAMP_LTZ | Account expiry time |
| LOCKED_UNTIL_TIME | TIMESTAMP_LTZ | Lock expiry time |
| HAS_RSA_PUBLIC_KEY | BOOLEAN | Key-pair auth configured |
| PASSWORD_LAST_SET_TIME | TIMESTAMP_LTZ | Last password change |
| OWNER | VARCHAR | Role with OWNERSHIP |
| DEFAULT_SECONDARY_ROLE | VARCHAR | Secondary role setting |
| HAS_PAT | BOOLEAN | Programmatic access token exists |
| HAS_WORKLOAD_IDENTITY | BOOLEAN | Workload identity configured |
| TYPE | VARCHAR | User type |
| IS_FROM_ORGANIZATION_USER | BOOLEAN | Imported from org user |

**Latency:** up to 2 hours. **Retention:** 365 days.

---

## ROLES

| Column | Type | Description |
|--------|------|-------------|
| ROLE_ID | NUMBER | System-generated identifier |
| CREATED_ON | TIMESTAMP_LTZ | Creation time (UTC) |
| DELETED_ON | TIMESTAMP_LTZ | Deletion time (UTC) |
| NAME | VARCHAR | Role name |
| COMMENT | VARCHAR | Role comment |
| OWNER | VARCHAR | Role with OWNERSHIP |
| ROLE_TYPE | VARCHAR | ROLE, DATABASE_ROLE, INSTANCE_ROLE, or APPLICATION_ROLE |
| ROLE_DATABASE_NAME | VARCHAR | Database (for database roles) |
| ROLE_INSTANCE_ID | NUMBER | Class instance ID (for instance roles) |
| OWNER_ROLE_TYPE | VARCHAR | Owner role type |
| IS_FROM_ORGANIZATION_USER_GROUP | BOOLEAN | Imported from org user group |

**Latency:** up to 2 hours. **Retention:** 365 days.

---

## GRANTS_TO_ROLES

| Column | Type | Description |
|--------|------|-------------|
| CREATED_ON | TIMESTAMP_LTZ | Grant time (UTC) |
| MODIFIED_ON | TIMESTAMP_LTZ | Modification time (UTC) |
| PRIVILEGE | VARCHAR | Privilege name (SELECT, INSERT, USAGE, etc.) |
| GRANTED_ON | VARCHAR | Object type (TABLE, DATABASE, SCHEMA, WAREHOUSE, etc.) |
| NAME | VARCHAR | Object name |
| TABLE_CATALOG | VARCHAR | Database name |
| TABLE_SCHEMA | VARCHAR | Schema name |
| GRANTED_TO | VARCHAR | Recipient type (ACCOUNT ROLE, APPLICATION, DATABASE_ROLE, etc.) |
| GRANTEE_NAME | VARCHAR | Recipient identifier |
| GRANT_OPTION | BOOLEAN | Can re-grant to others |
| GRANTED_BY | VARCHAR | Authorizing role |
| DELETED_ON | TIMESTAMP_LTZ | Revocation time (UTC) |
| GRANTED_BY_ROLE_TYPE | VARCHAR | APPLICATION, ROLE, or DATABASE_ROLE |
| OBJECT_INSTANCE | VARCHAR | Fully-qualified class instance name |

**Latency:** up to 2 hours. **Retention:** 365 days.

**Notes:**
- Excludes grants to database roles from databases created from shares
- Excludes grants on dropped objects
- Filter `DELETED_ON IS NULL` for current grants

---

## GRANTS_TO_USERS

| Column | Type | Description |
|--------|------|-------------|
| CREATED_ON | TIMESTAMP_LTZ | Grant time (UTC) |
| DELETED_ON | TIMESTAMP_LTZ | Revocation time (UTC) |
| ROLE | VARCHAR | Role granted |
| GRANTED_TO | VARCHAR | Always "USER" |
| GRANTEE_NAME | VARCHAR | User receiving the role |
| GRANTED_BY | VARCHAR | Authorizing role |

**Latency:** up to 2 hours. **Retention:** 365 days.

**Notes:**
- Re-granting a revoked role creates a new row
- Does NOT include privilege grants to users (only role grants)

---

## LOGIN_HISTORY

| Column | Type | Description |
|--------|------|-------------|
| EVENT_ID | NUMBER | System-generated identifier |
| EVENT_TIMESTAMP | TIMESTAMP_LTZ | Event time (UTC) |
| EVENT_TYPE | VARCHAR | Event type (e.g., LOGIN) |
| USER_NAME | VARCHAR | User attempting login |
| CLIENT_IP | VARCHAR | Source IP (IPv4 or IPv6) |
| REPORTED_CLIENT_TYPE | VARCHAR | Client type (JDBC_DRIVER, ODBC_DRIVER, etc.) |
| REPORTED_CLIENT_VERSION | VARCHAR | Client version |
| FIRST_AUTHENTICATION_FACTOR | VARCHAR | Primary auth method |
| SECOND_AUTHENTICATION_FACTOR | VARCHAR | MFA second factor (NULL if no MFA) |
| IS_SUCCESS | VARCHAR | YES or NO |
| ERROR_CODE | NUMBER | Error code on failure |
| ERROR_MESSAGE | VARCHAR | Error message on failure |
| RELATED_EVENT_ID | NUMBER | Reserved |
| CONNECTION | VARCHAR | Connection name used |
| CLIENT_PRIVATE_LINK_ID | VARCHAR | PrivateLink endpoint ID |
| FIRST_AUTHENTICATION_FACTOR_ID | VARCHAR | Credential ID for first factor |
| SECOND_AUTHENTICATION_FACTOR_ID | VARCHAR | Credential ID for MFA |
| LOGIN_DETAILS | VARCHAR | Malicious IP and risk info |

**Latency:** up to 2 hours. **Retention:** 365 days.

**Notes:**
- `0.0.0.0` appears for internal Snowflake operations (Snowsight, Snowpark Container Services)
- Does not record internal system user activity
