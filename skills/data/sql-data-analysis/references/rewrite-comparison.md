# Rewrite Comparison

Compare a rewrite, an optimization, or a migrated model with the original before it replaces SQL that returns the right rows. The comparison finds three kinds of difference: rows only in the original, rows only in the rewrite, and rows both return a different number of times.

## Contents

1. The comparison query
2. Low-cost checks on a large relation
3. Normalization
4. Intended differences
5. Rerun check for incremental and merge logic

## 1. The comparison query

```sql
with original as (
    -- the original query, unchanged
)

,rewrite as (
    -- the rewritten query
)

,both_sides as (
    select order_id, customer_id, order_total, 1 as side from original
    union all
    select order_id, customer_id, order_total, -1 as side from rewrite
)

,differences as (
    select
        order_id
        ,customer_id
        ,order_total
        ,sum(case when side = 1 then 1 else 0 end) as original_count
        ,sum(case when side = -1 then 1 else 0 end) as rewrite_count
    from both_sides
    group by order_id, customer_id, order_total
    having sum(side) <> 0
)

select
    sum(case when rewrite_count = 0 then 1 else 0 end) as only_in_original
    ,sum(case when original_count = 0 then 1 else 0 end) as only_in_rewrite
    ,sum(case when original_count > 0 and rewrite_count > 0 then 1 else 0 end) as different_count
from differences
```

Select `* from differences` to see the rows behind the counts. An empty `differences` means the two return the same rows the same number of times.

- List the same columns in the same order on both sides: every output column, minus any that section 3 excludes.
- Keep `union all`. `union` removes duplicates first and hides the counts this query exists to catch.
- `group by` puts nulls in one group, so a row with a null in the same column on both sides cancels out. No null-safe join is needed.
- Where the dialect documents `except all` (Postgres, DuckDB, Trino, Spark SQL), `original except all rewrite` and `rewrite except all original` also keep duplicate counts. Snowflake, BigQuery, and Redshift don't support it. Plain `except` or `minus` is never enough.

## 2. Low-cost checks on a large relation

On a large relation, run the cheap checks first:

1. Row count on each side.
2. On Snowflake, `hash_agg(<columns>)` on each side: an order-independent fingerprint of the rows. List the same columns in the same order on both sides, since the column order changes the hash.

Don't build a fingerprint from `bit_xor` of a row hash, the usual recipe on BigQuery, Postgres, DuckDB, and Spark: identical rows cancel in pairs, so a rewrite that doubles a row leaves the fingerprint unchanged.

A difference in either check means the rows differ; run the row-level comparison to find them. Equal counts or fingerprints are evidence, not proof: say which check ran, and run the row-level comparison when the user asks for it. To compare rows on a large relation, compare a sample with the same filter on both sides, such as one date partition, and state the filter.

## 3. Normalization

- Row order needs nothing; the comparison doesn't depend on it.
- Round floating-point values to a stated precision, the same on both sides: `round(gross_revenue, 2)`.
- Exclude a column that differs on every run, such as a load timestamp or a generated surrogate key, and name it with the reason.
- Trim or change case only when the request says that difference doesn't matter.

State each normalization in the response. With none, say the comparison uses every column as it is. A normalization you don't state can hide a defect.

## 4. Intended differences

When the request means the rewrite to return different rows, such as a bug fix that removes a join fan-out, list each intended difference as a predicate or a short description with its expected count. Exclude only those rows:

```sql
select *
from differences
where not (
    -- intended: the old join to order_items returned each order once per item
    original_count > 1
    and rewrite_count = 1
)
```

The result must be empty, and the excluded rows must match the expected count. Each remaining row is a defect: report it, and don't present the rewrite as equivalent.

## 5. Rerun check for incremental and merge logic

An incremental model or a merge must leave the table unchanged when it runs again on the same input:

1. Run the load on a fixed input in a development schema.
2. Copy the target table.
3. Run the load again on the same input.
4. Compare the copy, as `original`, with the target, as `rewrite`, using the query in section 1.

A row only in the target is one the second run added; a different count is one it duplicated. Either means the load is not idempotent. Exclude columns the load stamps on every run, such as `_loaded_at`, as section 3 describes, and name them.

The check needs write access to a development schema. Without it, give these steps and say that the check did not run.
