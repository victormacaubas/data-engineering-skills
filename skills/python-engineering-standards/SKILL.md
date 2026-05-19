---
name: python-engineering-standards
description: Canonical Python coding standards for production code — services, CLIs, pipelines, libraries, ETL jobs, and internal tooling. Use when writing, reviewing, or refactoring any Python beyond a throwaway snippet. Covers layout, typing, config, logging, error handling, retries, concurrency, testing, and packaging. Domain-specific Python skills (e.g., python-data-analysis) build on top of it.
---

# Python Engineering Standards

These are the canonical standards for writing production Python at this organization. Apply them to anything beyond throwaway code — services, CLIs, pipelines, libraries, jobs. Domain-specific skills (e.g., `python-data-analysis`) assume this file as their base and add patterns on top.

The guiding principle: **write code that another engineer can read, test, and re-run six months from now without surprise.** Every rule below exists because something broke when it wasn't followed.

## Operational concerns (in references/)

For patterns specific to running Python code in production — CLI entrypoints, layered configuration, secrets handling, observability for long-running jobs, pipeline idempotency, streaming I/O, and packaging for distribution — read `references/operational.md` when the task touches any of them. The content stays out of context for pure library/algorithm work.

## Style

- PEP 8. 4-space indents, `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for module-level constants, 88-char lines (Black-compatible).
- f-strings for constructing strings — except in **log calls**, where `%s`-style is required (lazy formatting; skipped when the level is filtered out).
- No magic numbers. If a value has meaning, name it: `DEFAULT_PART_SIZE_BYTES = 128 * 1024 * 1024`, not `128 * 1024 * 1024` scattered through the code.
- `from __future__ import annotations` is useful in modules with heavy type hints, forward references, or support for Python < 3.10 — it makes hints lazy and keeps runtime cheap. On 3.10+ with native `X | Y` syntax it earns its keep less often. Add it where it helps; skip it where it doesn't.
- Imports in three groups, separated by a blank line and sorted alphabetically within each: stdlib, third-party, local. Never `from x import *`.
- Prefer `pathlib.Path` over string concatenation and `os.path.join`. `Path("/data") / pipeline_name / "raw"` is safer and reads like what it does.

## Comments & Docstrings

Documentation depth should scale with API surface — what a reader *outside* the module needs to know to use it. Be generous where it helps; don't manufacture prose where names already do the work.

**Public vs. private.** Treat a function/class as public if it's imported from outside its module, listed in `__all__`, exposed via `__init__.py`, or called across package boundaries. Private means leading-underscore names, nested helpers, and module-local utilities that only the module's own code reaches for. Apply documentation and typing rigor proportionally: more at public edges, less ceremony inside.

**Public functions, classes, and methods** deserve a docstring when behavior isn't obvious from the signature. Document what a caller can't infer: non-obvious semantics, edge-case handling, side effects, raised exceptions callers are expected to catch. If the name and type hints already tell the story (`def user_exists(user_id: UUID) -> bool`), a docstring restating them is noise — skip it.

**Private helpers** usually get by on clear naming. Add a docstring or comment only when there's something a reader wouldn't guess — an invariant the function assumes, a workaround for a specific bug, a performance-sensitive choice.

**Module-level docstrings are not allowed.** They default to reading like spec notes or just restate the filename, and they rot as the module evolves. If a module needs context, put it in the README or a design doc — not at the top of the file.

When you do write a docstring, pick a style (Google or NumPy) and use it consistently within a project. Include args, returns, and raised exceptions only when they're part of what callers need to handle:

```python
def run_merge_procs(
    conn: SnowflakeConnection,
    procs: list[str],
    *,
    dryrun: bool = False,
) -> dict[str, str]:
    """Execute each stored procedure in order.

    Args:
        conn: Open Snowflake connection.
        procs: Fully qualified procedure names, executed sequentially.
        dryrun: If True, log planned calls and return 'DRYRUN' for each.

    Returns:
        Mapping of procedure name to its return value as a string.
    """
```

**Inline comments explain _why_, not _what_.** Well-named code already tells you what. Reserve comments for hidden constraints, subtle invariants, workarounds tied to a specific bug or upstream behavior, or anything that would surprise a reader.

Don't narrate the current task (`# added for the payout flow`), the author (`# Victor's change`), or removed code (`# removed old logic`). That context belongs in git history and PR descriptions — it rots in the source.

If a comment feels necessary, first ask whether renaming a variable or extracting a helper would remove the need. The best comment is the one you didn't have to write.

## Typing & Data Structures

Type-hint every public function and method — callers read signatures to understand the contract, and the checker catches real bugs. Private helpers benefit from hints too (IDE support, better error messages), but rigid completeness there is a matter of taste, not a rule. The goal is that `mypy --strict` passes on core modules; you don't have to run it, but code should be written as if you did.

- **Dataclasses over dicts** for internal structured values: config, coordinates, domain objects. Dicts are fine for external data (API payloads, JSON from Secrets Manager), but the moment you pass a dict around internally you lose autocomplete and catch typos only at runtime.
- `@dataclass(frozen=True)` when the value shouldn't mutate after construction. Config is a classic case.
- `typing.Protocol` for structural interfaces in dependency injection. Lighter than ABCs, doesn't require inheritance, works cleanly with duck-typed fakes in tests.
- `Optional[X]` (or `X | None` on 3.10+) only when `None` is a meaningful state. Don't make every argument nullable "just in case" — it pushes the null check onto every caller.

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol

@dataclass(frozen=True)
class S3Location:
    bucket: str
    key: str

class ObjectStore(Protocol):
    def put(self, location: S3Location, body: bytes) -> None: ...
    def get(self, location: S3Location) -> bytes: ...
```

## Module & Project Layout

Split by responsibility. A well-organized package has a shape like:

```
package/
├── main.py              # CLI entrypoint. argparse, wire dependencies, call runner. Nothing else.
├── core/                # Orchestration. Composes utils and models into a workflow.
│   └── runner.py
├── models/              # Dataclasses, enums, domain types. No I/O, no business logic.
│   └── config.py
└── utils/               # Leaf helpers: retries, I/O, parsing. Knows nothing about orchestration.
    ├── s3_ops.py
    └── retries.py
```

Dependencies flow one way: `main → core → {models, utils}`. `utils/` never imports from `core/`. If two modules want to import each other, the shared abstraction belongs in a third place — usually `models/` or a new utils module.

Group files by domain, not by type. `loaders.py`, `validators.py`, `transforms.py` communicate intent; `classes.py`, `functions.py`, `helpers.py` don't.

**Function and module size.** A function that scrolls past ~50 lines is usually doing more than one thing — extract helpers. A module over ~400 lines is signal that it's become a grab bag; split it along a natural seam. These aren't hard limits, but hitting them is a prompt to look again.

**Breaking circular imports.** If module A needs a type from module B for hints only, use `from __future__ import annotations` + `if TYPE_CHECKING: from b import BType`. The import is only evaluated by type checkers, not at runtime.

**`__init__.py` stays thin.** Export what the package offers, don't execute work on import. Heavy computation at import time turns every CLI startup into a tax.

## SOLID Applied

- **Single Responsibility** — one function does one thing, one class owns one concern. A `DataLoader` does not also validate schemas.
- **Open/Closed** — extend behavior through composition, new subclasses, or strategy callables rather than modifying working code.
- **Liskov Substitution** — subtypes must be drop-in replacements. If a function accepts `BaseTransformer`, any subclass must honor its contract without surprises.
- **Interface Segregation** — prefer small, focused protocols over fat interfaces. A consumer that only reads should not depend on an interface that also writes.
- **Dependency Inversion** — depend on abstractions, not concretions. Pass dependencies (DB connections, S3 clients, file readers) into the consumer rather than constructing them inside.

## Dependency Injection & Testability

A class that builds its own S3 client can't be tested without monkey-patching `boto3`. A class that accepts a client is trivially testable. **Pass dependencies in.**

Production code should construct concrete clients at the **composition root** — `main.py`, a CLI entrypoint, a `build_runner()` factory — and thread them down into the services that use them. Services accept their dependencies in `__init__` and keep the references. They shouldn't reach out to `boto3.client(...)` or `snowflake.connector.connect(...)` themselves.

```python
# service — knows nothing about how clients are built
class PipelineRunner:
    def __init__(
        self,
        config: Config,
        s3: S3Client,
        logger: logging.Logger,
    ) -> None:
        self.config = config
        self.s3 = s3
        self.logger = logger

# composition root — main.py or a build_* factory
def main() -> int:
    setup_logging("pipeline_runner")
    logger = logging.getLogger()
    config = build_config_from_env()
    s3 = boto3.client("s3", region_name=config.aws_region)
    runner = PipelineRunner(config=config, s3=s3, logger=logger)
    return runner.run(...)
```

The service has no knowledge of `boto3`. Tests hand it a fake or a `moto`-backed client. Different callers (prod pipeline, backfill job, ad-hoc script) can configure the client differently — region, retry config, endpoint override — without touching the service.

**Default-arg construction** (`s3: S3Client | None = None; self.s3 = s3 or boto3.client(...)`) is a common shortcut: callers can skip wiring and the service still works. It's fine for small CLI tools and one-off scripts where a composition root would be trivially small. Avoid it as the default pattern in a growing service — it hides the dependency graph, makes the service module import every concrete client it might ever need, and makes it easy to accidentally construct a real client in a test that forgot to inject a fake.

For pure functions that depend on the current time, the current random seed, or the process environment, take the value as a parameter with a default:

```python
def ingestion_partition(now: datetime | None = None) -> DatePartition:
    ts = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    ...
```

Tests pass a frozen time; production uses the default. No `freezegun`, no monkey-patching.

**Keyword-only arguments** for any public API with more than 2–3 parameters. Mark them with `*,`:

```python
def run(self, *, dryrun: bool, copy_only: bool, merge_only: bool) -> dict[str, Any]: ...
```

Prevents silent positional mistakes as the signature grows. `runner.run(True, False, True)` is a bug waiting to happen; `runner.run(dryrun=True, copy_only=False, merge_only=True)` is self-documenting.

## Design Patterns

Introduce patterns when they are needed, not for their own sake.

- **Strategy / callable injection** — swap algorithms at runtime by passing a function. Natural fit for "transform this stream" or "pick an aggregation." Use a `Callable[[...], ...]` type hint or a Protocol.
- **Factory closure** — when construction needs several arguments but callers only want to invoke the result, return a closure: `make_target_key = make_target_key_factory(cfg, partition)`; later, `tgt = make_target_key(src)`. Cleaner than threading `(cfg, partition, src)` through every call site.
- **Repository / Adapter** — abstract data access behind a clean interface so business logic doesn't know whether data comes from a database, API, or file. Enables swapping backends and mocking in tests.
- **Pipeline / Chain** — compose transformations as a sequence of discrete steps; each step takes input and returns output. Natural for ETL.
- **Decorator (functional)** — wrap functions with cross-cutting concerns (retries, caching, timing) via `@functools.wraps`.
- **Observer** — emit events (progress, quality-gate hits, shutdown signals) to pluggable listeners rather than coupling core logic to logging/alerting/metrics. Useful when multiple subsystems need to react to the same event.
- **Singleton** — exactly one instance across the process. In Python, **reach for it last**: a module is already a singleton (imported once, cached in `sys.modules`), so module-level state or a module-level `@functools.lru_cache`-wrapped factory is usually the right answer. Use a true Singleton class only when you need lazy construction *and* mutable state *and* the caller must treat the instance as an object (not a module). When you do, prefer a thread-safe factory over overriding `__new__`:

```python
import threading
from functools import lru_cache

@lru_cache(maxsize=1)
def get_connection_pool() -> ConnectionPool:
    """Process-wide connection pool; constructed lazily on first call."""
    return ConnectionPool(...)
```

`lru_cache(maxsize=1)` gives you lazy, thread-safe, one-time construction in three lines. It's testable (call `.cache_clear()` between tests), swappable (monkey-patch or override in fixtures), and readers don't need to recognize a pattern — just a cached function. **Avoid the classic `__new__`-override Singleton** — it hides construction, fights dependency injection, and makes tests painful. If you find yourself wanting a Singleton for configuration or clients, consider whether you could just pass the dependency in (back to DI) instead.

A plain function beats a class when there's no state. Three similar lines beats a premature base class. A module-level constant beats a Singleton.

## Logging

Prefer `logger` over `print()` in any file that gets committed. `print()` writes to stdout with no level, no timestamp, no module name, and no way to filter or route output — a `logger` call gets all of that for free and costs the same to type. For a quick debug, a progress update, a dry-run notice, or an error message, reach for `logger.debug/info/warning/error` first.

`print()` is reasonable in a few places: the body of `if __name__ == "__main__":` in a one-off script, a notebook cell, a short REPL experiment, or a CLI that emits machine-readable output (JSON, TSV) to stdout by design. Outside those, default to the logger.

- Module-level: `logger = logging.getLogger(__name__)` at the top of every file that emits output. Never instantiate a new logger per call.
- Lazy `%s` formatting: `logger.info("Copied %d files from %s", n, bucket)`. The formatting runs only if the log level is enabled.
- Pick levels intentionally: `DEBUG` for verbose diagnostics, `INFO` for milestones ("started phase X", "copied N files"), `WARNING` for degraded-but-continuing, `ERROR` for a specific failure, `logger.exception(...)` inside `except` blocks when the traceback adds signal.
- Include identifying context in every log: run id, pipeline name, key being processed. Otherwise parallel-run logs become unreadable.
- Log structured summaries at phase boundaries as JSON. Easy to grep, easy to pipe into an analyzer.

## Error Handling & Retries

- Never bare `except:`. Default to catching specific types — `except (ClientError, TimeoutError):`, not `except Exception:`. Broad catches are reserved for isolation boundaries (see below).
- Validate inputs at boundaries (function entry, config load, data ingress). Fail early with messages that tell the reader what was wrong and how to fix it.
- **Custom exception classes** for domain errors once the codebase has more than one call site: `class DecryptionError(RuntimeError): ...`. Makes callers' except blocks readable and lets a retry helper know what's safe to retry.
- **Retry only transient errors** — network flaps, 5xx responses, throttling, timeouts. Never retry `NoSuchKey`, `403`, `ValueError` — those are bugs, not flakes. Use exponential backoff with jitter, and **narrow the exception types** you catch:

```python
def retryable_call(
    fn: Callable[[], T],
    *,
    max_retries: int = 5,
    base_backoff: float = 0.5,
    retryable: tuple[type[Exception], ...],
    what: str,
) -> T:
    attempt = 0
    while True:
        try:
            return fn()
        except retryable as e:
            attempt += 1
            if attempt > max_retries:
                logger.exception("Exceeded retries for %s after %d attempts", what, attempt)
                raise
            sleep_s = base_backoff * (2 ** (attempt - 1)) * (0.7 + random.random() * 0.6)
            logger.warning("Transient error on %s (attempt %d/%d): %s; retrying in %.2fs",
                           what, attempt, max_retries, e, sleep_s)
            time.sleep(sleep_s)
```

### Broad `except Exception` at isolation boundaries

Broad catches don't belong scattered through ordinary code, but they earn their keep at **isolation boundaries** — places where one unit's failure shouldn't abort a larger run. Processing 10,000 records, refreshing 50 pipelines, serving the next request after the last one raised: these are all boundaries where `except Exception` is the right tool.

```python
results: dict[str, str] = {}
for pipeline in pipelines:
    try:
        results[pipeline.name] = refresh_pipeline(pipeline)
    except Exception as e:  # isolate: one bad pipeline shouldn't abort the batch
        logger.exception("Pipeline %s failed; continuing", pipeline.name)
        results[pipeline.name] = f"FAILED: {type(e).__name__}: {e}"
return results
```

Two rules keep this from sliding into the "swallow everything" anti-pattern:

1. **The `try` block wraps a single unit**, not a 200-line body. If something inside the unit is expected to fail in a specific way, catch *that* type inside — the outer broad catch is the last line of defense for unknown failures.
2. **The failure is recorded as a degraded result** the caller can act on, not silently dropped. Return an explicit `"FAILED: ..."` string, a `Result[T, Error]`-style object, or increment an error counter the summary surfaces. If the batch ends with `errors=3` and nobody looks, that's a process problem; if the code returned `results` with `"FAILED"` entries and the caller checks, the isolation worked.

Outside isolation boundaries, a broad catch is almost always the wrong answer — it hides bugs, makes diagnosis harder, and turns real failures into silent successes.

## Context Managers & Resource Management

Every resource that needs paired setup/teardown goes inside a `with` block. No exceptions.

- Files: `with open(path) as f:`, never bare `open()`.
- Connections: `with closing(conn):` or the client's own context-manager protocol.
- Locks, temp directories, subprocess handles, multipart uploads — wrap them.
- For anything custom, use `@contextlib.contextmanager`:

```python
@contextmanager
def ephemeral_keyring(base: Path) -> Iterator[Path]:
    """Create a RAM-backed GPG home; remove it on exit no matter what happens."""
    home = base / f"gnupg-{uuid.uuid4().hex}"
    home.mkdir(mode=0o700, exist_ok=False)
    try:
        yield home
    finally:
        shutil.rmtree(home, ignore_errors=True)
```

Why it matters: `finally` blocks are easy to forget after three levels of nested exceptions. A context manager makes cleanup impossible to skip, regardless of which exception or early return fires.

For **multi-resource cleanup** (abort this multipart upload, close that connection, remove that temp dir), use `contextlib.ExitStack`:

```python
with ExitStack() as stack:
    conn = stack.enter_context(closing(snowflake.connector.connect(**params)))
    keyring = stack.enter_context(ephemeral_keyring(Path("/dev/shm")))
    ...
# Both cleaned up, in reverse order, even if the body raised.
```

## Time & Timezones

- Always timezone-aware: `datetime.now(timezone.utc)`. Never naive `datetime.now()`.
- Carry UTC internally; convert to local only at display boundaries.
- Accept `now` as an optional argument in time-dependent pure functions so tests can freeze time without monkey-patching.

## Concurrency

Read `references/concurrency.md` before writing any code that involves parallelism, async/await, locks, signals, or worker pools. It covers the decision between threads, processes, and asyncio; synchronization primitives; bounded queues and backpressure; cancellation and timeouts; graceful shutdown; subprocess pipe deadlocks; connection pooling under concurrency; and the bugs you will hit otherwise. The checklist below is the floor, not the standard.

Quick rules:

- I/O-bound parallelism (HTTP, S3, DB queries): `concurrent.futures.ThreadPoolExecutor`. A sensible default size is `min(32, (cpu_count or 1) * 4)`, tuned from there.
- CPU-bound: `ProcessPoolExecutor`. Bypasses the GIL.
- Many small coroutines: `asyncio`. Do not mix asyncio and thread pools unless you mean to.
- Never share a mutable dict or list across threads without a lock or a thread-safe structure.
- Bound your queues. An unbounded work queue fills memory until the process dies; `queue.Queue(maxsize=N)` is a two-line fix.
- Graceful shutdown for long-running processes: handle `SIGTERM`, drain in-flight work, exit cleanly.

## Streaming Over Buffering

For any file whose size is unbounded (user upload, S3 object, API response):

- Stream with iterators/generators, don't `.read()` the whole thing into memory.
- For S3: use the `StreamingBody` from `get_object`; use multipart upload for anything potentially > 100 MB.
- For subprocesses: pipe stdin/stdout through `subprocess.PIPE`, feed and drain concurrently (threaded feeder + main-thread reader) to avoid deadlocks on buffer-full.

## Performance

- Measure before optimizing. `cProfile`, `timeit`, `line_profiler`. Assumptions about where time goes are usually wrong.
- `set` for membership, generators for large iterations, lazy evaluation where possible.
- Avoid N+1 patterns: a single bulk `list` + in-memory filter beats N individual `HEAD`s or `GET`s.

## Good Programming Practices

- **DRY** — extract repeated logic to shared functions or constants. Duplication rots.
- **YAGNI** — no speculative abstractions. Three similar lines beats a premature base class. Add complexity when a concrete requirement demands it, not before.
- **Fail fast** — assert invariants at boundaries so bugs surface close to their cause, not three layers down.
- **Immutability preference** — return new objects from transforms; avoid in-place mutation. Especially important for shared config, DataFrames, and anything passed between threads.
- **Explicit over implicit** — name your constants, type-hint your functions, keyword your arguments, raise your specific exceptions.
- **Trust framework guarantees** — don't validate what the type system or framework already enforces. Validate at system boundaries (user input, external APIs), not between internal functions.

### Python-Specific Footguns

- **Never use mutable default arguments.** `def f(items=[])` shares that list across every call. Use `None` and assign inside:

  ```python
  def f(items: list[str] | None = None) -> None:
      items = items if items is not None else []
  ```

- **Watch late-binding closures in loops.** `fs = [lambda: i for i in range(3)]` produces three functions that all return `2`. Capture with a default arg: `lambda i=i: i`.
- **`is` vs `==`.** Use `is` only for `None`, `True`, `False`, and sentinel identity checks. Never `x is 0` or `x is "foo"` — it works today only by CPython interning and will break silently.
- **Don't subclass `dict`/`list`.** Composition (wrap + expose the methods you need) avoids MRO and pickling surprises.
- **Avoid module-level side effects.** Code at import time runs every time something imports the module — don't open files, hit networks, or read config there. Put it in a function called from `main`.
- **`from x import *`** is banned. It pollutes the namespace and breaks tooling.

## Testing

- `pytest`. Small, deterministic fixtures. No external network in unit tests — use `pytest-socket` (or equivalent) to enforce it.
- **Inject the dependency, mock the dependency** — don't patch deep internals. `def test_runner(fake_s3: FakeS3) -> None: ...` is cleaner and more durable than `@patch("boto3.client")`.
- Test business logic (transforms, validators, config parsing) at high coverage. I/O boundaries get integration tests that can touch real infra with a `@pytest.mark.integration` marker.
- Edge cases to hit explicitly: empty input, all-null column, duplicate keys, unexpected dtypes, retry exhaustion, partial batch failure, config missing required key.
- Name tests by what they assert: `test_config_raises_when_bucket_missing`, not `test_config_1`.

### TDD (when the user asks for it)

When the user explicitly asks for TDD — "do this test-first", "let's red-green-refactor", "write the test before the implementation" — honor the order: failing test first, then implementation.

1. Write the test for the behavior you're about to add.
2. Run it and watch it fail for the *expected* reason (the assertion, not an import error or a typo). A test that fails for the wrong reason hasn't validated anything.
3. Implement just enough to make it pass.
4. Refactor with the test as a safety net.

**Don't weaken tests to fit an implementation that went a different direction.** The test encodes the requirement. If the implementation can't meet it, the first question is whether the requirement was wrong, not whether the test was too strict. When a test genuinely needs to change because the requirement was misunderstood or shifted, explain *why* — in the commit message, PR description, or directly to the user: "the original test asserted X; the requirement is actually Y because Z, so the test now asserts Y." Silent test edits that follow the implementation hollow out the discipline and hide real requirement drift.

TDD isn't the default for every change — exploratory code, spikes, one-line fixes usually don't benefit. When the user asks for it, follow it. When they don't, use judgment: tests still matter, they just don't have to come first.

## Packaging

- Pin dependencies. `pyproject.toml` with a lockfile (`poetry.lock`, `uv.lock`) or a pinned `requirements.txt`.
- Expose a console script in `pyproject.toml` so the CLI is installable:
  ```toml
  [tool.poetry.scripts]
  my-tool = "my_pkg.main:main"
  ```
- Keep `main` small. If it's growing past ~100 lines, the extra logic belongs in `core/`.
- Ship a `README.md` that explains: what the thing does, how to configure it, how to run it locally, and how to run it in production.
