# Project Layout

## Contents

- Picking an archetype
- Streaming engine / data pipeline workspace
- Service
- CLI tool
- Library crate
- Workspace `Cargo.toml`
- Why the dependencies flow one way
- Adapting the shape

## Picking an archetype

| You are building | Shape |
|---|---|
| A long-running engine with pluggable sources and sinks | Workspace: core crate, one crate per connector, one binary crate |
| An HTTP or gRPC service | One package with `lib.rs` + thin `main.rs`; split into a workspace only when a second binary or a heavy optional dependency appears |
| A command-line tool | One package with `lib.rs` + thin `main.rs` |
| A crate others import | One library package, no `main.rs` |

Start with the smallest shape that fits. A single package with `src/lib.rs` and `src/main.rs` turns into a workspace in an afternoon; a premature workspace of six crates costs a `Cargo.toml` per crate from day one.

## Streaming engine / data pipeline workspace

```
my-engine/
├── Cargo.toml                 # [workspace] only: members, shared deps, shared lints, profiles
├── Cargo.lock                 # committed: this workspace builds binaries
├── rust-toolchain.toml
├── deny.toml
├── crates/
│   ├── engine-core/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs         # module declarations and public re-exports only
│   │       ├── record.rs      # the record/batch types every crate shares
│   │       ├── source.rs      # trait Source and its error type
│   │       ├── sink.rs        # trait Sink and its error type
│   │       ├── checkpoint.rs  # trait CheckpointStore, Checkpoint type
│   │       ├── pipeline.rs    # the runner: source → buffer → sink, backpressure, shutdown
│   │       └── batch.rs       # batching policy (max rows, max bytes, max age)
│   ├── source-postgres/       # implements Source via logical replication
│   ├── source-bluesky/        # implements Source via the firehose
│   ├── sink-snowflake/        # implements Sink
│   ├── checkpoint-dynamodb/   # implements CheckpointStore
│   └── engine-cli/
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs        # parse args, load config, install tracing, wire, run, map exit code
│           └── config.rs      # typed config, layered from file + env + args
├── benches/                   # or per-crate benches/; Criterion, harness = false
└── tests/                     # or per-crate tests/; end-to-end with fake source and sink
```

Rules for this shape:

- `engine-core` depends on no vendor client and no runtime-specific I/O crate beyond what its traits need. It defines the traits; connector crates implement them.
- A connector crate depends on `engine-core` and its own client crates. Connectors never depend on each other.
- `engine-cli` is the only crate that knows every concrete type. It is the composition root.
- Test fakes for `Source`, `Sink`, and `CheckpointStore` live in `engine-core` behind a `test-util` feature (or a dedicated `engine-testkit` crate) so every connector's tests can use them. Don't copy a fake into each crate.
- A connector written in another language (a separate process speaking the connector protocol) gets a thin Rust adapter crate that implements `Source` or `Sink` over the protocol. The core does not know the difference.

## Service

```
my-service/
├── Cargo.toml
└── src/
    ├── main.rs        # build runtime, config, tracing, state; bind; serve; graceful shutdown
    ├── lib.rs
    ├── config.rs
    ├── state.rs       # AppState: clients and pools, built once, shared via Arc
    ├── routes/        # one module per resource; handlers stay thin
    │   └── orders.rs
    ├── domain/        # types and logic, no HTTP types
    │   └── order.rs
    └── store/         # repository traits and their database implementations
        └── orders.rs
```

Handlers translate between HTTP and domain types and call domain logic. Domain code never imports the web framework.

## CLI tool

```
my-tool/
├── Cargo.toml
└── src/
    ├── main.rs        # parse with clap, call lib, print, return ExitCode
    ├── lib.rs
    ├── cli.rs         # clap derive structs
    └── commands/      # one module per subcommand
        ├── sync.rs
        └── inspect.rs
```

`main.rs` handles printing and exit codes; command modules return values and errors, so they can be tested without capturing stdout.

## Library crate

```
my-lib/
├── Cargo.toml
└── src/
    ├── lib.rs         # //! crate docs, module declarations, public re-exports
    ├── error.rs       # the crate's error enum
    └── ...domain modules
```

A library does not commit `Cargo.lock` unless the project's policy says otherwise, installs no `tracing` subscriber, creates no runtime, and keeps its default features small.

## Workspace `Cargo.toml`

The root of a virtual workspace holds what members share, so versions and lints are set once:

```toml
[workspace]
members = ["crates/*"]
resolver = "3"          # take the resolver that matches the workspace's edition

[workspace.package]
edition = "..."         # take from `cargo new` on the pinned toolchain
rust-version = "..."    # the minimum supported Rust version, if the project sets one
license = "..."

[workspace.dependencies]
tokio = { version = "...", features = ["rt-multi-thread", "macros", "sync", "time", "signal"] }
tracing = "..."
thiserror = "..."
engine-core = { path = "crates/engine-core" }

[workspace.lints]
# see references/tooling.md
```

Members inherit with `edition.workspace = true`, `tokio = { workspace = true }`, and `[lints] workspace = true`. Never write a version number from memory into this file: run `cargo add <crate>` (which takes the latest compatible release) or copy the version already in `Cargo.lock`.

Enable only the Tokio features the code uses. `features = ["full"]` compiles everything and hides which capabilities a crate depends on.

## Why the dependencies flow one way

`engine-cli → connectors → engine-core`. Each arrow points toward the crate that changes least. When core changes, every connector may need updating, so core changes rarely and carefully. When a connector's vendor SDK changes, only that crate rebuilds and only that crate's tests run. If core imported a connector, one vendor's breaking release would break the whole engine.

Inside a crate the same rule holds between modules: `pipeline.rs` may use `batch.rs` and `record.rs`; `record.rs` uses neither.

## Adapting the shape

These trees are starting points. Keep a module the project does not need out of it — no empty `store/` for a service without a database. Rename to the project's domain language. When an existing project has a different but coherent layout, follow it.
