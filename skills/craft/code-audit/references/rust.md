# Language Pack: Rust

Load this pack when the review scope contains `.rs` files or `Cargo.toml`. Before scoring, read the crate and workspace `Cargo.toml` (`edition`, `rust-version`, `[lints]` / `[workspace.lints]`, enabled crate features), `rust-toolchain.toml`, `rustfmt.toml`, `clippy.toml`, and `deny.toml` if present — explicit checked-in config outranks defaults here. This pack sharpens the six generic rubric dimensions with Rust-specific footguns. Read it fully before scoring.

## Idiom & formatter

- `rustfmt` decides formatting; `clippy` (especially `pedantic` and `[lints]` overrides) is the lint baseline. Check `Cargo.toml` for project lint levels before raising lint-style nits.
- Follow the Rust API Guidelines: `snake_case` for functions/modules/crates, `UpperCamelCase` for types/traits/variants (acronyms as one word: `HttpClient`, not `HTTPClient`), `SCREAMING_SNAKE_CASE` for `const`/`static`. Conversion prefixes carry cost (`as_` cheap borrow, `to_` allocates/computes, `into_` consumes `self`); getters omit `get_`.
- Borrow in parameters (`&str`, `&[T]`, `&Path`) rather than `&String`, `&Vec<T>`, `&PathBuf`; default to the narrowest visibility (`pub(crate)` / private).
- Write `///` doc comments on public items when any of these hold: (a) side effects beyond the return value, (b) returns an error callers handle (`# Errors`), (c) can panic (`# Panics`), (d) is `unsafe` (`# Safety`), or (e) non-obvious semantics (bound inclusivity, empty-input behavior, ordering, units, whether it blocks, whether it is cancel-safe). Skip doc comments when the name and signature fully state the contract (`fn is_empty(&self) -> bool`).

## Security (×2.0)

- **Secrets leaked via `Debug`, `Serialize`, or spans:** `#[derive(Debug)]` or `#[derive(Serialize)]` on a config or client struct with plain `String` passwords, tokens, private keys, or DSNs — the first error log or debug print dumps the secret. Secrets belong in a redacting wrapper (`secrecy::SecretString` or a newtype with a manual redacted `Debug` impl).
- **`#[tracing::instrument]` argument capture:** records every parameter by default. Missing `skip_all` or `skip(...)` on a function taking credentials, configs, or raw payloads leaks them into spans.
- **Error-string credential leaks:** wrapping or logging URLs, DSNs, or upstream error bodies containing query-string tokens or passwords without stripping them. Secrets passed as CLI arguments (visible in process listings) or hardcoded/committed in config.
- **SQL injection:** building SQL with `format!` from external input instead of bound placeholders (`$1`, `?`, `.bind(...)`). Dynamic identifiers (table/schema/column names) cannot be bound and must be validated against an allowlist or strict pattern and quoted (ideally wrapped in a validated newtype).
- **Disabled TLS verification:** `danger_accept_invalid_certs(true)`, a custom accept-all verifier, or plaintext fallback outside local test fakes.
- **Subprocess shell injection:** `Command::new("sh").arg("-c").arg(...)` (or `bash`/`cmd`) with any external input instead of `Command::new(program).args([...])`. Passing secrets on the command line instead of stdin or a `0o600` file; unbounded reads of child stdout/stderr or unwaited/unkilled child processes.
- **Untrusted input and DoS:** allocating from an unchecked length prefix, `Content-Length`, or count field before bounds-checking against a configured maximum; `read_to_end` on untrusted streams; disabled parser recursion limits; missing `#[serde(deny_unknown_fields)]` at config boundaries.
- **Panics as DoS on untrusted input:** slicing a UTF-8 `str` at an unverified byte index (`&s[..n]` panics mid-codepoint — use `.get(..n)` or `char_indices`), `slice[i]`, `.unwrap()`/`.expect()`, division by zero, or unchecked arithmetic on externally supplied values.
- **Path traversal & permissions:** joining untrusted relative paths without rejecting absolute/`..` components, canonicalizing, and verifying the canonical prefix (symlinks escape naïve checks); check-then-open races; creating secret files without `0o600` at creation time (`OpenOptionsExt::mode`).
- **`unsafe` and FFI:** `unsafe` blocks without a `// SAFETY:` comment proving every invariant; `unsafe fn` without `# Safety` docs; FFI boundaries missing null-pointer, length, lifetime, or UTF-8 checks; lifting `unsafe_code = "forbid"` broadly instead of isolating into one small safe-wrapper module.
- **Supply chain:** git dependencies pinned to a moving branch instead of a commit `rev`; missing `Cargo.lock` in a binary workspace; unreviewed `build.rs` or proc-macro dependencies.

## Correctness & Hidden Bugs (×2.0)

- **Silent truncation, sign-flip, and wrap:** `as` casts (`usize as u32`, `i64 as u64`) silently truncate or change sign — use `TryFrom` when values may not fit. Integer arithmetic panics in debug and wraps silently in release; use `checked_*`, `saturating_*`, or `wrapping_*` on external values.
- **Panics in production paths:** `.unwrap()`, `.expect("failed")` (no invariant named), `slice[i]` on data-derived indices, `&s[..n]` on arbitrary UTF-8, or reachable `todo!()` / `unimplemented!()` / `unreachable!()`.
- **Stringly typed & broken invariants:** `HashMap<String, String>` or `&str` for a closed set of states, or a struct of mutually-exclusive `Option` fields instead of an enum whose variants carry their own data.
- **Non-exhaustive catch-all on owned enums:** `_ => {}` on an enum the crate owns throws away compiler exhaustiveness checks so future variants are silently ignored.
- **Blocking inside `async`:** synchronous file I/O (`std::fs`), `std::thread::sleep`, synchronous HTTP/DB clients, or sustained CPU loops inside `async fn` stall the Tokio worker thread and every task sharing it. `Runtime::block_on` inside async code panics; `tokio::task::block_in_place` panics on the current-thread runtime (`#[tokio::test]`).
- **Lock guards held across `.await`:** holding a `std::sync::MutexGuard` (or `!Send` borrow such as `RefCell`) across `.await` deadlocks workers or makes futures `!Send`. Scope the guard before awaiting, or move ownership to a dedicated task.
- **Detached / unobserved tasks:** `tokio::spawn` whose `JoinHandle` is dropped detaches the task — it does **not** cancel it, and any panic or `Err` inside the task vanishes silently. Tasks need an owner (`JoinHandle`, `JoinSet`, or `TaskTracker`) that inspects `JoinError` (`is_panic()` / `is_cancelled()`) and the inner `Result`.
- **`tokio::select!` cancellation bugs:**
  - A non-cancel-safe future (`AsyncReadExt::read_exact`, `read_to_end`, `write_all`, `mpsc::Sender::send`, or a custom `async fn` that pops state before awaiting) in a losing arm silently drops or corrupts data. Use cancel-safe methods (`Sender::reserve` + `permit.send`, `Receiver::recv`) or move non-cancel-safe work into the winning arm body.
  - Recreating a long-lived future inside a `select!` loop resets it every iteration instead of pinning it once outside.
  - A `select!` arm precondition (`fut, if cond => ...`) still evaluates the future expression when `cond` is false — calling `.unwrap()` in that expression panics.
  - `biased;` with an always-ready top arm starves lower arms.
- **Timers and timeouts:** network/RPC calls without `tokio::time::timeout` (or client timeout) hang tasks and connections indefinitely; `tokio::time::interval` defaults to `MissedTickBehavior::Burst`, firing catch-up storms after a slow tick (prefer `Delay` or `Skip` for heartbeats/flushes); using `SystemTime` instead of monotonic `Instant` for elapsed durations.
- **Memory leaks without `unsafe`:** `Rc`/`Arc` reference cycles (missing `Weak`); `tokio::sync::mpsc::unbounded_channel` or unbounded `Vec`/`HashMap` caches with no eviction; long-lived tasks that never finish while holding `Arc`s; unguarded `Box::leak` / `std::mem::forget`.
- **Async/fallible teardown skipped:** `Drop` cannot be `async` and cannot return errors. Types whose cleanup requires flushing, committing a checkpoint, or closing a remote lease need an explicit consuming `async fn close(self) -> Result<(), E>` called on normal paths (with `Drop` as best-effort logging fallback), and must not be silently bypassed by early `?`.
- **Lock ordering & atomics:** taking two locks in inconsistent order across paths (deadlock); `Ordering::Relaxed` used where `Acquire`/`Release` publish/consume synchronization is needed; unexamined `std::sync::Mutex` poison recovery leaving invariants torn.
- **Partial/non-unique keys & float bugs:** dedup, cache, checkpoint, or batch identities built from non-unique keys; float equality or drift in financial/count accumulation.

## Async, streaming & operational footguns

These bugs emerge from the *interaction* of channels, cancellation, retries, and durability boundaries across files. Probe them deliberately in **Sweep B (failure-mode trace)**.

- **Checkpoints advancing ahead of durability.** Committing a source cursor/LSN/offset when the source *reads* rather than after the sink *acknowledges* loses data on crash. With parallel sink writes, committing the latest acknowledged offset instead of the **contiguous acknowledged prefix** skips still-in-flight batches and silently drops them on restart.
- **Shutdown dropping buffered batches.** If every pipeline stage listens to the same `CancellationToken` and breaks immediately on `SIGTERM`, downstream stages discard buffered rows instead of draining. Only sources should watch the cancellation token; downstream stages drain naturally until their input channel returns `None`. Check also that the drain timeout fits inside the platform grace period (`stopTimeout` / `terminationGracePeriodSeconds`) with margin for the final checkpoint.
- **Unbounded backpressure gaps.** An `mpsc::unbounded_channel`, or a batch-count-only channel when row sizes vary widely (missing a byte-budget `Semaphore`), lets a slow sink grow memory until OOM-kill.
- **Startup / readiness blocked by upstream calls & retry multiplication.** Anything awaited before the service reports ready that calls an external dependency with `R` retries and timeout `T` across `N` items delays availability by `N × (R+1) × T`. Watch for serial `for item in items { client.call(item).await?; }` loops where bounded concurrency (`Semaphore` / `JoinSet` / `buffer_unordered`) belongs.
- **Failed flush clearing the buffer.** Clearing a batch buffer before `sink.write(&batch).await?` succeeds drops the batch on transient error instead of keeping it for retry.

### Worked example — silent data loss in `select!` and shutdown

> A streaming batcher uses `tokio::select!` with `tx.send(batch)` in one arm and `shutdown.cancelled()` in the other. When `shutdown` fires while `tx` is full (slow sink), `select!` drops the `tx.send(batch)` future — which owned `batch` — and breaks out of the loop immediately.
>
> **Failure story:** Under backpressure during a rolling deploy (`SIGTERM`), the batcher loses the in-flight batch and any rows queued upstream in its input channel, while exiting `0`. If the source already advanced its checkpoint, those rows are permanently lost; even if not, a batch-count-checked test on an unloaded sink never triggers the losing arm.
>
> **Severity:** **Critical** under Correctness (silent data loss on a routine operational path). Fix: let downstream stages drain until their input channel closes (only sources watch `shutdown`), and reserve channel capacity (`tx.reserve().await`) before moving `batch` into `permit.send(batch)` when sending inside `select!`.

## Performance (×1.5)

- **Hot-path allocations:** allocating `String`, `Vec`, `Box`, `format!`, or reflexive `.clone()` per event/row instead of reusing preallocated buffers (`Vec::with_capacity` + `clear()`, `write!` into a reused `String`), borrowing slices, `Cow<'_, str>`, `bytes::Bytes`, or interning repeated strings as `Arc<str>`.
- **Unbounded buffering / missing streaming:** `read_to_end`, `collect::<Vec<_>>()` on large streams or files instead of `BufReader`/`BufWriter` and streaming iterators.
- **Per-event overhead:** syscall per row (unbuffered file/socket), N+1 network/DB calls instead of batching at I/O boundaries, constructing a new HTTP/TLS client per request instead of reusing a long-lived client, `tokio::spawn` per event instead of bounded workers, or taking a mutex / incrementing a single contended global atomic per event instead of per batch.
- **Type & memory-footprint bloat:** large enum variants inflating every item sent through a hot channel (`large_enum_variant` — box the rare large variant); large stack arrays or locals held across `.await` bloating futures (`large_futures`) and risking Tokio worker stack overflow; buffers grown by a spike batch keeping peak capacity forever after `clear()` without `shrink_to`.
- **Untyped hot-path deserialization:** deserializing hot feeds into `serde_json::Value` instead of typed structs.
- **Unmeasured micro-optimizations:** gratuitous `#[inline]` everywhere, non-SipHash hashers on attacker-controlled keys (hash-flooding DoS), or a library crate setting `#[global_allocator]` (binary-only decision).

## Architecture & Design (×1.5)

Rust has no class inheritance; apply **SOLID** in Rust terms — single responsibility per struct/module, open/closed via traits or exhaustive enums, Liskov substitution honoring trait error and cancellation contracts, interface segregation via small traits, and dependency inversion via core-owned traits implemented by adapter crates/modules.

- **Inverted dependency arrows:** core crate or domain module importing concrete vendor SDKs, HTTP clients, or database drivers instead of depending on traits wired at the composition root (`main.rs`).
- **Thick `main.rs`:** business logic living in `main.rs` cannot be unit- or integration-tested; keep `main.rs` to CLI parsing, config loading, telemetry init, wiring, and exit-code mapping, with logic in `lib.rs` or library crates.
- **Library overreach:** a library crate creating a Tokio runtime, installing a global `tracing` subscriber, setting `#[global_allocator]`, or depending on `tokio` with `features = ["full"]` (hides capabilities and bloats builds).
- **Missing DI seams vs. gratuitous abstraction:** constructing clients/pools or calling `SystemTime::now()` directly inside business logic (untestable without network/real time); conversely, a trait with one impl and no test fake, a builder for a two-field struct, or `T: Into<String>` everywhere adds noise — raise gratuitous patterns as proposals, not mandates.
- **State smells:** `Arc<Mutex<T>>` around data owned by one task (give it to that task + channel, or `&mut self`); parameter-threading the same 3+ collaborators through a call chain instead of owning them on a struct; mixing `pub` fields with an invariant that methods try to protect.
- **Module hygiene:** intra-crate module cycles; junk-drawer modules (`utils.rs`, `helpers.rs`, `common.rs`, `types.rs`) instead of domain modules.
- **Public API & semver breaks (diff scope):** removing/renaming `pub` items, changing signatures or `Send`/`Sync` bounds, adding fields/variants to public structs/enums lacking `#[non_exhaustive]`, or leaking `anyhow::Error` / third-party error types from a library's public API.

## Error Handling & Resilience (×1.0)

- **Wrong error boundary:** library public APIs returning `anyhow::Error`, `Box<dyn Error>`, or `Result<T, String>` instead of typed `thiserror` error enums callers can match on; binary code propagating bare `?` without `.context(...)` / `.with_context(...)`, or logging `{e}` instead of `{e:#}` (hides the cause chain).
- **Swallowed errors & misused panics:** `let _ = ...` discarding a fallible I/O, flush, or checkpoint `Result`; empty `Err(_) => {}`; panicking for expected runtime failures (bad input, network timeout, missing config file).
- **Retry defects:** retrying non-transient errors (validation, auth, 4xx, not-found) instead of encoding retryability on the error type (`is_transient()`) with capped exponential backoff and jitter; retrying after a closed channel (`SendError` means downstream stopped).
- **Missing isolation:** a batch/stream loop where one malformed record aborts the whole pipeline instead of isolating per record and routing failures to a dead-letter path or error counter (never silently dropping).
- **Observability:** `println!`/`eprintln!`/`dbg!` in committed library/service code (fine only for CLI stdout output); interpolated log strings (`info!("table {} done", t)`) instead of structured fields (`info!(table = %t, "done")`); per-event `info!` logging on hot paths; error logs missing the failing record/batch/connector identifier or run span.

## Readability & Style (×1.0)

- **Missing public docs:** public items with errors, panics, `unsafe`, side effects, or non-obvious semantics missing `///` docs (`# Errors`, `# Panics`, `# Safety`, cancel safety). Do not penalize self-describing signatures or internal items.
- **Positional `bool` arguments:** `writer.flush(true, false)` instead of descriptive enums or split methods; taking `&String`/`&Vec<T>`/`&PathBuf` instead of `&str`/`&[T]`/`&Path`.
- **Blanket suppressions & glob imports:** `#![allow(dead_code, unused)]` or `#[allow(...)]` without justification instead of `#[expect(lint, reason = "...")]`; `use foo::*` outside `tests` or a documented prelude.
- **Stale / machine-generated tells:** dead code, plan/task pointers in comments (`// D4:`, `// task 3.2`), magic numbers without named constants or typed `Duration`, `get_`/`set_` boilerplate on plain structs, `async fn` that never awaits, or inconsistent `foo/mod.rs` mixed with `foo.rs`.
- **Function / module size:** soft ~50 / ~400 lines when a unit mixes multiple responsibilities (an exhaustive `match` over many real variants is one responsibility — split on responsibility, not raw line count).

## Grep patterns worth running

```
unsafe\s*\{|unsafe\s+fn                  # every block needs // SAFETY:, every fn needs # Safety
\.unwrap\(\)|\.expect\(                  # panics outside tests — check invariant or convert to ?
unbounded_channel                        # unbounded memory growth — needs written reason
danger_accept_invalid_certs              # disabled TLS verification
Command::new\("(sh|bash|cmd)"            # shell injection surface
format!\(.*(?i)(select|insert|update|delete)  # possible SQL injection
std::thread::sleep|std::fs::|block_on\(|block_in_place  # blocking or panic inside async
tokio::spawn\(                           # check JoinHandle / JoinSet ownership & error checks
tokio::select!                           # check cancel safety, pinning, and arm preconditions
tokio::time::interval                    # check MissedTickBehavior (default is Burst)
println!|eprintln!|dbg!|todo!|unimplemented!  # debug/incomplete code in prod paths
#!?\[allow\(                             # silenced lints — prefer #[expect(..., reason = "...")]
use .*::\*;                              # glob imports outside tests/prelude
let _ =                                  # swallowed Result / JoinHandle / guard
Box::leak|mem::forget                    # intentional leaks — require written justification
 as (u8|u16|u32|u64|i8|i16|i32|i64|usize|isize)  # silent truncation / sign-flip casts
#\[tracing::instrument                   # check skip_all / skip(...) on secret or large args
#\[derive\(.*Debug                       # check structs holding credentials for redaction
features\s*=\s*\[.*"full"                # over-broad crate features (e.g. tokio full)
```

## Calibration hints

- An unsound `unsafe` block (or one lacking a valid `// SAFETY:` proof), a secret leaked through `#[derive(Debug)]` / `#[tracing::instrument]` / logs, SQL injection via `format!`, or disabled TLS verification is **Critical** under Security/Correctness (caps Security/Correctness ≤ 5).
- A non-cancel-safe future in `tokio::select!` that can drop or corrupt data, a shutdown path that discards buffered rows, or a checkpoint committed before sink durability / out of order across parallel writes is **Critical** under Correctness (silent data loss).
- Holding a `std::sync::MutexGuard` across `.await`, blocking I/O or sustained CPU on a Tokio worker, a detached `tokio::spawn` whose panics/errors are never observed, or an `mpsc::unbounded_channel` on an external/high-throughput path is **High** under Correctness (and unbounded buffering caps Performance ≤ 6).
- `.unwrap()`, `&s[..n]`, `slice[i]`, or unchecked integer arithmetic reachable from untrusted input is **High** under Security/Correctness (remote panic / DoS); `.unwrap()` on plausible internal errors outside tests is **High/Medium** under Error Handling.
- Swallowing a fallible `Result` (`let _ = sink.flush().await;`) or retrying non-transient errors caps **Error Handling ≤ 6** (core guardrail).
- Exposing `anyhow::Error` or vendor driver types from a library's public API, or an unflagged semver-breaking public API change in diff scope, is **High** under Architecture (an unflagged diff-scope API break caps Architecture ≤ 5).
- Reflexive `.clone()` or per-event allocations on a documented hot path is **Medium–High** under Performance; outside hot paths it is **Low/Medium** under Readability.
- Missing `///` docs (`# Errors`, `# Panics`, `# Safety`, cancel safety) on public items that require them triggers the core **Readability ≤ 7** guardrail; self-describing signatures and private/internal items do not.
