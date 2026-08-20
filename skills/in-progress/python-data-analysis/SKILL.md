---
name: python-data-analysis
description: Python coding standards for data analysis — pandas, numpy, notebooks, dataframe transforms, statistical modeling, visualization, and analytical ETL. Use when writing or reviewing Python for data extraction, transformation, analysis, or plotting. Builds on python-engineering-standards.
---

# Python Data Analysis Standards

These standards extend `python-engineering-standards` with patterns for dataframe work, notebooks, and analytical pipelines. **Read the base standards first.** All base guidance (style, typing, docstrings, logging, error handling, testing, SOLID, dependency injection, idempotency, etc.) applies here unchanged.

The content below is **additive**. It adds patterns for pandas, numpy, and notebooks while leaving the base standards in effect.

## Data Inspection Before Transformation

Always inspect before transforming. Spend one minute on `df.info()` instead of an hour debugging an incorrect join.

- Shape, dtypes, null counts: `df.shape`, `df.dtypes`, `df.isnull().sum()`.
- Descriptive stats: `df.describe(include="all")`.
- Value distributions for keys: `df[key].value_counts(dropna=False)`.
- Duplicates: `df.duplicated(subset=key_cols).sum()`.
- Memory footprint on large frames: `df.memory_usage(deep=True).sum()`.

If a transformation's output looks wrong, incorrect input assumptions cause it 90% of the time. Re-inspect the input.

## Pandas Patterns

- **Vectorize.** Prefer Boolean indexing (`df[df.col > 0]`) and `.query()` to `.apply(axis=1)`; they outperform it by orders of magnitude. Use `apply` only when vectorization is not possible.
- **Chain with parens** for readability on multi-step transforms:

```python
result = (
    df.rename(columns={"cust_id": "customer_id"})
      .query("status == 'active'")
      .groupby("customer_id", as_index=False)
      .agg(total=("amount", "sum"), n=("amount", "size"))
)
```

- **`.copy()` at ingress** so downstream transforms do not mutate the caller's frame. Alternatively, return new frames from every step — no in-place operations. This follows the base skill's immutability-preference rule. DataFrame mutations can propagate through views.
- **Dtype discipline.** Cast intentionally at boundaries. Join keys must match dtypes exactly: `int64` vs `Int64` vs `str` can produce silent NULL join results. Use nullable dtypes (`Int64`, `string`, `boolean`) when NULLs are possible.
- **Treat null handling as a decision, not a default.** Document the strategy per column: drop, fill with a sentinel, fill with a computed value, or flag-and-keep. Never let NULLs propagate unexamined.
- **Use `assign` for chained column creation** rather than rebinding: `df.assign(margin=lambda d: d.revenue - d.cost)` keeps the chain unbroken and avoids `SettingWithCopyWarning`.

## Notebook Discipline

Use notebooks for exploration. Production work requires extra discipline.

- **One logical step per top-level cell.** Avoid placing 20 operations in one cell; you lose the ability to inspect intermediates.
- **Factor reusable logic out into a `.py` module** and `import` it back into the notebook. This keeps logic version-controlled, unit-testable, and reviewable. The base skill's module-layout rules apply.
- **Parameters at the top**, in a dedicated cell, clearly marked (`# parameters`). This lets you parameterize the notebook via papermill/Sagemaker/Dagster.
- **"Restart and run all"** before considering a notebook done. Out-of-order execution hides state-dependent bugs that break when someone else re-runs it.
- **Strip outputs before committing** (`nbstripout` pre-commit hook) unless the rendered output is the artifact. Large outputs bloat diffs and hide real changes.
- **Don't import from notebooks.** Logic you want to reuse belongs in a `.py` file.

## Analytical Reproducibility

- **Seed every random op.** Use `np.random.seed(42)`, `random.seed(42)`, and set `random_state=` on scikit-learn splits and samplers. Record the seed in the output.
- **Snapshot-date your queries.** For SQL queries against mutable tables (orders, users, events), record the `as_of` timestamp in the output or filename. The same query at different times produces different answers.
- **Pin package versions.** Minor `pandas` versions can introduce meaningful behavior changes (default `groupby` observed behavior, `.copy()` semantics, `Int64` arithmetic). A lockfile is required; see the base skill's packaging section.
- **Timezone on every datetime.** Apply the base skill's timezone rule to every datetime. Silent UTC↔local conversions during joins can produce incorrect results.

## Validation & Contracts

Use lightweight schema enforcement for analytical pipelines that feed downstream consumers:

- **Input schema** at the module boundary: expected columns, dtypes, non-null invariants. Use `pandera` schemas or a hand-rolled assertion helper.
- **Output schema** at the exit: same idea, applied to what you're producing.
- **Contract test**: run a tiny fixture through the full pipeline and assert the output shape/dtypes. Use it to detect upstream schema drift as soon as it breaks the pipeline.

```python
def validate_input(df: pd.DataFrame) -> None:
    required = {"customer_id", "amount", "event_date"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")
    if df["customer_id"].isnull().any():
        raise ValueError("customer_id must be non-null")
```

## Visualization

- **Label axes, title the plot, state units.** Readers cannot interpret an unlabeled chart.
- **Consistent styling:** set it once (`plt.rcParams` or a seaborn theme), then apply it everywhere.
- **Log scale** when spans exceed ~2 orders of magnitude.
- **Save with known DPI** (150+ for reports, 300 for print) and `bbox_inches="tight"` so labels remain visible.
- **Do not ship matplotlib globals in library code.** Reset or scope them via `with plt.style.context(...)`.

## Performance for Data Work

The base skill covers general performance. Use these pandas/numpy-specific additions:

- **Chunked reads** for files that don't fit in memory: `pd.read_csv(path, chunksize=100_000)` returns an iterator; aggregate per-chunk.
- **Categorical dtype** for high-cardinality repeated strings (country codes, statuses): often 10x memory savings and faster groupbys.
- **`numpy` over pandas** in hot inner loops. Convert to arrays, compute, wrap back in a frame at the end.
- **Avoid repeated `.iloc`/`.loc` lookups inside loops.** Each is O(log n) at best. Extract the column as a numpy array once.
- **Arrow-backed dtypes** (`dtype="string[pyarrow]"`, pandas 2+) for memory-efficient string handling.

## Analytical Pipeline Structure

For an analysis that grows into a pipeline (scheduled run, reproducible output, stakeholders), use the base skill's module layout: `main.py` / `core/` / `models/` / `utils/`. Apply these analysis-specific adaptations:

- `transforms.py` for pure dataframe functions: `def compute_ltv(orders: pd.DataFrame) -> pd.DataFrame`. One transform per function. Deterministic; no I/O.
- `loaders.py` for I/O: reading from Snowflake/S3/local, with a dependency-injected client per the base skill.
- `validators.py` for schema checks (see above).
- The notebook, if one remains, becomes a thin driver that calls into these modules.
