# Tooling

Use this file when a project has no tooling config to inherit. Checked-in config always wins. Never write a version number from memory: take toolchain versions from `rustc --version` on the machine that scaffolds the project, and crate versions from `cargo add` or `Cargo.lock`.

## Contents

- Toolchain
- Cargo habits
- rustfmt
- Lints: `[lints]` and Clippy
- Tests and coverage
- Supply-chain checks
- pre-commit
- CI order
- Editor
- Nightly-only tools

## Toolchain

Pin the toolchain so every machine and CI build with the same compiler:

```toml
# rust-toolchain.toml
[toolchain]
channel = "<the stable version from `rustc --version`>"
components = ["rustfmt", "clippy"]
# targets = ["aarch64-unknown-linux-gnu"]   # add cross-compile targets you build for
```

- `rustup` reads this file and installs the pinned toolchain on first use in the directory.
- Update the pin on purpose (a dedicated change that also fixes any new lint warnings), not by accident.
- `rust-version` in `Cargo.toml` states the minimum supported Rust version. Set it for libraries others depend on; for an application that only builds with its pinned toolchain, it is optional.
- New crates use the newest stable edition, which `cargo new` writes by default on the pinned toolchain. Don't change an existing crate's edition as a side effect of another change; `cargo fix --edition` is its own change.

## Cargo habits

- `cargo add <crate> [--features ...]` instead of typing a version into `Cargo.toml`. In a workspace, add shared dependencies to `[workspace.dependencies]` and reference them with `{ workspace = true }` in members.
- `cargo build --locked` and `cargo test --locked` in CI, so a stale `Cargo.lock` fails instead of silently updating.
- `cargo tree -i <crate>` shows why a dependency is in the tree; `cargo tree -d` shows duplicate versions.
- `cargo update -p <crate>` updates one dependency; a blanket `cargo update` is its own reviewed change.

## rustfmt

The defaults are the standard. A `rustfmt.toml` is optional; keep it small and use only options that are stable:

```toml
# rustfmt.toml
use_field_init_shorthand = true
use_try_shorthand = true
```

Options such as `group_imports` and `imports_granularity` exist but are unstable and are ignored (with a warning) on a stable toolchain. Don't add them unless the project formats with nightly. The edition comes from `Cargo.toml`.

## Lints: `[lints]` and Clippy

Configure lints once in the workspace `Cargo.toml` and inherit them in each member with `[lints] workspace = true`. This replaces `#![deny(...)]` attributes scattered across crate roots.

```toml
[workspace.lints.rust]
unsafe_code = "forbid"
rust_2018_idioms = { level = "warn", priority = -1 }

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
# Lints that encode the standards in SKILL.md:
unwrap_used = "warn"
dbg_macro = "warn"
todo = "warn"
print_stdout = "warn"
undocumented_unsafe_blocks = "warn"
# Pedantic lints this project finds wrong get allowed here, each with a reason:
must_use_candidate = "allow"   # applied by hand on functions whose result is the point
```

- **Groups need `priority = -1`** so individual lints listed after them override the group. Clippy's `lint_groups_priority` lint reports a missing priority.
- **Warnings fail CI**, not the local build: CI runs `cargo clippy ... -- -D warnings`. Local builds stay usable while you work.
- **`pedantic`** catches real issues for a codebase that cares about quality (casts that truncate, missing `# Errors` and `# Panics` docs, large futures). It also has opinions; allow the ones the project disagrees with in the table above, with a comment, rather than with attributes in the code.
- **Library crates** add `missing_docs = "warn"` in their own `[lints.rust]`, or inherit and extend. Don't put it in the workspace table if the workspace contains binaries, where it adds noise.
- **Exceptions in code** use `#[expect(clippy::lint_name, reason = "...")]`, not `#[allow]`. `expect` warns when the exception is no longer needed, so stale exceptions don't pile up.
- `print_stdout` is warned so stray `println!` debugging gets caught; a CLI whose output is stdout puts `#[expect(clippy::print_stdout, reason = "stdout is the command's output")]` on the output function.

```toml
# clippy.toml
allow-unwrap-in-tests = true
allow-expect-in-tests = true
```

Clippy reads the minimum supported Rust version from `rust-version` in `Cargo.toml` and won't suggest newer APIs.

## Tests and coverage

- `cargo test` runs unit, integration, and doc tests.
- `cargo nextest run` (when the project uses it) runs each test in its own process, in parallel, with clearer output. It **does not run doctests**, so pair it with `cargo test --doc`. Don't configure nextest's retries to hide flaky tests.
- Coverage with `cargo llvm-cov` (when the project uses it). Coverage shows untested code; it doesn't show tested behavior. Don't chase a number with tests that assert nothing.
- `cargo doc --no-deps` with `RUSTDOCFLAGS="-D warnings"` catches broken intra-doc links (``[`SinkError::Throttled`]``) in CI.

## Supply-chain checks

- **`cargo deny`**: generate a starting config with `cargo deny init`, then set the license allow-list, deny unknown registries and git sources, and warn on duplicate versions. Run `cargo deny check` in CI.
- **`cargo audit`** checks `Cargo.lock` against the RustSec advisory database. `cargo deny check advisories` covers the same database; one of the two is enough.
- **Unused dependencies**: `cargo machete` (stable, heuristic) or `cargo udeps` (nightly, precise) when the project uses one.

## pre-commit

When the project uses the pre-commit framework, run the Rust tools as local hooks, so no third-party hook repository needs a pinned version:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: cargo-fmt
        name: cargo fmt
        entry: cargo fmt --all -- --check
        language: system
        types: [rust]
        pass_filenames: false
      - id: cargo-clippy
        name: cargo clippy
        entry: cargo clippy --workspace --all-targets -- -D warnings
        language: system
        types: [rust]
        pass_filenames: false
```

Keep tests out of the pre-commit hook when they take more than a few seconds; CI runs them.

## CI order

Run the cheap checks first so failures come back fast:

1. `cargo fmt --all -- --check`
2. `cargo clippy --workspace --all-targets --locked -- -D warnings`
3. `cargo nextest run --workspace --locked` (or `cargo test --workspace --locked`)
4. `cargo test --doc --workspace --locked` (when using nextest)
5. `cargo doc --no-deps --workspace` with `RUSTDOCFLAGS="-D warnings"`
6. `cargo deny check`

Cache the cargo registry and `target/` between runs, keyed on `Cargo.lock` and the toolchain.

## Editor

rust-analyzer gives type hints, inline errors, and go-to-definition. Set its check command to Clippy (`rust-analyzer.check.command = "clippy"`) so lint warnings show while editing, not first in CI.

## Nightly-only tools

Some tools need a nightly toolchain alongside the pinned stable one. Install nightly without changing the project pin, and invoke it explicitly:

- **Miri** (`cargo +nightly miri test`): detects undefined behavior in `unsafe` code. Install with `rustup +nightly component add miri`.
- **Sanitizers** (`RUSTFLAGS="-Zsanitizer=address" cargo +nightly test --target <host-triple>`): for FFI-heavy code.
- **`cargo udeps`**: precise unused-dependency detection.

Never require nightly to build or test the project itself.
