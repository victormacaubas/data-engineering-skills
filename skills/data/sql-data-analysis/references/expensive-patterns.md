# Expensive SQL Patterns And Their Rewrites

Each pattern shows a costly shape, the cheaper equivalent, and why the rewrite is cheaper. The examples are generic, so adapt the names to the query in front of you. When you rewrite existing SQL, check the rewrite returns the same rows before you swap it in: run a row-count or `except` comparison when you can query the warehouse.

## Contents

1. Anti-joins: excluding rows
2. Semi-joins: keeping rows that match
3. `OR` and conditional joins
4. Functions on join and filter keys
5. Repeated scans and cross-joined aggregates
6. `distinct` covering a fan-out
7. "Everything except" predicates
8. Smaller traps

## 1. Anti-joins: excluding rows

Costly:

```sql
with refunded_order_ids as (
    select distinct
        refunds.order_id
    from analytics.refunds as refunds
)

select
    orders.order_id
    ,orders.order_total
from analytics.orders as orders
left join refunded_order_ids
    on refunded_order_ids.order_id = orders.order_id
where refunded_order_ids.order_id is null
```

Cheaper:

```sql
select
    orders.order_id
    ,orders.order_total
from analytics.orders as orders
where not exists (
    select 1
    from analytics.refunds as refunds
    where refunds.order_id = orders.order_id
)
```

`not exists` says what it means and compiles to an anti-join, which stops at the first match. The `left join` version has to deduplicate the keys first, or it fans out, then join, then throw away the matches. Its intent is also easy to break: someone adds a filter on `refunded_order_ids` in the `where` clause and the exclusion silently changes.

Avoid `where orders.order_id not in (select refunds.order_id ...)`. If the subquery returns a single null, `not in` evaluates to unknown for every row and the query returns nothing.

`except` also works when you only need the key columns, but it deduplicates the result, so it doesn't fit row-level output.

## 2. Semi-joins: keeping rows that match

Costly: an `inner join` to a table you take no columns from, often followed by `distinct` because the join multiplied rows.

```sql
select distinct
    customers.customer_id
    ,customers.customer_name
from analytics.customers as customers
inner join analytics.orders as orders
    on orders.customer_id = customers.customer_id
```

Cheaper:

```sql
select
    customers.customer_id
    ,customers.customer_name
from analytics.customers as customers
where exists (
    select 1
    from analytics.orders as orders
    where orders.customer_id = customers.customer_id
)
```

A semi-join can't fan out, so the `distinct` and its sort or hash go away.

## 3. `OR` and conditional joins

Costly: two lookups into the same table, each switched on by a condition inside its `on` clause.

```sql
select
    payments.payment_id
    ,coalesce(by_email.account_id, by_ref.account_id) as account_id
from raw.payments as payments
left join analytics.accounts as by_email
    on payments.payer_ref like '%@%'
    and by_email.email = lower(payments.payer_ref)
left join analytics.accounts as by_ref
    on payments.payer_ref not like '%@%'
    and by_ref.external_ref = payments.payer_ref
```

Cheaper: first ask whether both branches occur in the data. Often one never does, and the branch is a defense against nothing. If both are real, normalize the key once and join once:

```sql
with payment_keys as (
    select
        payments.payment_id
        ,iff(payments.payer_ref like '%@%', 'email', 'external_ref') as key_type
        ,iff(payments.payer_ref like '%@%', lower(payments.payer_ref), payments.payer_ref) as key_value
    from raw.payments as payments
)

,account_keys as (
    select account_id, 'email' as key_type, email as key_value from analytics.accounts
    union all
    select account_id, 'external_ref' as key_type, external_ref as key_value from analytics.accounts
)

select
    payment_keys.payment_id
    ,account_keys.account_id
from payment_keys
left join account_keys
    on account_keys.key_type = payment_keys.key_type
    and account_keys.key_value = payment_keys.key_value
```

`account_keys` reads `analytics.accounts` twice. That's fine for a dimension table this size, and a plan showing two scans of it isn't worth fixing. For a large table, read it once with `unpivot`.

Equality joins on plain columns let the planner hash-join. With `OR` or conditional predicates it may fall back to a nested-loop or filtered Cartesian join, and the `coalesce` across two joins also makes the grain hard to verify.

## 4. Functions on join and filter keys

Costly:

```sql
where date(events.event_at) = date '2026-03-01'
...
on to_varchar(orders.customer_id) = substr(crm.contact_key, 6)
```

Cheaper:

```sql
where events.event_at >= '2026-03-01'::timestamp
    and events.event_at < '2026-03-02'::timestamp
...
on orders.customer_id = crm_keys.customer_id   -- crm_keys parses contact_key once, upstream
```

Pruning uses the column's stored min and max values. Once the column is wrapped in a function, the planner can't use them and reads every partition. A cast on a join key runs on every row of both sides and can block hash joins. Parse or cast once, on the smaller side or in an upstream model.

## 5. Repeated scans and cross-joined aggregates

Costly: one large source read by several CTEs, plus a full-table aggregate cross-joined back in.

```sql
with latest_load as (
    select max(events.loaded_at) as max_loaded_at
    from analytics.events as events
)

,recent_events as (
    select events.*
    from analytics.events as events
    cross join latest_load
    where events.loaded_at >= dateadd('day', -3, latest_load.max_loaded_at)
)
```

Cheaper: ask whether the clock is needed at all. A fixed window or the incremental predicate often replaces it. If it is needed, use a scalar subquery where the filter is:

```sql
select
    events.event_id
    ,events.loaded_at
from analytics.events as events
where events.loaded_at >= (
    select dateadd('day', -3, max(latest.loaded_at))
    from analytics.events as latest
)
```

On Snowflake a plain `max()` over a table is often answered from micro-partition metadata, so the subquery is nearly free and the outer filter can still prune. Avoid `qualify ... max(loaded_at) over ()`: the window reads every row before `qualify` filters, so nothing prunes.

A CTE referenced several times may be computed again for each reference, depending on the warehouse. When several stages need different slices of one table, read it once with conditional aggregation (`count_if`, `sum(iff(...))`, `min(case when ...)`) and not one CTE per slice. In a Snowflake plan this shows up as the same object in several `TableScan` rows.

## 6. `distinct` covering a fan-out

Costly:

```sql
select distinct
    orders.order_id
    ,orders.order_total
from analytics.orders as orders
inner join analytics.order_items as items
    on items.order_id = orders.order_id
```

Cheaper: find out why rows multiplied and fix the grain: drop the join (section 2), pre-aggregate the many side, or deduplicate with an explicit `row_number()` rule. `distinct` over the whole result is a sort or hash of every column, and it hides a join bug that will show up in a metric later.

## 7. "Everything except" predicates

Costly:

```sql
where seams.account_id is null
    or orders.channel is distinct from 'wholesale'
    or orders.is_test is distinct from false
    or orders.ordered_at is null
    or orders.ordered_at < seams.cutover_at
```

Cheaper: name the set you're excluding once, positively:

```sql
where not exists (
    select 1
    from cutovers
    where cutovers.account_id = orders.account_id
        and orders.channel = 'wholesale'
        and orders.is_test = false
        and orders.ordered_at >= cutovers.cutover_at
)
```

A reader checks one condition rather than a chain of negations, and the planner gets an anti-join, not an `OR` filter it can't push down. The null-safety the chain was protecting comes for free: a null in any column makes the inner predicate unknown, the row isn't excluded, and so it's kept. Confirm that's the intended behaviour for nulls.

## 8. Smaller traps

- **`union` where `union all` is meant.** It deduplicates across the full row. Use `union all` when the branches can't overlap, and when they can, decide which overlap is correct.
- **`order by` in a view or CTE.** It costs a sort on every read and doesn't guarantee the order of the outer query. Sort in the final consumer.
- **Pass-through CTEs.** A CTE that only re-lists or renames the previous one's columns costs review time and plan nodes. Fold it into its neighbour.
- **Wide windows.** `row_number() over (order by ...)` with no `partition by` sorts the whole table on one node. Partition by the entity, filter before the window, and use `qualify` after it.
- **Many-to-many and range joins.** `on a.ts between b.start_at and b.end_at` across two large tables compares many row pairs. Bucket one side by day or key first, or pre-aggregate, and check the row count after the join.
- **`count(distinct)` at scale.** Exact distinct counts over billions of rows are memory-hungry. Use `approx_count_distinct` only when the business tolerates it, and label the result.
- **Raw-layer reads.** Reading the load or CDC table and filtering deletes yourself duplicates the modeled layer's work and drifts from it. Read the modeled table unless it lacks a column you need.
