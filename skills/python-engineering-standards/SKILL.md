---
name: python-engineering-standards
description: Canonical Python coding standards for production code — services, CLIs, pipelines, libraries, ETL jobs, and internal tooling. Use when writing, reviewing, or refactoring any Python beyond a throwaway snippet. Covers layout, typing, config, logging, error handling, retries, concurrency, security, testing, tooling, and packaging. Domain-specific Python skills (e.g., python-data-analysis) build on top of it.
---

# Python Engineering Standards

These are the canonical standards for writing production Python at this organization. Apply them to anything beyond throwaway code — services, CLIs, pipelines, libraries, jobs. Domain-specific skills (e.g., `python-data-analysis`) assume this file as their base and add patterns on top.

The guiding principle: **write code that another engineer can read, test, and re-run six months from now without surprise.** Every rule below exists because something broke when it wasn't followed.

## How to apply these standards

Start by reading the repo in front of you: `pyproject.toml`, Ruff/Black/mypy settings, supported Python version, package layout, and the dominant local conventions. Explicit, coherent project configuration wins. Use this skill for decisions the repo has not already made; when local code is inconsistent, align with the safest checked-in pattern before introducing a new one.

If there's no tooling config to read — a fresh repo, or you're scaffolding one — read `references/tooling.md` for the baseline `pyproject.toml` toolchain before writing one from memory. That's the one case where this skill, not the repo, is the source of truth for tooling.

## Reference files

The deeper material lives in `references/`. Read the file whose territory the task touches; skip the rest so they stay out of context.

- `references/operational.md` — running code in production: CLI entrypoints and exit codes, layered configuration, secrets lifecycle, observability for long-running jobs (correlation/run ids, health checks, metrics, heartbeats, alerting), making a pipeline idempotent or re-runnable (skip-if-exists, deterministic keys, manifests), streaming I/O, and packaging for distribution (lockfiles, console scripts, dependency auditing). Several of these topics have no section in this file — this reference is their only home, so reach for it whenever a task is about *running* a job rather than *writing* one.
- `references/concurrency.md` — threads vs. processes vs. asyncio, synchronization, bounded queues, cancellation, graceful shutdown. Read before writing any parallel code.
- `references/security.md` — the full security standard: credential handling, SQL, file permissions, path handling, API endpoints. The non-negotiable floor is in the Security section below.
- `references/tooling.md` — baseline `pyproject.toml` toolchain (uv, Ruff, mypy, pytest, pre-commit). For new projects or repos with no checked-in tooling config; existing repo config wins.

## Style

- PEP 8. 4-space indents, `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for module-level constants, 88-char lines (Black-compatible).
- f-strings for constructing strings — except in **log calls**, where `%s`-style is required (lazy formatting; skipped when the level is filtered out).
- No magic numbers. If a value has meaning, name it: `DEFAULT_PART_SIZE_BYTES = 128 * 1024 * 1024`, not `128 * 1024 * 1024` scattered through the code.
- `from __future__ import annotations` is useful in modules with heavy type hints, forward references, or support for Python < 3.10 — it makes hints lazy and keeps runtime cheap. On 3.10+ with native `X | Y` syntax there's less need for it. Add it where it helps; skip it where it doesn't.
- Imports in three groups, separated by a blank line and sorted alphabetically within each: stdlib, third-party, local. Never `from x import *`.
- Prefer `pathlib.Path` over string concatenation and `os.path.join`. `Path("/data") / pipeline_name / "raw"` is safer and reads like what it does.

## Comments & Docstrings

Documentation depth should scale with API surface — what a reader *outside* the module needs to know to use it. Be generous where it helps; don't manufacture prose where names already do the work.

**Public vs. private.** Treat a function/class as public if it's imported from outside its module, listed in `__all__`, exposed via `__init__.py`, or called across package boundaries. Private means leading-underscore names, nested helpers, and module-local utilities that only the module's own code reaches for. Apply documentation and typing rigor proportionally: more at public edges, less ceremony inside.

**Public functions, classes, and methods** deserve a docstring when behavior isn't obvious from the signature. Document what a caller can't infer: non-obvious semantics, edge-case handling, side effects, raised exceptions callers are expected to catch. If the name and type hints already tell the story (`def user_exists(user_id: UUID) -> bool`), a docstring restating them is noise — skip it.

**Private helpers** usually get by on clear naming. Add a docstring or comment only when there's something a reader wouldn't guess — an invariant the function assumes, a workaround for a specific bug, a performance-sensitive choice.

**Module docstrings need a reason to exist.** Skip perfunctory file summaries that just restate the filename. Keep a module docstring when it explains public API shape, package-level contracts, unusual import behavior, or context a caller needs before using the module. If the context is broader than one module, put it in the README or a design doc instead.

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

Split by responsibility. The shape depends on what you're building, but the layering principle is constant: dependencies flow one way, each layer knows only about layers below it.

For what goes *inside* the entrypoint — CLI wiring, config layering, secrets, exit codes, dryrun flags — read `references/operational.md` when the task involves a runnable job, CLI, or service rather than a pure library.

### Project archetypes

**Data pipeline / batch job** — argparse CLI, config from env/SSM, orchestrator class:

```
pipeline_name/
├── main.py              # argparse CLI. Parse args, build config, call runner.
├── core/                # Orchestration. Composes utils and models into a workflow.
│   └── runner.py        # PipelineRunner class — owns state (clients, config, logger).
├── models/              # Dataclasses, enums, domain types. No I/O, no logic.
│   └── config.py
└── utils/               # Leaf helpers: retries, I/O, parsing. Knows nothing about core.
    ├── s3_ops.py
    └── retries.py
```

**Service (FastAPI, Flask)** — no CLI, config from env/pydantic-settings:

```
service_name/
├── main.py              # App factory, lifespan wiring, uvicorn entrypoint.
├── config.py            # Config(BaseSettings) — env-driven, fail-fast validators.
├── api/                 # HTTP layer. Routes, deps, response schemas.
│   ├── routes.py
│   ├── deps.py
│   └── schemas.py
├── core/                # Business logic. Services, caches, state machines.
│   ├── service.py
│   └── cache.py
├── models/              # Domain types (dataclasses) and wire types (Pydantic).
│   ├── domain.py
│   └── wire.py
└── utils/               # External clients, helpers. No business logic.
    └── client.py
```

**CLI tool / developer utility** — click or typer for multi-command UX:

```
tool_name/
├── cli.py               # click/typer group. Parse commands, wire deps, call core.
├── core/                # Orchestration and processing logic.
│   ├── orchestrator.py  # Top-level workflow class — owns state, composes steps.
│   └── processor.py
├── models/              # Config, domain types, enums.
│   └── config.py
└── utils/               # I/O, formatting, parsing helpers.
    └── io.py
```

### Layout rules

Dependencies flow one way: `main/cli → core → {models, utils}`. `utils/` never imports from `core/`. If two modules want to import each other, the shared abstraction belongs in a third place — usually `models/` or a new utils module.

Group files by domain, not by type. `loaders.py`, `validators.py`, `transforms.py` communicate intent; `classes.py`, `functions.py`, `helpers.py` don't.

**Function and module size.** A function that scrolls past ~50 lines is usually doing more than one thing — extract helpers. A module over ~400 lines is signal that it's become a grab bag; split it along a natural seam. These aren't hard limits, but hitting them is a prompt to look again.

**Breaking circular imports.** If module A needs a type from module B for hints only, use `from __future__ import annotations` + `if TYPE_CHECKING: from b import BType`. The import is only evaluated by type checkers, not at runtime.

**`__init__.py` is a package marker, not a home for code.** Keep it empty (0 bytes) or limited to a short `__all__` re-export list. Never put classes, functions, dataclasses, or business logic in `__init__.py`. Every logical unit lives in a named module — `runner.py`, `status.py`, `config.py` — so a reader can find code by scanning file names in the directory tree. If a package contains only one module, that module still gets a descriptive name rather than living in `__init__.py`. The reason: when code lives in `__init__.py`, `from package import thing` gives the reader no signal about *where* inside the package `thing` is defined — they have to open the file and scroll. Named modules make the codebase navigable without grep.

### When to use a class vs a function

Start with the question that decides it: **does this code carry state across calls?** State is any resource or context that outlives a single invocation and that more than one operation reads or mutates — a connection, a cache, a client, config, a logger, an accumulating result. If yes, that state wants an owner, and the owner is a class. If no, a free function is the honest shape.

- **Class** — when the thing owns state or manages resources: connections, caches, orchestration context, lifecycle. The class accepts dependencies in `__init__` and holds them. Examples: `PipelineRunner`, `SnapshotCache`, `AirflowClient`, `PgpDecryptor`.
- **Free function** — for genuinely stateless transforms, computations, validators, builders — a leaf that takes its inputs, returns a result, and keeps nothing. Group these in named modules by domain (`status.py`, `freshness.py`, `key_partition.py`), not by type (`helpers.py`, `functions.py`).
- **Frozen dataclass** — for value objects: config, domain types, intermediate results. These are data containers, not behavioral classes. They live in `models/`.

**The parameter-threading smell.** The common mistake isn't reaching for a class too early — it's failing to notice state that's already there. When two or more functions pass the *same* objects to each other in a fixed sequence — `run(conn, cfg, logger)` calls `_extract(conn, cfg, logger)` then `_load(conn, cfg, logger)` — that shared context *is* state, and threading it through every signature is a class's `__init__` turned inside out. An orchestrator, runner, or pipeline that coordinates steps over a shared connection and config is a class even when each step looks pure in isolation. Give the shared context an owner: construct it once in `__init__`, and let the methods reach for `self.conn` instead of receiving it again and again.

Don't overcorrect. A single stateless computation doesn't need a class wrapped around it for ceremony, and three similar lines don't need a base class. The test is state, not size: hold state in a class, compute without it in a function.

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
- **Singleton** — exactly one instance across the process.

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

Broad catches don't belong scattered through ordinary code. Their place is at **isolation boundaries** — places where one unit's failure shouldn't abort a larger run. Processing 10,000 records, refreshing 50 pipelines, serving the next request after the last one raised: these are all boundaries where `except Exception` is the right tool.

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

Two rules keep this from sliding into the "swallow everything" anti-pattern:

1. **The `try` block wraps a single unit**, not a 200-line body. If something inside the unit is expected to fail in a specific way, catch *that* type inside — the outer broad catch is the last line of defense for unknown failures.
2. **The failure is recorded as a degraded result** the caller can act on, not silently dropped. Return an explicit `"FAILED: ..."` string, a `Result[T, Error]`-style object, or increment an error counter the summary surfaces. If the batch ends with `errors=3` and nobody looks, that's a process problem; if the code returned `results` with `"FAILED"` entries and the caller checks, the isolation worked.

Outside isolation boundaries, a broad catch is almost always the wrong answer — it hides bugs, makes diagnosis harder, and turns real failures into silent successes.

## Context Managers & Resource Management

Every resource that needs paired setup/teardown should live in a context manager when the API supports it. If the API requires explicit `close()`, `abort()`, or process-group cleanup, keep the lifecycle in a tight `try/finally` or `ExitStack` so teardown cannot be skipped.

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

`finally` blocks are easy to forget after three levels of nested exceptions. A context manager makes cleanup impossible to skip, regardless of which exception or early return fires.

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
- Accept `now` as an optional argument in time-dependent pure functions so tests can freeze time without monkey-patching.

## Concurrency

Read the relevant section of `references/concurrency.md` before writing code that involves parallelism, async/await, locks, signals, subprocess pipes, or worker pools. It covers the decision between threads, processes, and asyncio; synchronization primitives; bounded queues and backpressure; cancellation and timeouts; graceful shutdown; connection pooling under concurrency; and the bugs you will hit otherwise. The checklist below is the floor, not the standard.

Quick rules:

- I/O-bound parallelism (HTTP, S3, DB queries): `concurrent.futures.ThreadPoolExecutor`. A sensible default size is `min(32, (cpu_count or 1) * 4)`, tuned from there.
- CPU-bound: `ProcessPoolExecutor`. Bypasses the GIL.
- Many small coroutines: `asyncio`. Do not mix asyncio and thread pools unless you mean to.
- Never share a mutable dict or list across threads without a lock or a thread-safe structure.
- Bound your queues. An unbounded work queue fills memory until the process dies; `queue.Queue(maxsize=N)` is a two-line fix.
- Graceful shutdown for long-running processes: handle `SIGTERM`, drain in-flight work, exit cleanly.

## Performance

- Measure before optimizing. `cProfile`, `timeit`, `line_profiler`. Assumptions about where time goes are usually wrong.
- `set` for membership, generators for large iterations, lazy evaluation where possible.
- Avoid N+1 patterns: a single bulk `list` + in-memory filter beats N individual `HEAD`s or `GET`s.
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
- **`from x import *`** is banned. It pollutes the namespace and breaks tooling.

## Security

The floor, in every codebase:

- **Parameterized queries only.** Never f-string or `.format()` external input into SQL.
- **No secrets in logs, CLI args, or URLs.** Use Pydantic's `SecretStr` (or an equivalent repr-hiding wrapper) for credential fields.
- **Never `pickle.load()`, `eval()`, or `exec()` on untrusted input.** Use `yaml.safe_load()`, not `yaml.load()`.
- **No `shell=True`.** Pass subprocess arguments as a list: `subprocess.run(["ls", "-la", path])`.
- **TLS verification stays on.** Never `verify=False` in requests/httpx.

When the task touches credentials, auth, API endpoints, file permissions, or paths derived from external input, read `references/security.md` for the full standard — including the `SecretStr` caveats, SQL identifier handling, password hashing, and the API-endpoint rules.

## Testing

- `pytest`. Small, deterministic fixtures. No external network in unit tests — use `pytest-socket` (or equivalent) to enforce it.
- **Inject the dependency, mock the dependency** — don't patch deep internals. `def test_runner(fake_s3: FakeS3) -> None: ...` is cleaner and more durable than `@patch("boto3.client")`.
- Test business logic (transforms, validators, config parsing) at high coverage. I/O boundaries get integration tests that can touch real infra with a `@pytest.mark.integration` marker.
- Edge cases to hit explicitly: empty input, all-null column, duplicate keys, unexpected dtypes, retry exhaustion, partial batch failure, config missing required key.
- Name tests by what they assert: `test_config_raises_when_bucket_missing`, not `test_config_1`.
