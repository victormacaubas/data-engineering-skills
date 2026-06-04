# Severity & Confidence Rubric

Two **orthogonal** axes. Severity is about impact (how bad if real); confidence is about certainty (how sure you are it's real, given you have no runtime context). They are scored independently — a finding can be `critical` severity at `low` confidence (a plausible data-loss path you couldn't fully confirm) or `low` severity at `high` confidence (a definite style nit). Keeping them separate is what lets an orchestrator gate intelligently — e.g. block only on `critical`/`high` at `high` confidence, and treat low-confidence highs as "please verify".

## Severity (impact)

- **`critical`** — security vulnerability, data loss/corruption, credential leak, production-breaking bug, silent-wrong-answer bug in a core computation, a race that can drop records, a resource leak guaranteed under a common error path, a destroy-and-recreate of a stateful resource. **Ship-blocker.**
- **`high`** — likely to cause an incident even if not a vulnerability: bare catch-all that swallows control-flow/programmer errors, unbounded read of user-supplied data, missing retries on a known-flaky dependency, debug prints in a production path, a shared-state race, a blocking call on an event loop, a fire-and-forget async task whose failures are never observed, timezone-naive timestamps in a multi-region pipeline, a public API break with no deprecation path (diff scope), an error message that loses the failing identifier.
- **`medium`** — quality issues that compound over time: long functions, missing types on public APIs, magic numbers, missing docstrings, a missing DI seam (hard to test), config scattered instead of centralized, a gratuitous pattern adding indirection with no payoff, a missing log line at a non-obvious decision point, a missing correlation id on a multi-step job, missing tests on a new code path.
- **`low`** — nits and small consistency issues: import ordering, naming tweaks, minor docstring wording, redundant comments, a suggestion to extract a helper, a proposal to adopt a pattern where the existing code is fine but a pattern would read slightly cleaner.

When waffling between two severities, ask **"Would I block merge on this?"** Yes → lean higher. No → lean lower.

## Confidence (certainty)

- **`high`** — you read the code and the surrounding contract, and the finding holds without needing runtime behavior you can't see. You can write the failure scenario concretely.
- **`medium`** — the finding is well-founded but depends on an assumption about a callee, input distribution, or deployment context you couldn't fully confirm from the code in scope.
- **`low`** — a suspicion worth surfacing, but you could not confirm it. Say so in the `explanation`.

## Calibration discipline

These rules keep scores from drifting by reviewer mood and keep the artifact trustworthy:

- **When uncertain, lower `confidence` — never inflate `severity`.** A reviewer with no runtime context is sometimes wrong; the honest move is to flag impact accurately and let confidence carry the uncertainty. Inflating severity to "make sure it gets attention" poisons the gate.
- **Correctness findings need a one-sentence reproducible story** — "input X, state Y, observed Z, expected W" — embedded in the `explanation`. If you can't write it, you're speculating: downgrade the finding to a `readability`/`architecture` observation ("the invariant here is unclear; consider tightening the contract or the implementation") or drop it.
- **Never invent line numbers or excerpts.** Every `anchor` must quote code you actually read. No anchor (or `scope`, for systemic findings) → no finding.
- **Don't pad.** Clean code yields `verdict: approve` with an empty `findings` array. A two-finding artifact is more valuable than a ten-finding one with eight fabricated lows.
- **Design-pattern findings are proposals.** Raise "a pattern would help" / "this pattern isn't earning its keep" at `medium`/`low` with the tradeoff stated — unless a missing pattern is actively causing a `critical`/`high` bug, in which case the underlying bug is the finding and the pattern is just the fix.

## Severity anchors by category (quick reference)

These mirror the per-language calibration hints in the packs; use them when a pack isn't loaded:

- A secret leaked to logs or hardcoded, an injection surface on untrusted input, or a `0.0.0.0/0` ingress on an admin/DB port → **`critical`** under `security`.
- A join fan-out feeding an aggregate, a non-unique dedup/cache key, or any silent-wrong-answer in a core computation → **`critical`**/**`high`** under `correctness`.
- A bare catch-all in a production path, or a retry loop that retries non-transient errors → **`high`** under `error-handling`.
- An unbounded read / full materialization of something advertised as large → **`high`** under `performance`.
- A unit with >3 unrelated responsibilities, or external clients constructed inside with no injection seam → **`high`**/**`medium`** under `architecture`.
- A public function missing a docstring/types (in a language that supports them) → **`low`**/**`medium`** under `readability`.
