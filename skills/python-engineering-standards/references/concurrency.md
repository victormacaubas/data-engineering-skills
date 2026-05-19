# Concurrency

Concurrency is how you make a program do more than one thing at the same time. It is also the fastest way to introduce bugs that only show up under load, only on Linux, only on Tuesdays. This reference exists so you do not have to discover those bugs the slow way.

The decisions to make, in order:

1. Do you actually need concurrency?
2. Is the workload I/O-bound, CPU-bound, or wait-heavy at high fan-out?
3. Which primitive fits the answer to (2)?
4. How will you shut it down, cancel it, bound it, and observe it?

If you cannot answer all four before writing code, stop and answer them first.

## 1. Decide whether you need concurrency at all

Concurrency is a cost, not a feature. It adds bug surface (races, deadlocks, ordering assumptions), failure modes (partial completion, leaked workers), and debugging difficulty (stack traces that span threads). Before reaching for it, ask:

- Is the program actually slow, or does it just feel slow? Measure first. A `cProfile` run that shows 92% of time in `json.loads()` will not benefit from threading.
- Can a faster sequential algorithm solve it? An O(N) scan replacing an O(N^2) nested loop beats any amount of threading.
- Can batching solve it? Replacing 10,000 single-row inserts with one `executemany` call usually beats parallelizing the 10,000 inserts.
- Can streaming solve it? If memory is the bottleneck, an iterator chain solves the problem with zero concurrency.
- Is the latency floor a network round-trip you cannot avoid? Then yes, you probably want concurrency. This is the most common legitimate case in practice (S3, HTTP APIs, database queries).

If you decide you need it, write down (in a comment or a design note) what speedup you expect and why. "Threading this S3 copy from sequential to 16-wide should drop wall time from ~40m to ~3m because each object takes ~150ms of network round-trip and the local CPU is idle" is a real justification. "Parallelize for performance" is not.

## 2. Pick the model: threads, processes, or asyncio

Three questions decide which model fits.

**Is the work waiting on I/O or burning CPU?** Threads and asyncio shine when the program is waiting (network, disk, subprocess). Processes shine when the program is computing (parsing, hashing, numpy on plain Python loops, image work without C extensions).

**Why?** CPython has the Global Interpreter Lock, which serializes Python bytecode execution across threads in a single process. While one thread is computing, others wait. While one thread is *waiting on I/O* (a syscall that releases the GIL), others can run. Threads therefore parallelize I/O but not pure-Python CPU work. Processes sidestep the GIL entirely because each process has its own interpreter.

**How many concurrent operations do you need?** Threads scale to maybe a few thousand on a typical Linux box before the per-thread memory and context-switch cost becomes a tax. asyncio scales to tens or hundreds of thousands of concurrent waits because each one is a small Python object, not an OS thread. Processes are heavier still; you typically want one per CPU core, not one per task.

**Is the code you are calling async-aware?** asyncio only helps if the libraries you call expose `async` interfaces. Calling synchronous `requests.get()` from inside an asyncio event loop blocks the whole loop and ruins everything. If your stack is sync (boto3, psycopg2, snowflake-connector-python without async helpers), threads are usually the right call.

Decision shortcut:

- I/O-bound, dozens to hundreds of concurrent calls, sync libraries: `ThreadPoolExecutor`.
- I/O-bound, thousands to tens of thousands of concurrent calls, async libraries available: `asyncio`.
- CPU-bound: `ProcessPoolExecutor`.
- Mixed CPU + I/O at scale: a process pool of asyncio workers, or a thread pool feeding a process pool. This is advanced; do not start here.

Free-threaded CPython (PEP 703, available as an experimental build in 3.13) changes the calculus for CPU-bound threading once it stabilizes. As of now, plan for the GIL.

## 3. The GIL, briefly and accurately

The Global Interpreter Lock is a mutex inside CPython that ensures only one thread executes Python bytecode at a time within a single process. It is released around blocking I/O calls and inside many C extensions (numpy, pandas, lxml, hashlib), which is why those libraries get real parallelism from threads.

What this means in practice:

- A pure-Python loop in a thread does not get faster when you add more threads. It gets slower from lock contention.
- A `requests.get()` call in a thread does get faster when parallelized, because the socket read releases the GIL.
- A `hashlib.sha256(big_bytes).hexdigest()` call gets real parallelism from threads, because hashlib releases the GIL during the C-level hashing.
- numpy operations on large arrays release the GIL; pure-Python `for` loops over the array do not.

If you are unsure whether your hot loop releases the GIL, profile a multi-threaded run against a single-threaded run. If wall time does not drop, the GIL is in the way.

## 4. Threads: `ThreadPoolExecutor` patterns

`concurrent.futures.ThreadPoolExecutor` is the right default for I/O-bound parallelism with sync libraries. It is well-supported, composes with normal try/except, and is easy to reason about.

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

**`submit` vs `map`.** Use `map` when you want results in input order and any error should kill the batch. Use `submit` + `as_completed` when you want results as soon as they are ready or you need per-item error handling. Most production loops want the latter, because one bad key should not abort the other 999.

**Exceptions in workers.** A worker exception is *stored on the future*. It only raises when you call `future.result()`. If you forget to call `.result()`, exceptions vanish silently. Either call `.result()` on every future or use `as_completed` and check.

**Pool sizing.** For pure I/O, `min(32, (cpu_count or 1) * 4)` is a reasonable starting point. For S3 specifically, 16 to 32 is usually fine; far more than that hits per-connection or DNS limits. Measure before tuning further. The S3 SDK has its own internal thread pool; be aware you are stacking pools.

**Lifetime.** Use a `with` block so the pool joins on exit. A module-level `ThreadPoolExecutor` that nobody shuts down leaks threads on every reimport in tests, and stalls test runs as workers hold connections open. Construct the pool where you use it.

**Cancellation.** `Future.cancel()` only works if the task has not started yet. Once a worker picks up the call, cancellation does nothing. If you need to interrupt running work, you need cooperative cancellation: pass a `threading.Event` into the worker and have it check between units of work.

**Composing with retries and timeouts.** A retry wrapper around the per-task function composes cleanly with the pool: the wrapper handles transient failures, the pool handles parallelism, and they do not interact. Putting retries *around the pool* is almost always wrong; you cannot tell which item failed.

## 5. Processes: `ProcessPoolExecutor`

Use `ProcessPoolExecutor` for CPU-bound work that does not already release the GIL. It works almost identically to `ThreadPoolExecutor`, but with several constraints worth understanding.

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

**Everything crosses a pickle boundary.** Arguments, return values, and the function itself must be picklable. Lambdas, closures over local variables, locally-defined classes, open file handles, database connections: none of these pickle. Define worker functions at module level and pass simple data.

**`fork` vs `spawn`.** Linux defaults to `fork`, which copies the parent process. This is fast but inherits open file descriptors, threads, signal handlers, locks held by the parent at fork time, and so on. It is a fertile source of deadlocks and corruption, especially mixed with threads (the classic case: the parent holds a lock when it forks; the child inherits the locked lock with no owner, deadlocks forever). macOS defaults to `spawn` and the rest of Python is moving that way. Force `spawn` explicitly for safety:

```python
import multiprocessing as mp
ctx = mp.get_context("spawn")
with ProcessPoolExecutor(max_workers=4, mp_context=ctx) as pool:
    ...
```

**Startup cost is real.** A `spawn` worker starts a fresh Python interpreter, imports your modules, and reimports any third-party libraries. For pools that handle many small tasks, this dominates. Either keep workers warm by sending them large batches, or use `initializer=` to do one-time setup per worker.

**Sharing read-only data.** Big read-only inputs (a 2 GB lookup table) should not be pickled per call. Use an `initializer` that loads it once per worker, or store it in shared memory (`multiprocessing.shared_memory`). Pickling 2 GB across 8 workers eats 16 GB of RAM and runtime.

**Pool sizing.** For pure CPU work, `os.cpu_count()` is the ceiling. Going higher just oversubscribes the cores and slows everything down.

## 6. asyncio

asyncio is the right tool when you need many thousands of concurrent waits and the libraries you call expose an async API. It is the wrong tool when most of your stack is sync, because every sync call blocks the loop and serializes everything.

The mental model: there is one thread, one event loop, and an arbitrary number of *tasks*. The loop runs whichever task is ready. A task that needs to wait (`await some_async_call()`) yields control back to the loop, which picks the next ready task. There is no parallelism within a single event loop; there is *concurrency through cooperation*.

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

**Never block the loop.** A synchronous call inside `async def` (e.g., `time.sleep`, `requests.get`, a slow regex, a CPU-bound transform) freezes every other task. If you must call sync code, use `asyncio.to_thread(fn, *args)` (3.9+), which dispatches to a thread pool and returns an awaitable.

**Prefer `TaskGroup` over `gather`.** `asyncio.TaskGroup` (3.11+) is structured concurrency: if any task raises, all siblings are cancelled and the exception propagates out of the `async with`. `asyncio.gather` has subtle exception-handling modes (`return_exceptions=True` flips the behavior entirely) and leaks tasks on errors. Use `TaskGroup` unless you have a specific reason not to.

**Cancellation is cooperative.** `task.cancel()` raises `asyncio.CancelledError` at the next `await` point inside the task. Code between awaits cannot be interrupted. If a task wraps a sync `to_thread` call, cancelling the task does not stop the underlying thread; the thread keeps running, and its eventual result is discarded.

**Timeouts.** `async with asyncio.timeout(5):` (3.11+) cancels the body if it exceeds five seconds. Cleaner than wrapping every call in `wait_for`.

**Backpressure.** Spawning 100,000 tasks at once usually overwhelms the resource you are talking to (rate limits, connection pools, file handles). Use a `Semaphore` to cap concurrency:

```python
sem = asyncio.Semaphore(50)

async def bounded_fetch(client, url):
    async with sem:
        return await fetch(client, url)
```

**Mixing asyncio and threads.** It is possible, but introduces three concurrency models in one process (event loop, threads, GIL). Save it for cases where the cost of rewriting one side is genuinely higher than the cost of debugging the seam.

## 7. Synchronization primitives

The default rule for concurrent code is: **do not share mutable state**. If each worker has its own data, you cannot have a race condition. Pass inputs in, return outputs out, aggregate at the end.

When you do need to share, the standard library has a tiered toolbox.

**`threading.Lock`** is the workhorse. Use it whenever multiple threads read and write the same data and the read-modify-write pattern matters. Hold it for the shortest possible window:

```python
lock = threading.Lock()
counter = 0

def bump():
    global counter
    with lock:
        counter += 1
```

The `+= 1` is not atomic in Python; it is read, add, write. Without the lock, two threads can read the same value, both add one, and both write the same result.

**`threading.RLock`** is a reentrant lock: the same thread can acquire it multiple times without deadlocking itself. Reach for it when a locked function calls another locked function on the same object. Prefer not to need it; reentrant locking is usually a sign the locking surface is too broad.

**`threading.Semaphore`** caps the number of concurrent holders. Use it to bound an external resource: "at most 5 concurrent connections to the legacy API".

**`threading.Event`** is a one-shot or repeated signal. Use it for "stop the workers" or "config has been loaded, you may proceed". Workers check `event.is_set()` between units of work; whoever wants to signal calls `event.set()`.

**`threading.Condition`** is the right primitive for "worker waits until the queue is non-empty, then takes one item". Most of the time, you do not need this directly; `queue.Queue` already implements it for you.

**`queue.Queue`** is the right primitive for producer/consumer. It is thread-safe, supports bounded capacity, and handles all the condition-variable plumbing.

asyncio has analogous primitives: `asyncio.Lock`, `asyncio.Semaphore`, `asyncio.Event`, `asyncio.Queue`. They work the same way conceptually but only across asyncio tasks, not across threads. Do not mix `threading.Lock` and `asyncio.Lock`; they protect different things.

Lock ordering matters. If thread A holds lock 1 and wants lock 2, while thread B holds lock 2 and wants lock 1, both wait forever. The standard fix: always acquire locks in a consistent global order. The better fix: redesign so you only ever hold one lock at a time.

## 8. Queues and backpressure

A bounded queue is the simplest correct way to connect producers and consumers. The producer pushes work; the consumer pulls. If the consumer falls behind, the queue fills, and producers block on `put()` until consumers drain. This is backpressure: the slowest stage paces the system, and memory stays bounded.

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

- `maxsize=N` is the whole point. An unbounded queue is a memory leak waiting for the right input rate.
- The `None` or sentinel-object shutdown pattern is idiomatic. Put one sentinel per consumer.
- `task_done` and `join` give you a way to wait for all submitted work to finish without polling.
- For asyncio, use `asyncio.Queue` with the same patterns.

If your producer is much faster than the consumer and you want to drop work rather than block, use a `Queue` of fixed size and catch `queue.Full` on `put_nowait`. If you want to drop the oldest work instead, you need a custom structure; the stdlib does not have a bounded LIFO.

## 9. Cancellation, timeouts, and graceful shutdown

Long-running processes need to stop cleanly. A worker pool that gets `kill -9`'d mid-batch leaves multipart uploads dangling, connections leaked, and half-written files on disk. The discipline:

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

**Drain in-flight items, then exit.** Do not abandon partially-processed work; finish the current item, commit its state (or roll it back deterministically), then return. The cost of one extra item is much less than the cost of corrupted state.

**Close resources in `finally`.** Connections, multipart uploads, temp directories. A context manager around the whole worker body is the cleanest expression.

**Tell the user what happened.** Log a summary of processed/failed/skipped counts before exiting. A silent shutdown is indistinguishable from a crash.

For asyncio, the equivalent pattern uses `loop.add_signal_handler(signal.SIGTERM, ...)` to cancel the top-level task, and structured `TaskGroup`s handle cascading cancellation correctly.

Timeouts deserve the same care. Wrap calls to external services in explicit timeouts (`requests.get(url, timeout=10)`, `httpx` defaults, `asyncio.timeout`). A hung call without a timeout is the most common cause of "the job never finished and never failed".

## 10. Subprocesses with pipes

Subprocess deadlocks are subtle. If you call `subprocess.Popen(..., stdout=PIPE, stderr=PIPE)` and the child writes more than the pipe buffer holds (typically 64 KB on Linux), the child blocks on the write until the parent reads. If the parent is waiting for the child to finish before reading, both wait forever.

The safe patterns:

**For short outputs, use `subprocess.run` with `capture_output=True`.** It drains both pipes for you.

**For streaming output, drain stdout in the main thread and stderr in a background thread.** Or vice versa. The point is that both pipes must be drained concurrently.

**For feeding stdin and reading stdout at the same time, do not use `communicate` for large payloads.** Spawn a feeder thread that writes to stdin in chunks while the main thread reads stdout. `communicate` works for small inputs but buffers the whole input in memory.

**Always set timeouts.** A subprocess that hangs forever should be killed. `subprocess.run(..., timeout=600)` and handle `TimeoutExpired` by terminating the process group.

**Use process groups for kill propagation.** A child that spawns its own children needs `start_new_session=True` so a single `os.killpg(pgid, SIGTERM)` reaches all descendants.

## 11. Connection pooling and thread safety

"Is this connection thread-safe?" almost always means "can I share one connection across N threads?", and the answer is almost always no. The DB-API 2.0 spec says connections must be safe to *share*, but cursors are not. In practice, most drivers are happier when each thread has its own connection:

- **`snowflake-connector-python`**: connection is safe to use across threads, but performance is best with one connection per worker.
- **`psycopg2`**: connection objects are not thread-safe. Use one per thread or a pool (`psycopg2.pool.ThreadedConnectionPool`).
- **`psycopg` (v3)**: similar; use `ConnectionPool` from `psycopg_pool`.
- **`boto3`**: clients and resources are not thread-safe across calls in some edge cases; the SDK docs recommend one client per thread or per task. In practice, sharing a single low-level `boto3.client` across threads works for most call patterns, but a pool of clients is safer for heavy concurrency.
- **`requests.Session`**: connection pooling under the hood is thread-safe for typical use, but the session object's state (cookies, headers) is shared, which is usually what you want.

The general pattern: a connection pool sized to the number of concurrent workers, one connection out of the pool per unit of work, returned to the pool on completion. Use the driver's pool when it has one; do not roll your own.

When in doubt, write a stress test: hundreds of threads, each doing the operation in a loop, and watch for deadlocks, hangs, or corrupted results. Twenty minutes of stress testing saves a week of production debugging.

## 12. Concurrency bugs you will hit eventually

A short field guide. Knowing these by name makes them easier to spot.

**Race condition.** Two threads access shared state without coordination, and the outcome depends on which wins the race. Symptoms: intermittent off-by-one, occasional missing items, "works on my machine". Fix: lock the read-modify-write, or eliminate the shared state.

**Deadlock.** Two or more threads each hold a resource the other needs, and none can proceed. Symptoms: the program hangs, CPU is idle. Fix: a global lock order, or hold one lock at a time, or use timeouts on lock acquisition (`lock.acquire(timeout=...)`).

**Livelock.** Two threads keep changing state in response to each other, both staying busy, neither making progress. Rarer than deadlock; usually caused by retry logic that triggers retries in the other party. Fix: randomized backoff.

**Lost update.** Two writers each read, modify, and write. The second write overwrites the first. Common with "increment a counter in shared state" patterns. Fix: a lock, an atomic operation (`itertools.count` is thread-safe; `queue.Queue.put` is thread-safe), or a single owner of the counter.

**Atomicity assumption that is wrong.** People assume `dict[key] += 1` is atomic. It is not. `d[k] = d[k] + 1` is read, compute, write. Use a `Lock`, or `collections.Counter` plus a lock, or `threading.local()` plus a final reduce.

**Hidden global state.** Module-level caches, default mutable arguments, singleton clients with internal state. Looks innocent in single-threaded tests, explodes under concurrency. Fix: per-thread state via `threading.local()`, or pass the state in explicitly.

**Works in dev with 2 threads, dies in prod with 32.** Often a connection pool that is too small, a queue that fills, a rate limit hit by the higher fan-out, or a deadlock that is statistically unlikely at low concurrency. Always stress test at the production fan-out plus a margin.

**Fork after thread.** A multi-threaded program calls `os.fork()` (often via `multiprocessing` with the `fork` start method). Locks held in the parent at the moment of fork are held in the child with no owner. The child deadlocks on the next acquire. Fix: use `spawn`.

**Signal handler interactions.** Python signal handlers run on the main thread only, between bytecodes. If the main thread is blocked in a C call that does not release the GIL, the handler does not run until that call returns. Fix: keep main-thread blocking calls short, or use `signal.set_wakeup_fd` to bridge into a selector.

The throughline of all of these: **assume nothing about timing or ordering**. The race that hits one in a thousand requests at 10 RPS will hit one in three requests at 1000 RPS.

## A short closing note

If you take one habit away from this reference, take this one: every time you reach for concurrency, write down what you expect the speedup to be, then measure whether you got it. Most production concurrency code is either unnecessary (the bottleneck was elsewhere) or under-bounded (no queue cap, no shutdown handler, no timeout). The discipline of "predict, then measure" catches both classes of mistake before they ship.
