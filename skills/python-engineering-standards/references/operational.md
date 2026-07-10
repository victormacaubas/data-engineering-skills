# Operational Concerns

Patterns for putting Python code into production — the layer that matters once code runs as a job, service, or pipeline rather than just a library someone imports. Load this when the task involves CLI wiring, configuration, secrets, observability, idempotency, streaming, or packaging.

For general Python coding standards (style, typing, DI, error handling, concurrency, testing), the root `SKILL.md` is the source of truth — this file assumes those as given and adds the systems-side concerns on top.

## CLI & Entrypoints

`main.py` should do three things: parse args, build config, call a runner. If you're adding logic to `main`, it belongs in `core/`.

- **Pipelines and batch jobs:** use `argparse`. For multi-command developer tools, `click` or `typer` is appropriate — but the principle is the same: factor parsing into a testable function, keep it explicit, no magic. For services, skip the CLI entirely (config comes from environment/pydantic-settings, not flags).
- Factor `parse_args(argv=None)` into its own function so it's testable.
- `--dryrun` is a first-class flag. Every IO-producing code path respects it and logs `[Dryrun] Would ...`.
- Mutually exclusive modes go in `add_mutually_exclusive_group()`.
- Log the parsed args as JSON at startup — invaluable when debugging what a cron job actually received.
- Return an `int` exit code. `sys.exit(main())` at the bottom.

```python
def main(argv: list[str] | None = None) -> int:
    setup_logging("my_service")
    logger = logging.getLogger()
    try:
        args = parse_args(argv)
        logger.info("CLI args: %s", json.dumps(vars(args)))
        config = build_config_from_env(args.pipeline_name)
        runner = PipelineRunner(config=config)
        summary = runner.run(dryrun=args.dryrun, ...)
        logger.info("Run summary:\n%s", json.dumps(summary, indent=2))
        return 0
    except Exception:
        logger.exception("Unhandled exception in main")
        return 1
```

## Configuration

- Externalize every environment-specific value: bucket names, table names, thresholds, credentials, feature flags.
- Layer config sources in priority order: **env var → secret/parameter store → default**. First hit wins.
- Fail fast on missing required values, and name the **specific** key that's missing. `"Missing required config: SOURCE_BUCKET"` beats `"One or more required values could not be resolved"`.
- Never hard-code credentials. Use Secrets Manager / Parameter Store in production, gitignored `.env` for local.
- A single typed `Config` dataclass beats scattered `os.getenv()` calls across the codebase. Build it once at startup, pass it down.

```python
def build_config_from_env(pipeline_name: str) -> Config:
    def _require(key: str) -> str:
        value = os.getenv(key) or ssm_get_parameter(key, prefix=ssm_prefix)
        if not value:
            raise ValueError(f"Missing required config: {key}")
        return value.strip()
    ...
```

## Secrets & Credentials

- **Never commit secrets.** `.env` files are gitignored; `.env.example` with placeholder keys is not. Scan with `git-secrets` or `detect-secrets` in CI.
- **Never log secret values.** Not the key, not a prefix, not a "this looks safe" fragment. A single leaked token in CloudWatch lives forever.
- **Fetch at the composition/builder boundary, hold briefly.** Don't pass raw secrets through five function boundaries. Resolve them close to where the concrete client or connection is built, scrub error messages there, and pass only typed config, clients, or connections into downstream services.
- **Ephemeral storage for key material.** If you must materialize a key (e.g., PGP private key for `gpg`), use a RAM-backed path (`/dev/shm` on Linux), create the directory with `mode=0o700`, and `shutil.rmtree(..., ignore_errors=True)` in a `finally`. Never write secrets to `/tmp`.
- **Mask in exceptions.** When an exception bubbles up with a config dict in its message, you will leak every secret in the dict to the log pipeline. Wrap secret-bearing calls in try/except and re-raise with a scrubbed message.
- **Rotate-friendly.** Read the secret fresh on each long-running invocation, or cache with a TTL. Hardcoding "fetch once at boot" makes rotation a deploy event.

## Observability

Logging is the floor, not the ceiling. Long-running services and scheduled jobs deserve more:

- **Correlation IDs.** Generate a `run_id` (UUID or timestamp-based) once at startup, thread it through every log line and downstream call. Makes tracing a single run across parallel workers tractable.
- **Health checks.** Any long-lived connection (DB, Snowflake, Redis) should expose a cheap `check_health()` that does `SELECT 1` or equivalent and returns a boolean. Call it after connect, call it before long phases, and log the result.
- **Metrics at phase boundaries.** Emit counters (records processed, bytes copied, retries used) and timings (phase duration) to whatever backend you have — Prometheus, CloudWatch, StatsD, even a structured log line tagged `metric=`. Even without dashboards, these become queryable later.
- **Heartbeats for long phases.** If a single phase can run for 30+ minutes (large S3 copy, big query), log progress at a cadence (every N files, every minute). Silent processes look hung.
- **Alerting channels.** Route `ERROR` and unhandled exceptions to a Slack/Opsgenie integration, not just a log file. Prod failures that nobody sees are worse than failures that crash loudly.

## Idempotency

Pipeline steps must be safe to re-run. Running a job twice should produce the same result as running it once.

- **Skip-if-exists at targets.** HEAD before COPY, `CREATE TABLE IF NOT EXISTS`, `MERGE` (upsert) over `INSERT`.
- **Deterministic keys.** Source key → target key should be a pure function. Retries produce the same target, not a new one.
- **Manifest over scan** at scale. If the "already processed" check requires listing a million-object prefix every run, move to a manifest table (DynamoDB row, DB record, marker file). O(1) lookup beats O(N) list.
- **Resource cleanup in `finally`** — abort multipart uploads, close connections, remove temp directories. Leaked resources accumulate.

## Streaming Over Buffering

For any file whose size is unbounded (user upload, S3 object, API response):

- Stream with iterators/generators, don't `.read()` the whole thing into memory.
- For S3: use the `StreamingBody` from `get_object`; use multipart upload for anything potentially > 100 MB.
- For subprocesses: pipe stdin/stdout through `subprocess.PIPE`, feed and drain concurrently (threaded feeder + main-thread reader) to avoid deadlocks on buffer-full.

## Packaging

- Pin dependencies. `pyproject.toml` with a lockfile (`poetry.lock`, `uv.lock`) or a pinned `requirements.txt`. Audit regularly with `pip-audit`, `uv audit`, or Dependabot/Renovate to catch known CVEs — a vulnerable transitive dependency is still your vulnerability.
- Expose a console script in `pyproject.toml` so the CLI is installable:
  ```toml
  [tool.poetry.scripts]
  my-tool = "my_pkg.main:main"
  ```
- Keep `main` small. If it's growing past ~100 lines, the extra logic belongs in `core/`.
- Ship a `README.md` that explains: what the thing does, how to configure it, how to run it locally, and how to run it in production.
