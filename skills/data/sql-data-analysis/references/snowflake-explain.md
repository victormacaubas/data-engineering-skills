# Reading A Snowflake Query Plan

## Running it

```sql
explain using tabular
select ...;
```

`tabular` is the default and returns one row per plan operator. An agent can scan that output column by column. `using json` holds the same plan as one nested document, which is harder to read through a query tool and can come back truncated. Use JSON only when you need to store the plan in a table.

`explain` compiles the query without running it, so it needs no running warehouse and uses no warehouse credits. Compilation uses a small amount of cloud services time. With no current warehouse, the plan is built as if for an XSMALL warehouse, so it can differ from production.

### What to explain

- **Query:** the query itself.
- **View, `create table ... as select`, or `insert ... select`:** the `select` body only.
- **dbt model:** render the Jinja by hand. Replace `{{ ref('x') }}` and `{{ source('a', 'b') }}` with the fully qualified names they resolve to, which you can find in `sources.yml` and the model's schema config. `target/compiled/` is usually missing or stale, so use it only if it exists and is newer than the model file. For an incremental model, explain both shapes: a full refresh, and the `is_incremental()` branch.

## Columns

| Column | Meaning |
|---|---|
| `step` | Execution step. Most queries have one. |
| `id` | Operator id. |
| `parentOperators` | Ids of the operators this one feeds. Use it to reconstruct the tree. |
| `operation` | Operator type: `TableScan`, `Filter`, `Join`, `CartesianJoin`, `Aggregate`, `WindowFunction`, `Sort`, `UnionAll`, `Result`, and others. |
| `objects` | The table or view a scan reads. |
| `alias` | The query alias for that object. |
| `expressions` | Filter predicates, join conditions, projections, aggregate functions. |
| `partitionsTotal` | Micro-partitions in the object. |
| `partitionsAssigned` | Partitions left after compile-time pruning. |
| `bytesAssigned` | Bytes in those partitions. |

Two things look alarming but usually aren't:

- **Views are expanded.** `objects` names the base tables behind a view, not the view. The view's own filters appear in the plan's `Filter` rows, so you can see what cleanup it already applies.
- **Masking policies wrap columns.** Calls such as `NUMBER_MASKING(T.COMPANY_ID)` or `TEXT_MASKING(...)` in `expressions` are masking policies, not functions in your query. They aren't a sargability problem you introduced.

One `GlobalStats` row gives totals for partitions and bytes across the plan. Start with it to see the overall scan size.

## Red flags

| What the plan shows | Usually means | Change |
|---|---|---|
| The same object in more than one `TableScan` | A CTE referenced several times, or several CTEs reading one source | Read it once and derive the slices with conditional aggregation or windows |
| `CartesianJoin` | A `cross join`, or a join whose condition isn't an equality the planner can hash | Make the cross join intentional and tiny (one row), or rewrite the condition as an equality on plain columns |
| `Join` whose `expressions` contain `OR`, `substr`, `left`, casts, or `iff` | Conditional or computed join keys | Normalize the key upstream; split `OR` branches |
| `partitionsAssigned` ≈ `partitionsTotal` on a large table with a date filter | The filter isn't pruning: a function on the column, a filter applied after a join, or a table not clustered on that column | Make the predicate sargable and push it to the scan; check clustering only for production tables |
| Large `bytesAssigned` on a table that contributes a few columns or a lookup | Too many columns selected, or the filter is applied too late | Select only needed columns; filter in the source CTE |
| `Sort` under a view's `Result` | `order by` inside a view or CTE | Remove it; sort in the consumer |
| `Aggregate` directly above a `Join` that produced `distinct` columns | `distinct` covering a fan-out | Fix the join grain |
| `WindowFunction` over an unfiltered scan | Window computed before filtering | Filter first, then window, then `qualify` |

A finding is worth acting on when it touches a large object. Two scans of a 50-row lookup table don't matter. Two scans of the main fact table do. Use `partitionsTotal` and `bytesAssigned` to judge size.

## Comparing candidates

When two rewrites both look right, explain both and compare the `GlobalStats` bytes, the number of `TableScan` rows on the large objects, and the join operator types. Keep the cheaper plan unless it's harder to read for a small saving.

## Limits

- The plan is logical. Operators may run in a different order.
- `partitionsAssigned` and `bytesAssigned` are upper bounds. Runtime pruning, such as join filters, can cut them further.
- No actual row counts, spill, or timing.

## Runtime follow-up

Use this when the plan looks fine but the query is still slow, or when you need to confirm a join doesn't explode. Running the query costs credits, so add a tight date filter when the full run would be large.

```sql
-- run the query, then in the same session:
select
    operator_id
    ,operator_type
    ,operator_statistics:input_rows::number as input_rows
    ,operator_statistics:output_rows::number as output_rows
    ,execution_time_breakdown:overall_percentage::float as pct_of_time
    ,operator_statistics:spilling:bytes_spilled_local_storage::number as spilled_local
    ,operator_statistics:spilling:bytes_spilled_remote_storage::number as spilled_remote
    ,operator_statistics:pruning:partitions_scanned::number as partitions_scanned
    ,operator_statistics:pruning:partitions_total::number as partitions_total
from table(get_query_operator_stats(last_query_id()))
order by pct_of_time desc;
```

Read it for:
- A join whose `output_rows` is well above its `input_rows`: an exploding join.
- Any remote spill: the operator ran out of memory and local disk.
- One operator with most of `pct_of_time`: start there.

`get_query_operator_stats` needs a query that completed in the last 14 days, and MONITOR or OPERATE on the warehouse that ran it. Field paths inside `operator_statistics` can change, so if one comes back null, `select *` once and read the actual keys.
