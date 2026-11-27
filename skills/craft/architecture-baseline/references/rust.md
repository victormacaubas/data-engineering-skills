# Language Pack: Rust

Concrete crate and module layouts, declarations, seam choices, testing homes, enforcement config, registry test, and `verify` examples for Rust projects. Load this pack once the project is confirmed as Rust. Coherent tooling config that already exists in the repo wins over the defaults below.

**Don't copy version numbers from an example.** Take the toolchain version from `rustc --version`, the edition from `cargo new` on that toolchain, crate versions from `cargo add` or `Cargo.lock`, and hook revisions from `pre-commit autoupdate`. A version copied from a reference file is stale on the day it lands.

## Contents

- Archetypes and layer map
- Dependencies checklist (Decision 2)
- Declarations and doc comments
- Testing homes and conventions
- Enforcement toolchain (`cargo`, `[workspace.lints]`, `clippy.toml`, `deny.toml`)
- Intra-crate module boundaries
- The gate and three-tier hooks
- The rules registry test (`tests/rules_registry.rs`)
- Verify skill examples

## Archetypes and layer map

Start with the smallest shape that fits. A single package with `src/lib.rs` and a thin `src/main.rs` turns into a workspace in an afternoon; a premature six-crate workspace costs a `Cargo.toml` per crate from day one. Split into workspace crates when a boundary earns its compile boundary: hard compile-time layer enforcement, separate vendor dependency trees (connectors), or a second binary.

| What you're building | Archetype | Shape |
|---|---|---|
| Long-running engine with pluggable sources/sinks | Streaming engine / pipeline workspace | Virtual workspace: core crate, one crate per connector, one binary crate |
| HTTP or gRPC server | Service | One package (`src/lib.rs` + thin `src/main.rs`); workspace when a second binary or heavy optional adapter arrives |
| Multi-command developer tool | CLI tool | One package (`src/lib.rs` + thin `src/main.rs`) |
| Crate others import | Library | One library package (`src/lib.rs`), no `src/main.rs` |

### Streaming engine / data pipeline workspace

```
my-engine/
├── Cargo.toml                 # [workspace]: members, shared deps, shared lints, profiles
├── Cargo.lock                 # committed: this workspace builds binaries
├── rust-toolchain.toml
├── deny.toml
├── clippy.toml
└── crates/
    ├── engine-core/
    │   ├── Cargo.toml         # no vendor SDKs; defines traits, domain types, pipeline
    │   └── src/
    │       ├── lib.rs         # module declarations and public re-exports only
    │       ├── record.rs      # shared record/batch/identity newtypes
    │       ├── source.rs      # trait Source and SourceError
    │       ├── sink.rs        # trait Sink and SinkError
    │       ├── checkpoint.rs  # trait CheckpointStore and Checkpoint type
    │       └── pipeline.rs    # runner: source → buffer → sink, backpressure, shutdown
    ├── source-postgres/       # implements Source; owns its Postgres client
    ├── sink-snowflake/        # implements Sink; owns its Snowflake client
    └── engine-cli/
        ├── Cargo.toml         # composition root; wires concrete adapters
        └── src/
            ├── main.rs        # parse args, load config, init tracing, wire, run, ExitCode
            └── config.rs      # layered typed config, validated at startup
```

`engine-core` depends on no vendor client. Each connector crate depends on `engine-core` and its own client crates — connectors never depend on each other. `engine-cli` is the only crate that knows concrete adapter types.

### Service

```
my-service/
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── deny.toml
├── clippy.toml
└── src/
    ├── main.rs        # runtime, config, tracing, AppState, bind, serve, graceful shutdown
    ├── lib.rs         # module declarations and public re-exports
    ├── error.rs       # domain error taxonomy
    ├── config.rs      # env/file layered settings, fail-fast validation
    ├── state.rs       # shared clients/pools built at composition root
    ├── routes/        # HTTP/gRPC layer; translates wire ↔ domain
    ├── domain/        # domain types, traits, business logic; no web framework imports
    └── store/         # database implementations; owns SQL and driver types
```

### CLI tool

```
my-tool/
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── deny.toml
├── clippy.toml
└── src/
    ├── main.rs        # parse with clap, wire deps, print output, return ExitCode
    ├── lib.rs         # module declarations and public re-exports
    ├── error.rs       # domain error taxonomy
    ├── cli.rs         # clap derive structs
    └── commands/      # one module per subcommand; return values/errors, never exit directly
```

### Library crate

```
my-lib/
├── Cargo.toml
├── rust-toolchain.toml
├── deny.toml
├── clippy.toml
└── src/
    ├── lib.rs         # //! crate docs, module declarations, public re-exports
    ├── error.rs       # public error enum (thiserror)
    └── ...domain modules
```

A library installs no `tracing` subscriber, creates no async runtime, sets no `#[global_allocator]`, and keeps default features small. Record `Cargo.lock` policy explicitly in ADR 0002 (committed for binaries/workspaces; omitted or policy-driven for standalone libraries).

### Why dependencies flow one way

- **Keep `src/main.rs` thin.** Logic in `main.rs` cannot be imported by integration tests in `tests/` or reused; put logic in `src/lib.rs` (or library crates) and keep `main.rs` to argument parsing, config loading, telemetry initialization, composition-root wiring, and `ExitCode` mapping.
- **Crate boundaries are compiler-enforced.** Cargo forbids crate cycles and refuses any import from a crate not listed in `[dependencies]`. `engine-cli → connectors → engine-core` cannot be violated by accident.
- **Inside one crate, module cycles compile — treat them as layering errors.** Move shared types into a lower module (`domain/` or `record.rs`) rather than letting sibling modules import each other.
- **Use `foo.rs` + `foo/` rather than `foo/mod.rs`**, unless the repo already uses `mod.rs`.

### The layer table

For a workspace, list **crates** (and any sub-layer rules inside a crate):

| Crate | May depend on | Owns |
|---|---|---|
| `engine-cli` | all crates below | CLI parsing, config loading, tracing setup, composition root, exit codes |
| `source-*` / `sink-*` | `engine-core` | one external system's client, wire types, and error translation |
| `engine-core` | no workspace crates | domain types, seam traits, error enums, pipeline orchestration |

For a single crate, list **modules** under `src/` (`main` → `routes`/`commands` → `domain` → `store` where `store` implements traits defined in `domain`) and note honestly in ADR 0001 and `docs/rules.yaml` which module boundaries are enforced by review until promoted to crates.

## Dependencies checklist (Decision 2)

Rust's standard library is intentionally minimal, so Decision 2 settles more than in a batteries-included language. Decide each explicitly and record exclusions:

- **Toolchain & edition:** pinned stable version in `rust-toolchain.toml`; newest stable edition from `cargo new`; `rust-version` (MSRV) if building a library.
- **Async runtime:** Tokio with **explicit feature flags** (`["rt-multi-thread", "macros", "sync", "time", "signal"]` — never `features = ["full"]`), or **sync-only** (no async runtime at all).
- **Entrypoint / transport:** `clap` (derive) for CLIs, web/RPC framework (`axum`, `tonic`, etc.) for services, or none for libraries.
- **Errors:** `thiserror` for library/core error enums; `anyhow` (or equivalent) for binary context chains.
- **Serialization & config:** `serde` + wire formats (`serde_json`, Arrow/Parquet, etc.) and layered config strategy (`figment`, `config`, or typed `RawConfig` + `TryFrom`).
- **Observability:** `tracing` + `tracing-subscriber` (installed only in `main.rs`) and metrics stack if needed.
- **Persistence, external clients & TLS:** database drivers, HTTP client, cloud SDKs, and TLS backend (`rustls` preferred unless a dependency requires OpenSSL) — each paired with its owning crate/module.
- **Global allocator:** default system allocator unless a benchmark/soak test justifies `mimalloc`/`jemalloc` (note: static musl builds for high-throughput services warrant revisiting this).
- **Closed-set scope:** adding a crate, enabling a new feature flag, or introducing a proc-macro / `build.rs` dependency is a Decision 2 change (ADR), not a mid-task detail.

## Declarations and doc comments

- **Domain types (Decision 3):** newtypes (`struct Lsn(u64)`, `struct OrderId(String)`) and enums whose variants carry their own data so invalid states are unrepresentable. For streaming/CDC pipelines, declare the checkpoint/watermark identity alongside the record grain.
- **Seams (Decision 4):** `trait` definitions in `core`/`domain`. Because Rust has no monkey-patching (`@patch`), any dependency that crosses a process boundary, touches the network/clock/filesystem, or is nondeterministic *must* have a trait seam to be unit-testable. Settle two Rust-specific choices per seam at baseline time:
  - **Static dispatch (`struct Pipeline<S: Source, K: Sink>`) vs dynamic dispatch (`Box<dyn Sink>` / `Arc<dyn Sink>`):** static dispatch on hot paths and fixed types; `dyn Trait` when chosen from config at runtime or held in heterogeneous collections.
  - **Async trait style:** for multi-thread Tokio with static dispatch, declare methods returning `impl Future<Output = T> + Send` (so spawned futures stay `Send` and avoid the `async_fn_in_trait` warning); if `dyn Trait` with async methods is needed, settle `async-trait` vs explicit `Pin<Box<dyn Future<...> + Send + '_>>` now so every adapter and fake matches.
  - **Required injection:** accept collaborators directly in `new(...)`, never as `Option<...>` falling back to constructing the real client. Inject `Clock: Send + Sync` (or pass `now`) for wall-clock reads; use `#[tokio::test(start_paused = true)]` for Tokio timers.
- **Errors (Decision 5):**
  - Libraries and core crates define typed error enums with `thiserror` (`error.rs` or per-module). Never expose `anyhow::Error`, `Box<dyn Error>`, or `Result<T, String>` in a library's public API.
  - Adapter crates/modules translate foreign crate errors into domain errors at their boundary via `#[from]` or `map_err`.
  - Where retries apply, put `pub fn is_transient(&self) -> bool` on the domain error enum so retry loops never guess.
  - Never use `panic!` / `.unwrap()` for expected runtime failures; reserve `.expect("...")` for proven invariants with the invariant stated.
  - Binaries map outcomes to `std::process::ExitCode` in one place in `main.rs` (e.g., `0` success, `1` runtime failure, `2` usage/clap, `78` config error).
- **Doc comments (`///` / `//!`):** follow Rustdoc conventions — a one-line summary, then `# Errors`, `# Panics`, `# Safety` (for `unsafe`), and runnable `# Examples` (compiled and run by `cargo test --doc`), plus cancel-safety notes on public `async fn`. Enforced mechanically by Clippy `pedantic`, `missing_docs` on library crates, `cargo test --doc`, and `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps`. Skip docs when the signature already carries the full contract:

```rust
pub fn is_empty(&self) -> bool { ... } // self-describing — no doc comment needed

/// Appends `batch` to the open channel and waits for the server offset.
///
/// Rows are durable once this returns `Ok`. Dropping the future before it
/// completes may leave a partial batch on the server; retry from the last
/// committed checkpoint.
///
/// # Errors
///
/// Returns [`SinkError::Throttled`] when backpressure is requested and
/// [`SinkError::Rejected`] when a row fails validation. Both leave the
/// channel usable.
pub async fn append(&mut self, batch: &RecordBatch) -> Result<Offset, SinkError>
```

## Testing homes and conventions

- **Unit tests** live colocated in `#[cfg(test)] mod tests { use super::*; ... }` at the bottom of each module. **Integration tests** live in `tests/` and exercise only the crate's public API (`lib.rs`).
- **Shared canonical builders and fakes** (so later changes don't copy drifting local fakes):
  - **Workspace:** expose canonical builders and trait fakes (`FakeSource`, `FakeSink`, `FakeClock`) in `engine-core` behind a `test-util` Cargo feature, or in a dedicated `crates/<name>-testkit` dev-dependency crate.
  - **Single crate:** put integration helpers in `tests/common/mod.rs` and shared unit fakes in a `#[cfg(test)] pub(crate) mod test_support` module.
- **Excluding real-infrastructure tests from the default gate:** Rust has no pytest marker config; mark tests that need real infrastructure or credentials with `#[ignore = "requires real infrastructure"]` (or gate them behind a dedicated Cargo feature such as `--features integration-tests` when they pull heavy dev-dependencies). Default `cargo test` / `cargo nextest run` skips `#[ignore]` tests automatically and still runs `tests/rules_registry.rs`. Run the integration lane explicitly where credentials exist:
  - `cargo test --workspace --locked -- --ignored`
  - or with nextest: `cargo nextest run --workspace --locked --run-ignored ignored-only`
- **No network in unit tests:** enforced by requiring trait seams (Decision 4) and `#[ignore]` / feature-gating real-infra tests, plus a review rule in `docs/rules.yaml` if needed.
- **Test runner:** `cargo test` runs unit, integration, and doc tests. If the project adopts `cargo nextest run`, always pair it with `cargo test --doc` because nextest does not run doctests.
- **Additional lanes when relevant:** property-based tests (`proptest`) for round-trips/invariants, allocation-count tests (`dhat`) for hot paths, Miri (`cargo +nightly miri test`) for any `unsafe`, and Criterion micro-benchmarks in `benches/` (`harness = false`; a benchmark is not a test).

## Enforcement toolchain

### Toolchain pin (`rust-toolchain.toml`)

```toml
[toolchain]
channel = "<stable version from `rustc --version`>"
components = ["rustfmt", "clippy"]
```

### Workspace `Cargo.toml` and `[workspace.lints]`

Configure lints once at the workspace root (or `[lints]` in a single-crate `Cargo.toml`) and inherit in every member with `[lints] workspace = true`:

```toml
[workspace]
members = ["crates/*"]
resolver = "3"          # match the edition generated by `cargo new`

[workspace.lints.rust]
unsafe_code = "forbid"
rust_2018_idioms = { level = "warn", priority = -1 }

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "warn"
dbg_macro = "warn"
todo = "warn"
print_stdout = "warn"
undocumented_unsafe_blocks = "warn"
# Allow pedantic lints the project deliberately opts out of, each with a reason:
must_use_candidate = "allow"
```

- Groups require `priority = -1` so individual lint overrides take effect.
- Library crates add `missing_docs = "warn"` in their own `[lints.rust]` (don't enable it workspace-wide if the workspace contains binaries).
- Code-level exceptions use `#[expect(clippy::lint_name, reason = "...")]`, never `#[allow(...)]`, so stale suppressions fail once no longer needed.
- Optional minimal `rustfmt.toml` using stable options only (`use_field_init_shorthand = true`, `use_try_shorthand = true`).

### `clippy.toml` — test allowances and banned APIs

```toml
allow-unwrap-in-tests = true
allow-expect-in-tests = true

# docs/adr/0004-seams.md
disallowed-methods = [
    { path = "std::time::SystemTime::now", reason = "Read wall-clock time through the Clock seam." },
    # Add crate-specific bans once those dependencies exist, e.g.:
    # { path = "tokio::sync::mpsc::unbounded_channel", reason = "Use bounded channels for backpressure." },
]
```

`disallowed-methods` and `disallowed-types` are Clippy's mechanical equivalent of banned-import rules. Add the ADR comment directly above each entry. For an entry naming a crate not yet in the tree, either add it when the crate lands or set `allow-invalid = true`.

### `deny.toml` — closed dependency set and technology ownership

Initialize with `cargo deny init`, then configure `[advisories]`, `[licenses]`, `[sources]` (forbid unknown registries and unpinned git branches), and `[bans]`.

In a workspace, `[bans]` `wrappers` mechanically enforces Decision 2's technology ownership rule ("only this adapter crate may depend on this vendor crate"):

```toml
[bans]
multiple-versions = "warn"
wildcards = "deny"

# docs/adr/0002-runtime-stack-and-dependencies.md
deny = [
    { crate = "reqwest", wrappers = ["my-http-adapter"], reason = "Only my-http-adapter may depend on reqwest." },
]
```

Put the ADR comment above every ban/wrapper entry.

### Baseline scaffolding and making each contract fail once

At baseline time, create only the crates and modules the layer map names, with minimal compilable declarations (`Cargo.toml`, `src/lib.rs`, domain newtypes, seam traits, error enums, and thin `src/main.rs` if applicable), plus `tests/rules_registry.rs`. Never leave stub function bodies or empty placeholder modules that aren't part of the declared structure.

Before trusting the gate, **make each contract fail once and revert**:
- Add a forbidden dependency (e.g., violate a `deny.toml` `wrappers` rule or add a crate cycle) and confirm `cargo deny check` / `cargo check` fails.
- Call a `disallowed-methods` entry (e.g., `std::time::SystemTime::now()`) and confirm `cargo clippy --workspace --all-targets -- -D warnings` fails.
- Break one entry in `docs/rules.yaml` (bad `source` or unmatched `applies_to`) and confirm `cargo test` fails on `rules_registry`.

Record in ADR 0007 that each check was seen to fail.

## Intra-crate module boundaries

Cargo enforces **crate** boundaries with zero escape hatches, but inside a single crate it does **not** prevent module cycles (`crate::a` ↔ `crate::b`) or stop `domain` from importing `store`. Follow the skill's honesty rule — never pretend a tool checks something it doesn't:

- **Preferred for hard layer contracts:** promote the layer or adapter into its own workspace crate so Cargo + `deny.toml` enforce it mechanically.
- **For a single-crate project before splitting:** optionally add `cargo-modules dependencies --no-externs --acyclic` to the gate to forbid intra-crate module cycles, and record intra-crate module import direction explicitly in `docs/rules.yaml` as review-enforced until the crate splits.

## The gate and three-tier hooks

One command, ordered fast-to-slow (`Makefile` or equivalent `justfile`):

```makefile
.PHONY: check
check:
	cargo fmt --all -- --check
	cargo clippy --workspace --all-targets --locked -- -D warnings
	cargo test --workspace --locked
	RUSTDOCFLAGS="-D warnings" cargo doc --no-deps --workspace
	cargo deny check
```

If using `cargo nextest`, replace `cargo test --workspace --locked` with both `cargo nextest run --workspace --locked` and `cargo test --doc --workspace --locked` so doctests stay in the gate.

`tests/rules_registry.rs` runs inside the `cargo test` step, and `#[ignore]` integration tests are skipped by default so the gate needs no credentials. The gate shows that static checks and tests pass — it does not start the program. Starting the program and driving one flow is the verify skill's job (`references/verify-skill.md`).

CI runs `make check` (or `just check`) — the same command, never a separate step list. Checks run in three tiers:

1. **On each commit**: fast local hooks (`cargo fmt --all -- --check` and `detect-secrets`).
2. **Before a push or a pull request**: `make check` locally via a pre-push hook.
3. **In CI**: the same `make check`, as confirmation.

```yaml
# .pre-commit-config.yaml
minimum_pre_commit_version: "4.4.0"   # language: unsupported
default_install_hook_types: [pre-commit, pre-push]
default_stages: [pre-commit]
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: <current release>   # filled in by `pre-commit autoupdate`
    hooks:
      - id: detect-secrets
  - repo: local
    hooks:
      - id: cargo-fmt
        name: cargo fmt
        entry: cargo fmt --all -- --check
        language: system
        types: [rust]
        pass_filenames: false
      - id: gate
        name: make check
        entry: make check
        language: unsupported
        pass_filenames: false
        always_run: true
        stages: [pre-push]
```

Run `pre-commit autoupdate` to pin `detect-secrets` to its current release, then `pre-commit install` so both commit and pre-push hooks are installed.

## The rules registry test

Write `tests/rules_registry.rs` at baseline time (in the root crate, or in `crates/<core>/tests/rules_registry.rs` for a virtual workspace). Add dev-only `serde` (with `derive`), `yaml_serde`, and `glob` via `cargo add --dev`, and record them in ADR 0002 as dev tooling.

```rust
//! The rule registry's references resolve to files that exist.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

const INSTRUCTION_FILES: &[&str] = &["AGENTS.md", "CLAUDE.md"];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Registry {
    #[expect(dead_code, reason = "schema field validated by deny_unknown_fields")]
    version: u32,
    rules: Vec<Entry>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    id: String,
    rule: String,
    applies_to: Vec<String>,
    source: Option<String>,
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .find(|dir| dir.join("docs").join("rules.yaml").is_file())
        .expect("docs/rules.yaml must exist at or above CARGO_MANIFEST_DIR")
        .to_path_buf()
}

fn load_registry(root: &Path) -> Registry {
    let raw = fs::read_to_string(root.join("docs").join("rules.yaml"))
        .expect("docs/rules.yaml must be readable");
    yaml_serde::from_str(&raw).expect("docs/rules.yaml must match the allowed schema")
}

fn pattern_matches(root: &Path, pattern: &str, rule_id: &str) -> bool {
    let check = |pat: &str| {
        let full = root.join(pat);
        let full_str = full.to_str().expect("glob pattern must be valid UTF-8");
        glob::glob(full_str)
            .unwrap_or_else(|e| panic!("invalid glob {pat} in {rule_id}: {e}"))
            .any(|entry| entry.is_ok())
    };
    // The `glob` crate treats trailing `/**` as directories only, so also check `/**/*`.
    if let Some(prefix) = pattern.strip_suffix("/**") {
        check(pattern) || check(&format!("{prefix}/**/*"))
    } else {
        check(pattern)
    }
}

#[test]
fn rule_ids_are_unique() {
    let root = repo_root();
    let registry = load_registry(&root);
    let mut seen = HashSet::new();
    for rule in &registry.rules {
        assert!(!rule.id.trim().is_empty(), "rule id must not be empty");
        assert!(
            seen.insert(rule.id.as_str()),
            "duplicate rule id: {}",
            rule.id
        );
    }
}

#[test]
fn rule_references_resolve() {
    let root = repo_root();
    let registry = load_registry(&root);
    for rule in &registry.rules {
        assert!(
            !rule.rule.trim().is_empty(),
            "rule {} has an empty rule sentence",
            rule.id
        );
        assert!(
            !rule.applies_to.is_empty(),
            "rule {} has no applies_to patterns",
            rule.id
        );
        for pattern in &rule.applies_to {
            assert!(
                pattern_matches(&root, pattern, &rule.id),
                "applies_to {pattern} in {} matches nothing",
                rule.id
            );
        }
        if let Some(source) = &rule.source {
            let file_name = Path::new(source)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            assert!(
                !INSTRUCTION_FILES.contains(&file_name),
                "source {source} in {} is an instruction file",
                rule.id
            );
            assert!(
                root.join(source).is_file(),
                "source {source} in {} does not exist",
                rule.id
            );
        }
    }
}
```

`#[serde(deny_unknown_fields)]` rejects extra keys such as `enforced_by`, keeping the registry from turning into a copy of tool config.

## Verify skill examples

Illustrations of shape for `.claude/skills/verify/SKILL.md` (`references/verify-skill.md`). In a real project, every command comes from the design doc or the person.

**Streaming engine / data pipeline workspace** (`crates/engine-cli/src/main.rs`):
- Start: `cargo run --locked --bin engine-cli -- --config tests/fixtures/local_run.toml --input tests/fixtures/events_small.ndjson --output /tmp/verify_out.ndjson`
- Drive: one run on the 20-event fixture (finite source, local file sink).
- Evidence: exit status; line count and distinct event IDs in `/tmp/verify_out.ndjson`.
- Pass: exit 0, 20 records, 20 distinct `event_id` (matching the declared grain). A second run with the same checkpoint/output yields the same counts.

**Service** (`src/main.rs`):
- Start: `cargo run --locked --bin my-service -- --port 8765`, in the background.
- Drive: `curl -s -w '%{http_code}' -X POST http://127.0.0.1:8765/quotes -H 'content-type: application/json' -d @tests/fixtures/quote_request.json`
- Evidence: the status code and response body. Stop the server after.
- Pass: 201, and the body has `id` and `total` matching the fixture's expected value.

**CLI tool** (`src/main.rs`):
- Start: `cargo run --locked --bin my-tool -- summarize tests/fixtures/sample.log`
- Drive: the one subcommand on the fixture.
- Evidence: exit status and stdout.
- Pass: exit 0, and stdout equals `tests/fixtures/sample.summary.txt`.

**Library crate** (no `main.rs`; public API is the contract):
- Start: `cargo run --locked --example verify -- tests/fixtures/input.txt`
- Drive: one call through the public API in `examples/verify.rs` (importing only public crate-root symbols).
- Evidence: exit status and printed output.
- Pass: exit 0, and output equals `tests/fixtures/input.expected.txt`.
