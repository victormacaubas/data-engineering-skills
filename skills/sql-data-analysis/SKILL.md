---
name: sql-data-analysis
description: Canonical SQL standards for analytics, reporting, extraction, transformation, and review work. Use when writing, reviewing, debugging, or optimizing analytical SQL involving SELECT queries, CTEs, joins, aggregations, window functions, date logic, dimensional models, dbt models, warehouse queries, cost control, or performance tuning. Applies across warehouses such as BigQuery, Snowflake, Redshift, Postgres, DuckDB, Trino, and Spark SQL; adapt syntax to the active dialect.
---

# SQL Data Analysis

Use this skill to produce SQL that is correct, readable, reviewable, performant, and cost-aware. Optimize first for trustworthy analytical results, then for maintainability, then for speed and spend.

## Query Contract

Before writing SQL, identify the query contract. Ask only when the answer cannot be inferred safely.

- Define the business question and expected grain of the result.
- Identify the source tables, join keys, event timestamps, and relevant date boundaries.
- State the unit of analysis: one row per user, account, order, event, day, cohort, or another explicit entity.
- Define metric semantics before aggregation: numerator, denominator, filters, deduplication rules, and null handling.
- Confirm whether output is exploratory, production reporting, dbt/model code, dashboard SQL, or an ad hoc extract.
- Prefer deterministic results: specify ordering when using `limit`, ranking, deduplication, or "latest" logic.

## Output Standard

Always produce SQL that can be pasted into the target environment with minimal editing.

- Use the active SQL dialect when known; otherwise write portable ANSI-style SQL and note dialect assumptions.
- Avoid `select *` except during short-lived exploration; list production columns explicitly.
- Use lowercase keywords: `select`, `from`, `where`, `join`, `group by`.
- Use leading commas for column lists; this makes diffs cleaner and columns easier to comment out.
- Use consistent indentation: 4 spaces. Break major clauses onto new lines.
- Use explicit `inner join`, `left join`, `cross join`, or `full outer join`; never use implicit comma joins.
- Prioritize CTEs for complex logic; CTEs are preferable to nested subqueries.
- Qualify columns in multi-table queries.
- Alias every expression, aggregation, and window calculation.
- Name CTEs as pipeline stages, not implementation trivia: `source_orders`, `filtered_orders`, `daily_revenue`, `ranked_customers`.
- Order final columns as identifiers, timestamps, dimensions, metrics, flags, metadata.
- Add comments only for business rules, unusual filters, warehouse-specific choices, or known data quality assumptions.

```sql
with filtered_orders as (
    select
        orders.order_id
        ,orders.customer_id
        ,orders.order_created_at
        ,orders.order_total
    from analytics.orders as orders
    where orders.order_created_at >= date '2026-01-01'
)

,customer_revenue as (
    select
        filtered_orders.customer_id
        ,count(*) as order_count
        ,sum(filtered_orders.order_total) as gross_revenue
    from filtered_orders
    group by filtered_orders.customer_id
)

select
    customer_revenue.customer_id
    ,customer_revenue.order_count
    ,customer_revenue.gross_revenue
from customer_revenue
where customer_revenue.order_count > 0
order by customer_revenue.gross_revenue desc
```

## Correctness Rules

Protect against silent wrong answers. Be explicit about grain, joins, time, and nulls.

- Validate join cardinality before trusting metrics: one-to-one, many-to-one, one-to-many, or many-to-many.
- Pre-aggregate one-to-many tables before joining to a fact table when the join would duplicate measures.
- Use `count(distinct ...)` deliberately; know whether duplicates are data errors or legitimate repeated events.
- Use `where` for row filters before aggregation and `having` for aggregate filters after grouping.
- Include every non-aggregated selected column in `group by`, or use the dialect's explicit aggregate helpers with care.
- Handle nulls intentionally: `coalesce` for business defaults, `nullif` for divide-by-zero protection, and plain nulls when unknown is meaningful.
- Avoid filtering a `left join`ed table in the final `where` clause unless intentionally converting it to an inner join.
- Use half-open time intervals for ranges: `>= start_date` and `< end_date`.
- Specify timezone assumptions for event timestamps, reporting days, and cohort boundaries.
- Deduplicate with an explicit rule, usually `row_number() over (...)` plus a deterministic `order by`.
- Prefer `exists` for semi-joins when only existence matters.
- Use `union all` unless duplicate elimination is required; `union` can hide data issues and adds cost.

## Analytics Patterns

Choose patterns that make the metric definition auditable.

- Build queries as a pipeline: source, filter, normalize, deduplicate, join, aggregate, final select.
- Keep each CTE at a clear grain and avoid mixing row-level and aggregate logic in the same stage.
- Put business filters as close to the source CTE as possible, but keep filters visible and named when they define a metric.
- Separate reusable dimensions from metric calculations.
- For ratios, calculate numerator and denominator separately, then divide in the final stage.
- For cohort, retention, funnel, or lifecycle analysis, preserve the anchor timestamp and event timestamp separately.
- For slowly changing dimensions, join using valid-time ranges and make current-vs-historical intent explicit.
- For incremental models, include a stable unique key and a clear incremental predicate.

## Performance And Cost

Treat warehouse work as paid compute over data volume. Reduce scanned data, shuffled data, and repeated work.

- Filter partition/date columns early with sargable predicates; avoid wrapping partition columns in functions when it prevents pruning.
- Select only required columns, especially in columnar warehouses.
- Push filters below joins and aggregations when semantics allow it.
- Aggregate before joining when it reduces row count without changing the metric.
- Avoid unnecessary `distinct`, global sorts, and wide window partitions.
- Keep window functions partitioned narrowly and ordered only by required columns.
- Use approximate aggregate functions only when the business tolerance allows it and label the result clearly.
- Prefer `exists` or pre-aggregated keys over joining large tables when retrieving no columns from the joined table.
- Avoid cross joins unless the row explosion is intentional and bounded.
- Replace repeated expensive CTEs with temp tables or materialized models when the warehouse re-evaluates CTEs or the query is reused.
- Avoid casting join keys at query time; normalize types upstream or cast the smaller side only when unavoidable.
- Use clustering, partitioning, sort keys, distribution keys, or materialized views when maintaining production models and the warehouse supports them.
- Inspect query plans, scanned bytes, partitions read, spill, shuffle, and join strategy when tuning.
- For ad hoc analysis, add tight date filters and row limits while developing, then remove or adjust them intentionally for final output.

## Warehouse Awareness

Adapt syntax and optimization choices to the warehouse.

- BigQuery: prefer partition filters, avoid `select *`, check bytes processed, use `qualify` when helpful, and use approximate functions only by choice.
- Snowflake: watch warehouse size and auto-suspend behavior, use clustering only when pruning benefits justify maintenance cost, and use `qualify` for window filters.
- Redshift: consider distribution and sort keys for large joins and time filters; avoid operations that force excessive redistribution.
- Postgres: keep predicates index-friendly, review `explain analyze`, avoid CTE materialization assumptions across versions, and add indexes only when ownership permits it.
- Spark SQL or Trino: minimize shuffles, control skew, avoid collecting huge intermediate results, and be careful with wide `order by`.
- DuckDB: use it for local analytics and file-backed exploration, but do not assume production warehouse performance characteristics.

## Review Checklist

When reviewing or optimizing SQL, lead with correctness risks before style.

- Does the result grain match the business question?
- Can any join duplicate or drop rows unexpectedly?
- Are filters applied at the correct stage and date boundary?
- Are nulls, zeros, and missing dimension rows handled intentionally?
- Are metrics named and calculated from auditable numerator/denominator logic?
- Is the query deterministic where it ranks, deduplicates, or limits rows?
- Does it scan only the needed partitions, rows, and columns?
- Are expensive operations justified by the output need?
- Is the dialect-specific syntax valid for the target warehouse?
- Are comments sparse but sufficient for non-obvious business logic?

## Response Pattern

When answering SQL requests:

1. State assumptions briefly when schema, dialect, or business rules are uncertain.
2. Provide the query first for implementation tasks.
3. Explain the grain, key joins, and metric logic after the query when useful.
4. Call out performance or cost considerations that matter for the target warehouse.
5. Suggest validation queries for high-risk metrics or joins.

For reviews, report findings in severity order with file or line references when available. Include corrected SQL snippets only for the risky part unless a full rewrite is requested.
