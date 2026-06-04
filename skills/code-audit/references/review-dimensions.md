# Review Dimensions

The universal, language-agnostic checklist. These are the categories the reviewer points itself at; language packs (`languages/`) supply the idiom-specific instances. You don't run all 15 at full depth on every review — weight them by what's under review (a new endpoint leans on security / contracts / idempotency; a refactor on architecture / tests / readability). Each finding's `category` field is the kebab-case key in the heading.

> **The three reviewers most often miss:** `idempotency`, `concurrency`, and `resource-lifecycle`. They're invisible on a single happy-path read — they only surface when you ask *"what happens on retry, under concurrency, or on the error path?"* Probe them explicitly rather than waiting for them to jump out.

## `correctness` — Correctness & logic (bugs)

Boundary and off-by-one; null/empty/absent/zero handling; inverted conditions and wrong operators; state-mutation and aliasing bugs; unjustified assumptions about input range/encoding/ordering; float precision and money rounding; identity-vs-equality confusion; logic that silently diverges from the docstring/comment/contract or the caller's expectation; unreachable branches and dead code signalling a stale invariant; iterator/stream exhaustion.

**Partial / non-unique key defects** — identity, dedup, cache, or skip-if-exists logic keyed on a value that isn't unique across the set (a basename instead of the full path, a prefix, a truncated hash, a join key that isn't a primary key), so distinct items collide: one silently drops, overwrites, or returns a wrong cache hit; for joins, rows fan out and downstream aggregates are wrong. This is a **silent-wrong-answer** bug — score it here even when it lives inside a "skip if already processed" or "list what exists" optimization (it is *not* a performance finding).

## `error-handling` — Error handling & failure modes

Swallowed or over-broad catches; errors neither propagated nor logged; missing error paths; cleanup on the error path (don't leak files/connections/locks); partial-failure and rollback handling; actionable messages that don't leak internals; recoverable-vs-fatal distinction; retries only on transient failures with backoff (never on `ValueError`/`403`/`NoSuchKey`); per-item isolation in batch loops so one bad record doesn't kill the batch.

## `idempotency` — Idempotency, retries & side effects

Is the operation safe to retry under at-least-once delivery? Idempotency keys / dedup for writes; side effects that repeat on retry (double charge, double send, duplicate insert); non-idempotent work behind retry logic; upsert vs blind insert; replay safety in message/event consumers; for data pipelines, rerun safety (`MERGE`/`INSERT OVERWRITE` vs append) and convergence (no perpetual diff).

## `concurrency` — Concurrency & shared state

Data races and unsynchronized shared mutable state; check-then-act / read-modify-write atomicity; deadlocks and lock ordering; time-of-check/time-of-use gaps; unbounded concurrency causing exhaustion; blocking calls on async/hot paths; thread-safety of shared objects; fire-and-forget tasks whose failures are never observed.

## `security` — Security

Injection (SQL/command/template); validation and sanitization at trust boundaries; authN/authZ presence and correctness, including object-level access (IDOR); secrets in code/logs/config; unsafe deserialization; path traversal and SSRF; weak crypto, hardcoded keys, poor randomness; PII handling at rest/in transit/in logs; rate limiting on public surfaces; over-broad permissions/grants. Frame against CWE/OWASP categories by name where it helps. *(For a full dependency-CVE + attack-chain + deployment-context audit, that's a dedicated security-audit job, not this code review — note the boundary if asked.)*

## `data-integrity` — Data integrity & persistence

Transaction boundaries and atomicity; no partial-commit windows; constraints/validation at the data layer; migration safety (backward-compatible, reversible); consistency under concurrent writes; unbounded result sets and missing pagination; query correctness, not just speed.

## `resource-lifecycle` — Resource management & lifecycle

Acquire/release symmetry for files, sockets, locks, transactions, multipart uploads; timeouts on **every** external call; bounded buffers and queues; backpressure; cleanup on cancel/shutdown; resources released on the exception path, not just the happy path.

## `api-contracts` — API design & contracts

Backward compatibility and flagged breaking changes (renamed/removed public symbols, changed signatures, changed return shapes, silent behavior changes on existing entry points); clear, minimal, consistent interfaces; inputs/outputs/errors matching the documented contract; versioning and deprecation paths; leaky abstractions; mutable default arguments; defensive boundaries vs over-trusting callers. In diff scope, call out whether in-repo callers break and whether external callers need a deprecation path.

## `architecture` — Architecture & design principles

In object-oriented code apply the **SOLID** lens (single responsibility; open/closed; Liskov substitutability; interface segregation; dependency inversion). In non-OO/declarative code (SQL, IaC) the same dimension means layering, composability, blast-radius control, and module boundaries — the language pack frames it. Plus the broader concerns SOLID serves: coupling and cohesion, dependency direction and no cycles, separation of concerns, appropriate abstraction level, DRY balanced against premature abstraction, composition over inheritance, dependency-injection seams (construct external clients at a composition root, not inside the consumer).

**Design-pattern fit — flag both directions, as proposals not mandates:** (a) a pattern that would clarify the code but is missing (parallel if/elif/switch on a type tag crying out for polymorphism; repeated connect/retry scaffolding begging for a reusable helper); (b) a pattern applied gratuitously (a factory for a single concrete class, a singleton as global-state laundering, an abstraction with one implementation and no realistic second one coming). State the tradeoff so the author can disagree with context.

## `performance` — Performance & efficiency

Avoidable algorithmic complexity; N+1 queries and repeated work; allocations/copies in hot loops; unbounded memory growth; blocking I/O where async fits; cache correctness and invalidation; streaming/pagination for large payloads; missing indexes / full scans at the data layer. **Flag only real impact — no premature-optimization nits.**

## `testing` — Testing & verifiability

New and changed logic covered; edge cases and error paths tested, not just the happy path; assertions that actually assert; determinism (no flakiness from time/random/order/network); test isolation; the right level (unit vs integration) without mocking it into meaninglessness. Edge cases worth demanding: empty input, all-null column, duplicate keys, unexpected types, retry exhaustion, partial batch failure, config missing a required key.

## `observability` — Observability & operability

Logging at correct levels, structured, free of sensitive data; metrics/traces on critical paths; errors carrying enough context to act on — **the failing record's identifier in the message** ("failed to upload part 7 of s3://bucket/key: <error>", not "failed to upload"); a correlation/request/job id threaded through a multi-step pipeline; counters/latency on retry and error paths; feature-flag, rollout, and rollback safety; config externalized rather than hardcoded; graceful degradation. Can an on-call engineer diagnose a failure from logs and metrics alone?

## `dependencies` — Dependencies & supply chain

New dependencies justified, pinned, maintained, and license-clean; known CVEs; transitive bloat; reinventing what the standard library already provides.

## `readability` — Readability & maintainability

Naming; function and module size and nesting depth (soft limits ~50 lines / ~400 lines); dead code and duplication; magic numbers and strings; comments that explain *why* and don't contradict the code; types on public APIs where the language supports them; docstrings on public surface; consistency with existing repo conventions; idiomatic style and formatter conformance (the pack carries the language's specifics).

## `documentation` — Documentation & change communication

Public API documented; migration and breaking-change notes; non-obvious decisions captured; changelog/README updated where it matters.
