# Language Pack: Python

Load when the review scope contains `.py` files, `pyproject.toml`, or `requirements.txt`. This pack sharpens the six generic rubric dimensions with Python-specific footguns. Read it fully before scoring.

## Idiom & formatter

- PEP 8, Black-compatible (4-space indents, ~88–100 col). `ruff`/`flake8` for lint, `mypy`/`pyright` for types.
- Type hints on public APIs. `f-strings` for formatting **except** in logging calls, where lazy `%s` args are correct (`logger.info("x=%s", x)`, not `logger.info(f"x={x}")`) — the f-string formats even when the log level is disabled.
- Docstrings on public modules, classes, and functions.

## Security (×2.0)

- Hardcoded secrets or secrets logged (`logger.info("config: %s", config)` dumping a dict with a token).
- `verify=False` on `requests`/`httpx`, or a custom `ssl` context that disables verification.
- Injection: `subprocess` with `shell=True` on interpolated input; raw f-string SQL instead of parameterized queries; `eval`/`exec`/`pickle.loads`/`yaml.load` (without `SafeLoader`) on untrusted input.
- `tempfile.mktemp` (race) instead of `mkstemp`/`NamedTemporaryFile`; world-readable file perms on secret files.
- `assert` used to enforce a security/validation invariant — stripped under `python -O`.

## Correctness & Hidden Bugs (×2.0)

- **Mutable default arguments** (`def f(x, acc=[])`) — shared across calls; classic state-leakage bug.
- **Class-level mutable containers** shared across instances; module-level caches without eviction.
- `datetime.utcnow()` / `datetime.now()` (naive) vs `datetime.now(UTC)` — naive datetimes in a pipeline crossing regions or compared against aware ones.
- `==` vs `is` (especially `is` with small ints / interned strings working by accident; `== None` vs `is None`).
- Float equality and accumulation; integer division surprises (`/` vs `//`).
- Iterator/generator exhaustion (consuming a generator twice; `zip` truncation; `dict`/`set` ordering assumptions on older runtimes).
- Late binding in closures inside loops (`lambda: i` capturing the variable, not the value).
- `except ... as e` then referencing `e` outside the block (cleared after the block in Py3).
- **Async/concurrency:** blocking I/O (`requests`, `time.sleep`, heavy CPU) inside a coroutine; unawaited coroutine (returns a coroutine object, never runs); fire-and-forget `asyncio.create_task` whose exceptions are never retrieved; `asyncio.gather(...)` without `return_exceptions=` when one failure should surface; thread-unsafe shared state under `threading`; GIL assumptions that break under `multiprocessing`.
- Resource leaks: file/DB/socket opened without a `with` block and not closed on the exception path.

## Async, startup & operational footguns

These bugs rarely show up on a happy-path read — they live in the *interaction* of a startup sequence, a retry budget, and an unreachable upstream. They map to the core skill's **Sweep B (failure-mode trace)**. Probe them deliberately; they are routinely the costliest issues in a service and the ones reviewers miss.

- **Readiness blocked by an upstream call.** Anything `await`ed in a FastAPI `lifespan` / `@app.on_event("startup")` **before `yield`** (or before the app reports healthy) gates readiness. If that work calls an external dependency — especially a client with retries and timeouts — a slow or down upstream delays the service becoming available, sometimes for minutes. The status endpoint can't serve, even cached data it already has, until the blocking work finishes or gives up.

- **Retry-budget multiplication.** When a client with timeout `T` and `R` retries is called inside a loop of `N` items, the worst case isn't `T` — it's `N × (R+1) × T`. A 10s timeout, 2 retries, 30-item registry, all called serially at startup against a down upstream = `30 × 3 × 10s = 15 minutes` of blocked readiness. Each piece looks fine in isolation; multiply them through to see the failure. Compute this explicitly rather than eyeballing it (a 10-line script settles it — see the core skill's "verify by execution").

- **Serial vs concurrent async I/O.** A `for item in items: await client.call(item)` loop runs the calls *sequentially* — total latency is the sum, not the max. If the calls are independent, this usually wants `asyncio.gather(*calls)` with a bounded `Semaphore`. Watch for *inconsistency within the same codebase*: a request path that correctly uses `gather` + semaphore alongside a startup path that loops serially is a smell worth flagging — the author already knows the pattern and didn't apply it where it matters most.

- **"Best-effort" work placed on a blocking path.** A comment saying *"validation should never fail startup"* sitting next to code that `await`s that validation **before `yield`** is a contradiction: the intent is non-critical, but the placement makes readiness depend on it. Best-effort or advisory work belongs in a background task kicked off *after* the app reports ready (`asyncio.create_task` whose result is observed/logged), not in the readiness-gating section.

- **Unobserved background tasks.** `asyncio.create_task(...)` without holding a reference or attaching a done-callback: the task can be garbage-collected mid-flight, and its exceptions vanish. Fire-and-forget that swallows failures is High when the task does real work.

- **Missing short-circuit driving avoidable upstream load.** A resolver that fetches a primary resource, gets `None` (e.g. "DAG not found"), but continues calling the rest of the chain anyway turns a cheap known-negative into N extra upstream calls every refresh — and can mask the clearer "not found" reason behind a later generic error.

### Worked example — weigh severity against what the service is *for*

> A status-dashboard backend awaits `_run_startup_validation` in its `lifespan` before `yield`. The validation loops serially over the pipeline registry, calling a retrying Airflow client (`timeout=10s`, `retries=2`) once per entry. A comment says validation must never fail startup.
>
> **Failure story:** Airflow is down when the backend restarts. Worst-case readiness delay ≈ `registry_size × 3 × 10s`. The dashboard whose entire reason to exist is *showing status while Airflow is unhealthy* is itself unavailable during exactly that incident — even though it has a cache it could serve.
>
> **Severity:** this is **High**, not Medium, *because of what the service is for*. The same blocking validation in a nightly batch job that nobody waits on would be Medium. Name that reasoning in the finding. Fix: move validation into a post-`yield` background task with a concurrency cap, or make it non-blocking; cache task lists by `dag_id` if entries share DAGs.

## Performance (×1.5)

- Unbounded `.read()` on a stream/response/file advertised as large; list-materializing a generator that could stream.
- N+1 queries in a loop; building a `list` then `len()`-checking instead of early-exit.
- String concatenation in a loop instead of `"".join`; repeated recompilation of regexes in a hot path.
- Wrong executor: CPU-bound work on a `ThreadPoolExecutor` (GIL-bound) instead of processes; unbounded `Queue`/`Semaphore`.

## Architecture & Design (×1.5)

Python is object-oriented, so the full **SOLID** lens applies (single responsibility, open/closed, Liskov, interface segregation via `Protocol`/ABC, dependency inversion).

- God classes; classes constructing their own boto3/DB/HTTP clients internally with no injection seam (untestable).
- Circular imports; business logic in `__main__`/entrypoint instead of a thin shell calling `core`.
- Missing `Protocol`/ABC where a structural interface would decouple; gratuitous `Factory`/`Singleton`/ABC-with-one-impl (raise as proposal).
- Public API breaks (diff scope): renamed/removed public functions, changed signatures or return shapes, `__all__` changes.

## Error Handling & Resilience (×1.0)

- Bare `except:` or `except Exception:` without a stated reason — swallows `KeyboardInterrupt`/`SystemExit` and masks programmer errors.
- Retry loops that retry non-transient errors (e.g., `ValueError`) instead of only transient (`ConnectionError`, timeouts) with backoff.
- Resources not under context managers; no per-item isolation in a batch loop (one bad record kills the batch).
- Observability: exception message omits the failing record's identifier; `print()` instead of `logging` in a production path; log level mismatches.

## Readability & Style (×1.0)

- Missing type hints/docstrings on public APIs; `type(x) == str` instead of `isinstance(x, str)`.
- Magic numbers; functions >50 lines / modules >400 lines (soft).
- `from module import *`; unused imports; f-strings inside `logger.*` calls.

## Grep patterns worth running

```
except:                      # bare except
except Exception             # broad catch — check for justification
verify=False                 # disabled TLS
shell=True                   # subprocess injection surface
eval(|exec(|pickle.loads|yaml.load(   # unsafe deserialization
def .*=\[\]|def .*=\{\}      # mutable default args
datetime.utcnow|datetime.now\(\)       # naive datetimes
print\(                      # debug prints in prod paths
import \*                    # wildcard imports
lifespan|on_event\("startup" # startup hooks — check what blocks readiness before yield
create_task\(                 # background tasks — check the reference is held & errors observed
for .*:\n.*await              # serial awaits in a loop — should this be gather()?
```

## Calibration hints

- A mutable default argument or a naive-datetime comparison in a multi-region pipeline is at least **High** — both are silent-wrong-answer or state-leak bugs.
- A bare `except:` in a production path caps **Error Handling at ≤ 6** (per the core guardrail).
- A blocking call inside a coroutine, or a fire-and-forget `create_task` with unobserved exceptions, is **High** under Correctness.
- An upstream call on the startup/readiness path that can block the service from becoming available is at least **High** — and weigh it up further for a service whose job is to stay up while that upstream is down. Compute the worst-case `N × (retries+1) × timeout` delay before settling severity.
