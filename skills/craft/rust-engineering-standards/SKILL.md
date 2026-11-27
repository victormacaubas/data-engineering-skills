---
name: rust-engineering-standards
description: Canonical Rust coding standards — ownership and types, Clean Code applied to Rust, doc comments, error handling, memory and allocation without a garbage collector, async and concurrency with Tokio, performance for high-throughput streaming, unsafe, security, testing, and the tells that make code read as machine-generated. Use whenever you write, review, or refactor Rust of any kind — streaming engines, services, CLIs, libraries, connectors, benchmarks, Cargo workspaces, build scripts. Consult it before writing rather than fixing style afterward, even for a small function.
---

# Rust Engineering Standards

Apply these by default. A throwaway snippet in a playground is the only exception.

The guiding principle: **write code that another engineer can read, test, and run under load six months from now without surprise.** The compiler proves memory safety. It does not prove that the code is clear, that it handles errors well, or that it stays inside a memory budget. Those are your job, and every rule below comes from a failure in one of them.

## How to apply these standards

Read the project first: `Cargo.toml` (and the workspace root's), `Cargo.lock`, `rust-toolchain.toml`, `rustfmt.toml`, `clippy.toml`, the `[lints]` tables, the edition, `rust-version`, and the dominant local conventions. Explicit, coherent project configuration wins. Use this skill for the decisions the project has not made. When local code is inconsistent, follow the safest checked-in pattern before you introduce a new one.

**Check APIs, don't recall them.** Crate APIs change between releases, and a plausible call from an older version reads exactly like a correct one. Before you write a call signature, a trait bound, or an error type for a third-party crate, find its version in `Cargo.lock` and read that version's docs on docs.rs. Also check the enabled feature flags in `Cargo.toml`: many items exist only behind a feature (`tokio`'s `test-util`, `tracing-subscriber`'s `json`, `tokio-util`'s `rt`), and code that compiles in one crate fails in the next.

**Public vs. private.** An item is public API when code outside its crate can reach it: `pub` and re-exported from the crate root, or part of a `pub` item's signature. `pub(crate)`, `pub(super)`, and private items are internal. Apply documentation and type rigor in proportion: most at public edges, less ceremony inside. Default to the narrowest visibility that works, because widening visibility later is free and narrowing it is a breaking change.

**Done means a real check passed.** When you change code, run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` (with the project's own flags if it has them), and the tests that exercise the change (`cargo test`, or `cargo nextest run` plus `cargo test --doc`, because nextest does not run doctests). `cargo check` alone does not count when tests exist, and neither does a command that failed to start. If no real check can run, say which one you did not run and why, instead of reporting the change as done.

**Do what was asked, and mention the rest.** Don't add features, crates, tests, docs, example binaries, config options, or refactors that the task did not ask for, even when they fit the project's conventions. If you think one would help, say so at the end of your reply instead of writing it. A new dependency is the project's decision, not yours.

## Reference files

The deeper material lives in `references/`. Read the file that covers the task and skip the rest.

**Read `references/concurrency.md`** before you write anything with `async`, Tokio tasks, channels, `select!`, locks, atomics, `spawn_blocking`, signals, worker pools, or shutdown logic. The Async & Concurrency section below is the floor, not the standard.

**Read `references/performance.md`** when the code is on a hot path (per-event or per-row work), when the task names throughput, latency, or memory targets, or before you add a benchmark, a custom allocator, `#[inline]`, or a zero-copy type such as `Bytes` or an Arrow array. It also holds the full memory and allocation standard.

**Read `references/layout.md`** when you start a crate or workspace, add a crate to a workspace, or decide which module a new file belongs in. It holds the full trees for each archetype (streaming engine workspace, service, CLI, library).

**Read `references/operational.md`** when you build a binary that runs as a job or service rather than a library someone imports: CLI parsing and exit codes, layered config, secrets, tracing setup, metrics and health checks, checkpoints and idempotency, release profiles, and container images. This file covers none of those in depth, so that reference is their only home. If a task lands there and you have not opened it, you are answering from memory.

**Read `references/security.md`** when the task touches credentials, SQL, network endpoints, TLS, deserialization of external input, subprocesses, file permissions, paths from external input, or a new dependency. The Security section below sets the floor.

**Read `references/tooling.md`** when there is no tooling config to inherit (a fresh crate or workspace) before you write `Cargo.toml` lints, `rustfmt.toml`, `clippy.toml`, `deny.toml`, or CI steps from memory. Checked-in config always wins over that file.

## Style

- **rustfmt decides formatting.** Don't hand-format, and don't fight it with `#[rustfmt::skip]` except for a table or matrix whose alignment carries meaning.
- **Naming follows the Rust API Guidelines.** `snake_case` for functions, variables, modules, and crates; `UpperCamelCase` for types, traits, and enum variants; `SCREAMING_SNAKE_CASE` for `const` and `static`. Acronyms are one word: `HttpClient`, `SnowflakeSink`, not `HTTPClient`.
- **Conversion prefixes carry cost.** `as_` is a cheap borrowed view (`as_str`), `to_` is an expensive conversion that allocates or computes (`to_string`, `to_vec`), `into_` consumes `self` (`into_inner`). `From`/`TryFrom` for type conversions. Getters have no `get_` prefix: `fn offset(&self) -> u64`, not `fn get_offset`.
- **No magic numbers.** If a value has meaning, name it: `const MAX_BATCH_ROWS: usize = 10_000;`. Use `_` separators in long literals. Put units in the name when the type does not carry them (`FLUSH_INTERVAL_MS`), and prefer a type that carries them (`Duration::from_millis(250)`).
- **Imports.** Group them as std, external crates, then the current crate (`crate::`, `super::`), with a blank line between groups. Stable rustfmt does not enforce the grouping, so keep it by hand. No glob imports (`use foo::*`) outside a `tests` module or a crate's documented prelude, because they hide where a name comes from and break when the source adds a name.
- **Module files.** Use `foo.rs` plus a `foo/` directory for submodules, not `foo/mod.rs`, unless the project already uses `mod.rs`. A dozen editor tabs named `mod.rs` tell a reader nothing.

## Comments & Doc Comments

Documentation depth scales with API surface: what a reader outside the module needs to use the item correctly. A comment earns its space by carrying what the code cannot say. Where names and types already say it, prose competes with them.

One test settles most cases: **would a reader six months from now, who has never seen the plan or the PR, need this line?** A hidden constraint passes. A pointer to a document that no longer exists does not.

**Don't cite the plan that produced the code.** No design-doc decision IDs (`// D1:`, `(design D3)`), task numbers (`// task 3.2`, `// per tasks.md step 4`), or review references (`// per review feedback`). The plan is archived when the change ships, so the pointer dies. Its labels are not unique either, so `D1` in one module can lead a reader to an unrelated `D1`. **Write the reason, not the pointer:**

```rust
// pgoutput sends an unchanged TOAST column as a marker, not a value, so keep the old one.   ← survives archival
// D4: handle toast                                                                        ← dead reference
```

References to durable sources are fine: `#[expect(clippy::cast_possible_truncation, reason = "...")]`, an upstream issue in a workaround (`// workaround for tokio#1234; remove when fixed`).

**Public items** get a `///` doc comment when any of these hold:

- the item has side effects beyond its return value;
- it returns an error the caller is expected to handle — add an `# Errors` section that names the cases;
- it can panic — add a `# Panics` section that names the condition;
- it is `unsafe` — add a `# Safety` section that states what the caller must uphold;
- its semantics are not obvious from the signature: bound inclusivity, empty-input behavior, ordering, units, whether it blocks, whether it is cancel-safe.

If the name and the types fully describe the contract, skip it. `fn is_empty(&self) -> bool` needs nothing. `async fn flush(&mut self) -> Result<(), SinkError>` looks just as simple and needs a doc comment, because the signature does not say whether a failed flush keeps the buffered rows, or whether dropping the future mid-flight loses them.

````rust
/// Appends `batch` to the open channel and waits for the server offset.
///
/// Rows are durable once this returns `Ok`. Dropping the future before it
/// completes may leave a partial batch on the server; the caller retries
/// from its last checkpoint, never from the dropped batch.
///
/// # Errors
///
/// Returns [`SinkError::Throttled`] when the server asks for backoff and
/// [`SinkError::Rejected`] when a row fails validation. Both leave the
/// channel usable.
pub async fn append(&mut self, batch: &RecordBatch) -> Result<Offset, SinkError> {
````

Add `# Examples` with a runnable doctest on public items whose correct use is not obvious; doctests are compiled and run by `cargo test`, so they cannot rot silently. A library crate turns on `missing_docs` for its public API (see `references/tooling.md`).

**`//!` crate and module docs need a reason to exist.** Keep one when it explains the module's public shape, an invariant that spans the module, or context a caller needs first. Skip a summary that restates the module name.

**Inline `//` comments explain why, not what.** Reserve them for hidden constraints, invariants, workarounds tied to a specific bug or upstream behavior, and anything that would surprise a reader. Don't narrate the task (`// added for the CDC flow`), the author, or removed code. If a comment feels needed, first ask whether a better name, a newtype, or an extracted function removes the need.

## Clean Code, Applied to Rust

These come from Robert C. Martin's *Clean Code*, adjusted where Rust has a better tool than the Java the book was written for.

**Names reveal intent.** A name says why the item exists, what it does, and how it is used. `elapsed_since_flush` beats `d`; `pending_rows` beats `list`. Pick one word per concept across the codebase (`fetch`, `get`, or `load` — not all three for the same idea). Types and fields are nouns, functions are verbs. No encodings: no Hungarian prefixes, no `I` on traits, no `Impl` suffix on the one implementation.

**Functions do one thing, at one level of abstraction.** A function that reads a config file, opens a connection, and parses a row mixes three levels. Read top to bottom like a newspaper: public entry points first, then the functions they call, each one level more detailed (the stepdown rule). Size is a symptom, not the rule: a function that scrolls past about 50 lines usually does more than one thing, but a `match` over twelve real variants is long and still does one thing.

**Few arguments.** Zero to two is the ideal. Three needs a reason. Past that, the arguments travel together and want a struct. Rust has no keyword arguments, so a positional `bool` is a bug waiting to happen:

```rust
writer.flush(true, false);              // which flag is which?
writer.flush(Durability::Sync, Retry::Never);  // reads itself
```

Replace a flag argument with an enum, or split the function in two (`flush_sync` / `flush_async`) when the branches share little.

**No hidden side effects, and keep commands apart from queries.** A function named `is_ready` doesn't reset a timer. A function either changes state (`&mut self`, returns `()` or `Result<(), E>`) or answers a question (`&self`, returns a value). The borrow checker already pushes you this way; follow it rather than reaching for interior mutability to make a query mutate.

**Errors are values, not sentinels.** Return `Result` and `Option`; never `-1`, an empty string, or a zeroed struct to mean "failed" or "absent". Keep error handling from burying the happy path: `?` propagates, and the mapping to a domain error happens once, at the boundary (see Error Handling).

**Law of Demeter.** A function talks to its arguments, its own fields, and what it creates — not to the internals of what those return. `self.pipeline.source().connection().pool().get()` couples this code to four types' layouts; give `Pipeline` a method that says what you need. Iterator chains and builders are not violations: each step returns a value meant to be chained.

**Data structures vs. objects.** A plain data struct has `pub` fields and no behavior (a decoded row, a config value). An object has private fields and behavior that protects an invariant (a buffer that is never over capacity). Don't mix them: `pub` fields on a type with an invariant let any caller break it.

**Wrap third-party boundaries.** Code that calls a vendor client in thirty places breaks in thirty places on the next release. Put the client behind a small trait or module you own, and the rest of the code depends on that.

**Simple design, in order:** the code passes all tests, expresses intent, contains no duplication, and has the fewest types and functions that do the job (Kent Beck's four rules, as *Clean Code* restates them). The last rule loses to the first three.

**The boy scout rule, scoped.** Leave the code you touch a little cleaner than you found it — inside the lines your change already touches. A rename or extraction elsewhere is a separate change; mention it instead of doing it, so the diff stays reviewable.

Where Rust departs from the book:

- **`Result` replaces exceptions.** The book's "prefer exceptions to error codes" becomes "prefer `Result` to sentinel values". Errors stay visible in the signature, which is the point.
- **A closed set of cases wants `match`, not polymorphism.** The book's "replace switch with polymorphism" assumes new types arrive often. When the set of variants is closed and you own it (event kinds, connector states), an `enum` with an exhaustive `match` is clearer and the compiler finds every site to update when a variant is added. Use a trait when the set is open or injected (sinks, sources, a clock).
- **Composition replaces inheritance.** There is no inheritance. Share behavior through traits with default methods, generics, and plain delegation to a field.
- **"Small" is a guide, not a line count.** Error mapping and exhaustive matches make honest Rust functions longer than the book's examples. Split on responsibility, not on length.

## Code That Reads As Written

Code can follow every rule above and still read as though a generator wrote it. These patterns feel diligent while you write them; reviewers recognize them and stop trusting the code.

- **`.clone()` to quiet the borrow checker.** A clone added where the error appeared, not where ownership was designed. Restructure first: borrow for a shorter scope, pass `&T`, move the value, or split the struct so two borrows don't overlap. Clone when the copy is the design (a cheap `Arc` handle, a small `Copy` type, a snapshot you mean to diverge).
- **`unwrap()` scattered through code paths.** Every `unwrap` claims "this cannot fail". Outside tests, either propagate with `?` or use `expect` with the invariant that makes failure impossible: `.expect("regex literal is valid")`. `expect("failed")` and `expect("should work")` say nothing.
- **`Arc<Mutex<T>>` around data one task owns.** Shared mutable state by reflex. If one task owns the data, give it to that task and talk to it through a channel, or pass `&mut T`.
- **Stringly typed code.** `Result<T, String>`, `HashMap<String, String>` for structured data, `&str` for a known set of states. Use error enums, structs, and enums; the compiler then checks what tests otherwise have to.
- **Abstraction with one use.** A trait with one implementation and no test fake, a builder for a two-field struct, a generic `T: Into<String>` on every parameter, `new()` plus `Default` plus a builder for the same type. Each is right once a second case exists. One exception: a trait over an injected dependency (a sink, a clock) is legitimate with one production implementation, because the second implementation is the test fake. Ask whether the indirection is a seam you use, not how many implementers exist.
- **Getters and setters for every field.** `get_x`/`set_x` pairs on a struct with no invariant. Make the fields `pub` on plain data, or expose behavior instead of fields on an object.
- **Silenced warnings.** `#![allow(dead_code, unused)]` at the crate root, or `#[allow]` without a reason. Delete dead code; where a lint is wrong for one item, use `#[expect(lint, reason = "...")]`, which also warns when the exception is no longer needed.
- **A catch-all arm on your own enum.** `_ => {}` in a `match` on an enum you own throws away the exhaustiveness check, so the next new variant is silently ignored. List the variants.
- **`async` with nothing to await.** An `async fn` that never awaits adds a state machine and forces callers into async for no reason.
- **Step-numbered comments, banners, and decoration.** `// Step 1: parse`, `// ===== HELPERS =====`, emoji in logs. If the steps are real seams, make them functions. If a file needs signposts, split it.
- **Placeholder names.** `process_data`, `handle`, `do_work`, `Manager`, `utils.rs`, `helpers.rs`, `common.rs`. Name what it handles: `decode_wal_record`, `checkpoint.rs`. A short name is fine where the type supplies the noun (`batch: RecordBatch`) or the code is generic.
- **Entry and exit logging on every function.** `info!("starting flush")` / `info!("flush done")` everywhere. Put a `#[tracing::instrument]` span on the operations worth tracing and log events a human reads during an incident.
- **Uniform rhythm.** Every function the same length, every doc comment the same four sections, every error mapped the same way. Problems vary, so code varies.
- **Files nobody asked for.** A `README.md` per crate, an `examples/` directory, a `prelude.rs` for three items, a `constants.rs` holding one value, a feature flag the task did not need.

When you finish a function, ask: would I defend each line to a reviewer? A line you would defend with "it seemed thorough" is a candidate for deletion.

## Types, Ownership & Borrowing

- **Borrow in parameters, own in fields.** Take `&str` not `&String`, `&[T]` not `&Vec<T>`, `&Path` not `&PathBuf`: callers can pass more types and nothing is copied. Take ownership (`String`, `Vec<T>`) when the function stores the value or consumes it. `impl AsRef<Path>` is fine on public APIs that take paths.
- **Return owned values** unless the result borrows from an argument. Fighting lifetimes in a return type is a sign that the data wants an owner.
- **Newtypes for domain values.** `struct Lsn(u64)`, `struct TableName(String)`. A function that takes `(Lsn, Offset)` cannot have its arguments swapped; one that takes `(u64, u64)` can. Newtypes are free at runtime.
- **Make invalid states unrepresentable.** Prefer an enum whose variants carry their own data over a struct of `Option` fields that are valid only in some combinations:

  ```rust
  enum Connector {
      Idle,
      Snapshotting { table: TableName, rows_done: u64 },
      Streaming { slot: SlotName, last_lsn: Lsn },
  }
  ```

  Validate at the boundary and return a type that proves it: `fn parse(raw: &str) -> Result<BatchSize, ConfigError>` means no code after it checks the value again.
- **`Option<T>` only when absence is meaningful.** Don't make every field optional "just in case"; it pushes a check onto every reader.
- **Derive what the type honestly supports.** `Debug` on nearly everything (except types holding secrets — see Security). `Clone` when copies make sense, `Copy` only for small plain values, `PartialEq`/`Eq`/`Hash` when equality is defined by all fields. `#[non_exhaustive]` on public enums and structs that will grow, so adding a variant or field is not a breaking change. `#[must_use]` on functions whose return value is the point (a builder, a `Result`-like status).
- **Integer arithmetic on external input is explicit.** Overflow panics in debug builds and wraps silently in release. When a value comes from outside, use `checked_*`, `saturating_*`, or `wrapping_*` to say which behavior you mean. `as` casts truncate and change sign silently; use `TryFrom` (`u32::try_from(len)?`) where the value might not fit.
- **Index with `.get()` when the index comes from data.** `slice[i]` panics out of bounds; reserve it for indexes the code itself proves valid.

## Choosing a Struct, an Enum, a Trait, or a Function

Start with the deciding question: **does this code carry state across calls?** State is anything that outlives one call and that more than one operation reads or changes: a connection, a buffer, a client, config, metrics handles, a checkpoint.

- **Struct with methods** — when the thing owns state or a resource: `WalReader`, `BatchBuffer`, `SnowflakeSink`, `PipelineRunner`. It receives its collaborators in its constructor and keeps them.
- **Free function** — for stateless transforms, validators, and computations: a leaf that takes inputs and returns a result. Group these in modules named by domain (`decode.rs`, `partition.rs`), not by kind (`helpers.rs`, `functions.rs`).
- **Plain data struct** — for values: config, decoded records, intermediate results. `pub` fields or a constructor that validates, and no I/O.
- **Enum** — for a closed set of alternatives you own: event kinds, states, commands, error cases.
- **Trait** — for an open set of implementations, or an injected dependency that tests replace with a fake: `Source`, `Sink`, `Clock`, `CheckpointStore`.

**The parameter-threading smell.** When two or more functions pass the same values in a fixed order — `run(&conn, &cfg, &metrics)` calling `extract(&conn, &cfg, &metrics)` then `load(&conn, &cfg, &metrics)` — that shared context is state without an owner. Give it one: a struct built once, whose methods use `self.conn`. An orchestrator that coordinates steps over shared resources is a struct even when each step looks pure.

Use state, not size, as the test.

## Crate & Module Layout

Split by responsibility, and keep dependencies flowing one way. The shape in one line: **`main.rs` → application crate or module → domain types**, with imports only pointing toward the domain.

```
my-engine/
├── Cargo.toml          # workspace root: members, shared deps, shared lints
├── crates/
│   ├── engine-core/    # domain types, traits (Source, Sink), the pipeline. No I/O clients.
│   ├── source-postgres/  # one crate per connector; depends on engine-core
│   ├── sink-snowflake/
│   └── engine-cli/     # main.rs: parse args, build config, wire concrete types, run
```

That sketch is generic. **Read `references/layout.md`** for the filled-in tree of the archetype you are building before you create crates.

### Layout rules

- **`main.rs` stays thin.** It parses input, builds config, constructs concrete clients, wires them together, and calls into a library. Logic in `main.rs` cannot be tested or reused. Put the logic in `lib.rs` (or a library crate) and keep `main.rs` to wiring.
- **The core crate knows nothing about concrete clients.** `engine-core` defines `trait Sink`; `sink-snowflake` implements it. If core imports a vendor SDK, the dependency arrow points the wrong way.
- **No cycles.** Cargo forbids crate cycles; inside a crate, a module cycle is legal but is the same smell. Move the shared type into a lower module.
- **Group by domain, not by kind.** `checkpoint.rs`, `decode.rs`, `backpressure.rs` say what lives there; `types.rs`, `traits.rs`, `helpers.rs` do not.
- **`lib.rs` is a table of contents.** It declares modules and re-exports the public API. Logic lives in named modules.
- **Module size.** A file over about 400 lines usually holds more than one concern; split it along a seam. Not a hard limit, but a prompt to look again.
- **Split a crate when it earns its compile boundary**: a separate dependency set (each connector pulls its own client), a separately reusable unit, or compile time that hurts. Not for tidiness alone; every crate adds a `Cargo.toml` to keep in sync.

## Design Principles

SOLID, in Rust terms:

- **Single Responsibility** — one type owns one concern. A `WalReader` does not also batch rows.
- **Open/Closed** — add behavior with a new trait implementation or a new enum variant handled at every `match`, not by editing working code paths with flags.
- **Liskov Substitution** — every implementation of a trait honors the trait's documented contract, including its error and cancellation behavior. A `Sink` whose `flush` silently drops rows is not a `Sink`.
- **Interface Segregation** — small traits. A consumer that only reads checkpoints depends on `CheckpointReader`, not a store trait with ten methods.
- **Dependency Inversion** — the core depends on traits it defines; concrete clients implement them and are wired in at the composition root.

And the broader habits: **DRY** (extract repeated logic and constants), **YAGNI** (no speculative abstraction), **fail fast** (validate at the boundary so bugs surface near their cause), **prefer immutability** (`let` over `let mut`, `&` over `&mut`, return new values from transforms), **explicit over implicit** (named constants, newtypes, enums over flags), and **trust the type system** (don't re-validate what a type already guarantees; validate at system boundaries).

## Dependency Injection & Testability

A type that builds its own HTTP client or database pool can only be tested against the real thing. A type that receives its collaborators is easy to test. **Pass dependencies in.**

Construct concrete clients at the **composition root** (`main.rs` or a `build_*` function it calls) and pass them down. Services receive dependencies in their constructor and do not call `Client::new()` themselves.

Two ways to accept a dependency:

- **Generics (static dispatch):** `struct Pipeline<S: Source, K: Sink>`. Monomorphized, so calls inline and cost nothing at runtime. Use this on the hot path and when the concrete type is fixed for the life of the program.
- **Trait objects (dynamic dispatch):** `Box<dyn Sink>` or `Arc<dyn Sink>`. One vtable call per method. Use this when the implementation is chosen at runtime (from config), when a collection holds mixed implementations, or when generic parameters would spread through every signature.

```rust
pub trait Clock: Send + Sync {
    fn now(&self) -> SystemTime;
}

pub struct Batcher<K: Sink, C: Clock> {
    sink: K,
    clock: C,
    max_rows: usize,
    max_age: Duration,
}

impl<K: Sink, C: Clock> Batcher<K, C> {
    pub fn new(sink: K, clock: C, max_rows: usize, max_age: Duration) -> Self {
        Self { sink, clock, max_rows, max_age }
    }
}

// composition root (main.rs)
let sink = SnowflakeSink::connect(&config.snowflake).await?;
let batcher = Batcher::new(sink, SystemClock, config.max_rows, config.max_age);
```

Tests pass a fake sink that records batches and a fake clock they advance by hand. No network, no sleeping.

**`async fn` in traits** works for static dispatch but such traits cannot be used as `dyn Trait`. If you need `Box<dyn Sink>` with async methods, check what the project already uses (the `async-trait` crate, or methods returning boxed futures) before choosing.

**Time and randomness are dependencies.** Code that reads the clock takes a `Clock` (or a `now` parameter); code that needs randomness takes a seeded RNG. In Tokio tests, `#[tokio::test(start_paused = true)]` makes `tokio::time` deterministic.

**Many parameters** go into a config struct with named fields, or a builder when some are optional with defaults. Never more than about three positional parameters on a public function.

## Error Handling

- **Libraries define error enums with `thiserror`.** One enum per crate or per major module, with variants a caller can act on: `Throttled`, `Rejected { row: u64, reason: String }`, `Io(#[from] std::io::Error)`. Don't expose `anyhow::Error` or `Box<dyn Error>` from a library's public API; callers cannot match on them.
- **Binaries use `anyhow`** (or the project's equivalent) at the top, with `.context("...")` / `.with_context(|| format!(...))` at each layer so the final message says what was being attempted: `failed to open replication slot "engine_1": connection refused`.
- **Propagate with `?`.** Map to a domain error once, at the boundary where the meaning changes, with `#[from]` or `map_err`.
- **Error messages** are lowercase, without trailing punctuation, and describe the failure, not the fix. They get chained into longer messages.
- **`unwrap` and `expect` are for tests and proven invariants.** In production code, `expect` names the invariant: `.expect("channel capacity is non-zero")`. If you cannot state why it cannot fail, it can fail: return an error.
- **A panic means a bug.** Never use a panic for an expected failure (bad input, a network error, a missing file). In a long-running service, a panic in a Tokio task does not stop the process by default; it surfaces as a `JoinError` that someone must check (see `references/concurrency.md`).
- **Retry only transient errors**: timeouts, connection resets, throttling, 5xx. Never retry validation failures, auth failures, or "not found"; those are bugs or config errors. Use exponential backoff with jitter and a cap on attempts or total time, and make the retryable cases a property of the error type so the retry loop doesn't guess:

  ```rust
  impl SinkError {
      pub fn is_transient(&self) -> bool {
          matches!(self, Self::Throttled { .. } | Self::Timeout | Self::Connection(_))
      }
  }
  ```

  Check whether the project already has a retry helper or crate before writing one.

### Isolation boundaries

Catch everything only where one unit's failure must not stop the larger run: one record of many, one table of many, one connector of many. There, record the failure as a result the caller sees (a dead-letter entry, a `Failed` status, an error counter in the run summary) and continue. The isolated unit is small — one record, not a 200-line body — and the failure is never silently dropped. Everywhere else, propagate.

## Memory & Allocation

Rust has no garbage collector. Every value is freed when its owner goes out of scope (RAII), at a point you can read in the code. That gives steady latency with no GC pauses, which is why high-throughput engines are written in it. It also means nothing reclaims memory you keep reachable by mistake, and every allocation costs on the hot path. Memory use is a design decision, not something to tune later.

- **Bound everything that grows.** Every channel, queue, buffer, cache, and map that grows with input has a stated maximum, and the code does something defined at the limit: wait (backpressure), shed, or fail. An unbounded channel or a cache with no eviction is a memory leak that waits for a traffic spike. `tokio::sync::mpsc::unbounded_channel` needs a written reason.
- **Allocate once, reuse.** In loops, preallocate with `Vec::with_capacity` / `String::with_capacity` when the size is known or estimable, and reuse buffers: `buf.clear()` keeps the capacity. `std::mem::take` moves a buffer out and leaves an empty one in place. Write into a reused `String` with `write!` instead of building a new one with `format!` per event.
- **Borrow instead of copying.** `&str` and `&[u8]` slices into an existing buffer, `Cow<'_, str>` when a value is usually borrowed and only sometimes changed, `bytes::Bytes` for cheap, reference-counted slices of a network buffer (where the project uses it).
- **Share read-only data with `Arc`, not copies.** `Arc<str>` / `Arc<[T]>` for immutable data many tasks read. Use `Rc` only in single-threaded code. Don't wrap data in `Arc` that only one owner uses.
- **Know the ways to leak without `unsafe`.** Reference cycles of `Rc`/`Arc` (break them with `Weak`), `Box::leak` and `mem::forget`, unbounded collections, spawned tasks that never finish and hold `Arc`s, and global caches with no eviction. All of them pass the borrow checker.
- **Release early when it matters.** Locals drop at the end of their scope, in reverse order of declaration. A large buffer or a lock guard you no longer need can be released with `drop(value)` or a tighter block scope, so it doesn't live until the end of a long function.
- **Keep large values off the stack.** A large array in a local can overflow a thread's stack (Tokio worker stacks are smaller than the main thread's). Box it or use a `Vec`.
- **Size matters for types moved in bulk.** A large enum variant makes every value of the enum that large. Box the rare large variant when the enum is moved through a hot channel.
- **Change the global allocator only on evidence.** mimalloc or jemalloc can cut fragmentation and raise throughput in long-running, allocation-heavy services, but adopt one only when a benchmark or a memory profile on your workload shows the gain.

**Read `references/performance.md`** for profiling memory (heap profilers, counting allocations in tests), arena and pool patterns, and the hot-path rules.

## Resource Management

Every resource with paired setup and teardown — a file, a socket, a connection, a lock, a temp directory, a replication slot lease — is owned by a value whose `Drop` releases it. Don't write `close()` calls that an early `return` or a `?` can skip.

- Lock guards release on drop. Keep the guard's scope as small as the critical section.
- **`Drop` cannot be async and cannot return an error.** When release needs I/O that can fail or must be awaited (flush a sink, commit a final checkpoint, close a remote channel), give the type an explicit `async fn close(self) -> Result<(), E>` that consumes it, call it on every normal path, and keep `Drop` as a best-effort fallback that logs. Document that callers must call `close`.
- A temp directory is a `tempfile::TempDir` (where the project uses it) that removes itself on drop, not a path you remember to delete.

## Logging & Observability

Use `tracing`, not `println!` or `eprintln!`, in committed code. `println!` has no level, timestamp, span, or filter. It is fine in a CLI whose stdout is its output (JSON, a table) and in a one-off example.

- **Structured fields, not formatted strings.** `info!(table = %name, rows, "snapshot complete")`, not `info!("snapshot of {} complete: {} rows", name, rows)`. Fields can be filtered and aggregated; interpolated text cannot.
- **Spans carry context.** Put `#[tracing::instrument(skip_all, fields(connector = %self.name))]` on operations worth tracing, so every event inside carries the connector, table, or run id without repeating it. Use `skip_all` or `skip(...)` so large arguments and secrets are not recorded.
- **Levels on purpose.** `error!` for a failure someone must act on, `warn!` for degraded-but-continuing, `info!` for milestones (phase boundaries, connections opened, checkpoints committed), `debug!`/`trace!` for diagnostics.
- **Never log per event at `info` on a hot path.** At 100,000 events per second, a log line per event is the bottleneck. Count events in metrics and log a summary per batch or per interval.
- Library crates emit events and spans but never install a subscriber; the binary installs it once, in `main`. Setup is in `references/operational.md`.

## Async & Concurrency

Read `references/concurrency.md` before you write async or concurrent code. The rules below are the floor.

- **One runtime, chosen by the binary.** Use Tokio unless the project uses something else. Libraries don't create runtimes.
- **Never block inside async code.** Blocking file I/O, a CPU-heavy loop, `std::thread::sleep`, or a blocking client call inside an `async fn` stalls every task on that worker thread. Move it to `tokio::task::spawn_blocking` (for blocking I/O) or a dedicated thread pool such as `rayon` (for CPU work).
- **Bounded channels only**, sized on purpose. `send().await` on a full channel is your backpressure; it slows the producer to the speed of the slowest consumer, which is what a streaming engine needs.
- **Don't hold a `std::sync::Mutex` guard across `.await`.** It can deadlock the worker and makes the future `!Send`. A `std::sync::Mutex` is fine for short critical sections that do not await. Use `tokio::sync::Mutex` only when the lock must be held across an `.await`, and first consider whether a single owning task with a channel removes the lock.
- **Every spawned task has an owner.** Keep the `JoinHandle` or use a `JoinSet`, and check the result: a panic or error in a task is invisible unless someone awaits it.
- **Know what is cancel-safe.** A future in a `tokio::select!` branch that loses is dropped at its last `.await`. Check the Tokio docs for each method's cancel safety before you put it in `select!`.
- **Graceful shutdown** for long-running processes: catch `SIGTERM` and Ctrl-C, stop taking new work, drain in-flight batches, commit the final checkpoint, then exit — within the platform's grace period.
- **Prefer message passing to shared state.** One task owns a piece of state and others send it messages. Shared state behind a lock is for small, read-mostly data.

## Performance

- **Measure before you optimize.** Criterion for micro-benchmarks, a flamegraph or `samply` for where time goes, a heap profiler for where memory goes. Guesses about hot spots are usually wrong.
- **Benchmark and profile release builds.** Debug builds are often ten to a hundred times slower, and their profile looks nothing like production.
- **Batch at every I/O boundary.** One network call per batch, not per row. Per-event cost belongs in nanoseconds; anything that crosses a socket is amortized.
- **Avoid N+1 round trips**: one bulk request plus in-memory lookup beats N single requests.
- **Stream, don't buffer**: process unbounded inputs (files, sockets, query results) incrementally with a bounded buffer.

`references/performance.md` holds the hot-path rules, zero-copy patterns, Arrow, and the profiling workflow.

## Unsafe

- **`unsafe_code` is forbidden by default**, through the workspace lint or `#![forbid(unsafe_code)]` in each crate root. Nearly every task in this domain has a safe solution with the same performance.
- When a crate genuinely needs `unsafe` (FFI, a measured hot path the safe version cannot match), isolate it in one small module with a safe API around it, and lift the forbid only there.
- Every `unsafe` block has a `// SAFETY:` comment directly above it that states why each requirement of the operation holds. Every `unsafe fn` has a `# Safety` doc section stating what the caller must uphold.
- Run the tests that cover `unsafe` code under Miri (`cargo +nightly miri test`) where the code allows it.
- A dependency's `unsafe` is your risk too; see `references/security.md` on reviewing new crates.

## Security

Every codebase has this floor:

- **Parameterized queries only.** Bind values with the driver's placeholders (`$1`, `?`, `.bind(...)`). Never build SQL with `format!` from external input. Identifiers (table, column, schema names) cannot be bound: validate them against an allowlist or a strict pattern, then quote them.
- **No secrets in logs, `Debug` output, CLI arguments, or URLs.** Hold credentials in a wrapper that redacts itself in `Debug` (the `secrecy` crate's `SecretString`, or a newtype with a manual `Debug` impl). A `#[derive(Debug)]` on a config struct with a plain `password: String` field prints the password in the first error report.
- **TLS verification stays on.** Never `danger_accept_invalid_certs(true)` or an equivalent, outside a test against a local fake.
- **No shell.** Run subprocesses with `std::process::Command::new(program).args([...])`, never `Command::new("sh").arg("-c").arg(string_built_from_input)`.
- **Bound what you deserialize.** Limit message and frame sizes before you allocate for them; a length prefix from the network is untrusted.
- **New dependencies are reviewed.** Build scripts and procedural macros run arbitrary code on every build machine. Check maintenance, downloads, and `unsafe` use before adding a crate, and run the project's `cargo deny` / `cargo audit` checks.

When the task touches credentials, auth, endpoints, file permissions, external paths, or dependencies, read `references/security.md` for the full standard.

## Testing

- **Unit tests live next to the code** in a `#[cfg(test)] mod tests { use super::*; ... }` block at the bottom of the module, so they can test private functions. **Integration tests** live in `tests/` and use only the public API.
- **Inject the dependency, fake the dependency.** A fake `Sink` that records batches and a fake `Clock` you advance beat a mocking framework, and beat patching. Unit tests make no network calls; put tests that need real infrastructure behind `#[ignore]` or a cargo feature, and say how to run them.
- **Deterministic time.** Use `#[tokio::test(start_paused = true)]` and `tokio::time::advance` (Tokio's `test-util` feature) instead of real sleeps.
- **Hit the edge cases explicitly**: empty input, one element, exactly at the batch limit, one past it, a full channel, a closed channel, a dropped future mid-flush, retry exhaustion, a partial batch failure, a malformed record, a config missing a required key.
- **Property-based tests where a law holds for every input**: a round-trip (`decode(encode(r)) == r`), an invariant (a batcher never emits more than `max_rows`), idempotency, or equivalence with a simple reference implementation. Use `proptest` when the project declares it; when it doesn't, write example-based tests and recommend it to the user rather than adding the dependency. Keep the named edge-case tests too: they document intent.
- **Benchmarks** for code with a throughput or latency target live in `benches/` (Criterion, `harness = false`) and run against release builds. A benchmark is not a test; it does not replace one.
- **Fix a flaky test; don't mask it.** A test that varies between identical runs has a cause: shared state, real time, unseeded randomness, a race, task scheduling order, or the network. Find and fix it. Don't add `#[ignore]`, a sleep, or a retry to make it pass. If you cannot find the cause, delete the test and record why and which behavior now has no test.
- **Name tests by what they assert**: `flush_emits_partial_batch_when_max_age_elapses`, not `test_flush_2`.
- **Don't game the tests.** No special cases that exist only to make a test pass. If a test is wrong, say so instead of working around it.
