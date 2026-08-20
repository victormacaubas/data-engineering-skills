# Concurrency

Concurrency lets a program do more than one thing at the same time. It also introduces bugs that may appear only under load or on a specific platform. This reference helps you avoid discovering them in production.

The decisions to make, in order:

1. Do you actually need concurrency?
2. Is the workload I/O-bound, CPU-bound, or wait-heavy at high fan-out?
3. Which primitive fits the answer to (2)?
4. How will you shut it down, cancel it, bound it, and observe it?

Answer all four before writing code.

## How to use this reference

Load the section that matches the work instead of the entire reference:

- Choosing a model: sections 1–3.
- Thread pools and I/O fan-out: section 4.
- CPU-bound work or multiprocessing: section 5.
- `async`/`await`: section 6.
- Shared state, locks, queues, shutdown, or subprocess pipes: sections 7–10.
- Database/SDK clients under concurrency: section 11.
- Debugging intermittent concurrency failures: section 12.

## 1. Decide whether you need concurrency at all

Concurrency has costs. It adds bug surface (races, deadlocks, ordering assumptions), failure modes (partial completion, leaked workers), and debugging difficulty (stack traces that span threads). Before using it, ask:

- Is the program actually slow, or does it only feel slow? Measure first. A `cProfile` run showing 92% of time in `json.loads()` will not benefit from threading.
- Can a faster sequential algorithm solve it? An O(N) scan replacing an O(N^2) nested loop beats any amount of threading.
- Can batching solve it? Replacing 10,000 single-row inserts with one `executemany` call usually beats parallelizing the 10,000 inserts.
- Can streaming solve it? If memory is the bottleneck, an iterator chain solves the problem without concurrency.
- Is the latency floor an unavoidable network round-trip? Then you probably want concurrency. This is the most common legitimate case in practice (S3, HTTP APIs, database queries).

If you decide you need it, write down the expected speedup and why in a comment or design note. "Threading this S3 copy from sequential to 16-wide should drop wall time from ~40m to ~3m because each object takes ~150ms of network round-trip and the local CPU is idle" is a real justification. "Parallelize for performance" is not.

## 2. Pick the model: threads, processes, or asyncio

Three questions select the model.

**Is the work waiting on I/O or burning CPU?** Threads and asyncio work well while a program waits (network, disk, subprocess). Processes work well while it computes (parsing, hashing, numpy on plain Python loops, image work without C extensions).

**Why?** CPython has the Global Interpreter Lock, which serializes Python bytecode execution across threads in a single process. While one thread is computing, others wait. While one thread is *waiting on I/O* (a syscall that releases the GIL), others can run. Threads therefore parallelize I/O but not pure-Python CPU work. Processes sidestep the GIL entirely because each process has its own interpreter.

**How many concurrent operations do you need?** Threads scale to perhaps a few thousand on a typical Linux box before per-thread memory and context-switch costs become a tax. asyncio scales to tens or hundreds of thousands of concurrent waits because each one is a small Python object, not an OS thread. Processes are heavier still; you typically want one per CPU core, not one per task.

**Is the code you are calling async-aware?** asyncio only helps if the libraries you call expose `async` interfaces. Calling synchronous `requests.get()` from an asyncio event loop blocks the whole loop. If your stack is sync (boto3, psycopg2, snowflake-connector-python without async helpers), threads are usually the right call.

Decision shortcut:

- I/O-bound, dozens to hundreds of concurrent calls, sync libraries: `ThreadPoolExecutor`.
- I/O-bound, thousands to tens of thousands of concurrent calls, async libraries available: `asyncio`.
- CPU-bound: `ProcessPoolExecutor`.
- Mixed CPU + I/O at scale: a process pool of asyncio workers, or a thread pool feeding a process pool. This is advanced; do not start here.

Free-threaded CPython (PEP 703, available as an experimental build in 3.13) will change the calculus for CPU-bound threading after it stabilizes. Plan for the GIL for now.

## 3. The GIL, briefly and accurately

The Global Interpreter Lock is a mutex inside CPython that allows only one thread to execute Python bytecode at a time within a single process. CPython releases it around blocking I/O calls and inside many C extensions (numpy, pandas, lxml, hashlib), which is why those libraries get real parallelism from threads.

What this means in practice:

- A pure-Python loop in a thread does not get faster when you add more threads. It gets slower from lock contention.
- A `requests.get()` call in a thread does get faster when parallelized, because the socket read releases the GIL.
- A `hashlib.sha256(big_bytes).hexdigest()` call gets real parallelism from threads, because hashlib releases the GIL during the C-level hashing.
- numpy operations on large arrays release the GIL; pure-Python `for` loops over the array do not.

If you are unsure whether your hot loop releases the GIL, compare a multi-threaded run with a single-threaded run. If wall time does not drop, the GIL is blocking it.

## 4. Threads: `ThreadPoolExecutor` patterns

`concurrent.futures.ThreadPoolExecutor` is the default for I/O-bound parallelism with sync libraries. It is well-supported, works with normal try/except, and is easy to reason about.

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch_one(key: str) -> bytes:
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()

with ThreadPoolExecutor(max_workers=16) as pool:
    futures = {pool.submit(fetch_one, k): k for k in keys}
    for fut in as_completed(futures):
        key = futures[fut]
        try:
            body = fut.result()
        except Exception:
            logger.exception("Failed to fetch %s", key)
            continue
        handle(body)
```

Things to know:

**`submit` vs `map`.** Use `map` when you want results in input order and any error should kill the batch. Use `submit` + `as_completed` when you want results as soon as they are ready or need per-item error handling. Most production loops need the latter because one bad key should not abort the other 999.

**Exceptions in workers.** A worker exception is *stored on the future*. It raises only when you call `future.result()`. If you omit `.result()`, exceptions vanish silently. Either call `.result()` on every future or use `as_completed` and check.

**Pool sizing.** For pure I/O, `min(32, (cpu_count or 1) * 4)` is a reasonable starting point. For S3, 16 to 32 is usually fine; more can hit per-connection or DNS limits. Measure before tuning further. The S3 SDK has its own internal thread pool, so be aware that you are stacking pools.

**Lifetime.** Use a `with` block so the pool joins on exit. A module-level `ThreadPoolExecutor` that is never shut down leaks threads on every test reimport and stalls test runs while workers hold connections open. Construct the pool where you use it.

**Cancellation.** `Future.cancel()` works only if the task has not started. Once a worker picks up the call, cancellation does nothing. To interrupt running work, use cooperative cancellation: pass a `threading.Event` into the worker and have it check between units of work.

**Composing with retries and timeouts.** A retry wrapper around the per-task function works cleanly with the pool: the wrapper handles transient failures, the pool handles parallelism, and they do not interact. Putting retries *around the pool* is almost always wrong because you cannot tell which item failed.

## 5. Processes: `ProcessPoolExecutor`

Use `ProcessPoolExecutor` for CPU-bound work that does not already release the GIL. It works much like `ThreadPoolExecutor`, but has several constraints.

```python
from concurrent.futures import ProcessPoolExecutor

def parse_file(path: str) -> ParsedRecord:
    with open(path, "rb") as f:
        return parse(f.read())

with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
    for result in pool.map(parse_file, paths):
        store(result)
```

Constraints:

**Everything crosses a pickle boundary.** Arguments, return values, and the function itself must be picklable. Lambdas, closures over local variables, locally-defined classes, open file handles, and database connections do not pickle. Define worker functions at module level and pass simple data.

**`fork` vs `spawn`.** Linux defaults to `fork`, which copies the parent process. It is fast but inherits open file descriptors, threads, signal handlers, and locks held by the parent at fork time. This can cause deadlocks and corruption, especially when mixed with threads: if the parent holds a lock at fork time, the child inherits a locked lock with no owner and deadlocks. macOS defaults to `spawn`, and the rest of Python is moving that way. Force `spawn` explicitly for safety:

```python
import multiprocessing as mp
ctx = mp.get_context("spawn")
with ProcessPoolExecutor(max_workers=4, mp_context=ctx) as pool:
    ...
```

**Startup cost is real.** A `spawn` worker starts a fresh Python interpreter, imports your modules, and reimports third-party libraries. For pools that handle many small tasks, this cost dominates. Either keep workers warm by sending large batches or use `initializer=` for one-time setup per worker.

**Sharing read-only data.** Do not pickle large read-only inputs (a 2 GB lookup table) per call. Use an `initializer` that loads the data once per worker or store it in shared memory (`multiprocessing.shared_memory`). Pickling 2 GB across 8 workers consumes 16 GB of RAM and time.

**Pool sizing.** For pure CPU work, `os.cpu_count()` is the ceiling. Going higher just oversubscribes the cores and slows everything down.

## 6. asyncio

asyncio fits workloads with many thousands of concurrent waits when the libraries you call expose an async API. It does not fit a mostly sync stack because every sync call blocks the loop and serializes everything.

The mental model uses one thread, one event loop, and an arbitrary number of *tasks*. The loop runs the next ready task. A task that needs to wait (`await some_async_call()`) yields control to the loop, which picks the next ready task. A single event loop has no parallelism; it has *concurrency through cooperation*.

```python
import asyncio
import httpx

async def fetch(client: httpx.AsyncClient, url: str) -> dict:
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()

async def fetch_all(urls: list[str]) -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch(client, u)) for u in urls]
    return [t.result() for t in tasks]
```

Things to know:

**Never block the loop.** A synchronous call inside `async def` (e.g., `time.sleep`, `requests.get`, a slow regex, a CPU-bound transform) freezes all other tasks. If you must call sync code, use `asyncio.to_thread(fn, *args)` (3.9+), which dispatches it to a thread pool and returns an awaitable.

**Prefer `TaskGroup` over `gather`.** `asyncio.TaskGroup` (3.11+) provides structured concurrency: if any task raises, it cancels all siblings and propagates the exception out of the `async with`. `asyncio.gather` has subtle exception-handling modes (`return_exceptions=True` changes the behavior entirely) and leaks tasks on errors. Use `TaskGroup` unless you have a specific reason not to.

**Cancellation is cooperative.** `task.cancel()` raises `asyncio.CancelledError` at the task's next `await` point. Code between awaits cannot be interrupted. If a task wraps a sync `to_thread` call, cancelling the task does not stop the underlying thread; the thread keeps running, and its eventual result is discarded.

**Timeouts.** `async with asyncio.timeout(5):` (3.11+) cancels the body if it exceeds five seconds. It is cleaner than wrapping every call in `wait_for`.

**Backpressure.** Spawning 100,000 tasks at once usually overwhelms the target resource (rate limits, connection pools, file handles). Use a `Semaphore` to cap concurrency:

```python
sem = asyncio.Semaphore(50)

async def bounded_fetch(client, url):
    async with sem:
        return await fetch(client, url)
```

**Mixing asyncio and threads.** It is possible, but it introduces three concurrency models in one process (event loop, threads, GIL). Use it only when rewriting one side costs more than debugging the seam.

## 7. Synchronization primitives

The default rule for concurrent code is: **do not share mutable state**. If each worker has its own data, you cannot have a race condition. Pass inputs in, return outputs, and aggregate at the end.

When you need to share, the standard library provides a tiered toolbox.

**`threading.Lock`** is the workhorse. Use it whenever multiple threads read and write the same data and the read-modify-write pattern matters. Hold it for the shortest window possible:

```python
lock = threading.Lock()
counter = 0

def bump():
    global counter
    with lock:
        counter += 1
```

The `+= 1` is not atomic in Python; it reads, adds, and writes. Without the lock, two threads can read the same value, both add one, and both write the same result.

**`threading.RLock`** is a reentrant lock: the same thread can acquire it multiple times without deadlocking itself. Use it when a locked function calls another locked function on the same object. Avoid needing it; reentrant locking usually signals that the locking surface is too broad.

**`threading.Semaphore`** caps the number of concurrent holders. Use it to bound an external resource: "at most 5 concurrent connections to the legacy API."

**`threading.Event`** is a one-shot or repeated signal. Use it for "stop the workers" or "config has been loaded, you may proceed." Workers check `event.is_set()` between units of work; the code that signals calls `event.set()`.

**`threading.Condition`** fits "worker waits until the queue is non-empty, then takes one item." You usually do not need it directly because `queue.Queue` already implements it.

**`queue.Queue`** fits producer/consumer work. It is thread-safe, supports bounded capacity, and handles the condition-variable plumbing.

asyncio has analogous primitives: `asyncio.Lock`, `asyncio.Semaphore`, `asyncio.Event`, `asyncio.Queue`. They work the same way conceptually but only across asyncio tasks, not across threads. Do not mix `threading.Lock` and `asyncio.Lock`; they protect different things.

Lock ordering matters. If thread A holds lock 1 and wants lock 2, while thread B holds lock 2 and wants lock 1, both wait forever. The standard fix: always acquire locks in a consistent global order. The better fix: redesign so you only ever hold one lock at a time.

## 8. Queues and backpressure

A bounded queue is the simplest correct way to connect producers and consumers. The producer pushes work; the consumer pulls. If the consumer falls behind, the queue fills and producers block on `put()` until consumers drain. This is backpressure: the slowest stage sets the system pace and keeps memory bounded.

```python
import queue
import threading

WORK_QUEUE = queue.Queue(maxsize=100)
SENTINEL = object()

def producer():
    for item in source():
        WORK_QUEUE.put(item)
    for _ in range(NUM_WORKERS):
        WORK_QUEUE.put(SENTINEL)

def consumer():
    while True:
        item = WORK_QUEUE.get()
        if item is SENTINEL:
            return
        try:
            handle(item)
        finally:
            WORK_QUEUE.task_done()
```

Key points:

- `maxsize=N` provides the bound. An unbounded queue becomes a memory leak at the right input rate.
- The `None` or sentinel-object shutdown pattern is idiomatic. Put one sentinel per consumer.
- `task_done` and `join` give you a way to wait for all submitted work to finish without polling.
- For asyncio, use `asyncio.Queue` with the same patterns.

If your producer is much faster than the consumer and you want to drop work rather than block, use a fixed-size `Queue` and catch `queue.Full` on `put_nowait`. To drop the oldest work instead, you need a custom structure; the stdlib does not have a bounded LIFO.

## 9. Cancellation, timeouts, and graceful shutdown

Long-running processes need to stop cleanly. A worker pool that receives `kill -9` mid-batch leaves multipart uploads dangling, connections leaked, and half-written files on disk. Follow this discipline:

**Catch `SIGTERM` in the main loop.**

```python
import signal

shutdown_requested = threading.Event()

def _on_sigterm(signum, frame):
    logger.info("Received SIGTERM, beginning graceful shutdown")
    shutdown_requested.set()

signal.signal(signal.SIGTERM, _on_sigterm)
```

**Workers check the flag between units of work.**

```python
def worker():
    while not shutdown_requested.is_set():
        item = WORK_QUEUE.get(timeout=1.0)
        ...
```

**Drain in-flight items, then exit.** Do not abandon partially processed work; finish the current item, commit its state (or roll it back deterministically), then return. One extra item costs much less than corrupted state.

**Close resources in `finally`.** Close connections, multipart uploads, and temp directories. A context manager around the whole worker body expresses this cleanly.

**Tell the user what happened.** Log processed/failed/skipped counts before exiting. A silent shutdown is indistinguishable from a crash.

For asyncio, the equivalent pattern uses `loop.add_signal_handler(signal.SIGTERM, ...)` to cancel the top-level task, and structured `TaskGroup`s handle cascading cancellation correctly.

Treat timeouts with the same care. Wrap calls to external services in explicit timeouts (`requests.get(url, timeout=10)`, `httpx` defaults, `asyncio.timeout`). A hung call without a timeout commonly causes "the job never finished and never failed."

## 10. Subprocesses with pipes

Subprocess deadlocks are subtle. If you call `subprocess.Popen(..., stdout=PIPE, stderr=PIPE)` and the child writes more than the pipe buffer holds (typically 64 KB on Linux), the child blocks on its write until the parent reads. If the parent waits for the child to finish before reading, both wait forever.

The safe patterns:

**For short outputs, use `subprocess.run` with `capture_output=True`.** It drains both pipes for you.

**For streaming output, drain stdout in the main thread and stderr in a background thread.** Or reverse them. Both pipes must be drained concurrently.

**For feeding stdin and reading stdout at the same time, do not use `communicate` for large payloads.** Start a feeder thread that writes to stdin in chunks while the main thread reads stdout. `communicate` works for small inputs but buffers the whole input in memory.

**Always set timeouts.** Kill a subprocess that hangs forever. Use `subprocess.run(..., timeout=600)` and handle `TimeoutExpired` by terminating the process group.

**Use process groups for kill propagation.** A child that spawns its own children needs `start_new_session=True` so one `os.killpg(pgid, SIGTERM)` reaches all descendants.

## 11. Connection pooling and thread safety

"Is this connection thread-safe?" usually means "can I share one connection across N threads?" The answer is usually no. The DB-API 2.0 spec says connections must be safe to *share*, but cursors are not. In practice, most drivers work better when each thread has its own connection:

- **`snowflake-connector-python`**: connection is safe to use across threads, but performance is best with one connection per worker.
- **`psycopg2`**: connection objects are not thread-safe. Use one per thread or a pool (`psycopg2.pool.ThreadedConnectionPool`).
- **`psycopg` (v3)**: similar; use `ConnectionPool` from `psycopg_pool`.
- **`boto3`**: clients and resources are not thread-safe across calls in some edge cases; the SDK docs recommend one client per thread or per task. In practice, sharing a single low-level `boto3.client` across threads works for most call patterns, but a pool of clients is safer for heavy concurrency.
- **`requests.Session`**: connection pooling under the hood is thread-safe for typical use, but the session object's state (cookies, headers) is shared, which is usually what you want.

The general pattern uses a connection pool sized to the number of concurrent workers. Take one connection from the pool per unit of work, then return it on completion. Use the driver's pool when it has one; do not roll your own.

When in doubt, write a stress test with hundreds of threads, each doing the operation in a loop, and watch for deadlocks, hangs, or corrupted results. Twenty minutes of stress testing can save a week of production debugging.

## 12. Concurrency bugs you will hit eventually

A short field guide. Knowing the names makes the bugs easier to spot.

**Race condition.** Two threads access shared state without coordination, and the outcome depends on timing. Symptoms: intermittent off-by-one, occasional missing items, "works on my machine." Fix: lock the read-modify-write or eliminate the shared state.

**Deadlock.** Two or more threads each hold a resource the other needs, and none can proceed. Symptoms: the program hangs and CPU is idle. Fix: use a global lock order, hold one lock at a time, or use timeouts on lock acquisition (`lock.acquire(timeout=...)`).

**Livelock.** Two threads keep changing state in response to each other, both stay busy, and neither makes progress. It is rarer than deadlock and usually comes from retry logic that triggers retries in the other party. Fix: randomized backoff.

**Lost update.** Two writers each read, modify, and write. The second write overwrites the first. This is common in "increment a counter in shared state" patterns. Fix: a lock, an atomic operation (`itertools.count` is thread-safe; `queue.Queue.put` is thread-safe), or a single owner of the counter.

**Atomicity assumption that is wrong.** People assume `dict[key] += 1` is atomic. It is not. `d[k] = d[k] + 1` reads, computes, and writes. Use a `Lock`, `collections.Counter` plus a lock, or `threading.local()` plus a final reduce.

**Hidden global state.** Module-level caches, default mutable arguments, and singleton clients with internal state look innocent in single-threaded tests but fail under concurrency. Fix: per-thread state via `threading.local()`, or pass the state explicitly.

**Works in dev with 2 threads, dies in prod with 32.** The cause is often an undersized connection pool, a full queue, a rate limit reached at higher fan-out, or a deadlock that is statistically unlikely at low concurrency. Always stress test at the production fan-out plus a margin.

**Fork after thread.** A multi-threaded program calls `os.fork()` (often via `multiprocessing` with the `fork` start method). Locks held in the parent at fork time are held in the child with no owner. The child deadlocks on the next acquire. Fix: use `spawn`.

**Signal handler interactions.** Python signal handlers run only on the main thread, between bytecodes. If the main thread is blocked in a C call that does not release the GIL, the handler does not run until that call returns. Fix: keep main-thread blocking calls short or use `signal.set_wakeup_fd` to bridge into a selector.

The rule across all of these is: **assume nothing about timing or ordering**. A race that hits one in a thousand requests at 10 RPS can hit one in three requests at 1000 RPS.

## A short closing note

Keep one habit from this reference: every time you use concurrency, write down the expected speedup, then measure the result. Much production concurrency code is either unnecessary (the bottleneck was elsewhere) or under-bounded (no queue cap, no shutdown handler, no timeout). "Predict, then measure" catches both mistakes before they ship.
