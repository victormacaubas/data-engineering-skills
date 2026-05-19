---
name: sql-data-analysis
description: SQL coding standards and best practices for data analysis queries. Use when writing, reviewing, or optimizing SQL for analytics, reporting, data extraction, or data transformation. Triggers on any SQL task involving SELECT queries, CTEs, window functions, aggregations, joins, or database schema work.
---

# SQL Data Analysis Standards

## Formatting

- Lowercase keywords (`select`, `from`, `where`, `join`, `group by`).
- Leading commas for column lists — makes diffs cleaner and columns easier to comment out.
- Consistent indentation (4 spaces). Break major clauses onto new lines.

```sql
select
    orders.order_id
    ,customers.customer_name
    ,orders.order_date
    ,sum(line_items.amount) as total_amount
from orders
inner join customers
    on orders.customer_id = customers.customer_id
inner join line_items
    on orders.order_id = line_items.order_id
where orders.order_date >= '2024-01-01'
group by
    orders.order_id
    ,customers.customer_name
    ,orders.order_date
order by orders.order_date desc
```

## Structure

- Prioritize **CTEs** for complex logic — avoid nested subqueries.
- Name CTEs descriptively to document the pipeline stage they represent.
- Use explicit `inner join` / `left join` syntax — never implicit comma joins.

```sql
with active_users as (
    select
        user_id
        ,min(created_at) as first_seen
    from events
    where event_type = 'login'
    group by user_id
)

,user_orders as (
    select
        active_users.user_id
        ,active_users.first_seen
        ,count(orders.order_id) as order_count
        ,sum(orders.amount) as total_spend
    from active_users
    left join orders
        on active_users.user_id = orders.user_id
    group by
        active_users.user_id
        ,active_users.first_seen
)

select *
from user_orders
where order_count > 0
```

## Aliases

- Descriptive aliases (length > 2 chars) for tables and computed fields.
- Always qualify column references with the table alias in multi-table queries.
- Alias every expression and aggregation — no unnamed columns in results.

## Field Ordering

Order columns logically: identifiers first, then dimensions, then metrics.

```sql
select
    -- identifiers
    user_id
    ,order_id
    -- dimensions
    ,region
    ,product_category
    -- metrics
    ,quantity
    ,revenue
    ,discount_amount
```

## NULL Handling

- Use `coalesce()` to provide defaults where appropriate.
- Be explicit about NULL behavior in aggregations and joins.
- Document when NULLs are expected vs. when they indicate data quality issues.

## Documentation

- Add `-- @comments` for complex business logic, non-obvious filters, or magic values.
- Comment the "why" not the "what" — the SQL itself shows what it does.

## Performance

- Filter early in CTEs to reduce downstream data volume.
- Avoid `select *` in production queries — list needed columns explicitly.
- Check for redundant joins or transformations.
- Be mindful of data type consistency across join keys.
