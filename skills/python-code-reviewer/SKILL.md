---
name: python-code-reviewer
description: Produces a non-destructive Python code review as a markdown report under `./reviews/`. Scores security, correctness, performance, architecture, error handling, and readability with severity-counted findings and before/after fixes. Never edits source. Use whenever the user wants to review, audit, grade, critique, or assess Python code — a file, module, PR, or branch diff. Prefer over generic review approaches for Python.
---

# Python Code Reviewer

Produce a written review of Python code as a markdown artifact. **This skill is read-only with respect to source files** — it never edits code. The only file it creates is the review report under `./reviews/`.

The guiding principle: act as a thoughtful senior Python reviewer doing a PR review. Every finding cites a specific line, names the principle from `python-engineering-standards`, and proposes a concrete before/after fix. The reader should be able to turn the report into PR comments and fixup commits without further interpretation.

## Before you start: load the rubric

At the start of every review, load the `python-engineering-standards` skill. It is the **source of truth for the rubric** — every finding should map to a principle there. Cite the section name in each finding (see the template) so the author can look up the reasoning.

If the code violates something the standards don't explicitly cover (e.g., a domain-specific pitfall), you can still raise it — just note that it's "beyond the canonical standards" in the finding.

## Step 0: OpenSpec pre-check (skip if not applicable)

Before anything else, check whether the repo uses OpenSpec to track in-flight work:

```
openspec/changes/               ← run `ls` on top level only, do not recurse into archive/
openspec/changes/archive/       ← ignore this; archived changes are shipped
openspec/specs/                 ← canonical capability specs
```

Three cases:

1. **No `openspec/` directory, or only archived changes.** Skip this step entirely. Do not mention OpenSpec in the report — it adds noise when it doesn't apply.
2. **`openspec/changes/` has non-archived entries but none touch your review scope.** Read each `proposal.md` headline to confirm they're unrelated. Note briefly in *Notes & limitations* that OpenSpec was checked and no active change overlaps. Do not generate a Specification Alignment section.
3. **An active change's scope overlaps the files you're reviewing** (touches the same module / adds-or-modifies-requirements for the same capability). Read that change's `proposal.md`, `design.md` (if present), `tasks.md`, and any file under its `specs/`. Hold those specs in your head as the reviewer's source of truth — they describe what the code *should* be doing right now. Then when reading the source, compare behavior against the spec.

Two signals count as contradiction, not stylistic drift:

- The code contradicts a **SHALL / MUST** requirement in an active spec (e.g., spec says "freshness computation treats overdue jobs as stale", code marks overdue jobs as healthy).
- The code has already implemented a `- [x]` checked task from `tasks.md` in a way that diverges from the proposal's design, *and* the diff is the one that introduced the divergence.

Missing implementation of `- [ ]` (unchecked) tasks is **not** a contradiction — that work hasn't been done yet. Only flag it if the PR claims to complete the task but doesn't.

Any contradictions become a dedicated **Specification Alignment — BLOCKER** section at the top of the report (see template). They don't lower the numeric scores — contradictions are a contract issue, not a quality issue — but they mark the PR as unmergeable until the author either fixes the code or amends the spec.

## Step 1: Scope the review

The user will point you at one of three things. Figure out which before you start reading code — the scope determines what "complete review" means.

1. **Specific file(s) or a directory.** User named `src/foo.py` or `src/foo/`. Review every `.py` file in scope, treating a directory as a cohesive unit (comment on architecture as well as per-file findings).
2. **Git diff / PR changes.** User said "review my PR", "review this branch", "review the changes". Run `git diff <base>...HEAD -- '*.py'` (default base: `main`) and review only the changed hunks plus ~10 lines of surrounding context for each hunk. **Don't flag unchanged code as a finding** — the author isn't responsible for it in this PR. You may note unchanged-code issues in "Notes & limitations" if they're load-bearing to a finding.
3. **Ambiguous.** Ask once, then proceed. Prefer the diff scope when there's an unmerged branch with Python changes — that's the common PR-review case.

If the scope resolves to zero files (e.g., the diff only touches YAML), say so in a short report rather than inventing findings.

## Step 2: Read thoroughly

Read every file in scope completely before scoring anything. A review that claims "the error handling is weak" without pointing at specific `except` clauses is worthless.

- Use `Read` for each file; don't skim with `head`/`tail`.
- Use `Grep` to locate patterns across the codebase you're reviewing (bare excepts, `print(`, mutable defaults, `from x import *`).
- If the file imports from a module outside scope and the finding depends on the callee's behavior, read the callee too. Speculation is not a finding.

Every finding needs a `file:line` anchor. No anchor, no finding.

## Step 3: Build findings against the rubric

Score six dimensions. Weights reflect that a silent-wrong-answer bug or a security hole is costlier than a stylistic nit.

| Dimension | Weight | What it covers |
|---|---|---|
| **Security** | ×2.0 | Secret handling (never logged, never committed), input validation at boundaries, injection risks (shell, SQL, unsafe deserialization), ephemeral storage for key material, log-safe exception messages, rotation-friendly credential reads. |
| **Correctness & Hidden Bugs** | ×2.0 | Deep scan for bugs the compiler and tests won't catch. Off-by-one, boundary-condition, and range errors. Logic that silently diverges from the docstring or the caller's expectation. State leakage across invocations (mutable defaults, class-level mutable containers, module-level caches without eviction). Time-zone and DST assumptions; `datetime.utcnow()` vs `datetime.now(UTC)` mistakes. Floating-point equality and accumulation traps. `==` vs `is` confusion. Unreachable branches and dead code that signals a stale invariant. Iterator exhaustion footguns. Async/concurrency hazards: blocking I/O inside coroutines, unawaited awaitables, fire-and-forget `create_task` that swallows exceptions, `asyncio.gather` without `return_exceptions=` when failures should surface, thread-unsafe shared state, lock-ordering, GIL assumptions that break under multiprocessing. Resource leaks on exception paths (file/DB/socket handles not closed when the happy path doesn't reach `close()`). |
| **Performance** | ×1.5 | N+1 patterns, unbounded `.read()` on streams, missing streaming for large objects, bad concurrency (unbounded queues, shared mutable state without locks, wrong pool type for the workload), hot-path allocations. |
| **SOLID & Architecture** | ×1.5 | Single responsibility, dependency injection over construction-inside, Protocols for structural interfaces, one-way module dependencies (main → core → {models, utils}), no circular imports, thin `main.py`, no god classes. **Design-pattern fit** — flag both directions: (a) a pattern that would clarify the code but is missing (e.g., three parallel if/elif branches on a type tag crying out for Strategy; repeated try/connect/retry scaffolding begging for a context-manager helper); (b) a pattern applied gratuitously — Factory for a single concrete class, Singleton as global-state laundering, Observer where a direct callback would do, abstract base class with one implementation and no realistic second one coming. Patterns are tools, not goals; raise the finding as a *proposal* with the tradeoff, not a MUST. **Public API & backward compatibility** (diff / PR scope only) — flag renamed or removed public symbols, changed function signatures, changed return shapes, and silent behavior changes on existing entry points. Call out whether callers in the same repo would break; if callers are external, note that the change needs a deprecation path. |
| **Error Handling & Resilience** | ×1.0 | Specific `except` types (no bare `except:` / `except Exception:` without reason), retries only on transient failures with backoff, per-item isolation in batch loops, context managers for resources, idempotency of re-runs. **Observability & debuggability** — can an on-call engineer diagnose a failure from the logs and metrics alone? Flag: missing log lines at meaningful decision points (branch taken, retry attempted, record skipped); exception messages that omit the identifier of the failing record ("failed to upload" vs "failed to upload part 7 of s3://bucket/key: <error>"); log payloads that bury structured fields inside free-text; no correlation / request / job ID threaded through a multi-step pipeline; missing counters or latency histograms on retry and error paths; logs emitted at the wrong level (INFO for a fatal, ERROR for an expected retry). |
| **Readability & Style** | ×1.0 | PEP 8 / Black compatibility, naming clarity, function/module length (~50 / ~400 line soft limits), no magic numbers, type hints on public APIs, docstrings on public functions/classes/modules, comment quality (why not what), `%s` lazy formatting in log calls, f-strings elsewhere. |

### Severity buckets

Use these definitions consistently — scores calibrate against them.

- **Critical** — security vulnerability, data-loss risk, production-breaking bug, credential leak, silent data corruption, silent-wrong-answer bug in a core computation, async race that can drop records, resource leak guaranteed under a common error path. **Ship-blocker.**
- **High** — likely to cause an incident even if not a vulnerability: bare `except:`, unbounded memory reads on user-supplied data, missing retries on a known-flaky dependency, `print()` in a production code path, mutable default argument, shared-state race, blocking call inside a coroutine, fire-and-forget `asyncio.create_task` whose exceptions are never observed, time-zone-naive `datetime` in a pipeline that crosses regions, public API break without a deprecation path (diff scope), exception message that loses the failing identifier.
- **Medium** — quality issues that compound over time: long functions (>50 lines), missing type hints on public APIs, magic numbers, missing docstrings, DI seam missing (hard to test), config scattered across the module instead of a `Config` dataclass, gratuitous design pattern adding indirection with no payoff, missing log line at a non-obvious decision point, missing correlation ID on a multi-step job.
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
overall = (Security*2.0 + Correctness*2.0 + Performance*1.5 + SOLID*1.5 + ErrorHandling*1.0 + Readability*1.0) / 9.0
```

Show this formula in the report so the reader can trace how the overall was computed.

A Specification Alignment contradiction (from Step 0) **does not** enter this formula. Contract violations are surfaced as a top-of-report blocker instead of as a numeric penalty, because a PR can be technically clean and still violate the spec, and conversely a PR can be spec-aligned but quality-poor — they're independent signals.

### Calibration guardrails

Scores mean nothing if they drift by reviewer mood. Anchor each score against a concrete question:

- **Security ≤ 5** if any Critical finding exists in this dimension, regardless of how much else is clean. A single secret-leak is a failure.
- **Correctness ≤ 5** if any Critical finding exists in this dimension — silent-wrong-answer bugs, async races that can drop records, or resource leaks on a common error path. ≤ 7 if there's a High finding you can plausibly defend (e.g., time-zone-naive datetimes in single-region code) but no Critical.
- **Error Handling ≤ 6** if there's a bare `except:` in a production path, or any retry loop that retries non-transient errors, or an exception message in a batch job that doesn't carry the failing record's identifier.
- **Readability ≤ 7** if any public function lacks a docstring or type hints. ≤ 5 if most of them do.
- **SOLID ≤ 5** if a class has >3 unrelated responsibilities or constructs its own AWS/DB clients internally with no injection seam, **or** (diff scope) if a public API break lands without a deprecation path and the authors didn't flag it in the PR description.
- **Performance ≤ 6** if there's an unbounded `.read()` or list-materialization of something that's advertised as potentially large (uploads, S3 objects, DB result sets).

When waffling between two scores, pick based on the question: **"Would I block merge on this?"** If yes, lean lower. If no, lean higher.

### Don't pad

If the code is clean, the report should be short and the scores should be high. **Never invent findings to make the report look thorough.** A two-finding, 9.2/10 review is more valuable than a ten-finding report with eight fabricated Lows.

## Step 4: Write the report

Write to `./reviews/<YYYY-MM-DD-HHMM>-<scope-slug>.md`. Create `./reviews/` if it doesn't exist.

- `<scope-slug>`: for a file, use the basename without extension (`runner`); for a directory, the directory name (`s3_to_snowflake_pipeline`); for a diff, `pr-<branch-name>` (from `git rev-parse --abbrev-ref HEAD`).
- Before writing, run `git rev-parse HEAD` so you can include the commit SHA. If the working tree is dirty, note `(dirty)` next to the SHA.

### Finding detail policy by scope

Snippets are great in PR context — a reviewer on GitHub can paste them straight into a suggestion. In a whole-file or directory review they pile up fast: twenty `Before:` / `After:` blocks for style nits bury the two findings that actually matter. Match the density to the scope.

- **Diff / PR scope** — always include a `Before:` and `After:` code block for every finding. PR reviewers expect concrete, pasteable suggestions, and the scope is bounded so the report stays readable.
- **File / directory scope** — include `Before:` / `After:` for **Critical** and **High** findings only. For **Medium** and **Low**, default to a one-line "what to change" description plus a minimal inline reference (single-line code span, or a single small block if the change really needs structural context). Include a full snippet only when prose genuinely can't convey the fix.

The aim is that a clean file produces a tight report you can read in one scroll, while a PR produces a report you can act on line-by-line without alt-tabbing to the source.

Use this **exact template** — it's what downstream tooling expects and it's what the user is going to diff across reviews.

````markdown
# Python Code Review — <scope>

- **Reviewer:** `python-code-reviewer` skill
- **Date:** <YYYY-MM-DD HH:MM local>
- **Scope:** <files reviewed, or diff spec like `main...HEAD`>
- **Commit:** <git SHA, `(dirty)` if uncommitted changes>
- **Lines reviewed:** <approx loc>

## Specification Alignment

<Include this section only when Step 0 determined an active OpenSpec change overlaps the review scope. Use one of two forms.>

<Form A — clean. One line:>
✅ **Aligned.** Checked active OpenSpec changes (`<change-a>`, `<change-b>`); no contradictions found with the code under review.

<Form B — contradiction(s). Upgrade to a blocker block:>
🛑 **BLOCKER — code contradicts an active OpenSpec change.** Merge is not advised until the author either reconciles the code with the spec or amends the proposal.

- **[SPEC-01] <short title>**
  - **Active change:** `openspec/changes/<change-name>/`
  - **Spec reference:** `specs/<capability>/spec.md` → `<requirement heading or anchor>` (quote the SHALL/MUST line verbatim)
  - **Code location:** `path/to/file.py:42`
  - **What the spec says:** <the normative requirement, quoted>
  - **What the code does:** <the observed behavior, with enough detail to point at a specific branch or value>
  - **Resolution options:** (1) change the code to match the spec, or (2) amend the change proposal to reflect the new intent and re-align the tasks list.

<If there are multiple contradictions, list each as [SPEC-02], [SPEC-03], etc. Do not lower the numeric scores below on account of these findings — they're tracked separately because they're a contract issue, not a code-quality issue.>

## Summary

**Overall: X.X / 10** (weighted)

<2–4 sentences: the top-line verdict. Lead with the biggest risk, then the biggest strength, then what to fix first. Written like a PR review comment, not a press release. If there is a Specification Alignment blocker, mention it in the first sentence so the reader doesn't miss it.>

## Rubric

| Dimension | Score | Weight | Critical | High | Medium | Low |
|---|---|---|---|---|---|---|
| Security | X/10 | ×2.0 | N | N | N | N |
| Correctness & Hidden Bugs | X/10 | ×2.0 | N | N | N | N |
| Performance | X/10 | ×1.5 | N | N | N | N |
| SOLID & Architecture | X/10 | ×1.5 | N | N | N | N |
| Error Handling & Resilience | X/10 | ×1.0 | N | N | N | N |
| Readability & Style | X/10 | ×1.0 | N | N | N | N |

**Weighted formula:** `(Security*2.0 + Correctness*2.0 + Performance*1.5 + SOLID*1.5 + ErrorHandling*1.0 + Readability*1.0) / 9.0 = X.X`

**Totals:** N Critical · N High · N Medium · N Low

## Findings

Findings are grouped by dimension, sorted by severity (Critical → Low) within each group. Each has a stable ID (`[SEC-01]`, `[BUG-02]`, `[ERR-03]`, `[ARCH-04]`, `[PERF-05]`, `[STYLE-06]`) for PR-comment reference. Use `[BUG-NN]` for Correctness & Hidden Bugs findings and `[ARCH-NN]` for SOLID & Architecture (includes design-pattern and API-contract findings).

### Security

#### [SEC-01] <short title> — **Critical**
- **Where:** `path/to/file.py:42`
- **Standard:** Secrets & Credentials → "Never log secret values"
- **Problem:** <1–3 sentences explaining the issue and its impact. Name the concrete failure mode — "a single leaked token in CloudWatch lives forever" beats "this could leak secrets".>
- **Proposed change:** (for Critical / High, or any finding in diff scope — always include Before / After)

  Before:
  ```python
  logger.info("Connecting with config: %s", config)
  ```

  After:
  ```python
  # Log only non-secret fields; never the whole config dict.
  logger.info("Connecting to %s as %s", config.host, config.user)
  ```

#### [STYLE-01] <short title> — **Low**
- **Where:** `path/to/file.py:12`
- **Standard:** Style → "PEP 8. 4-space indents, Black-compatible."
- **Problem:** <1 sentence.>
- **Proposed change:** (for Medium / Low in file or directory scope — prose + inline reference is fine; skip Before/After)
  Replace `type(v) != str` with `isinstance(v, str)` — catches subclasses and matches idiomatic Python. `pre-commit` won't flag this one on its own; needs a manual edit.

<... more findings, same shape — Critical/High always get Before/After; Medium/Low in file scope usually don't ...>

### Correctness & Hidden Bugs

<Findings from the deep bug scan — off-by-one, silent divergence from docstring, async/concurrency hazards, state leakage, resource leaks on exception paths. If empty, write "No correctness bugs found in scope." rather than omitting the section — readers look for this dimension specifically.>

### Error Handling & Resilience

<Findings on exception handling, retries, resource cleanup, logging/observability gaps, exception-message quality.>

### SOLID & Architecture

<Findings on responsibilities, coupling, dependency injection, design-pattern fit (both missing and gratuitous — call the latter out as proposals, not mandates), and — in diff scope — public API and backward-compatibility issues.>

### Performance

<... findings ...>

### Readability & Style

<... findings ...>

## What went well

<3–8 bullets of genuinely good patterns worth copying elsewhere. This isn't filler — a review that's all negative is less useful and the author stops trusting the reviewer. If you truly can't find 3 good things, write fewer; don't invent them.>

## Suggested order of fixes

1. <Specification Alignment contradictions first, if any — they block merge regardless of scores.>
2. <Cluster of Critical + related High findings that should land in one PR.>
3. <Next cluster.>
4. <Medium cluster — can be a follow-up.>
5. <Low cluster — optional polish.>

## Notes & limitations

<What you couldn't assess: missing test suite, callers not in scope, external config not in repo, dynamic behavior not visible from static read, etc. Be explicit about the limits of the review so the reader knows what's not covered. If Step 0 found active OpenSpec changes that didn't overlap scope, mention that here: "Active OpenSpec changes `<change-a>`, `<change-b>` were checked; neither touches the files in scope.">
````

### How to write a good finding

The finding is the atomic unit of a review. Each one has to stand on its own in a PR comment.

**Bad — vague, no anchor, no fix:**
> The error handling in the runner is not great. Some exceptions are caught too broadly and it's hard to debug.

**Good — High severity, specific, anchored, standard cited, concrete fix with Before/After:**
> #### [ERR-02] Bare `except:` swallows `KeyboardInterrupt` — **High**
> - **Where:** `src/s3_to_snowflake_pipeline/core/runner.py:87`
> - **Standard:** Error Handling & Retries → "Never bare `except:`. Always catch the specific type."
> - **Problem:** This catch blocks every exception including `SystemExit` and `KeyboardInterrupt`, making the process unkillable via Ctrl-C during long S3 copies. It also masks programmer errors (`AttributeError`, `TypeError`) as if they were transient — they'll be retried instead of failing fast.
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
> #### [STYLE-04] Use `isinstance` rather than `type(v) != str` — **Low**
> - **Where:** `src/util/snowflake.py:123`
> - **Standard:** Python-Specific Footguns (idiomatic type checks).
> - **Problem:** `type(v) != str` rejects `str` subclasses (enum string values, `UserString`). `isinstance(v, str)` is the canonical check and works for subclasses without surprise.
> - **Proposed change:** Replace the `type(v) != str` guard with `if not isinstance(v, str):`. One-line edit; no structural change.

The second form is the right default for Medium/Low findings in a file or directory review — you get the same information density without the visual weight of a code block. Promote to Before/After only when the change is structural enough that prose alone is ambiguous.

**Good — Correctness & Hidden Bugs finding, silent divergence from docstring:**
> #### [BUG-01] `freshness_for(dag)` treats overdue runs as healthy — **Critical**
> - **Where:** `apps/backend/app/domain/freshness.py:58`
> - **Standard:** Correctness & Hidden Bugs (logic must match docstring) + Observability (silent wrong answer).
> - **Problem:** The docstring says "returns `STALE` when the last successful run is older than the DAG's SLA". The implementation computes `age = now - last_success_ts` but compares against `sla + grace_period`, where `grace_period` defaults to 30 minutes — so a run that's 45 minutes past SLA still returns `HEALTHY` silently. The status page will show green pipelines that are already breaching. No test covers the `sla < age < sla + grace` window. This is a silent-wrong-answer bug, not a crash — production will look fine until someone notices stale data downstream.
> - **Proposed change:**
>
>   Before:
>   ```python
>   def freshness_for(dag: Dag) -> Freshness:
>       age = datetime.now(UTC) - dag.last_success_ts
>       if age > dag.sla + GRACE_PERIOD:
>           return Freshness.STALE
>       return Freshness.HEALTHY
>   ```
>
>   After:
>   ```python
>   def freshness_for(dag: Dag) -> Freshness:
>       age = datetime.now(UTC) - dag.last_success_ts
>       if age > dag.sla:
>           return Freshness.STALE
>       return Freshness.HEALTHY
>   ```
>   Also add a regression test for the `sla < age < sla + GRACE_PERIOD` window. If `GRACE_PERIOD` is genuinely needed for alerting (different concept), move it to the alerting layer and keep `freshness_for` honest to its docstring.

**Good — Design-pattern-for-its-own-sake finding, Medium severity:**
> #### [ARCH-03] `RunnerFactory` wraps a single concrete class — **Medium**
> - **Where:** `src/pipeline/runner_factory.py:1-40`
> - **Standard:** SOLID & Architecture → "Don't add a pattern without a second implementation in sight."
> - **Problem:** `RunnerFactory.create()` takes a string and always returns `S3ToSnowflakeRunner`. There is no second runner, no configuration branching, and no test that exercises a different return type. The factory adds 40 lines of indirection and an extra import hop for every caller, with no readability or testability payoff. If a second runner appears later, introducing the factory at that point is cheap; introducing it now is speculative generalization.
> - **Proposed change:** Delete `RunnerFactory`. Replace `RunnerFactory.create("s3").run(...)` call sites with `S3ToSnowflakeRunner(...).run(...)`. Raise this as a proposal, not a mandate — if the team already has a concrete second runner coming this quarter, ignore the finding. Include the tradeoff in the PR comment so the author can decide with context.

## Hard rules

- **Never edit source files being reviewed.** This skill is read-only. If the user asks "apply these fixes now", tell them this skill only produces the report and offer to apply specific findings as a separate action.
- **Every finding cites `file:line`.** Re-read the file if you have to. No anchor, no finding.
- **No hallucinated issues.** Before raising a finding, confirm it by reading the code. Reviews with fabricated findings destroy trust on the first wrong claim.
- **Don't flag unchanged code in diff scope.** If the user asked for a PR review, the scope is the diff, not the surrounding module.
- **Don't pad.** A clean module deserves a short report with high scores. Inventing Lows to fill a section is worse than leaving the section empty.
- **Correctness bugs need a reproducible story.** Before raising a `[BUG-NN]` finding, write the failure scenario in one sentence: "input X, state Y, observed behavior Z, expected W". If you can't, you're speculating — either read more code until you can, or downgrade it to a Readability/SOLID finding that says "the invariant here is unclear; consider tightening the implementation or the docstring."
- **Design-pattern findings are proposals, not mandates.** Patterns are tools. Raise "a pattern would help here" and "this pattern is carrying its weight" findings at Medium or Low unless the missing pattern is actively causing a Critical/High bug (in which case the underlying bug is the finding; the pattern is the fix). State the tradeoff so the author can disagree with context.
- **Specification Alignment is a contract check, not a quality score.** If Step 0 finds contradictions, they live in their own top-of-report section and must not change the numeric scores. Conversely, don't bury a spec contradiction inside SOLID — readers skim for the blocker section.
- **Tone is senior reviewer.** Direct, specific, actionable. Not cheerleading ("great job!!"), not scolding ("this is bad"). Assume the author is a competent peer who wants concrete feedback.
- **Write once, to the reports folder.** Don't print the report to the terminal instead of writing it — the artifact is the deliverable. After writing, tell the user the path so they can open it.

## When the user wants something slightly different

- **"Just give me the score, skip the findings"** — still write the full report to `./reviews/`, and in your response, paste the Rubric table.
- **"Review only security"** (or "only correctness" / "only bugs") — still run the rubric, but only fill in the requested dimension with findings. Mark other dimensions as "not reviewed in this pass" in the report. Note the reduced scope at the top.
- **"Just do the bug scan"** / **"deep scan for hidden bugs"** — run Step 0 (OpenSpec) and focus on the Correctness & Hidden Bugs dimension only. Skip the other dimension findings, but keep the rubric table and mark the others as "not reviewed in this pass". Keep the Specification Alignment section if applicable — it's cheap and high-value.
- **"Check if we're still aligned with the spec"** — run Step 0 thoroughly. If there are active changes overlapping scope, produce the Specification Alignment section as the primary deliverable; the rubric can be shorter or note "quality axes not reviewed in this pass". If there are no active changes, tell the user plainly — don't manufacture a section.
- **"Compare against last review"** — find the most recent file in `./reviews/` for this scope, read it, and include a "Since last review" section summarizing which findings were resolved, which remain, and which are new. Put this section right after Summary.
- **"Apply the fixes"** — decline politely: this skill is review-only. Offer to hand the findings to the user so they can ask you to apply specific ones in a fresh turn (a regular coding turn, not this skill).
