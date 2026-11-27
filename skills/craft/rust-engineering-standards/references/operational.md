# Operational Concerns

## Contents

- CLI & entrypoints
- Configuration
- Secrets & credentials
- Observability
- Checkpoints & idempotency
- Streaming over buffering
- Packaging & deployment

Check the versions and feature flags of `clap`, `tracing-subscriber`, and any config crate in `Cargo.lock` / `Cargo.toml` before you copy a snippet: derive attributes and builder methods differ between releases, and several items below need a feature (`clap`'s `derive` and `env`, `tracing-subscriber`'s `env-filter` and `json`).

## CLI & entrypoints

`main.rs` does five things and nothing else: parse arguments, build config, install tracing, wire concrete types, run, and map the outcome to an exit code.

```rust
use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;

#[derive(Parser)]
#[command(version, about)]
struct Cli {
    /// Path to the engine config file.
    #[arg(long, env = "ENGINE_CONFIG")]
    config: PathBuf,

    /// Read from sources and log what would be written, without writing.
    #[arg(long)]
    dry_run: bool,
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse(); // prints usage and exits with status 2 on bad arguments
    let config = match engine_cli::config::load(&cli.config) {
        Ok(config) => config,
        Err(e) => {
            eprintln!("invalid configuration: {e:#}"); // tracing is not installed yet
            return ExitCode::from(EXIT_CONFIG);
        }
    };
    engine_cli::telemetry::init(config.log_format);

    match engine_cli::run(config, cli.dry_run).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!(error = format!("{e:#}"), "engine stopped with an error");
            ExitCode::FAILURE
        }
    }
}

const EXIT_CONFIG: u8 = 78; // EX_CONFIG from sysexits.h
```

- **Exit codes mean something to the platform.** `0` is success, `1` a runtime failure, `2` a usage error (clap's default). A distinct code for configuration errors lets an operator tell "bad deploy" from "transient failure" at a glance.
- `{e:#}` on an `anyhow::Error` prints the whole context chain on one line (`opening slot "engine_1": connection refused`). `{e:?}` prints it as a multi-line report with a backtrace when `RUST_BACKTRACE=1`.
- **Dry-run is a real mode, not a flag check scattered through the code.** Pass a sink implementation that logs instead of writing; the rest of the pipeline runs unchanged.

## Configuration

Layer configuration from least to most specific: built-in defaults, then a config file, then environment variables, then CLI arguments. Merge once at startup into one typed struct, validate it, and pass it down. Code below `main` never reads environment variables or files for settings.

```rust
#[derive(Debug, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawConfig {
    pub max_batch_rows: usize,
    #[serde(with = "humantime_serde")]
    pub max_batch_age: Duration,
    pub channel_capacity: usize,
    pub snowflake: SnowflakeConfig,
}

pub struct Config { /* validated fields, newtypes where a value has rules */ }

impl TryFrom<RawConfig> for Config {
    type Error = ConfigError;
    fn try_from(raw: RawConfig) -> Result<Self, Self::Error> {
        if raw.max_batch_rows == 0 {
            return Err(ConfigError::Invalid("max_batch_rows must be at least 1"));
        }
        // ...
    }
}
```

- `deny_unknown_fields` turns a typo (`max_batch_row`) into a startup error instead of a silently ignored setting.
- Validate everything at startup and fail fast with a message that names the field and the rule. A bad value found at 3 a.m. on the first large batch is the same bug, found later.
- Durations and sizes are typed (`Duration`, a byte-size newtype), parsed from human-readable strings (`"250ms"`, `"64MiB"`) with whatever parser the project uses, never as bare integers of unstated units.
- Use the config crate the project already has (`figment`, `config`, or hand-rolled merging). For a new project, pick one and keep the layering rules above.
- Log the effective configuration at startup at `info`, with secrets redacted, so an incident starts with what the process actually ran with.

## Secrets & credentials

- **Load secrets at startup** from the platform's secret store (AWS Secrets Manager, SSM Parameter Store, or the task's injected environment) into `SecretString` fields. Never take a secret as a CLI argument: arguments are visible in the process list and in shell history.
- **Prefer short-lived credentials from the platform** (an IAM task role, key-pair auth with a rotated key) over long-lived passwords.
- **Plan for rotation.** A process that runs for weeks outlives a rotated credential. Refresh on an authentication failure (once, then fail) or on a timer, through the composition root, not inside every client call.
- Details on redaction and storage: `security.md`.

## Observability

### Tracing setup

The binary installs one subscriber, once, at startup. JSON for machines, human-readable for local runs, filtered by `RUST_LOG`:

```rust
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init(format: LogFormat) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let registry = tracing_subscriber::registry().with(filter);
    match format {
        LogFormat::Json => registry.with(fmt::layer().json()).init(),
        LogFormat::Pretty => registry.with(fmt::layer()).init(),
    }
}
```

- Open a root span per run (`info_span!("engine", run_id = %run_id)`) and per connector, so every event carries them.
- Filter noisy dependencies in the default directive (`info,hyper=warn,aws_config=warn`) instead of raising your own crates' levels.

### Metrics

Logs say what happened; metrics say how much and how fast. A streaming engine exports at least:

| Metric | Why |
|---|---|
| Events in / out per stage (counters) | Throughput, and where events disappear |
| Batch size in rows and bytes (histograms) | Whether batching works as configured |
| Sink write latency (histogram) | The usual bottleneck |
| End-to-end lag: now minus source event time of the last committed record (gauge) | The number users feel |
| Channel occupancy per link (gauge; `Sender::max_capacity() - Sender::capacity()` on a Tokio `mpsc::Sender`) | Where backpressure is building |
| Retries and dead-lettered records (counters) | Degradation before failure |
| Source-side lag (replication slot retained WAL, consumer offset lag) | Pressure the engine pushes back upstream |

Use the metrics stack the project has (the `metrics` crate with an exporter, OpenTelemetry, or CloudWatch embedded metric format). Increment in the hot path only through cheap handles created once at startup.

### Health

- **Liveness** answers "is the process stuck?": the main loop has made progress recently (a heartbeat timestamp updated per batch or per idle tick). A failed liveness check restarts the container.
- **Readiness** answers "should it get work?": connections are established and the first checkpoint is loaded.
- Alert on lag and on stalled progress, not only on error logs. A pipeline that stopped quietly has no errors.

## Checkpoints & idempotency

A streaming engine delivers at least once: after a crash it resumes from the last committed checkpoint and replays everything after it. Exactly-once results come from making the replay harmless.

- **Commit the checkpoint after the sink acknowledges**, never when the source reads. With parallel writes, commit only the contiguous acknowledged prefix (see `performance.md`, section 5).
- **Make sink writes idempotent.** Give each batch a deterministic identity derived from its source range (start and end LSN, partition and offset range), so a replayed batch is recognized: merge by primary key, deduplicate by source position, or use the sink's own offset tracking when it has one. When the sink stores the last committed offset itself, treat that value as the source of truth on restart rather than a separate checkpoint that can disagree with it.
- **Store checkpoints atomically.** A checkpoint is written in one operation that either fully succeeds or leaves the previous value (a conditional put in DynamoDB, a write-then-rename on a file system). A half-written checkpoint is worse than an old one.
- **Make the run resumable by construction.** Restarting with the same config and checkpoint produces the same output. No step depends on in-memory state that a restart loses.
- **Snapshots and streams meet at a known point.** For CDC, record the stream position at which a snapshot starts, and apply stream changes from that point after the snapshot, deduplicating by key and version.

## Streaming over buffering

Process input incrementally with bounded memory. Read files with `BufReader` and line or frame iterators, consume HTTP bodies and query results as streams, and never `read_to_end` an input whose size you do not control. When an API forces you to buffer, put a size limit on it and fail clearly at the limit.

## Packaging & deployment

- **Commit `Cargo.lock`** for workspaces that build binaries, and build in CI with `--locked` so CI builds exactly what was reviewed.
- **Container images**: a multi-stage Dockerfile that builds in a Rust image and copies only the binary into a small runtime image (distroless or a slim distribution image). Cache dependency builds separately from your source (`cargo-chef` or the build tool's cache mounts) so a one-line change does not rebuild every crate. Run as a non-root user.
- **Build for the deploy architecture.** ARM instances (Graviton) are often cheaper for the same throughput; build an `aarch64` image for them and benchmark on the target, not on your laptop.
- **Embed the version.** `env!("CARGO_PKG_VERSION")` plus the git commit (from a build script or the CI environment) in the startup log and in a metrics label, so every incident names the exact build.
- **Shutdown timing**: set the platform's stop timeout (ECS `stopTimeout`, Kubernetes `terminationGracePeriodSeconds`) longer than the engine's drain timeout plus the final checkpoint write. See `concurrency.md`, section 11.
