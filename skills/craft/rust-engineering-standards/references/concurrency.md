# Concurrency

## How to use this reference

Read the section for the problem in front of you. Sections 1–2 decide whether and how to be concurrent; 3–11 are the mechanics; 12 is a worked pipeline stage; 13 lists the bugs that pass review and fail in production. Check the Tokio and `tokio-util` versions in `Cargo.lock` and their docs before you use an API from here: method names and cancel-safety notes are per version, and several items need a feature flag.

## Contents

1. Decide whether you need concurrency at all
2. Pick the model: async tasks, OS threads, or a CPU pool
3. The runtime
4. Tasks and their owners
5. Channels
6. Backpressure end to end
7. Shared state and synchronization
8. Blocking and CPU-bound work
9. `select!` and cancellation safety
10. Timeouts and intervals
11. Graceful shutdown
12. Worked example: a batching stage
13. Async traits and `Send`
14. Concurrency bugs you will hit eventually

## 1. Decide whether you need concurrency at all

Concurrency adds states the code can be in, and each one is a place for a bug. Add it when a measured or obvious wait dominates: network round trips, many independent connections, a pipeline whose stages run at different speeds. A single sequential loop that processes a local file is often fast enough and far easier to reason about. In a streaming engine you need it, because sources, transforms, and sinks must overlap — but you need a few long-lived tasks connected by channels, not a task per event.

## 2. Pick the model: async tasks, OS threads, or a CPU pool

| Work | Model |
|---|---|
| Many sockets, mostly waiting (sources, sinks, HTTP, database clients) | Tokio tasks |
| CPU-heavy transforms (decode, compress, convert to Arrow) over large batches | `rayon` or a dedicated thread pool, fed from async code |
| A blocking library with no async API (some database drivers, file APIs) | `tokio::task::spawn_blocking` |
| A small fixed number of long-running loops with no async I/O | `std::thread::spawn` with channels |

Async is cooperative: a task gives up its worker thread only at an `.await`. That makes it cheap for waiting and wrong for computing — a task that computes for 10 ms blocks every other task on that worker for 10 ms.

## 3. The runtime

- The binary creates the runtime, once: `#[tokio::main]` on `main`, or `tokio::runtime::Builder` when you need to set worker threads, thread names, or stack size. Libraries never create a runtime.
- The default `#[tokio::main]` is the multi-thread runtime with one worker per CPU core. On a container with a CPU limit, confirm that Tokio sees the limit you expect, and set `worker_threads` from config if it does not.
- Never call `Runtime::block_on` or create a runtime from inside async code; it panics ("Cannot start a runtime from within a runtime"). To call async code from a sync function that is itself running on the runtime, the design is wrong — make the caller async or move the sync part to `spawn_blocking`.
- Tests use `#[tokio::test]`, which builds a current-thread runtime per test. Use `#[tokio::test(flavor = "multi_thread")]` only for tests that need real parallelism.

## 4. Tasks and their owners

`tokio::spawn` starts a task that runs independently. The future must be `Send + 'static`: it owns its data (move it in, or clone an `Arc`) and holds nothing across an `.await` that cannot cross threads.

- **Every task has an owner that awaits it.** Keep the `JoinHandle`, or spawn into a `tokio::task::JoinSet` (or `tokio_util::task::TaskTracker`). A task that panics or returns an error is otherwise silent: the panic is caught by the runtime and reported only through the `JoinHandle` as a `JoinError`.
- **Dropping a `JoinHandle` does not stop the task.** It detaches it. Stop a task with `handle.abort()`, a `CancellationToken`, or by closing the channel it reads from. Detaching is a decision; write the reason.
- **Check what the join returns.** `JoinError::is_panic()` means a bug — log it and fail the run. `is_cancelled()` means you aborted it. The task's own `Result` is inside the `Ok`.

```rust
let mut tasks = JoinSet::new();
tasks.spawn(source.run(tx, shutdown.child_token()));
tasks.spawn(batcher.run(rx));

while let Some(joined) = tasks.join_next().await {
    match joined {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            error!(error = %e, "pipeline stage failed");
            shutdown.cancel();
            return Err(e.into());
        }
        Err(join_err) => {
            error!(error = %join_err, "pipeline stage panicked or was cancelled");
            shutdown.cancel();
            return Err(PipelineError::StagePanicked);
        }
    }
}
```

- **Don't spawn a task per event** on a hot path. Each spawn allocates and schedules. A fixed set of long-lived workers reading from a channel handles the same load with flat overhead.

## 5. Channels

| Channel | Use |
|---|---|
| `tokio::sync::mpsc::channel(cap)` | The default. Many producers, one consumer, bounded. The pipe between pipeline stages. |
| `tokio::sync::oneshot` | One value, once: a reply to a request, the result of a background job. |
| `tokio::sync::watch` | The latest value of something, many readers: current config, a health state. Readers see only the newest value, never a backlog. |
| `tokio::sync::broadcast` | Every message to every receiver. A slow receiver falls behind and gets `RecvError::Lagged`, losing messages. Rarely right for data; fine for notifications. |
| `mpsc::unbounded_channel` | Almost never. It turns a slow consumer into unbounded memory growth. Requires a written reason. |

Rules:

- **Size bounded channels on purpose.** Capacity is the number of messages a stage may run ahead. Small (tens to hundreds of batches) keeps memory bounded and latency low; the goal is to absorb jitter, not to store a backlog. If a message is a batch, capacity × batch size is your worst-case memory for that link — write that number down.
- **Closing is a signal.** When every `Sender` is dropped, `recv()` returns `None` after the buffered messages are delivered. A stage that loops until `None` drains naturally when the stage before it stops. Use that for shutdown (section 11) instead of a separate flag.
- **`send().await` waits for capacity.** That wait is backpressure. `try_send` returns immediately with `TrySendError::Full`; use it only when dropping or shedding a message is the designed behavior, and count what you drop.
- **A failed `send` means the receiver is gone.** Treat it as "downstream stopped", not as an error to retry: stop producing and return.

## 6. Backpressure end to end

A streaming engine is only as fast as its slowest stage. Backpressure makes the fast stages wait instead of buffering without limit:

```
source ──bounded──▶ transform ──bounded──▶ batcher ──bounded──▶ sink
```

When the sink slows down, its input channel fills, the batcher's `send` waits, the transform's channel fills, and finally the source stops reading. Every link is bounded, so memory stays bounded.

- **Bound by bytes when sizes vary.** A channel of 100 batches is 100 KB or 10 GB depending on the rows. When record sizes vary widely, bound in-flight bytes with a `tokio::sync::Semaphore`: acquire permits equal to the batch's size before sending, release them when the sink acknowledges. Use `acquire_many_owned` so the permit travels with the batch.
- **Backpressure has to reach the source.** When the source stops reading, the pressure moves upstream to whatever feeds it. For Postgres logical replication, the server retains WAL until the slot's confirmed position advances, so a stalled engine grows the server's disk. For a WebSocket firehose, the server may disconnect a slow reader. Know what happens at your source and monitor it (replication slot lag, reconnect counts).
- **Acknowledge only what is durable.** The source's checkpoint (an LSN, an offset, a cursor) advances only after the sink confirms the data is stored. Pass the checkpoint along with the batch, and commit it after the sink's acknowledgment — never when the source reads the data.

## 7. Shared state and synchronization

First choice: no shared state. One task owns the data; others send it messages and get replies on a `oneshot`. This removes lock contention and lock-ordering bugs together.

When state must be shared:

- **`Arc<T>` for immutable shared data.** Config, lookup tables, schemas. No lock needed.
- **`std::sync::Mutex` for short critical sections that never await.** Tokio's own docs recommend it over the async mutex in that case; it is faster. Lock, change, unlock, then await.
- **`tokio::sync::Mutex` only when the lock must be held across an `.await`.** It is slower, and holding any lock across an await serializes everything that needs it. Before reaching for it, ask whether a dedicated owning task is clearer.
- **Never hold a `std::sync::MutexGuard` across `.await`.** The compiler rejects it inside `tokio::spawn` because the guard is `!Send`; outside spawn it can deadlock the worker. Clippy's `await_holding_lock` catches it. End the guard's scope first:

  ```rust
  let next = {
      let mut state = self.state.lock().expect("state mutex is never poisoned by a panic we allow");
      state.take_next()
  }; // guard dropped here
  self.sink.write(&next).await?;
  ```

- **`RwLock`** helps only when reads vastly outnumber writes and reads are long enough to matter. Under write contention it is slower than a `Mutex`. Measure.
- **Atomics** for counters and flags: `AtomicU64::fetch_add(1, Ordering::Relaxed)` for a metric counter. Use `Acquire`/`Release` when one thread publishes data that another reads through the atomic. If you cannot explain why a weaker ordering is correct, use `SeqCst`.
- **Lock ordering.** When code takes two locks, every path takes them in the same order. Document the order where the locks are defined.
- **Mutex poisoning.** A `std::sync::Mutex` is poisoned when a thread panics while holding it, and `lock()` returns `Err`. Decide per mutex: propagate the panic with `expect` naming why, or recover with `into_inner` when the protected data cannot be left inconsistent.

## 8. Blocking and CPU-bound work

- **`tokio::task::spawn_blocking`** runs a closure on Tokio's blocking thread pool. Use it for a blocking call: a synchronous driver, file system work, a DNS lookup through a blocking API. The pool is large and meant for waiting, not for a sustained CPU load.
- **CPU-heavy batch work goes to `rayon`** (or a dedicated pool) and back through a `oneshot`:

  ```rust
  let (tx, rx) = oneshot::channel();
  rayon::spawn(move || {
      let encoded = encode_batch(&rows);
      let _ = tx.send(encoded); // receiver gone means the caller stopped waiting
  });
  let encoded = rx.await.map_err(|_| PipelineError::EncoderStopped)?;
  ```

- **A loop that computes for a long time without awaiting starves its worker.** Move the work off the runtime. `tokio::task::yield_now().await` inside the loop is a patch, not a fix.
- `tokio::task::block_in_place` exists for the multi-thread runtime only and panics on the current-thread runtime, which is what `#[tokio::test]` uses. Prefer `spawn_blocking`.

## 9. `select!` and cancellation safety

`tokio::select!` polls several futures and runs the arm of the first one that completes. **The other futures are dropped** at whatever `.await` they had reached. That is cancellation, and whether it loses data depends on the future.

- A method is **cancel-safe** when dropping it before completion loses nothing. Tokio documents this per method. `mpsc::Receiver::recv`, `time::sleep`, `CancellationToken::cancelled`, and `AsyncReadExt::read` are cancel-safe. `AsyncReadExt::read_exact`, `read_to_end`, and `AsyncWriteExt::write_all` are not: a partial read or write is lost.
- `mpsc::Sender::send` in a `select!` that loses does not deliver the message, and the message is dropped with the future. When you must not lose it, take capacity first with `sender.reserve().await` in the `select!`, then `permit.send(msg)` after it wins.
- **Your own `async fn` is cancel-safe only if every `.await` in it is a safe place to stop.** A function that pops a row from a buffer and then awaits a write loses the row when it is dropped between the two. Document cancel safety on public async functions (see the doc-comment rules in `SKILL.md`).
- **Don't recreate a long future on every loop iteration.** A future created inside `select!` starts over each time. Create it once before the loop, pin it with `tokio::pin!` (or `std::pin::pin!`), and poll `&mut fut` in the arm.
- **`biased;`** as the first line polls arms in written order instead of randomly. Use it when one arm must win ties — a shutdown signal before more work — and know that a busy higher arm can starve the lower ones.
- **Preconditions disable an arm**: `() = sleep_until(deadline), if has_deadline => ...`. The future expression is still evaluated even when the precondition is false, so it must not panic (see section 12).
- `break` and `return` inside an arm apply to the enclosing loop and function; arms are not closures.

## 10. Timeouts and intervals

- **Every network call has a timeout.** A connection that hangs without an error holds a task, a pooled connection, and the pipeline behind it forever. Wrap with `tokio::time::timeout(duration, fut)` or use the client's own timeout settings, and make timeout values config, not literals.
- **`tokio::time::interval`** fires immediately on the first tick, then every period. If processing a tick takes longer than the period, the default behavior (`MissedTickBehavior::Burst`) fires the missed ticks back to back. Set `MissedTickBehavior::Delay` or `Skip` for periodic work such as metrics flushes and heartbeats.
- **Deadlines relative to an event** (flush 250 ms after the first row of a batch) use `sleep_until(deadline)` with a deadline you store, not an `interval` that ticks regardless of when the batch started.

## 11. Graceful shutdown

On ECS and Kubernetes, the platform sends `SIGTERM`, waits a grace period, then sends `SIGKILL`. Everything not flushed and checkpointed by then is replayed on restart (or lost, if the design is wrong). The order:

1. Catch the signal.
2. Stop the sources: they stop reading and drop their channel senders.
3. Let each stage drain: it receives `None` once its input is empty and closed, flushes what it holds, and drops its own sender.
4. The sink flushes its last batch and the final checkpoint is committed.
5. Exit with a status that says whether shutdown was clean.

Shutdown flows down the pipeline by closing channels. Only the sources (and anything else that pulls from outside) watch the cancellation token; downstream stages simply run until their input closes. That way no stage throws away buffered rows because it saw the signal first.

```rust
use tokio::signal::unix::{signal, SignalKind};
use tokio_util::sync::CancellationToken;

async fn wait_for_shutdown_signal() -> std::io::Result<()> {
    let mut terminate = signal(SignalKind::terminate())?;
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = terminate.recv() => {}
    }
    Ok(())
}

// in main, after wiring the stages into a JoinSet:
let shutdown = CancellationToken::new();
// ... sources receive shutdown.child_token() ...

tokio::select! {
    result = wait_for_shutdown_signal() => {
        result?;
        info!("shutdown signal received; draining");
        shutdown.cancel();
    }
    // A stage that ends on its own (an error, a panic, a finite source) ends the run.
    // `supervise` is the JoinSet loop from section 4; `join_next` is cancel-safe.
    outcome = supervise(&mut tasks, &shutdown) => return outcome,
}

let drained = tokio::time::timeout(config.shutdown_grace, drain(&mut tasks)).await;
if drained.is_err() {
    error!("drain exceeded the grace period; exiting with buffered data unflushed");
    return Ok(ExitCode::FAILURE);
}
```

- Keep the drain timeout below the platform's grace period, with margin for the final checkpoint write.
- A second signal during drain means the operator wants out now: exit immediately.
- `CancellationToken` and `TaskTracker` live in `tokio-util` (check its features in `Cargo.toml`). `child_token()` lets a stage be cancelled alone without cancelling its parent.

## 12. Worked example: a batching stage

Flush when the batch reaches `max_rows`, or when `max_age` has passed since its first row. Drain and flush on shutdown. Keep the rows if the sink fails.

```rust
use std::future::Future;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{sleep_until, Instant};

pub trait Sink: Send {
    fn write(&mut self, rows: &[Row]) -> impl Future<Output = Result<(), SinkError>> + Send;
}

pub struct BatchPolicy {
    pub max_rows: usize,
    pub max_age: Duration,
}

pub async fn run_batcher<K: Sink>(
    mut input: mpsc::Receiver<Row>,
    mut sink: K,
    policy: BatchPolicy,
) -> Result<(), SinkError> {
    let mut batch = Vec::with_capacity(policy.max_rows);
    let mut deadline: Option<Instant> = None;

    loop {
        tokio::select! {
            received = input.recv() => {
                let Some(row) = received else { break };
                if batch.is_empty() {
                    deadline = Some(Instant::now() + policy.max_age);
                }
                batch.push(row);
                if batch.len() >= policy.max_rows {
                    flush(&mut sink, &mut batch).await?;
                    deadline = None;
                }
            }
            // The expression is evaluated even when the arm is disabled, so it must not unwrap.
            () = sleep_until(deadline.unwrap_or_else(Instant::now)), if deadline.is_some() => {
                flush(&mut sink, &mut batch).await?;
                deadline = None;
            }
        }
    }

    if !batch.is_empty() {
        flush(&mut sink, &mut batch).await?;
    }
    Ok(())
}

async fn flush<K: Sink>(sink: &mut K, batch: &mut Vec<Row>) -> Result<(), SinkError> {
    sink.write(batch).await?;
    batch.clear(); // only after success, so a failed write keeps the rows for a retry
    Ok(())
}
```

What it shows: a bounded input is the backpressure; `recv()` returning `None` is the shutdown signal, so the stage drains everything before it exits; both `select!` arms are cancel-safe; the flush runs in an arm body, which is never cancelled; the buffer is allocated once and reused; the deadline starts with the batch, not with a free-running timer.

## 13. Async traits and `Send`

- `async fn` in a trait compiles, but the future it returns has no `Send` bound. A generic function that calls it inside `tokio::spawn` then fails to compile with an error about the future not being `Send`. For traits used with a multi-thread runtime, declare the method as returning `impl Future<Output = T> + Send` (as `Sink` does above). Implementations can still write `async fn`. The compiler's `async_fn_in_trait` lint warns about this on public traits.
- Traits whose methods return `impl Future` cannot be used as `dyn Trait`. When you need dynamic dispatch over async methods, follow the project's existing choice (the `async-trait` crate, which boxes the future, or methods that return `Pin<Box<dyn Future<Output = T> + Send + '_>>`).
- Types that are `!Send` — `Rc`, `RefCell` borrows, `std::sync::MutexGuard` — held across an `.await` make the whole future `!Send`. Drop them before the await or use the `Send` equivalent (`Arc`, a scoped lock).

## 14. Concurrency bugs you will hit eventually

- **Blocking in async.** A synchronous call inside an `async fn` freezes a worker. Symptom: latency spikes on unrelated tasks. Find it with `tokio-console` or by searching for blocking calls in async code.
- **Lock held across `.await`.** Deadlock or a `!Send` compile error. Scope the guard.
- **Unbounded growth.** An unbounded channel, a `Vec` that only grows, a map with no eviction. Symptom: memory climbs steadily until the container is killed.
- **Lost task failures.** A spawned task panicked and nobody awaited its handle. Symptom: a stage silently stops and the pipeline stalls without an error.
- **Data lost in `select!`.** A non-cancel-safe future in a losing arm. Symptom: rare, load-dependent missing rows.
- **Shutdown that drops buffers.** Every stage watches the shutdown token and breaks immediately. Fix: only sources watch the token; the rest drain on channel close.
- **Checkpoint ahead of the data.** The source commits its position when it reads, not when the sink confirms. A crash loses the gap. Fix: commit after the sink's acknowledgment.
- **Lock-order deadlock.** Two paths take the same two locks in opposite order.
- **Starvation.** A `biased;` select whose first arm is always ready, or a CPU loop without awaits.
- **Runtime inside a runtime.** `block_on` called from async code panics.
- **Task per event.** Scheduling overhead dominates at high rates. Use a fixed worker set.
