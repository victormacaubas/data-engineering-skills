---
name: python-data-analysis
description: Python coding standards for data analysis — pandas, numpy, notebooks, dataframe transforms, statistical modeling, visualization, and analytical ETL. Use when writing or reviewing Python for data extraction, transformation, analysis, or plotting. Builds on python-engineering-standards.
---

# Python Data Analysis Standards

These extend `python-engineering-standards` with patterns specific to dataframe work, notebooks, and analytical pipelines. **Read the base standards first** — everything there (style, typing, docstrings, logging, error handling, testing, SOLID, dependency injection, idempotency, etc.) applies here unchanged:

```
/Users/victor-macaubas/.claude/skills/python-engineering-standards/SKILL.md
```

The content below is **additive**. It does not replace the base standards; it adds patterns that only make sense once pandas/numpy/notebooks are in the picture.

## Data Inspection Before Transformation

Always inspect before transforming. One minute of `df.info()` saves an hour debugging the wrong join.

- Shape, dtypes, null counts: `df.shape`, `df.dtypes`, `df.isnull().sum()`.
- Descriptive stats: `df.describe(include="all")`.
- Value distributions for keys: `df[key].value_counts(dropna=False)`.
- Duplicates: `df.duplicated(subset=key_cols).sum()`.
- Memory footprint on large frames: `df.memory_usage(deep=True).sum()`.

If a transformation's output looks wrong, 90% of the time it's because the input wasn't what you thought — go back and inspect.

## Pandas Patterns

- **Vectorize.** Boolean indexing (`df[df.col > 0]`) and `.query()` beat `.apply(axis=1)` by orders of magnitude. Reach for `apply` only when vectorization genuinely isn't possible.
- **Chain with parens** for readability on multi-step transforms:

```python
result = (
    df.rename(columns={"cust_id": "customer_id"})
      .query("status == 'active'")
      .groupby("customer_id", as_index=False)
      .agg(total=("amount", "sum"), n=("amount", "size"))
)
```

- **`.copy()` at ingress** so downstream transforms don't mutate the caller's frame. Or return new frames from every step — no in-place ops. This matches the base skill's immutability-preference rule; it bites especially hard with DataFrames because mutations can propagate through views.
- **Dtype discipline.** Cast intentionally at boundaries. Join keys must match dtypes exactly — `int64` vs `Int64` vs `str` is a classic silent-null-join footgun. Use nullable dtypes (`Int64`, `string`, `boolean`) when NULLs are possible.
- **Null handling is a decision, not a default.** Document the strategy per column: drop, fill with a sentinel, fill with a computed value, or flag-and-keep. Never let NULLs propagate unexamined.
- **Use `assign` for chained column creation** rather than re-binding: `df.assign(margin=lambda d: d.revenue - d.cost)` keeps the chain unbroken and avoids `SettingWithCopyWarning`.

## Notebook Discipline

Notebooks are great for exploration, dangerous for production.

- **One logical step per top-level cell.** Don't pile 20 operations into one cell; you lose the ability to inspect intermediates.
- **Factor reusable logic out into a `.py` module** and `import` it back into the notebook. Keeps logic version-controlled, unit-testable, and reviewable — the base skill's module-layout rules apply.
- **Parameters at the top**, in a dedicated cell, clearly marked (`# parameters`). Makes the notebook parameterizable via papermill/Sagemaker/Dagster.
- **"Restart and run all"** before declaring a notebook done. Out-of-order execution hides state-dependent bugs that break when someone else re-runs it.
- **Strip outputs before committing** (`nbstripout` pre-commit hook) unless the rendered output is the artifact. Bloated diffs obscure real changes.
- **Don't import from notebooks.** Logic you want to reuse belongs in a `.py` file.

## Analytical Reproducibility

- **Seed every random op.** `np.random.seed(42)`, `random.seed(42)`, set `random_state=` on scikit-learn splits and samplers. Record the seed in the output.
- **Snapshot-date your queries.** When SQL hits mutable tables (orders, users, events), record the `as_of` timestamp in the output or filename. The same query at different times gives different answers.
- **Pin package versions.** `pandas` behavior changes meaningfully across minor versions (default `groupby` observed behavior, `.copy()` semantics, `Int64` arithmetic). Lockfile required; see the base skill's packaging section.
- **Timezone on every datetime** — carries over from the base skill, doubly important in analysis because silent UTC↔local conversions during joins produce ghost bugs.

## Validation & Contracts

Analytical pipelines that feed downstream consumers need lightweight schema enforcement:

- **Input schema** at the module boundary: expected columns, dtypes, non-null invariants. Use `pandera` schemas or a hand-rolled assertion helper.
- **Output schema** at the exit: same idea, applied to what you're producing.
- **Contract test**: run a tiny fixture through the full pipeline and assert the output shape/dtypes. Catches upstream schema drift the moment it breaks you, not in prod a week later.

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

- **Label axes, title the plot, state units.** An unlabeled chart is a rumor.
- **Consistent styling** — set once (`plt.rcParams` or a seaborn theme), apply everywhere.
- **Log scale** when spans exceed ~2 orders of magnitude.
- **Save with known DPI** (150+ for reports, 300 for print) and `bbox_inches="tight"` so labels aren't clipped.
- **Don't ship matplotlib globals in library code.** Reset or scope via `with plt.style.context(...)`.

## Performance for Data Work

The base skill covers general performance; a few pandas/numpy-specific additions:

- **Chunked reads** for files that don't fit in memory: `pd.read_csv(path, chunksize=100_000)` returns an iterator; aggregate per-chunk.
- **Categorical dtype** for high-cardinality repeated strings (country codes, statuses) — often 10x memory savings, faster groupbys.
- **`numpy` over pandas** in hot inner loops. Convert to arrays, compute, wrap back in a frame at the end.
- **Avoid repeated `.iloc`/`.loc` lookups inside loops** — each is O(log n) at best. Extract the column as a numpy array once.
- **Arrow-backed dtypes** (`dtype="string[pyarrow]"`, pandas 2+) for memory-efficient string handling.

## Analytical Pipeline Structure

When an analysis grows into a pipeline (scheduled run, reproducible output, stakeholders), the base skill's module layout applies: `main.py` / `core/` / `models/` / `utils/`. Analysis-specific adaptations:

- `transforms.py` for pure dataframe functions: `def compute_ltv(orders: pd.DataFrame) -> pd.DataFrame`. One transform per function. Deterministic; no I/O.
- `loaders.py` for I/O: reading from Snowflake/S3/local, with a dependency-injected client per the base skill.
- `validators.py` for schema checks (see above).
- The notebook, if one remains, becomes a thin driver that calls into these modules.
