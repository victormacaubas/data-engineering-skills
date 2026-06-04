# Language Pack: Python

Load when the review scope contains `.py` files, `pyproject.toml`, or `requirements.txt`. This pack sharpens the universal review dimensions with Python-specific footguns; the dimension keys in parentheses match `../references/review-dimensions.md`. Read it fully before scoring.

## Idiom & formatter

- PEP 8, Black-compatible (4-space indents, ~88–100 col). `ruff`/`flake8` for lint, `mypy`/`pyright` for types.
- Type hints on public APIs. `f-strings` for formatting **except** in logging calls, where lazy `%s` args are correct (`logger.info("x=%s", x)`, not `logger.info(f"x={x}")`) — the f-string formats even when the log level is disabled.
- Docstrings on public modules, classes, and functions.

## Security (`security`)

- Hardcoded secrets or secrets logged (`logger.info("config: %s", config)` dumping a dict with a token).
- `verify=False` on `requests`/`httpx`, or a custom `ssl` context that disables verification.
- Injection: `subprocess` with `shell=True` on interpolated input; raw f-string SQL instead of parameterized queries; `eval`/`exec`/`pickle.loads`/`yaml.load` (without `SafeLoader`) on untrusted input.
- **Path traversal via `os.path`**: `os.path.join(base, user_input)` does NOT sandbox — if `user_input` is absolute it replaces `base` entirely; `os.path.normpath` preserves leading `../` sequences. Any code that builds a filesystem or S3 key path from external/config-sourced input using `os.path.join`/`normpath` is a traversal surface. Grep for `os.path.join` and `os.path.normpath` and trace whether the second argument can come from outside the trust boundary.
- `tempfile.mktemp` (race) instead of `mkstemp`/`NamedTemporaryFile`; world-readable file perms on secret files.
- `assert` used to enforce a security/validation invariant — stripped under `python -O`.

## Correctness & hidden bugs (`correctness`, `concurrency`, `resource-lifecycle`)

- **Mutable default arguments** (`def f(x, acc=[])`) — shared across calls; classic state-leakage bug.
- **Class-level mutable containers** shared across instances; module-level caches without eviction.
- `datetime.utcnow()` / `datetime.now()` (naive) vs `datetime.now(UTC)` — naive datetimes in a pipeline crossing regions or compared against aware ones.
- `==` vs `is` (especially `is` with small ints / interned strings working by accident; `== None` vs `is None`).
- Float equality and accumulation; integer division surprises (`/` vs `//`).
- Iterator/generator exhaustion (consuming a generator twice; `zip` truncation; `dict`/`set` ordering assumptions on older runtimes).
- Late binding in closures inside loops (`lambda: i` capturing the variable, not the value).
- `except ... as e` then referencing `e` outside the block (cleared after the block in Py3).
- **Async/concurrency** (`concurrency`): blocking I/O (`requests`, `time.sleep`, heavy CPU) inside a coroutine; unawaited coroutine (returns a coroutine object, never runs); fire-and-forget `asyncio.create_task` whose exceptions are never retrieved; `asyncio.gather(...)` without `return_exceptions=` when one failure should surface; thread-unsafe shared state under `threading`; GIL assumptions that break under `multiprocessing`.
- **Type annotations that lie** (`correctness`): dataclass/Pydantic fields annotated as `str` but populated with `None` (no `Optional`), or vice versa. Python doesn't enforce annotations at runtime — the object is silently invalid and any downstream `.split()`, `len()`, or f-string use crashes with `AttributeError`/`TypeError`. Check every dataclass/model instantiation site: does the value actually match the declared type?
- **Resource leaks** (`resource-lifecycle`): file/DB/socket opened without a `with` block and not closed on the exception path; missing timeout on a network call. **Also**: HTTP response bodies and S3 `GetObject["Body"]` (StreamingBody) — these hold open a connection from the pool. If not explicitly closed (or used inside `with`), they leak under exception paths and eventually exhaust the connection pool under load. Grep for `.get_object(`, `requests.get(`, `httpx.` and trace whether the response body is closed on both success and error paths.

## Performance (`performance`)

- Unbounded `.read()` on a stream/response/file advertised as large; list-materializing a generator that could stream.
- N+1 queries in a loop; building a `list` then `len()`-checking instead of early-exit.
- String concatenation in a loop instead of `"".join`; repeated recompilation of regexes in a hot path.
- Wrong executor: CPU-bound work on a `ThreadPoolExecutor` (GIL-bound) instead of processes; unbounded `Queue`/`Semaphore`.

## Architecture & design (`architecture`, `api-contracts`)

Python is object-oriented, so the full **SOLID** lens applies (single responsibility, open/closed, Liskov, interface segregation via `Protocol`/ABC, dependency inversion).

- God classes; classes constructing their own boto3/DB/HTTP clients internally with no injection seam (untestable).
- Circular imports; business logic in `__main__`/entrypoint instead of a thin shell calling `core`.
- Missing `Protocol`/ABC where a structural interface would decouple; gratuitous `Factory`/`Singleton`/ABC-with-one-impl (raise as proposal).
- Public API breaks (`api-contracts`, diff scope): renamed/removed public functions, changed signatures or return shapes, `__all__` changes.

## Error handling & resilience (`error-handling`, `idempotency`, `observability`)

- Bare `except:` or `except Exception:` without a stated reason — swallows `KeyboardInterrupt`/`SystemExit` and masks programmer errors.
- Retry loops that retry non-transient errors (e.g., `ValueError`) instead of only transient (`ConnectionError`, timeouts) with backoff.
- Resources not under context managers; no per-item isolation in a batch loop (one bad record kills the batch).
- Idempotency (`idempotency`): re-running a job double-writes because an insert isn't an upsert / lacks a dedup key.
- Observability (`observability`): exception message omits the failing record's identifier; `print()` instead of `logging` in a production path; log level mismatches.

## Readability & style (`readability`)

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
os\.path\.join|os\.path\.normpath     # path traversal surface — trace second arg origin
get_object\(|\.get\(.*stream  # S3/HTTP body — verify .close() or `with` on both paths
@dataclass|BaseModel          # check annotations match actual values at construction sites
```

## Calibration hints

- A mutable default argument or a naive-datetime comparison in a multi-region pipeline is at least **high** under `correctness` — both are silent-wrong-answer or state-leak bugs.
- A bare `except:` in a production path is at least **high** under `error-handling`.
- A blocking call inside a coroutine, or a fire-and-forget `create_task` with unobserved exceptions, is **high** under `concurrency`.
