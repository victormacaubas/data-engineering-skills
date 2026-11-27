# Performance

## How to use this reference

Read section 1 before you change code for speed. Read section 3 for any question about memory: budgets, allocation counts, leaks, fragmentation, or the allocator. The rest is per topic. Tool names and flags change between versions; check the installed tool's `--help` and the crate docs for the version in `Cargo.lock`.

## Contents

1. Measure first
2. Hot-path rules
3. Memory and allocation
4. Zero-copy and data layout
5. Batching and I/O
6. Serialization
7. Throughput through parallelism
8. Build profiles
9. Benchmarks in CI

## 1. Measure first

Optimization without measurement moves cost around and adds complexity where it was not needed. The loop:

1. **State the target** in numbers: events per second, p99 end-to-end latency, peak resident memory. "Faster" is not a target.
2. **Reproduce the load** with a fixed, representative input: a recorded slice of the firehose, a generated dataset at a fixed scale, a replayed WAL. Live sources vary too much to compare runs.
3. **Find where the time goes** before you change anything:
   - CPU: a flamegraph (`cargo flamegraph` on Linux with `perf`) or `samply` (Linux and macOS). Read the widest frames first.
   - Async scheduling: `tokio-console` shows tasks that are busy, idle, or starved, and tasks that never finish.
   - Memory: a heap profiler (section 3).
   - System: `perf stat` or the platform's equivalent for cache misses and context switches when the flamegraph is flat.
4. **Change one thing, measure again.** Keep the change only if the numbers moved in the direction you predicted. Revert it otherwise — an unproven optimization is a cost with no benefit.

Profile release builds with symbols. Add a profile so you don't change the release build itself:

```toml
[profile.profiling]
inherits = "release"
debug = "line-tables-only"
```

Micro-benchmarks use Criterion in `benches/` (with `harness = false` on the `[[bench]]` target). Wrap inputs and outputs in `std::hint::black_box` so the compiler cannot delete the work being measured. A micro-benchmark tells you a function got faster; only an end-to-end load test tells you the pipeline did.

## 2. Hot-path rules

The hot path is the code that runs once per event or per row. At 200,000 events per second you have 5 µs per event for everything, so each of these matters:

- **No allocation per event.** No `String`, `Vec`, `Box`, or `format!` built and dropped for each row. Reuse buffers (section 3), borrow slices, and write into a reused `String` with `std::fmt::Write`.
- **No log line per event.** Count in a metric; log per batch or per interval.
- **No lock per event.** Take the lock once per batch, or give each worker its own state and merge at the end.
- **No syscall per event.** Wrap files and sockets in `BufReader`/`BufWriter`, and send batches over the network.
- **No `Arc` clone per event** when a borrow works. A clone is an atomic increment, cheap alone and contended when many cores do it on the same counter.
- **Static dispatch where the type is fixed.** A generic `S: Sink` lets the compiler inline; `dyn Sink` is a vtable call per method. The difference matters per event and rarely per batch — measure before you convert.
- **The default `HashMap` hasher is SipHash**, chosen to resist hash-flooding attacks. When keys never come from an attacker (internal IDs, column names) and the map is hot, a faster hasher (`rustc-hash`, `ahash`, or what the project already uses) is a measurable win. Keep SipHash for keys from external input.
- **Iterators over index loops.** `for row in &rows` and iterator chains let the compiler drop bounds checks that `rows[i]` keeps.
- **`#[inline]` only on evidence.** Generic functions are already inlinable across crates. A small non-generic function called across a crate boundary may need `#[inline]` or LTO; add it when a profile shows the call, not by default.

## 3. Memory and allocation

Rust frees memory deterministically when the owner goes out of scope. There is no collector to pause the program and none to clean up after it. The two consequences: latency stays steady, and memory use is exactly what the design allows — including what it allows by mistake.

### Budget it

Write down the worst-case memory of the pipeline and check it against the container limit:

```
Σ over channels (capacity × max batch bytes)
+ Σ over stages (buffers held: current batch, encode buffer, compression buffer)
+ caches (max entries × max entry size)
+ connection buffers (connections × buffer size)
+ allocator overhead and fragmentation (measure; often 10–30%)
```

If the budget is unknown, some link is unbounded. Find it before production does.

### Reuse instead of reallocating

- `Vec::with_capacity(n)` when the size is known or estimable; `clear()` keeps capacity for the next batch.
- `std::mem::take(&mut buf)` hands a full buffer to the next stage and leaves an empty `Vec` in its place. To avoid reallocating that empty `Vec`, recycle: the consumer sends emptied buffers back on a second bounded channel, and the producer takes one from there before allocating.
- **Capacity remembers spikes.** A buffer that once held a 500 MB batch keeps 500 MB after `clear()`. After a spike, `shrink_to(normal_capacity)`. Don't call `shrink_to_fit` on every iteration; that reallocates every time.
- **Arenas** (`bumpalo`, where the project uses it) suit many small allocations with the same lifetime — everything built while processing one batch — freed together at once.

### Count allocations

- `dhat` (the `dhat-rs` crate) profiles heap use from inside the program, and its testing mode can assert the number of allocations in a test: "decoding a batch performs at most 2 allocations". That turns a hot-path rule into a check that fails when someone adds a `format!`.
- `heaptrack` (Linux) and Instruments' Allocations tool (macOS) profile a running binary without code changes.

### Keep sizes in check

- `std::mem::size_of::<T>()` in a test documents and pins the size of types moved through hot channels. Clippy's `large_enum_variant` warns when one variant inflates an enum; box the large variant.
- **Large futures.** Locals that live across an `.await` become part of the future's size. A big array in an `async fn` makes the future big, and spawning it copies that. Box the data or the future (`Box::pin`). Clippy's `large_futures` lint (pedantic) catches this.
- Tokio worker threads have smaller stacks than the main thread. Deep recursion or large stack arrays that work in a unit test can overflow in a task.

### Leaks without `unsafe`

All of these compile and pass the borrow checker:

- `Rc`/`Arc` cycles: a parent and child that hold strong references to each other are never freed. Make the back-reference `Weak`.
- `Box::leak` and `std::mem::forget`: intentional leaks; each needs a comment saying why.
- Unbounded collections: an unbounded channel, a `Vec` that only grows, a `HashMap` keyed by something unbounded (per-connection, per-request IDs) with no eviction.
- Tasks that never finish: each holds its captured `Arc`s and buffers. `tokio-console` lists them.

Find leaks with a soak test: run the load for hours and plot resident memory. Steady growth under steady load is a leak or fragmentation.

### Fragmentation and the allocator

Long-running services that allocate many different sizes can grow their resident memory even when live data is flat, because freed memory is fragmented and not returned to the OS. If a soak test shows this:

- Try a different global allocator in the binary crate and compare throughput and resident memory on the same load:

  ```rust
  #[global_allocator]
  static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;
  // or: static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;
  ```

- Static musl builds use musl's allocator, which is much slower under multi-threaded allocation than glibc's. A musl binary for a high-throughput service needs one of the allocators above.
- Only the binary sets `#[global_allocator]`; a library never does.

Adopt an allocator change only when the measurement shows a gain on your workload.

## 4. Zero-copy and data layout

- **`bytes::Bytes` / `BytesMut`** for network data: `split_to` and `slice` hand out views of one reference-counted buffer without copying. Decode fields as slices of the frame instead of copying them into new `Vec`s.
- **Borrowed deserialization**: serde can deserialize `&'a str` and `&'a [u8]` fields pointing into the input buffer (`#[serde(borrow)]` for `Cow` fields), when the input outlives the decoded value.
- **Columnar batches.** Converting rows to Apache Arrow arrays once per batch makes encoding, compression, and many sinks faster, because each column is one contiguous typed buffer. Use the array builders with a capacity hint (`with_capacity`) set from the batch size. Arrow IPC moves batches between processes without re-encoding, which suits a connector protocol.
- **Struct of arrays vs. array of structs.** Code that scans one field across many records reads less memory when that field is stored contiguously. Don't reshape data for this without a profile that shows memory bandwidth as the limit.
- **Intern repeated strings.** Table names, column names, and schema names repeat in every event. Store them once as `Arc<str>` and pass the `Arc`, instead of a new `String` per event.

## 5. Batching and I/O

- **Batch on three limits**: rows, bytes, and age. Rows alone lets one wide table blow the memory budget; age bounds latency when traffic is low.
- **Bound concurrency to the sink.** Parallel writes raise throughput until the sink throttles. Use a fixed number of in-flight writes (a `Semaphore`, a `JoinSet` of N, or `futures::StreamExt::buffer_unordered(n)` where the project uses `futures`) and make N config.
- **Parallel writes complete out of order, so checkpoints need care.** Commit the source position only up to the highest batch for which every earlier batch is also acknowledged — the contiguous acknowledged prefix. Committing the latest acknowledgment skips a batch that is still in flight, and a crash then loses it.
- **Reuse connections.** Building a TLS connection per batch costs more than the write. Keep clients long-lived and shared through the composition root.
- **Compression is a CPU-for-bandwidth trade.** Fast levels (for example zstd at a low level, or lz4) usually win for streaming. Measure on real data before raising the level.

## 6. Serialization

- Deserialize into typed structs, not `serde_json::Value`: typed decoding is faster and catches schema drift at the boundary.
- JSON is slow to parse. On a hot path, measure a SIMD-accelerated parser (`simd-json`, `sonic-rs`) against `serde_json` before adopting one; the gain depends on the payload shape.
- Between your own processes, use a binary format (Arrow IPC for columnar data) rather than JSON.

## 7. Throughput through parallelism

- **Partition, don't share.** Split the stream by a key (table, partition, primary key hash) and give each worker its own partition and its own state. Ordering then holds within a key, and workers never contend for a lock.
- **False sharing**: two atomics or counters written by different threads on the same cache line slow each other down. Pad hot per-thread counters (`crossbeam_utils::CachePadded`, where the project uses it) or keep per-worker counters and sum them on read.
- **Contended atomics** cost more than they look. A single global counter incremented by every worker per event is a bottleneck; increment a local count and add it to the shared counter per batch.

## 8. Build profiles

```toml
[profile.release]
lto = "thin"            # or "fat"; measure the gain against the build time
codegen-units = 1       # better optimization, slower builds
```

- `panic = "abort"` makes binaries smaller and slightly faster, and makes **any** panic, including one inside a Tokio task, end the whole process. That removes the `JoinError` path from section 4 of `concurrency.md`. Choose it on purpose; for a supervised container that restarts on exit it can be the right call.
- `-C target-cpu=native` tunes for the build machine's CPU. A binary built that way can crash with an illegal instruction on a different CPU. On cloud platforms where the CPU type varies (x86 vs. Graviton, different instance generations), target the oldest CPU you deploy to, or leave it unset.
- Profile-guided optimization (PGO) can add more, at the cost of a more complex build. Consider it after the code-level work is done.

## 9. Benchmarks in CI

- Shared CI runners are noisy. Use benchmarks in CI to catch large regressions (tens of percent), not small ones; run precise comparisons on a dedicated machine.
- Criterion can save a baseline and compare against it (`--save-baseline`, `--baseline`). Compare a branch against main on the same machine in the same run.
- Allocation-count tests (section 3) are deterministic and belong in the normal test suite, where they never flake.
