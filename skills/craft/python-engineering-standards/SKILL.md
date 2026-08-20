---
name: python-engineering-standards
description: Canonical Python coding standards — layout, typing, docstrings and comments, class-vs-function, logging, error handling and retries, dependency injection, concurrency, security, testing, and the tells that make code read as machine-generated. Use whenever you write, review, or refactor Python of any kind — services, CLIs, pipelines, ETL jobs, libraries, internal tooling, scripts. Consult it before writing rather than fixing style afterward. Domain-specific Python skills build on top of it.
---

# Python Engineering Standards

Apply these by default. A genuine one-off in a REPL is the only exception.

The guiding principle: **write code that another engineer can read, test, and re-run six months from now without surprise.** Every rule below comes from a failure.

## How to apply these standards

Read the repo first: `pyproject.toml`, Ruff/Black/mypy settings, supported Python version, package layout, and the dominant local conventions. Explicit, coherent project configuration wins. Use this skill for decisions the repo has not already made. When local code is inconsistent, align with the safest checked-in pattern before introducing a new one.

## Reference files

The deeper material lives in `references/`. Read the file that covers the task; skip the rest to keep them out of context.

**Read `references/operational.md`** when you're building a job, service, or pipeline rather than a library someone imports. Read it whenever the task involves:

- a CLI entrypoint, argument parsing, or exit codes
- layered configuration, or secrets and their lifecycle
- observability for a long-running job — correlation/run ids, health checks, metrics, heartbeats, alerting
- making a pipeline idempotent or re-runnable — skip-if-exists, deterministic keys, manifests
- streaming I/O, or packaging for distribution (lockfiles, console scripts, dependency auditing)

This file covers none of these except streaming, so that reference is their only home. If a task lands here and you haven't opened it, you're answering from memory.

**Read `references/layout.md`** when starting a new project, adding a package to an existing one, or deciding which directory a new file belongs in. It contains the full directory tree for each archetype (data pipeline, service, CLI tool) and explains the one-way dependency flow.

**Read `references/concurrency.md`** before writing anything involving threads, processes, asyncio, locks, bounded queues, signals, subprocess pipes, or worker pools. The quick rules in the Concurrency section below are a floor, not the standard.

**Read `references/security.md`** when the task touches credentials, auth, SQL, file permissions, API endpoints, or paths derived from external input. The Security section below sets the non-negotiable floor; the reference contains the full standard.

**Read `references/tooling.md`** when there is no tooling config to inherit (a fresh repo or a scaffold) before writing a `pyproject.toml` from memory. This skill, rather than the repo, is the source of truth only in that case; checked-in config always wins.

## Style

- PEP 8. 4-space indents, `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for module-level constants, 88-char lines (Black-compatible).
- f-strings for constructing strings — except in **log calls**, where `%s`-style is required (lazy formatting; skipped when the level is filtered out).
- No magic numbers. If a value has meaning, name it: `DEFAULT_PART_SIZE_BYTES = 128 * 1024 * 1024`, not `128 * 1024 * 1024` scattered through the code.
- `from __future__ import annotations` helps modules with heavy type hints, forward references, or support for Python < 3.10 because it makes hints lazy and keeps runtime cheap. Native `X | Y` syntax reduces the need on 3.10+. Add it where it helps; skip it where it does not.
- Imports belong in three groups, separated by a blank line and sorted alphabetically within each: stdlib, third-party, local. `from x import *` is banned because it pollutes the namespace and breaks tooling.
- Prefer `pathlib.Path` to string concatenation and `os.path.join`. `Path("/data") / pipeline_name / "raw"` is safer and shows the resulting path structure.

## Comments & Docstrings

Documentation depth should scale with API surface: what a reader *outside* the module needs to know to use it. A comment or docstring earns its space by carrying what the code cannot say for itself. Where names and types already do the work, prose competes with them.

One test settles most cases: **would a reader six months from now, who has never seen the plan or the PR, need this line?** A hidden constraint passes. A pointer to a document that no longer exists does not.

**Don't cite the plan that produced the code.** These specific shapes, in comments or docstrings:

- Design-doc decision IDs — `(D1)`, `D4:`, `(design D1/D3)`, `(D5's low-volume guard)`
- Task or checklist numbers — `(D2/task 3.3)`, `# task 3.2`, `# per tasks.md step 4`
- Review or PR references — `# per review feedback`, `# addressed reviewer comment`

Plan citations look like traceability, especially when you have just read a design doc. They fail twice. The document is **archived** when the change lands, so the pointer dies when the work ships. Its labels also are not unique across a codebase: `D1` in one module means something unrelated to `D1` in another, so a reader can follow the reference to the wrong document and trust it.

**Write the reason, not the pointer.** The rationale lasts; the label only indexed scaffolding:

```python
# Omitting --allowedTools does not deny tools; it selects the CLI's default   ← survives archival
# D1: tools intentionally not restricted                                      ← dead reference
```

References to durable sources are fine: `# noqa: E501`, `# type: ignore[arg-type]`, and an upstream issue in a genuine workaround comment (`# workaround for boto3#1234; drop when fixed`). The reference must continue to exist and mean the same thing.

Cross-cutting rationale — the decision that shaped five modules — belongs in the ADR or design doc, not mirrored into each module that implements it. Each module gets the part of the reason that applies to its own code.

**Public vs. private.** Treat a function/class as public if code imports it from outside its module, lists it in `__all__`, exposes it via `__init__.py`, or calls it across package boundaries. Private means leading-underscore names, nested helpers, and module-local utilities used only by the module. Apply documentation and typing rigor proportionally: more at public edges, less ceremony inside.

**Public functions, classes, and methods** need a docstring when any of these hold:

- it has side effects beyond its return value
- it raises something callers are expected to catch
- it has non-obvious semantics: bound inclusivity, empty-input behavior, argument mutation, ordering guarantees, units
- it touches IO, the network, or a transaction

Otherwise, if the name and type hints fully describe the contract, skip it — a docstring that restates the signature is noise, and it can go stale independently of the code.

The list matters because "obvious from the signature" can become "obvious to me right now." `def user_exists(user_id: UUID) -> bool` is fully described by its signature. `def truncate(table: str) -> None` looks just as simple and needs a docstring because the signature does not say whether it is transactional, whether it commits, or what happens when the table does not exist.

**Private helpers** usually need only clear names. Add a docstring or comment when a reader would not infer an invariant the function assumes, a workaround for a specific bug, or a performance-sensitive choice.

**Module docstrings need a reason to exist.** Skip file summaries that restate the filename. Keep a module docstring when it explains public API shape, package-level contracts, unusual import behavior, or context a caller needs before using the module. Put context broader than one module in the README or a design doc.

When you do write a docstring, use **Google style** — the format in the example below. Include args, returns, and raised exceptions only when they're part of what callers need to handle:

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

**Inline comments explain _why_, not _what_.** Well-named code already says what it does. Reserve comments for hidden constraints, subtle invariants, workarounds tied to a specific bug or upstream behavior, or anything that would surprise a reader.

Don't narrate the current task (`# added for the payout flow`), the author, or removed code (`# removed old logic`). Put that context in git history and PR descriptions; it rots in the source.

If a comment feels necessary, first ask whether renaming a variable or extracting a helper removes the need. The best comment is one you did not need to write.

## Code That Reads As Written

Code can satisfy every rule above and still read as though a generator wrote it. The patterns below can feel diligent in the moment, but readers recognize them and lose trust in the code.

- **Step-numbered headers inside a function.** `# Step 1: validate`, `# Step 2: load`, `# Step 3: write`. The numbering brings the task list into the source. If those steps are real seams, make them named helpers; otherwise, the labels decorate a function that already reads top to bottom.
- **Docstrings on three-line private helpers.** `"""Return the parsed row."""` above `def _parse_row(line: str) -> Row:` adds maintenance and no information. Apply documentation rigor at public edges (see the public/private split above), not evenly everywhere.
- **Defensive scaffolding around what can't fail.** An `if not items: return []` before a loop that already yields nothing for an empty list; a `try/except` around dict construction; a null check on a value the type system says is non-optional. Use guards at system boundaries: user input, external APIs, and config. Between internal functions, they add noise and suggest a failure mode that does not exist.
- **Abstraction with one implementation.** A base class with one subclass, a factory called from one place, a strategy dict with one key, or a `Protocol` that nothing is ever passed as. Each is the right tool once a second case exists; before then, it is indirection a reader must follow to reach the one path that runs. One exception matters: a `Protocol` describing an *injected* dependency can legitimately have no in-repo implementer because the implementations are the real client and a test fake. Narrowing `boto3`'s client to the three methods you call applies the DI pattern rather than speculating. The question is whether the indirection provides a seam you use, not how many implementers exist.
- **Entry/exit logging ceremony.** `logger.info("Starting sync")` / `logger.info("Finished sync")` wrapped around every function. Log milestones and phase boundaries a human will read during an incident, not a call trace. Two lines per function drown the ten that matter.
- **Placeholder naming.** `process_data`, `handle_data`, `_do_work`, `manage_items`, `utils.py`, `helpers.py`, `common.py`. These describe the *shape* of the code, a verb plus a shrug, instead of what it handles: `merge_partitions`, `decrypt_payload`, `key_partition.py`. Ask whether the name narrows anything: `helpers.py` gives a reader nowhere to look, and `process_data` describes every function. Bare nouns like `value`, `result`, `rows`, or `items` are not on this list. They are precise when the type annotation supplies the noun (`result: TableFreshness`, `value: datetime`) or when the code is generic. Judge vagueness against what the signature already says, not against a blocklist.
- **Uniform rhythm.** Every function the same length, every docstring the same four sections, every branch logged the same way. Problems vary, so code varies: one function needs three lines; the next needs thirty because the domain is genuinely fiddly. Uniformity across a module suggests a template rather than a solved problem.
- **Decoration.** `# ===== HELPERS =====` banner comments, box-drawing separators, emoji in log lines or docstrings. If a file needs internal signposting to navigate, it's telling you to split it.

None of this calls for fewer comments, shorter functions, or less structure in the abstract. Every line should exist because *this* problem needs it. When you finish a function, ask, "would I defend each of these lines to a reviewer?" A line you would defend with "it seemed thorough" is a candidate for deletion.

## Typing & Data Structures

Type-hint every public function and method because callers read signatures to understand the contract, and the checker catches real bugs. Private helpers benefit from hints too (IDE support, better error messages), but rigid completeness there is a matter of taste, not a rule. Aim for `mypy --strict` to pass on core modules. You do not have to run it, but write code as if you did.

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

## Choosing a Class, a Function, or a Dataclass

Start with the deciding question: **does this code carry state across calls?** State is any resource or context that outlives a single invocation and that more than one operation reads or mutates: a connection, a cache, a client, config, a logger, or an accumulating result. If yes, put that state in a class. If no, use a free function.

- **Class** — when the thing owns state or manages resources: connections, caches, orchestration context, lifecycle. The class accepts dependencies in `__init__` and holds them. Examples: `PipelineRunner`, `SnapshotCache`, `AirflowClient`, `PgpDecryptor`.
- **Free function** — for genuinely stateless transforms, computations, validators, and builders: a leaf that takes inputs, returns a result, and keeps nothing. Group these in named modules by domain (`status.py`, `freshness.py`, `key_partition.py`), not by type (`helpers.py`, `functions.py`).
- **Frozen dataclass** — for value objects: config, domain types, intermediate results. These are data containers, not behavioral classes. Put them in `models/`.

**The parameter-threading smell.** The common mistake is missing state that already exists, not reaching for a class too early. When two or more functions pass the *same* objects in a fixed sequence, `run(conn, cfg, logger)` calling `_extract(conn, cfg, logger)` then `_load(conn, cfg, logger)`, that shared context *is* state. Threading it through every signature turns a class's `__init__` inside out. An orchestrator, runner, or pipeline that coordinates steps over a shared connection and config needs a class even when each step looks pure in isolation. Give the shared context an owner: construct it once in `__init__`, and let methods use `self.conn` instead of receiving it again and again.

Use state, not size, as the test: hold state in a class and compute without it in a function. The Dependency Injection section below covers what goes *into* that `__init__`: the class accepts collaborators rather than constructing them.

## Module & Project Layout

Split by responsibility. The shape depends on what you are building, but the layering principle stays constant: dependencies flow one way, and each layer knows only about layers below it.

For what goes *inside* the entrypoint (CLI wiring, config layering, secrets, exit codes, dryrun flags), read `references/operational.md` when the task involves a runnable job, CLI, or service rather than a pure library.

The shape, in one line: **`main`/`cli` → `core` → `{models, utils}`**, with imports only ever pointing right.

```
project/
├── main.py     # or cli.py. Parse input, build config, hand off. Stays thin.
├── core/       # Orchestration and business logic. Owns state.
├── models/     # Dataclasses, enums, domain types. No logic, no I/O.
└── utils/      # Leaf helpers. Knows nothing about core.
```

That sketch is deliberately generic. **Read `references/layout.md`** for the filled-in tree of the archetype you are building (data pipeline, service, or CLI tool) before creating directories.

### Layout rules

`utils/` never imports from `core/`. If two modules need to import each other, put the shared abstraction in a third place, usually `models/` or a new utils module.

Group files by domain, not by type. `loaders.py`, `validators.py`, `transforms.py` communicate intent; `classes.py`, `functions.py`, `helpers.py` don't.

**Function and module size.** A function that scrolls past ~50 lines usually does more than one thing; extract helpers. A module over ~400 lines signals that it has become a grab bag; split it along a natural seam. These are not hard limits, but hitting them should prompt another look.

**Breaking circular imports.** If module A needs a type from module B for hints only, use `from __future__ import annotations` + `if TYPE_CHECKING: from b import BType`. The import is only evaluated by type checkers, not at runtime.

**`__init__.py` is a package marker, not a home for code.** Keep it empty (0 bytes) or limited to a short `__all__` re-export list. Never put classes, functions, dataclasses, or business logic in `__init__.py`. Put every logical unit in a named module (`runner.py`, `status.py`, `config.py`) so readers can find code by scanning directory file names. If a package contains only one module, that module still gets a descriptive name rather than living in `__init__.py`. When code lives in `__init__.py`, `from package import thing` does not show readers *where* inside the package `thing` is defined, so they have to open the file and scroll. Named modules make the codebase navigable without grep.

## Design Principles

SOLID, applied:

- **Single Responsibility** — one function does one thing, one class owns one concern. A `DataLoader` does not also validate schemas.
- **Open/Closed** — extend behavior through composition, new subclasses, or strategy callables rather than modifying working code.
- **Liskov Substitution** — subtypes must be drop-in replacements. If a function accepts `BaseTransformer`, any subclass must honor its contract without surprises.
- **Interface Segregation** — prefer small, focused protocols over fat interfaces. A consumer that only reads should not depend on an interface that also writes.
- **Dependency Inversion** — depend on abstractions, not concretions. Pass dependencies (DB connections, S3 clients, file readers) into the consumer rather than constructing them inside.

And the broader habits:

- **DRY** — extract repeated logic to shared functions or constants.
- **YAGNI** — no speculative abstractions. Add complexity when a concrete requirement demands it, not before.
- **Fail fast** — assert invariants at boundaries so bugs surface close to their cause, not three layers down.
- **Prefer immutability** — return new objects from transforms; avoid in-place mutation. Especially important for shared config, DataFrames, and anything passed between threads.
- **Explicit over implicit** — name your constants, type-hint your functions, keyword your arguments, raise your specific exceptions.
- **Trust framework guarantees** — don't validate what the type system or framework already enforces. Validate at system boundaries (user input, external APIs), not between internal functions.

## Dependency Injection & Testability

A class that builds its own S3 client requires monkey-patching `boto3` in tests. A class that accepts a client is easy to test. **Pass dependencies in.**

Production code should construct concrete clients at the **composition root** (`main.py`, a CLI entrypoint, or a `build_runner()` factory) and thread them down to the services that use them. Services accept dependencies in `__init__` and keep the references. They should not call `boto3.client(...)` or `snowflake.connector.connect(...)` themselves.

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

The service does not know about `boto3`. Tests hand it a fake or a `moto`-backed client. Different callers (prod pipeline, backfill job, ad-hoc script) can configure the client differently (region, retry config, endpoint override) without touching the service.

**Default-arg construction** (`s3: S3Client | None = None; self.s3 = s3 or boto3.client(...)`) lets callers skip wiring while the service still works. It is fine for small CLI tools and one-off scripts with a trivially small composition root. Avoid it as the default pattern in a growing service because it hides the dependency graph, makes the service module import every concrete client it might need, and makes it easy for a test that forgot a fake to construct a real client.

For pure functions that depend on the current time, the current random seed, or the process environment, take the value as a parameter with a default:

```python
def ingestion_partition(now: datetime | None = None) -> DatePartition:
    ts = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    ...
```

Tests pass a frozen time; production uses the default. This needs no `freezegun` or monkey-patching.

**Keyword-only arguments** for any public API with more than 2–3 parameters. Mark them with `*,`:

```python
def run(self, *, dryrun: bool, copy_only: bool, merge_only: bool) -> dict[str, Any]: ...
```

This prevents silent positional mistakes as the signature grows. `runner.run(True, False, True)` invites a bug; `runner.run(dryrun=True, copy_only=False, merge_only=True)` documents itself.

## Design Patterns

Introduce patterns when the work needs them.

- **Strategy / callable injection** — swap algorithms at runtime by passing a function. Natural fit for "transform this stream" or "pick an aggregation." Use a `Callable[[...], ...]` type hint or a Protocol.
- **Factory closure** — when construction needs several arguments but callers only want to invoke the result, return a closure: `make_target_key = make_target_key_factory(cfg, partition)`; later, `tgt = make_target_key(src)`. Cleaner than threading `(cfg, partition, src)` through every call site.
- **Repository / Adapter** — abstract data access behind a clean interface so business logic doesn't know whether data comes from a database, API, or file. Enables swapping backends and mocking in tests.
- **Pipeline / Chain** — compose transformations as a sequence of discrete steps; each step takes input and returns output. Natural for ETL.
- **Decorator (functional)** — wrap functions with cross-cutting concerns (retries, caching, timing) via `@functools.wraps`.
- **Observer** — emit events (progress, quality-gate hits, shutdown signals) to pluggable listeners rather than coupling core logic to logging/alerting/metrics. Useful when multiple subsystems need to react to the same event.
- **Singleton** — exactly one instance across the process.

## Logging

Prefer `logger` to `print()` in committed files. `print()` writes to stdout without a level, timestamp, module name, or a way to filter or route output. A `logger` call provides all of these at the same typing cost. For a quick debug, progress update, dry-run notice, or error message, use `logger.debug/info/warning/error` first.

`print()` is reasonable in a few places: the body of `if __name__ == "__main__":` in a one-off script, a notebook cell, a short REPL experiment, or a CLI designed to emit machine-readable output (JSON, TSV) to stdout. Outside these cases, default to the logger.

- Module-level: `logger = logging.getLogger(__name__)` at the top of every file that emits output. Never instantiate a new logger per call.
- Lazy `%s` formatting: `logger.info("Copied %d files from %s", n, bucket)`. The formatting runs only if the log level is enabled.
- Pick levels intentionally: `DEBUG` for verbose diagnostics, `INFO` for milestones ("started phase X", "copied N files"), `WARNING` for degraded-but-continuing, `ERROR` for a specific failure, and `logger.exception(...)` inside `except` blocks when the traceback adds signal.
- Include identifying context in every log: run id, pipeline name, key being processed. Otherwise parallel-run logs become unreadable.
- Log structured summaries at phase boundaries as JSON. You can grep them or pipe them into an analyzer.

## Error Handling & Retries

- Never bare `except:`. Catch specific types by default: `except (ClientError, TimeoutError):`, not `except Exception:`. Reserve broad catches for isolation boundaries (see below).
- Validate inputs at boundaries (function entry, config load, data ingress). Fail early with messages that say what is wrong and how to fix it.
- **Custom exception classes** for domain errors once the codebase has more than one call site: `class DecryptionError(RuntimeError): ...`. They make callers' except blocks readable and let a retry helper identify what is safe to retry.
- **Retry only transient errors**: network flaps, 5xx responses, throttling, timeouts. Never retry `NoSuchKey`, `403`, `ValueError`; these are bugs, not flakes. Use exponential backoff with jitter, and **narrow the exception types** you catch:

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

Do not scatter broad catches through ordinary code. Use them at **isolation boundaries**, where one unit's failure should not abort a larger run. Processing 10,000 records, refreshing 50 pipelines, or serving the next request after the last one raised are all boundaries where `except Exception` is the right tool.

```python
results: dict[str, str] = {}
for pipeline in pipelines:
    try:
        results[pipeline.name] = refresh_pipeline(pipeline)
    except Exception as e:
        logger.exception("Pipeline %s failed; continuing", pipeline.name)
        results[pipeline.name] = f"FAILED: {type(e).__name__}: {e}"
return results
```

Two rules prevent the "swallow everything" anti-pattern:

1. **The `try` block wraps a single unit**, not a 200-line body. If something inside the unit is expected to fail in a specific way, catch *that* type inside. The outer broad catch is the last line of defense for unknown failures.
2. **The failure is recorded as a degraded result** that the caller can act on, rather than silently dropped. Return an explicit `"FAILED: ..."` string, a `Result[T, Error]`-style object, or increment an error counter the summary surfaces. If the batch ends with `errors=3` and nobody looks, that is a process problem. If the code returned `results` with `"FAILED"` entries and the caller checks, the isolation worked.

Outside isolation boundaries, a broad catch is almost always wrong because it hides bugs, makes diagnosis harder, and turns real failures into silent successes.

## Context Managers & Resource Management

Put every resource that needs paired setup/teardown in a context manager when the API supports it. If the API requires explicit `close()`, `abort()`, or process-group cleanup, keep the lifecycle in a tight `try/finally` or `ExitStack` so teardown cannot be skipped.

- Files: `with open(path) as f:`, not bare `open()`.
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

Nested exceptions make `finally` blocks easy to miss. A context manager makes cleanup impossible to skip, regardless of the exception or early return.

For **multi-resource cleanup** (abort this multipart upload, close that connection, remove that temp dir), use `contextlib.ExitStack`:

```python
with ExitStack() as stack:
    conn = stack.enter_context(closing(snowflake.connector.connect(**params)))
    keyring = stack.enter_context(ephemeral_keyring(Path("/dev/shm")))
    ...
```

## Time & Timezones

- Always timezone-aware: `datetime.now(timezone.utc)`. Never naive `datetime.now()`.
- Carry UTC internally; convert to local only at display boundaries.
- Time-dependent pure functions take `now` as an optional parameter — see the injection pattern in Dependency Injection & Testability above.

## Concurrency

Read the relevant section of `references/concurrency.md` before writing code that involves parallelism, async/await, locks, signals, subprocess pipes, or worker pools. It covers choosing between threads, processes, and asyncio; synchronization primitives; bounded queues and backpressure; cancellation and timeouts; graceful shutdown; connection pooling under concurrency; and the resulting bugs. The checklist below is the floor, not the standard.

Quick rules:

- I/O-bound parallelism (HTTP, S3, DB queries): `concurrent.futures.ThreadPoolExecutor`. A sensible default size is `min(32, (cpu_count or 1) * 4)`, tuned from there.
- CPU-bound: `ProcessPoolExecutor`. Bypasses the GIL.
- Many small coroutines: `asyncio`. Do not mix asyncio and thread pools unless you mean to.
- Never share a mutable dict or list across threads without a lock or a thread-safe structure.
- Bound your queues. An unbounded work queue fills memory until the process dies; use `queue.Queue(maxsize=N)`.
- Graceful shutdown for long-running processes: handle `SIGTERM`, drain in-flight work, exit cleanly.

## Performance

- Measure before optimizing with `cProfile`, `timeit`, or `line_profiler`. Assumptions about where time goes are often wrong.
- `set` for membership, generators for large iterations, lazy evaluation where possible.
- Avoid N+1 patterns: a single bulk `list` plus an in-memory filter beats N individual `HEAD`s or `GET`s.
- Stream unbounded inputs — large files, user uploads, S3 objects, API responses, subprocess pipes — instead of buffering the whole payload. Streaming details are in `references/operational.md`.

## Python-Specific Footguns

- **Never use mutable default arguments.** `def f(items=[])` shares that list across every call. Use `None` and assign inside:

  ```python
  def f(items: list[str] | None = None) -> None:
      items = items if items is not None else []
  ```

- **Watch late-binding closures in loops.** `fs = [lambda: i for i in range(3)]` produces three functions that all return `2`. Capture with a default arg: `lambda i=i: i`.
- **`is` vs `==`.** Use `is` only for `None`, `True`, `False`, and sentinel identity checks. Never `x is 0` or `x is "foo"` — it works today only by CPython interning and will break silently.
- **Don't subclass `dict`/`list`.** Composition (wrap + expose the methods you need) avoids MRO and pickling surprises.
- **Avoid module-level side effects.** Code at import time runs every time something imports the module — don't open files, hit networks, or read config there. Put it in a function called from `main`.

## Security

Every codebase has this floor:

- **Parameterized queries only.** Never f-string or `.format()` external input into SQL.
- **No secrets in logs, CLI args, or URLs.** Use Pydantic's `SecretStr` (or an equivalent repr-hiding wrapper) for credential fields.
- **Never `pickle.load()`, `eval()`, or `exec()` on untrusted input.** Use `yaml.safe_load()`, not `yaml.load()`.
- **No `shell=True`.** Pass subprocess arguments as a list: `subprocess.run(["ls", "-la", path])`.
- **TLS verification stays on.** Never `verify=False` in requests/httpx.

When the task touches credentials, auth, API endpoints, file permissions, or paths derived from external input, read `references/security.md` for the full standard, including the `SecretStr` caveats, SQL identifier handling, password hashing, and API-endpoint rules.

## Testing

- `pytest`. Small, deterministic fixtures. No external network in unit tests — use `pytest-socket` (or equivalent) to enforce it.
- **Inject the dependency, mock the dependency** — don't patch deep internals. `def test_runner(fake_s3: FakeS3) -> None: ...` is cleaner and more durable than `@patch("boto3.client")`.
- Test business logic (transforms, validators, config parsing) at high coverage. I/O boundaries get integration tests that can touch real infra with a `@pytest.mark.integration` marker.
- Edge cases to hit explicitly: empty input, all-null column, duplicate keys, unexpected dtypes, retry exhaustion, partial batch failure, config missing required key.
- Name tests by what they assert: `test_config_raises_when_bucket_missing`, not `test_config_1`.
