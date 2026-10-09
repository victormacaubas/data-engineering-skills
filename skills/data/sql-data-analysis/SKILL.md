---
name: sql-data-analysis
description: Canonical SQL standards for analytics, reporting, extraction, transformation, and review work. Use when writing, reviewing, debugging, simplifying, or optimizing analytical SQL, including SELECT queries, CTEs, joins, aggregations, window functions, date logic, dimensional models, views, CTAS tables, dbt models of any materialization (view, table, incremental, ephemeral, snapshot), warehouse queries, query plans and EXPLAIN, compute cost, or runtime tuning. Also use when a query works but is too long, too slow, or too hard to follow. Applies across warehouses such as Snowflake, BigQuery, Redshift, Postgres, DuckDB, Trino, and Spark SQL; adapt syntax to the active dialect.
---

# SQL Data Analysis

Write SQL the way a senior data engineer does when their team pays for every query: correct first, then simplest, then cheapest. A shorter query that returns the same rows is usually the cheaper one too, because every CTE, join, and predicate is work the warehouse repeats on each run.

Two reference files carry the detail. Read each one at the point named below, not up front:

- `references/expensive-patterns.md`: before/after SQL for each costly shape in *Performance And Cost*, with the null and grain traps each rewrite can introduce.
- `references/snowflake-explain.md`: what each `explain` column means, which plan rows are red flags, which ones look alarming but aren't, and the runtime follow-up.

## Know What You're Building

What the SQL becomes decides what it costs and which shape it should take. Find out before writing. Ask the user only when the SQL will be persisted (a view, table, or dbt model) and the type, or the dbt materialization, is still open, because that choice changes the query's shape.

| Artifact | How it's paid for | What it changes |
|---|---|---|
| Ad hoc query or extract | Once | Tight date filters and row limits while developing |
| View | On every read, once per consumer, and again inside every view built on it | Keep the plan lean; nested views compound |
| Table / CTAS | Once per build | Heavier logic is acceptable; cluster only when pruning justifies the maintenance |
| dbt `view` / `table` | Same as view / table | Same as above |
| dbt `incremental` | Per run, over new rows only | Stable `unique_key`; an `is_incremental()` filter on a sargable column; a lookback window for late-arriving rows; reruns that produce the same result; a deliberate `incremental_strategy` (`merge`, `delete+insert`, `append`) |
| dbt `ephemeral` | Inlined into every model that references it | Expensive logic is recomputed per reference; materialize it instead if reused |
| dbt snapshot | Per run, comparing to history | `strategy` (`timestamp` vs `check`), `unique_key`, `updated_at` or `check_cols`; select source columns only and transform downstream |
| Snowflake dynamic table / materialized view | On refresh | Check the refresh mode and the constructs it disallows before writing |

## Query Contract

Before writing SQL, identify the query contract. Ask only when you cannot infer the answer safely.

- Define the business question and expected grain of the result.
- Identify the source tables, join keys, event timestamps, and relevant date boundaries.
- State the unit of analysis: one row per user, account, order, event, day, cohort, or another explicit entity.
- Define metric semantics before aggregation: numerator, denominator, filters, deduplication rules, and null handling.
- Prefer deterministic results: specify ordering when using `limit`, ranking, deduplication, or "latest" logic.
- Read from the most-modeled layer that has the columns you need. A raw load or CDC table makes you rebuild soft-delete filters, dedup, and type fixes that the modeled layer already applies, and each rebuild is a place to drift from it.
- Let the data justify each defense. Before writing a guard for an edge case (excluded IDs, null branches, date floors, fallback joins, grace periods), check whether the case exists, batching all the candidate cases into one profiling query. Write logic for the cases the data shows or the user names, and say which ones you checked. A hardcoded ID or magic date gets a comment naming where it came from.

Check the real shape before assuming it. When a warehouse connection is available, describe the tables you'll use; in a dbt project, read the model's `schema.yml` and sources, including their `unique` and `not_null` tests. A `unique` test on a join key settles the cardinality question in *Correctness Rules*; a column name written from memory is where most first drafts go wrong.

## Output Standard

Always produce SQL that can be pasted into the target environment with minimal editing.

- Use the active SQL dialect when known; otherwise write portable ANSI-style SQL and note dialect assumptions.
- For a function or syntax you're not sure the target warehouse supports in its current form (`qualify`, `approx_*`, JSON and semi-structured functions), check that warehouse's docs rather than memory. Dialects add, rename, and deprecate functions.
- For dbt model code, write the model the request asked for. Don't add models, tests, or `schema.yml` docs it didn't ask for; mention the ones that would help.
- Avoid `select *` except during short-lived exploration; list production columns explicitly.
- Use lowercase keywords: `select`, `from`, `where`, `join`, `group by`.
- Use leading commas for column lists; they make diffs cleaner and columns easier to comment out.
- Use consistent indentation: 4 spaces. Break major clauses onto new lines.
- Use explicit `inner join`, `left join`, `cross join`, or `full outer join`; never use implicit comma joins.
- Prefer CTEs to nested subqueries for complex logic, but don't add a CTE that only renames or re-lists columns from the one before it.
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

Guard against silent errors. Be explicit about grain, joins, time, and nulls.

- Validate join cardinality before trusting metrics: one-to-one, many-to-one, one-to-many, or many-to-many. When you can query the warehouse, run the check (duplicate count on the join key, or row counts before and after the join) and report the number. A dry run or `explain` proves the query parses, not that its grain is right.
- Pre-aggregate one-to-many tables before joining to a fact table when the join would duplicate measures.
- Use `count(distinct ...)` deliberately; know whether duplicates are data errors or legitimate repeated events.
- Use `where` for row filters before aggregation and `having` for aggregate filters after grouping.
- Include every non-aggregated selected column in `group by`, or use the dialect's explicit aggregate helpers with care.
- Handle nulls intentionally: `coalesce` for business defaults, `nullif` for divide-by-zero protection, and plain nulls when unknown is meaningful. A `col != 'x'` filter also drops rows where `col` is null; say so when that's intended, use `is distinct from` when it isn't.
- Avoid filtering a `left join`ed table in the final `where` clause unless intentionally converting it to an inner join.
- Use half-open time intervals for ranges: `>= start_date` and `< end_date`.
- Specify timezone assumptions for event timestamps, reporting days, and cohort boundaries.
- Deduplicate with an explicit rule, usually `row_number() over (...)` plus a deterministic `order by`.
- Use `union all` unless duplicate elimination is required; `union` can hide data issues and adds a sort or hash over the whole result.

## Analytics Patterns

Use patterns that keep metric definitions auditable.

- Build queries as a pipeline: source, filter, normalize, deduplicate, join, aggregate, final select.
- Keep each CTE at a clear grain and avoid mixing row-level and aggregate logic in the same stage.
- Put business filters as close to the source CTE as possible, but keep filters visible and named when they define a metric.
- Separate reusable dimensions from metric calculations.
- For ratios, calculate numerator and denominator separately, then divide in the final stage.
- For cohort, retention, funnel, or lifecycle analysis, preserve the anchor timestamp and event timestamp separately.
- For slowly changing dimensions, join using valid-time ranges and make current-vs-historical intent explicit.

## Performance And Cost

Reduce scanned data, shuffled data, and repeated work. Apply this to every CTE and join, not just the final select; most of the cost in a long query hides in the middle.

- Filter partition/date columns early with sargable predicates. A function on a filter column (`date(created_at) = ...`, `to_varchar(id) = ...`) usually stops pruning.
- Select only required columns, especially in columnar warehouses.
- Push filters below joins and aggregations when semantics allow it.
- Aggregate before joining when it reduces row count without changing the metric.
- Keep window functions partitioned narrowly and ordered only by required columns; filter first, then window, then `qualify`.
- Use approximate aggregate functions only when the business tolerance allows it and label the result clearly.
- Avoid casting join keys at query time; normalize types upstream or cast the smaller side only when unavoidable.
- Replace repeated expensive CTEs with temp tables or materialized models when the warehouse re-evaluates CTEs or the query is reused.
- Use clustering, partitioning, sort keys, distribution keys, or materialized views when maintaining production models and the warehouse supports them.
- For ad hoc analysis, add tight date filters and row limits while developing, then remove or adjust them intentionally for final output.

These shapes are the usual sources of avoidable cost. Each has a cheaper equivalent:

| Expensive shape | Cheaper equivalent |
|---|---|
| Excluding rows with `left join ... where right.key is null`, often after a `select distinct` of the keys | `where not exists (select 1 ... where key = outer.key)`: an anti-join that stops at the first match and needs no dedup |
| `not in (subquery)` | `not exists`; `not in` returns no rows at all if the subquery yields a null |
| Keeping rows that match with an `inner join` you take no columns from | `where exists (...)`: a semi-join that can't fan out |
| `OR` inside a join condition, or several conditional joins to the same table | Normalize the key once in an upstream CTE and join on it, or split into `union all` branches with plain equality joins |
| Functions on join keys (`substr`, `left`, casts) | Compute the key once upstream; equality on bare columns lets the planner hash-join and prune |
| The same table scanned in several CTEs | Read it once and derive the variants with conditional aggregation or window functions |
| A global `max()`/`min()` cross-joined back onto rows | A scalar subquery in the `where` clause that uses it; a plain `max()` over a table is often answered from metadata |
| Long `OR` chains of `is distinct from` to keep "everything except" | State the excluded set once with `not exists` against it; a bare `where not (a and b and c)` drops rows where any part is null |
| `select distinct` to hide duplicates | Fix the join that fanned out; `distinct` sorts or hashes the whole result and hides the bug |
| `order by` inside a view or a CTE | Sort only in the final consumer query |
| Unintended `cross join`, or a join condition that doesn't relate the two sides | Cross join only a bounded, small side (a one-row parameter set, a date spine); otherwise add the equality the join is missing |
| Many-to-many or range (`between`) joins on large tables | Pre-aggregate or bucket one side first; confirm the row count after the join |

Read `references/expensive-patterns.md` the first time one of these comes up: you're about to rewrite one of these shapes (in your draft or in SQL under review), a plan flags one, or you're asked to simplify a query that works but is long or slow. A rewrite here can change results in edge cases: an anti-join treats nulls differently from an `OR` chain, and dropping a `distinct` exposes a fan-out. The file shows which ones do and how to confirm the row count still matches.

## Check The Plan Before Presenting

On Snowflake, when you can run queries, run `explain using tabular` on the final query before presenting it if it has a join or CTE, or will be persisted. A single-table aggregate doesn't need it. A plan catches what reading misses: a table scanned twice, a Cartesian join, a filter that doesn't prune. It only compiles the query, so it uses no warehouse credits.

Read `references/snowflake-explain.md` before the first `explain` you run. It covers two things that look like problems but aren't. Views are expanded to their base tables. Masking policies show up as function wrappers around columns.

- For a view, CTAS, or dbt model, explain the `select` body, not the DDL.
- Read the plan for:
    - the same object in more than one `TableScan`
    - a `CartesianJoin`
    - join or filter `expressions` that contain `OR` or wrap columns in functions
    - `partitionsAssigned` close to `partitionsTotal` on a large table you meant to filter by date
    - `bytesAssigned` far out of proportion to what the result needs
- When two shapes are close and you can't tell which is cheaper from reading, explain both and keep the cheaper one.
- Fix what the plan shows. Explain again only if the fix changed the query's shape (joins, scans, or CTEs), not for a renamed column. Present the query with a one or two line plan summary: scans, join types, and pruning on the largest table.

`explain` partition and byte numbers are compile-time upper bounds; it shows no spill, timings, or actual row counts. When the query is still slow or a join may explode, run it, with a tight date filter if the full run would be large, and read `get_query_operator_stats`. The runtime query and how to read it are in `references/snowflake-explain.md`.

On other warehouses, use the native equivalent when it's cheap: BigQuery dry-run bytes, Postgres `explain` (or `explain analyze`, which executes the query), Trino or Spark `explain`.

## Warehouse Awareness

Adapt syntax and optimization choices to the target warehouse.

- BigQuery: prefer partition filters, avoid `select *`, check bytes processed, use `qualify` when helpful, and use approximate functions only by choice.
- Snowflake: watch warehouse size and auto-suspend behavior, use clustering only when pruning benefits justify maintenance cost, and use `qualify` for window filters.
- Redshift: consider distribution and sort keys for large joins and time filters; avoid operations that force excessive redistribution.
- Postgres: keep predicates index-friendly, review `explain analyze`, avoid CTE materialization assumptions across versions, and add indexes only when ownership permits it.
- Spark SQL or Trino: minimize shuffles, control skew, avoid collecting huge intermediate results, and be careful with wide `order by`.
- DuckDB: use it for local analytics and file-backed exploration, but do not assume production warehouse performance characteristics.

## Review Checklist

When reviewing or optimizing SQL, lead with correctness risks before style.

- Is the artifact type known, and does the query's shape suit how it's paid for?
- Does the result grain match the business question?
- Can any join duplicate or drop rows unexpectedly?
- Are filters applied at the correct stage and date boundary?
- Are nulls, zeros, and missing dimension rows handled intentionally?
- Are metrics named and calculated from auditable numerator/denominator logic?
- Is the query deterministic where it ranks, deduplicates, or limits rows?
- Does it read from the modeled layer, or does it rebuild cleanup that already exists?
- Does every guard and hardcoded value correspond to a case the data shows or the user named?
- Is any table scanned more than once, or any CTE a pass-through?
- Does it scan only the needed partitions, rows, and columns?
- Are expensive operations justified by the output need?
- On Snowflake, was the plan checked, and does it show what the query intends?
- Is the dialect-specific syntax valid for the target warehouse?
- Are comments sparse but sufficient for non-obvious business logic?

## Response Pattern

When answering SQL requests:

1. State the artifact type when it isn't obvious from the request, and any assumptions about schema, dialect, or business rules.
2. Provide the query first for implementation tasks.
3. Explain the grain, key joins, and metric logic after the query when useful.
4. On Snowflake, give the plan summary; elsewhere, call out the performance or cost considerations that matter for the target warehouse.
5. For high-risk metrics or joins, run the validation queries when you can query the warehouse and report what they returned; suggest them only when you can't run them.

For reviews, report findings in severity order with file or line references when available. Include corrected SQL snippets only for the risky part unless a full rewrite is requested. When a simpler query returns the same rows, say so and show it; that is a finding, not a style note.
