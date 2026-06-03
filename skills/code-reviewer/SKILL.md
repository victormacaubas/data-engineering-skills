---
name: code-reviewer
description: Produces a non-destructive, language-agnostic code review as a markdown report under `./reviews/`. Scores security, correctness, performance, architecture, error handling, and readability with severity-counted findings and before/after fixes. Loads a language pack (Python, SQL, JS/TS, React, Terraform) for language-specific footguns. Never edits source. Use whenever the user wants to review, audit, grade, critique, or assess code in any language — a file, module, PR, or branch diff.
---

# Code Reviewer

Produce a written review of code as a markdown artifact, in any language. **This skill is read-only with respect to source files** — it never edits code. The only file it creates is the review report under `./reviews/`.

The guiding principle: act as a thoughtful senior reviewer doing a PR review. Every finding cites a specific line, names the violated principle (e.g., "bare catch-all in a production path", "missing types on a public API", "unbounded read of user-supplied data"), and proposes a concrete before/after fix. The reader should be able to turn the report into PR comments and fixup commits without further interpretation.

The rubric, severity model, and report shape below are **language-agnostic** — they hold whether you're reviewing Python, SQL, TypeScript, a React component, or a Terraform module. The sharp, language-specific footguns live in **language packs** under `references/`, which you load in Step 2 once you know what you're reviewing. The generic core tells you *how to review*; the pack tells you *what tends to go wrong in this language*.

## Step 1: Scope the review

The user will point you at one of three things. Figure out which before you start reading code — the scope determines what "complete review" means.

1. **Specific file(s) or a directory.** User named `src/foo.ts` or `src/foo/`. Review every source file in scope, treating a directory as a cohesive unit (comment on architecture as well as per-file findings).
2. **Git diff / PR changes.** User said "review my PR", "review this branch", "review the changes". Run `git diff <base>...HEAD` (default base: `main`) and review only the changed hunks plus ~10 lines of surrounding context for each hunk. **Don't flag unchanged code as a finding** — the author isn't responsible for it in this PR. You may note unchanged-code issues in "Notes & limitations" if they're load-bearing to a finding.
3. **Ambiguous.** Ask once, then proceed. Prefer the diff scope when there's an unmerged branch with code changes — that's the common PR-review case.

If the scope resolves to zero reviewable source files (e.g., the diff only touches lockfiles or generated output), say so in a short report rather than inventing findings.

## Step 2: Detect language(s) and load the matching pack

Before reading code in depth, identify the languages in scope — from file extensions, shebangs, import syntax, and config files (`pyproject.toml`, `package.json`, `*.tf`, `dbt_project.yml`). Then load the matching language pack(s) so your findings carry language-specific weight instead of staying generic.

| If the scope contains… | Load |
|---|---|
| `.py`, `pyproject.toml`, `requirements.txt` | `references/python.md` |
| `.sql`, `.dbt`, dbt models, warehouse queries | `references/sql.md` |
| `.js`, `.ts`, `.mjs`, `.cjs`, Node/`package.json` (non-React) | `references/javascript-typescript.md` |
| `.jsx`, `.tsx`, React components/hooks | `references/react.md` **and** `references/javascript-typescript.md` |
| `.tf`, `.tfvars`, Terraform/HCL modules | `references/terraform.md` |

Rules for loading:

- **Read the pack(s) fully before scoring.** Each pack maps its footguns onto the six rubric dimensions and adds language-specific calibration hints. It changes what counts as Critical vs. Low in that language.
- **Mixed scope** (e.g., a PR touching Python and SQL, or a `.tsx` file with embedded SQL) — load every relevant pack. A React+TypeScript file needs both `react.md` and `javascript-typescript.md`.
- **No pack for the language in scope** (e.g., Go, Rust, Bash, YAML pipelines). Don't stop — review against the generic rubric below, lean on universal principles, and note in *Notes & limitations* that no dedicated language pack was available so language-specific footguns may be under-covered. If the user reviews this language often, suggest they add a pack (authoring guide and template: `README.md` in this skill's directory — not auto-loaded during a review).

## Step 3: Read thoroughly

Read every file in scope completely before scoring anything. A review that claims "the error handling is weak" without pointing at specific catch clauses is worthless.

- Use `Read` for each file; don't skim with `head`/`tail`.
- Use `Grep` to locate patterns across the codebase you're reviewing (catch-all handlers, debug-print calls, hardcoded secrets, wildcard imports — the packs list the patterns worth grepping per language).
- If the file calls into a module outside scope and the finding depends on the callee's behavior, read the callee too. Speculation is not a finding.

Every finding needs a `file:line` anchor. No anchor, no finding.

### Coverage sweep before you score

Reading top-to-bottom, it's easy to flag the loud problems (a `*` wildcard, a `:latest` tag) and skip the quiet ones sitting one line away. Before scoring, do one deliberate pass to make sure you accounted for every unit of the thing you're reviewing — not just the parts that caught your eye:

- **Enumerate the units.** List the resources / functions / statements in scope (e.g. every IAM statement and every action inside it, every declared resource, every exported function). Confirm you formed a judgment on each — even if the judgment is "fine". A resource you never mention is a resource you never reviewed.
- **Check for what's referenced but not defined.** A name used but not declared in scope (a log group, a bucket, a role, a cluster, an env var) is a common silent gap — either it's managed elsewhere (note it) or it's missing (flag it).
- **Within a permission/capability grant, read every entry, not the headline.** The obvious over-broad item (`IAMFullAccess`) can mask a subtler one next to it (`iam:PassRole`, a resource wildcard). Sweep the whole list.

This is a completeness check, not a second full read — a minute spent here is what separates a specialized review from a skim that found the first three issues.

## Step 4: Build findings against the rubric

Score six dimensions. Weights reflect that a silent-wrong-answer bug or a security hole is costlier than a stylistic nit. The "what it covers" column is the language-agnostic baseline; your loaded language pack sharpens each row with concrete patterns.

| Dimension | Weight | What it covers (language-agnostic) |
|---|---|---|
| **Security** | ×2.0 | Inline security issues catchable in a code review: secrets logged or hardcoded, disabled TLS/cert verification, injection risks (shell, SQL, command, template, unsafe deserialization/eval), input validation missing at trust boundaries, overly broad permissions, secrets or PII in logs. For a comprehensive security audit — dependency CVEs, attack chains, deployment-context analysis, capability abuse — use the `security-analyst` skill. |
| **Correctness & Hidden Bugs** | ×2.0 | Deep scan for bugs the type checker and tests won't catch. Off-by-one, boundary-condition, and range errors. Logic that silently diverges from the docstring/comment/contract or the caller's expectation. State leakage across invocations (shared mutable state, caches without eviction, module/global singletons mutated in place). Time-zone, DST, and clock assumptions. Floating-point equality and accumulation traps. Identity-vs-equality confusion. **Partial/non-unique key defects** — identity, dedup, cache, or skip-if-exists logic keyed on a value that isn't unique across the set (a basename instead of the full path, a prefix, a truncated hash, a join key that isn't a primary key), so distinct items collide: one silently drops, overwrites, or returns a wrong cache hit, and (for joins) rows fan out and downstream aggregates are wrong. This is a silent-wrong-answer bug, **not** a performance one — even when it lives inside a "skip if already processed" or "list what exists" optimization, score it under Correctness, not Performance. Null/undefined/empty handling. Unreachable branches and dead code that signals a stale invariant. Iterator/stream exhaustion footguns. Concurrency hazards: blocking work on the wrong thread/loop, unhandled async failures, fire-and-forget tasks that swallow errors, races on shared state, lock ordering. Resource leaks on exception paths (file/DB/socket/handle not released when the happy path doesn't reach cleanup). The language pack lists the specific shapes these take. |
| **Performance** | ×1.5 | N+1 patterns, unbounded reads/materialization of things advertised as large, missing streaming/pagination, redundant recomputation in hot paths, bad concurrency (unbounded queues, wrong pool/executor for the workload, shared mutable state without synchronization), avoidable allocations in tight loops, missing indexes / full scans (data layer). |
| **Architecture & Design** | ×1.5 | Modularity and separation of concerns, dependency injection over construct-inside, one-way module dependencies, no circular imports, thin entrypoints, DRY. In object-oriented code, apply the **SOLID** lens (single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion); in non-OO languages (SQL, IaC) the same dimension means layering, composability, and blast-radius control — the language pack frames it appropriately. **Design-pattern fit** — flag both directions: (a) a pattern that would clarify the code but is missing (e.g., parallel if/elif/switch branches on a type tag crying out for polymorphism/strategy; repeated connect/retry scaffolding begging for a reusable helper); (b) a pattern applied gratuitously — a factory for a single concrete class, a singleton as global-state laundering, an abstraction with one implementation and no realistic second one coming. Patterns are tools, not goals; raise as a *proposal* with the tradeoff, not a MUST. **Public API & backward compatibility** (diff / PR scope) — flag renamed or removed public symbols, changed signatures, changed return shapes, and silent behavior changes on existing entry points. Call out whether in-repo callers break; if callers are external, note the change needs a deprecation path. |
| **Error Handling & Resilience** | ×1.0 | Specific exception/error types (no bare catch-all without a stated reason), retries only on transient failures with backoff, per-item isolation in batch loops, scoped resource cleanup (context managers / try-finally / RAII / defer), idempotency of re-runs. **Observability & debuggability** — can an on-call engineer diagnose a failure from logs and metrics alone? Flag: missing log lines at meaningful decision points (branch taken, retry attempted, record skipped); error messages that omit the identifier of the failing record ("failed to upload" vs "failed to upload part 7 of s3://bucket/key: <error>"); structured fields buried inside free-text; no correlation/request/job ID threaded through a multi-step pipeline; missing counters or latency histograms on retry/error paths; logs at the wrong level (INFO for a fatal, ERROR for an expected retry). |
| **Readability & Style** | ×1.0 | Conformance to the language's idiomatic style and formatter, naming clarity, function/module length (soft limits ~50 / ~400 lines), no magic numbers, types on public APIs where the language supports them, docstrings/comments on public surface, comment quality (why not what), lazy/structured logging over string-concatenated log lines. The pack carries the language's specific idioms and formatter. |

### Severity buckets

Use these definitions consistently — scores calibrate against them. The language pack may add language-specific examples to each bucket.

- **Critical** — security vulnerability, data-loss risk, production-breaking bug, credential leak, silent data corruption, silent-wrong-answer bug in a core computation, race that can drop records, resource leak guaranteed under a common error path. **Ship-blocker.**
- **High** — likely to cause an incident even if not a vulnerability: bare catch-all that swallows control-flow/programmer errors, unbounded reads on user-supplied data, missing retries on a known-flaky dependency, debug prints in a production path, shared-state race, blocking call on an event loop, fire-and-forget async task whose failures are never observed, time-zone-naive timestamps in a pipeline that crosses regions, public API break without a deprecation path (diff scope), error message that loses the failing identifier.
- **Medium** — quality issues that compound over time: long functions, missing types on public APIs, magic numbers, missing docstrings, missing DI seam (hard to test), config scattered instead of centralized, gratuitous pattern adding indirection with no payoff, missing log line at a non-obvious decision point, missing correlation ID on a multi-step job.
- **Low** — nits and small consistency issues: import ordering, naming tweaks, minor docstring wording, redundant comments, a suggestion to extract a helper, a proposal to adopt a pattern where the existing code is fine but a pattern would read slightly cleaner.

### Scoring bands (0–10) per dimension

Apply the same bands to each dimension so scores are comparable.

- **10** — clean; matches or exceeds the standards for this dimension.
- **8–9** — solid; a handful of Low or at most 1–2 Medium findings.
- **6–7** — workable but with meaningful gaps; 1 High or several Medium findings.
- **4–5** — noticeable risks; multiple High findings, or 1 Critical.
- **1–3** — structural problems; several Critical/High findings across the dimension.
- **0** — dimension essentially unattempted (e.g., no error handling anywhere in the code path).

### Overall score

Weighted average, **rounded to one decimal**:

```
overall = (Security*2.0 + Correctness*2.0 + Performance*1.5 + Architecture*1.5 + ErrorHandling*1.0 + Readability*1.0) / 9.0
```

Show this formula in the report so the reader can trace how the overall was computed.

**Follow this procedure exactly — it is the single source of the headline number.**

1. **Settle the six dimension scores first.** The calibration guardrails below (e.g. "Security ≤ 5 if any Critical exists") shape *which 0–10 number you pick for a dimension*. Once picked, that number is final. There is no second, separately-"capped" set of scores — the cap is already baked into the value you wrote in the Rubric table.
2. **The formula takes the six Rubric-table values verbatim.** Substitute exactly the numbers that appear in your Rubric table. Don't recompute, re-cap, or adjust them on the way into the formula.
3. **Show the arithmetic in one line, in full:** the six substituted products, then the sum, then the division, then the result rounded to one decimal. For example: `(2*2.0 + 6*2.0 + 9*1.5 + 6*1.5 + 6*1.0 + 7*1.0) / 9.0 = (4 + 12 + 13.5 + 9 + 6 + 7) / 9.0 = 51.5 / 9.0 = 5.7`.
4. **Range-check before you write it.** The weighted average must land between your lowest and highest dimension score. If your result is below every dimension score (or above all of them), your arithmetic is wrong — redo the division. (In the example above, 5.7 sits between 2 and 9: plausible. A result like 4.0 would be *below* five of the six scores — an immediate signal the division was botched.)
5. **Write it once.** The Summary's headline number and the Rubric section's computed result are the same number. Never include a second "recalculated" or "with capped scores" formula, a "wait —" correction, or any scratch work. If you catch a mistake while drafting, fix it silently before writing. A report that shows the reviewer second-guessing its own math reads as untrustworthy.

### Calibration guardrails

Scores mean nothing if they drift by reviewer mood. Anchor each score against a concrete question:

- **Security ≤ 5** if any Critical finding exists in this dimension, regardless of how much else is clean. A single secret-leak is a failure.
- **Correctness ≤ 5** if any Critical finding exists in this dimension — silent-wrong-answer bugs, races that can drop records, or resource leaks on a common error path. ≤ 7 if there's a defensible High finding (e.g., time-zone-naive timestamps in single-region code) but no Critical.
- **Error Handling ≤ 6** if there's a bare catch-all in a production path, or a retry loop that retries non-transient errors, or an error message in a batch job that doesn't carry the failing record's identifier.
- **Readability ≤ 7** if any public function lacks a docstring or types (in a language that supports them). ≤ 5 if most of them do.
- **Architecture ≤ 5** if a unit has >3 unrelated responsibilities or constructs its own external clients internally with no injection seam, **or** (diff scope) if a public API break lands without a deprecation path and the authors didn't flag it in the PR description.
- **Performance ≤ 6** if there's an unbounded read or full materialization of something advertised as potentially large (uploads, object-store reads, DB result sets, unpaginated queries).

When waffling between two scores, pick based on the question: **"Would I block merge on this?"** If yes, lean lower. If no, lean higher.

### Don't pad

If the code is clean, the report should be short and the scores should be high. **Never invent findings to make the report look thorough.** A two-finding, 9.2/10 review is more valuable than a ten-finding report with eight fabricated Lows.

## Step 5: Write the report

Write to `./reviews/<YYYY-MM-DD-HHMM>-<scope-slug>.md`. Create `./reviews/` if it doesn't exist.

- `<scope-slug>`: for a file, use the basename without extension (`runner`); for a directory, the directory name (`ingest_pipeline`); for a diff, `pr-<branch-name>` (from `git rev-parse --abbrev-ref HEAD`).
- Before writing, run `git rev-parse HEAD` so you can include the commit SHA. If the working tree is dirty, note `(dirty)` next to the SHA. (Skip silently if the scope isn't a git repo.)

### Finding detail policy by scope

Snippets are great in PR context — a reviewer can paste them straight into a suggestion. In a whole-file or directory review they pile up fast: twenty before/after blocks for style nits bury the two findings that actually matter. Match the density to the scope.

- **Diff / PR scope** — always include a `Before:` and `After:` code block for every finding. PR reviewers expect concrete, pasteable suggestions, and the scope is bounded so the report stays readable.
- **File / directory scope** — include `Before:` / `After:` for **Critical** and **High** findings only. For **Medium** and **Low**, default to a one-line "what to change" description plus a minimal inline reference (single-line code span, or one small block if the change really needs structural context). Include a full snippet only when prose genuinely can't convey the fix.

The aim is that a clean file produces a tight report you can read in one scroll, while a PR produces a report you can act on line-by-line without alt-tabbing to the source.

Use this **exact template** — it's what the user is going to diff across reviews.

````markdown
# Code Review — <scope>

- **Reviewer:** `code-reviewer` skill
- **Language(s):** <e.g., Python; or "TypeScript + SQL"; note which packs were loaded>
- **Date:** <YYYY-MM-DD HH:MM local>
- **Scope:** <files reviewed, or diff spec like `main...HEAD`>
- **Commit:** <git SHA, `(dirty)` if uncommitted changes; omit if not a git repo>
- **Lines reviewed:** <approx loc>

## Summary

**Overall: X.X / 10** (weighted)

<2–4 sentences: the top-line verdict. Lead with the biggest risk, then the biggest strength, then what to fix first. Written like a PR review comment, not a press release.>

## Rubric

| Dimension | Score | Weight | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| Security | X/10 | ×2.0 | N | N | N | N |
| Correctness & Hidden Bugs | X/10 | ×2.0 | N | N | N | N |
| Performance | X/10 | ×1.5 | N | N | N | N |
| Architecture & Design | X/10 | ×1.5 | N | N | N | N |
| Error Handling & Resilience | X/10 | ×1.0 | N | N | N | N |
| Readability & Style | X/10 | ×1.0 | N | N | N | N |

**Weighted formula:** `(Security*2.0 + Correctness*2.0 + Performance*1.5 + Architecture*1.5 + ErrorHandling*1.0 + Readability*1.0) / 9.0 = X.X`

**Totals:** N Critical · N High · N Medium · N Low

## Findings

Findings are grouped by dimension, sorted by severity (Critical → Low) within each group. Each has a stable ID (`[SEC-01]`, `[BUG-02]`, `[ERR-03]`, `[ARCH-04]`, `[PERF-05]`, `[STYLE-06]`) for PR-comment reference. Use `[BUG-NN]` for Correctness & Hidden Bugs findings and `[ARCH-NN]` for Architecture & Design (includes design-pattern and API-contract findings).

### Security

#### [SEC-01] <short title> — **Critical**
- **Where:** `path/to/file.ext:42`
- **Standard:** Secrets & Credentials → "Never log secret values"
- **Problem:** <1–3 sentences explaining the issue and its impact. Name the concrete failure mode — "a single leaked token in the log sink lives forever" beats "this could leak secrets".>
- **Proposed change:** (for Critical / High, or any finding in diff scope — always include Before / After)

  Before:
  ```
  log.info("Connecting with config: %s", config)
  ```

  After:
  ```
  // Log only non-secret fields; never the whole config object.
  log.info("Connecting to %s as %s", config.host, config.user)
  ```

#### [STYLE-01] <short title> — **Low**
- **Where:** `path/to/file.ext:12`
- **Standard:** Style → "<idiom from the language pack>"
- **Problem:** <1 sentence.>
- **Proposed change:** (for Medium / Low in file or directory scope — prose + inline reference is fine; skip Before/After)
  <One line describing the change and a single-line code span if helpful.>

<... more findings, same shape — Critical/High always get Before/After; Medium/Low in file scope usually don't ...>

### Correctness & Hidden Bugs

<Findings from the deep bug scan — off-by-one, silent divergence from contract, concurrency hazards, state leakage, resource leaks on exception paths. If empty, write "No correctness bugs found in scope." rather than omitting the section — readers look for this dimension specifically.>

### Error Handling & Resilience

<Findings on exception/error handling, retries, resource cleanup, logging/observability gaps, error-message quality.>

### Architecture & Design

<Findings on responsibilities, coupling, dependency injection, design-pattern fit (both missing and gratuitous — call the latter out as proposals, not mandates), and — in diff scope — public API and backward-compatibility issues.>

### Performance

<... findings ...>

### Readability & Style

<... findings ...>

## What went well

<3–8 bullets of genuinely good patterns worth copying elsewhere. This isn't filler — a review that's all negative is less useful and the author stops trusting the reviewer. If you truly can't find 3 good things, write fewer; don't invent them.>

## Suggested order of fixes

1. <Critical + related High findings that should land in one PR.>
2. <Next cluster.>
3. <Medium cluster — can be a follow-up.>
4. <Low cluster — optional polish.>

## Notes & limitations

<What you couldn't assess: missing test suite, callers not in scope, external config not in repo, dynamic behavior not visible from static read, no language pack available for part of the scope, etc. Be explicit about the limits of the review so the reader knows what's not covered.>
````

### How to write a good finding

The finding is the atomic unit of a review. Each one has to stand on its own in a PR comment.

**Bad — vague, no anchor, no fix:**
> The error handling in the runner is not great. Some exceptions are caught too broadly and it's hard to debug.

**Good — High severity, specific, anchored, standard cited, concrete fix with Before/After:**
> #### [ERR-02] Bare catch-all swallows cancellation — **High**
> - **Where:** `src/pipeline/runner.py:87`
> - **Standard:** Error Handling & Retries → "Never a bare catch-all. Always catch the specific type."
> - **Problem:** This catch blocks every exception including process-cancellation and keyboard-interrupt, making the process hard to kill during long copies. It also masks programmer errors (attribute/type errors) as if they were transient — they'll be retried instead of failing fast.
> - **Proposed change:**
>
>   Before:
>   ```python
>   try:
>       upload_part(part)
>   except:
>       logger.warning("Part failed; retrying")
>       retry(part)
>   ```
>
>   After:
>   ```python
>   try:
>       upload_part(part)
>   except (ClientError, ConnectionError) as e:
>       logger.warning("Transient error on part %d: %s; retrying", part.index, e)
>       retry(part)
>   ```

**Good — Low severity in file/directory scope, prose + inline reference, no Before/After:**
> #### [STYLE-04] Use a type-safe check rather than a loose comparison — **Low**
> - **Where:** `src/util/parse.ts:123`
> - **Standard:** language pack (idiomatic type checks).
> - **Problem:** `typeof v != "string"` plus a `== null` guard is two checks where one idiomatic guard would do, and the loose `==` invites a coercion bug later.
> - **Proposed change:** Collapse to `if (typeof v !== "string")` and use `===`/`!==` throughout. One-line edit; no structural change.

The second form is the right default for Medium/Low findings in a file or directory review — same information density without the visual weight of a code block. Promote to Before/After only when the change is structural enough that prose alone is ambiguous.

**Good — Correctness & Hidden Bugs finding, silent divergence from contract:**
> #### [BUG-01] `freshness_for(dag)` treats overdue runs as healthy — **Critical**
> - **Where:** `app/domain/freshness.py:58`
> - **Standard:** Correctness & Hidden Bugs (logic must match the documented contract) + Observability (silent wrong answer).
> - **Problem:** The docstring says "returns `STALE` when the last successful run is older than the DAG's SLA". The implementation compares `age` against `sla + grace_period`, where `grace_period` defaults to 30 minutes — so a run 45 minutes past SLA still returns `HEALTHY` silently. The status page shows green for pipelines already breaching. No test covers the `sla < age < sla + grace` window. This is a silent-wrong-answer bug, not a crash — production looks fine until someone notices stale data downstream.
> - **Proposed change:**
>
>   Before:
>   ```python
>   age = now() - dag.last_success_ts
>   if age > dag.sla + GRACE_PERIOD:
>       return Freshness.STALE
>   return Freshness.HEALTHY
>   ```
>
>   After:
>   ```python
>   age = now() - dag.last_success_ts
>   if age > dag.sla:
>       return Freshness.STALE
>   return Freshness.HEALTHY
>   ```
>   Also add a regression test for the `sla < age < sla + GRACE_PERIOD` window. If `GRACE_PERIOD` is genuinely needed for alerting (a different concept), move it to the alerting layer and keep `freshness_for` honest to its contract.

**Good — Design-pattern-for-its-own-sake finding, Medium severity:**
> #### [ARCH-03] `RunnerFactory` wraps a single concrete class — **Medium**
> - **Where:** `src/pipeline/runner_factory.py:1-40`
> - **Standard:** Architecture & Design → "Don't add a pattern without a second implementation in sight."
> - **Problem:** `RunnerFactory.create()` takes a string and always returns `S3ToSnowflakeRunner`. There is no second runner, no configuration branching, no test exercising a different return type. The factory adds 40 lines of indirection and an extra import hop for every caller, with no readability or testability payoff. If a second runner appears later, introducing the factory then is cheap; introducing it now is speculative generalization.
> - **Proposed change:** Delete `RunnerFactory`. Replace `RunnerFactory.create("s3").run(...)` call sites with `S3ToSnowflakeRunner(...).run(...)`. Raise this as a proposal, not a mandate — if the team already has a concrete second runner coming this quarter, ignore the finding. Include the tradeoff in the PR comment so the author can decide with context.

## Hard rules

- **Never edit source files being reviewed.** This skill is read-only. If the user asks "apply these fixes now", tell them this skill only produces the report and offer to apply specific findings as a separate action.
- **Every finding cites `file:line`.** Re-read the file if you have to. No anchor, no finding.
- **No hallucinated issues.** Before raising a finding, confirm it by reading the code. Reviews with fabricated findings destroy trust on the first wrong claim.
- **Don't flag unchanged code in diff scope.** If the user asked for a PR review, the scope is the diff, not the surrounding module.
- **Don't pad.** A clean module deserves a short report with high scores. Inventing Lows to fill a section is worse than leaving the section empty.
- **Correctness bugs need a reproducible story.** Before raising a `[BUG-NN]` finding, write the failure scenario in one sentence: "input X, state Y, observed behavior Z, expected W". If you can't, you're speculating — either read more code until you can, or downgrade it to a Readability/Architecture finding that says "the invariant here is unclear; consider tightening the implementation or the contract."
- **Design-pattern findings are proposals, not mandates.** Patterns are tools. Raise "a pattern would help here" and "this pattern is carrying its weight" findings at Medium or Low unless the missing pattern is actively causing a Critical/High bug (in which case the underlying bug is the finding; the pattern is the fix). State the tradeoff so the author can disagree with context.
- **Tone is senior reviewer.** Direct, specific, actionable. Not cheerleading ("great job!!"), not scolding ("this is bad"). Assume the author is a competent peer who wants concrete feedback.
- **Write once, to the reports folder.** Don't print the report to the terminal instead of writing it — the artifact is the deliverable. After writing, tell the user the path so they can open it.

## When the user wants something slightly different

- **"Just give me the score, skip the findings"** — still write the full report to `./reviews/`, and in your response, paste the Rubric table.
- **"Review only security"** (or "only correctness" / "only bugs") — still run the rubric, but only fill in the requested dimension with findings. Mark other dimensions as "not reviewed in this pass" in the report. Note the reduced scope at the top.
- **"Just do the bug scan"** / **"deep scan for hidden bugs"** — focus on the Correctness & Hidden Bugs dimension only. Skip the other dimension findings, but keep the rubric table and mark the others as "not reviewed in this pass".
- **"Compare against last review"** — find the most recent file in `./reviews/` for this scope, read it, and include a "Since last review" section summarizing which findings were resolved, which remain, and which are new. Put this section right after Summary.
- **"Apply the fixes"** — decline politely: this skill is review-only. Offer to hand the findings to the user so they can ask you to apply specific ones in a fresh turn (a regular coding turn, not this skill).
