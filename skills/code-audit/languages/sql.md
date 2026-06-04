# Language Pack: SQL

Load when the review scope contains `.sql` files, dbt models, or warehouse queries. Covers analytical SQL across BigQuery, Snowflake, Redshift, Postgres, DuckDB, Trino, and Spark SQL — **adapt syntax to the active dialect** (detect from `dbt_project.yml` profile, file path, or function names). This pack sharpens the universal review categories; the category keys in parentheses match `../SKILL.md`. Read it fully before scoring.

> SQL maps onto the dimensions a little differently from imperative code: `correctness` is dominated by join fan-out and NULL semantics, `performance` by scan/shuffle cost, and `error-handling`/`idempotency` by rerun safety rather than try/catch. The category keys stay the same; the content shifts.

## Idiom & formatter

- Leading commas or trailing commas consistently; uppercase keywords (or follow the repo's existing convention — match, don't impose). CTEs over nested subqueries. One column per line in long SELECTs. `sqlfluff` is the common linter.
- dbt: `ref()`/`source()` instead of hardcoded table names; models named by layer (`stg_`, `int_`, `fct_`, `dim_`).

## Security (`security`)

- String-concatenated / templated SQL built from user input without parameterization or `quote_literal` — injection.
- Secrets or credentials embedded in a query, connection string, or `COPY`/external-stage definition.
- Over-broad grants in DDL under review (`GRANT ALL ... TO PUBLIC`); PII selected into a non-restricted target.

## Correctness & hidden bugs (`correctness`, `data-integrity`)

- **Join fan-out:** a join on a non-unique key silently multiplies rows; an aggregate after the fan-out is then wrong. Demand a reason any time a join isn't on a known unique/PK column. (This is the SQL face of the generic *partial/non-unique key defect* — same root cause, mirror symptom: SQL multiplies rows, imperative dedup/skip logic drops them.)
- **NULL semantics:** `NOT IN (subquery)` returns no rows when the subquery contains a NULL; `=`/`<>` against NULL; `COUNT(col)` skipping NULLs vs `COUNT(*)`; aggregates ignoring NULLs unexpectedly.
- **`INNER` vs `LEFT`** dropping rows the author meant to keep; filtering a `LEFT JOIN`ed table in the `WHERE` clause (turns it back into an inner join) instead of in the `ON`.
- **Window functions:** missing `PARTITION BY`, wrong frame (`ROWS` vs `RANGE`), `ROW_NUMBER` without a deterministic `ORDER BY` (non-reproducible results), dedup via `QUALIFY ROW_NUMBER()` picking an arbitrary row.
- **GROUP BY** mismatch with selected non-aggregated columns; `DISTINCT` masking a fan-out bug instead of fixing it.
- **Date/time:** time-zone-naive comparisons; `BETWEEN` on timestamps catching/missing the boundary; date truncation assuming a session time zone; off-by-one on `DATE_DIFF`.
- **Type coercion:** implicit string↔number casts; float equality; integer division truncation.
- dbt (`data-integrity`): `unique`/`not_null` tests missing on a key the model assumes is unique; incremental model `is_incremental()` filter that drops late-arriving rows.

## Performance (`performance`)

- `SELECT *` in a model materialized downstream (wide scans, schema-change fragility).
- Cross join / accidental Cartesian product; join order forcing a large shuffle.
- Missing partition/cluster pruning predicate on a partitioned table (full scan — direct cost in BigQuery/Snowflake).
- Functions wrapped around a filtered/joined column defeating partition elimination or index use.
- `DISTINCT`/`GROUP BY` on high-cardinality columns where a window or `EXISTS` would be cheaper; correlated subquery that should be a join.
- Unpartitioned `ORDER BY` over a huge result; `COUNT(DISTINCT ...)` where approximate is acceptable.

## Architecture & design (`architecture`)

SQL is declarative and has no objects, so **SOLID does not apply** — don't force it. This dimension here means *layering, modularity, and DRY*: clean staging→intermediate→mart separation, single-responsibility models, no copy-pasted logic, sensible materialization.

- Monolithic query doing staging + business logic + presentation in one statement — should be CTEs or separate dbt models by layer.
- Repeated subquery logic copy-pasted instead of a CTE or an `int_` model; hardcoded table names instead of `ref()`/`source()`.
- Materialization choice mismatch (a heavy transform left as a `view`; a rarely-changing dim rebuilt as `table` every run when incremental fits).

## Error handling & resilience (`idempotency`, `error-handling`)

- **Idempotency / rerun safety:** `INSERT` without dedup or a `MERGE`/`INSERT OVERWRITE` so a rerun double-counts; non-deterministic logic (`CURRENT_TIMESTAMP`, unordered `ROW_NUMBER`) that makes reruns diverge.
- Incremental models without a late-arriving-data strategy; no handling for an empty source (downstream divide-by-zero or empty-partition overwrite).
- Silent `NULL` propagation through `/` (division by zero returns NULL in some dialects, errors in others) with no `NULLIF`/`SAFE_DIVIDE` guard.

## Readability & style (`readability`)

- Cryptic single-letter aliases (`a`, `b`, `c`) on many-table joins; no CTE names describing intent.
- Magic literals (status codes, date cutoffs) inline instead of a CTE/variable with a name.
- Deeply nested subqueries where CTEs would read top-to-bottom.

## Grep patterns worth running

```
SELECT \*               # select-star in models
NOT IN \(               # NULL-trap with subqueries
LEFT JOIN               # check WHERE-clause filters on the right table
ROW_NUMBER\(\)          # check for deterministic ORDER BY
CURRENT_TIMESTAMP|NOW\(\)   # non-deterministic → rerun divergence
DISTINCT                # is it masking a fan-out?
```

## Calibration hints

- A join fan-out feeding an aggregate is a **silent-wrong-answer bug → `critical`/`high` under `correctness`**; treat it like any silent data-corruption finding.
- A `NOT IN (subquery-with-NULLs)` is at least **high** — it silently returns the wrong row set.
- A non-idempotent `INSERT` in a scheduled job that double-counts on rerun is **high** under `idempotency`.
- A missing partition-pruning predicate on a large partitioned table is at least **high** under `performance` (the unbounded-scan, data-layer flavor).
