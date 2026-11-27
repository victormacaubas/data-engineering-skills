# Security

## Contents

- Credential fields
- Secrets in logs and errors
- Where secrets live
- SQL
- TLS
- Untrusted input and deserialization
- Panics are a denial-of-service
- Subprocesses
- Path handling and file permissions
- Network servers and endpoints
- Dependencies and the supply chain
- `unsafe` and FFI

Check the version of each crate named here in `Cargo.lock` and read that version's docs: `secrecy`, for example, changed its types and traits between releases.

## Credential fields

- Hold passwords, private keys, tokens, and connection strings with credentials in a type that redacts itself: `secrecy::SecretString` (or `SecretBox<T>`), or a newtype with a hand-written `Debug` that prints `[REDACTED]`. Reading the value takes an explicit call (`expose_secret()`), which makes every use visible in review.
- **`#[derive(Debug)]` on a struct with a plain secret field leaks it** the first time the struct appears in an error report or a `?` debug print. Check every config and client struct that holds a credential.
- Never implement or derive `Serialize` for a type holding a secret unless writing it out is the point.
- Call `expose_secret()` as late as possible — at the line that hands the value to the client — and don't store the exposed `&str` in a longer-lived variable.
- Zeroizing on drop (`zeroize`, which `secrecy` uses) limits how long a secret sits in freed memory. It is defense in depth, not a reason to hold secrets longer.

## Secrets in logs and errors

- `#[tracing::instrument]` records every argument by default. Use `skip_all` (or `skip(...)` naming the secret-bearing arguments) on functions that take credentials, configs, or raw payloads.
- **Error messages leak too.** A driver error that includes the connection string, a URL with a token in its query string, or a request dump in a `Debug` impl all end up in logs. Strip credentials from URLs and DSNs before you put them in an error or a span field.
- Don't log full records at `info` or above when they may hold personal or regulated data. Log keys and counts.

## Where secrets live

- Secrets come from the platform's secret store or injected environment at startup, never from source code, never from a committed config file, and never from CLI arguments.
- Files that must hold a secret on disk (a private key for key-pair auth) are created with mode `0o600` and owned by the service user (see *File permissions*).
- Test fixtures use obviously fake values (`test-password`), never a real credential "just for local testing".

## SQL

- **Bind values with placeholders** (`$1`, `?`, or the driver's `.bind(...)`). Never build SQL with `format!` from data that came from outside the process, including config values, table contents, and API responses.
- **Identifiers cannot be bound.** Table, schema, and column names used dynamically (common in CDC and loaders) are validated against an allowlist or a strict pattern (letters, digits, underscore, a length limit) and then quoted with the database's identifier quoting, doubling any embedded quote character. Wrap a validated identifier in a newtype (`struct Ident(String)`) whose only constructor validates, so an unvalidated string cannot reach the SQL builder.
- Where the project uses compile-time checked queries (such as `sqlx::query!`), prefer them for static SQL.
- Grant the engine's database user the minimum it needs: replication and read on the source, insert/merge on the target schema. A connector does not need DDL rights it never uses.

## TLS

- Verification stays on. Never call `danger_accept_invalid_certs(true)`, never install a verifier that accepts everything, and never fall back to plaintext when TLS fails.
- To trust a private CA, add that CA's certificate to the client's root store from config. That fixes the real problem; disabling verification hides it.
- Prefer `rustls` unless the project or a dependency requires OpenSSL. Keep the TLS crate's version current; most TLS advisories are fixed by an update.

## Untrusted input and deserialization

Everything from the network, from a source database, from files you did not write, and from connector processes is untrusted.

- **Limit sizes before allocating.** A length prefix, a `Content-Length`, or a count field in a frame is an attacker-controlled number. Check it against a configured maximum before you allocate a buffer of that size.
- **Bound nesting.** Deeply nested input can exhaust the stack. Use the parser's recursion limit (check that it is on) and don't disable it.
- **Deserialize into typed structs** with `deny_unknown_fields` at configuration boundaries. For data feeds, decide explicitly whether unknown fields are an error or ignored (schema evolution), and write the choice down.
- Never deserialize untrusted input into a format that can construct arbitrary types or run code. Serde's derived deserializers do not, which is a reason to use them.

## Panics are a denial-of-service

A panic on input that an outside party controls stops a task or the process. Code that handles untrusted input never panics on bad data:

- **Slicing a `str` at a byte index that is not a character boundary panics.** `&s[..n]` on UTF-8 input from outside panics on multibyte characters. Use `s.get(..n)`, `char_indices`, or work in bytes.
- `slice[i]`, `.unwrap()`, `.expect()`, and integer overflow in debug builds all panic. Use `.get()`, `?`, and `checked_*` arithmetic on values derived from input.
- Division by zero panics for integers. Check divisors that come from data.
- Isolate per-record processing so one malformed record goes to a dead-letter path instead of stopping the pipeline (see *Isolation boundaries* in `SKILL.md`).

## Subprocesses

- Build commands with `std::process::Command::new(program).args([...])` (or Tokio's equivalent). Arguments are passed directly to the program with no shell interpretation.
- `Command::new("sh").arg("-c").arg(text)` with any part of `text` from input is shell injection. If a shell feature is needed, implement it in Rust.
- Pass secrets to a child process through its standard input or a file with restricted permissions, not as an argument. Use `env_clear()` and add back only the variables the child needs when it should not inherit the parent's environment.
- A spawned child is your resource: wait for it or kill it on every path, and bound what you read from its pipes.

## Path handling and file permissions

- A path built from input is validated before use: reject absolute paths and `..` components, join it to a base directory, canonicalize the result, and check that it still starts with the canonical base. Symlinks inside the base can escape it; canonicalization resolves them.
- Check-then-use on paths is racy (the file can change between the check and the open). Open the file once and work with the handle.
- Create files that hold secrets with restrictive permissions from the start (`std::os::unix::fs::OpenOptionsExt::mode(0o600)`), rather than creating them world-readable and changing the mode afterward.
- Temporary files go through `tempfile` (where the project uses it), which creates them with safe names and permissions.

## Network servers and endpoints

When the engine exposes anything (metrics, health checks, an admin API, a connector protocol listener):

- Limit request body size, header size, and connection count, and set read and write timeouts. A slow client otherwise holds resources indefinitely.
- Admin and debug endpoints are not exposed publicly. Bind them to a private interface or put authentication in front of them.
- Metrics labels never include secrets or unbounded values (user IDs, raw keys); unbounded label values also exhaust the metrics backend's memory.

## Dependencies and the supply chain

- **Every new crate is a decision.** Check that it is maintained (recent releases, open issue response), widely used, and does what you need without a large tree of transitive dependencies. Enable only the features you use.
- **Build scripts (`build.rs`) and procedural macros run arbitrary code** on every machine that builds the project, including CI with its credentials. Treat adding one as adding code you must trust.
- **Run the project's supply-chain checks**: `cargo deny check` (advisories, licenses, banned crates, allowed sources) and `cargo audit` (RustSec advisories). Fix or explicitly accept each finding, with a reason and an expiry, in `deny.toml`.
- Git dependencies are pinned to a commit (`rev = "..."`), never a moving branch.
- Commit `Cargo.lock` for binaries so a fresh build cannot silently pick up a compromised new release.

## `unsafe` and FFI

- Forbid `unsafe_code` by default (see `SKILL.md` and `tooling.md`). Where it is allowed, each block has a `// SAFETY:` comment and the module offers a safe API.
- FFI boundaries validate everything that crosses them: null pointers, lengths, lifetimes of borrowed buffers, and string encoding. A C library's bug becomes your memory-safety bug at that line.
- `unsafe` in dependencies is part of your risk. When choosing between crates, prefer the one with less `unsafe` (`cargo geiger` reports it) for code that handles untrusted input.
- Run tests that exercise `unsafe` code under Miri where the code allows it, and under sanitizers (AddressSanitizer, on nightly) for FFI-heavy code.
