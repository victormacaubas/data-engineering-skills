# A/B Eval: code-reviewer skill vs freeform baseline

**Target:** `apps/backend/src/airflow_status` + `apps/backend/tests` @ `main@190112a`  
**Date:** 2026-06-05  
**Judge:** independent verification of every finding against source

---

## Cost & logistics

| Metric | ARM-SKILL | ARM-BASELINE |
|--------|-----------|--------------|
| total_tokens | 116,378 | 118,277 |
| duration_ms | 322,493 | 357,501 |
| tool_uses | 42 | 41 |
| Permission issues | Bash denied (all), Write denied | Bash denied (non-pytest), Write denied |
| Test suite run | No (Bash blocked) | Yes (97 passed in 0.39s) |
| Artifact written to disk | No | No |

Both arms hit identical Write permission blocks. BASELINE got partial Bash (test runner only); SKILL got nothing. Neither could save its artifact to `./reviews/`.

---

## Merged findings — independent verification

| # | Finding | Severity (my judgment) | SKILL | BASELINE | Verdict |
|---|---------|----------------------|-------|----------|---------|
| 1 | Startup validation blocks readiness before yield — Airflow-down causes N×30s startup delay | **High** | ARCH-01 (High) | ERR-01 (High) + ARCH-02 (Med, elaboration) | **TRUE POSITIVE** |
| 2 | `Status` Literal defined twice (`core/status.py:18` + `models/wire.py:8`) | Medium | ARCH-02 (Med) | BUG-01 (Med) | **TRUE POSITIVE** |
| 3 | `compute_status_reason` re-derives conditions independently of `status` param | Medium | BUG-01 (Med) | ARCH-01 (Med) | **TRUE POSITIVE** |
| 4 | No early exit in `resolve_airflow_state` when DAG is missing — 5 wasted calls/cycle | Medium | PERF-01 (Med) | PERF-01 (Med) | **TRUE POSITIVE** |
| 5 | HTTP 429 not in retryable statuses | Low–Medium | ERR-01 (Med) | — | **TRUE POSITIVE** |
| 6 | IPv6 `::1` not in HTTP bypass allowlist | Low | SEC-01 (Low) | — | **TRUE POSITIVE** |
| 7 | Wall-clock-dependent 10s assertion window in integration test | Low | BUG-02 (Low) | — | **TRUE POSITIVE** |
| 8 | `force_refresh` return value always discarded at call site | Low | — | ERR-02 (Low) | **TRUE POSITIVE** (style) |
| 9 | `import json` inside test function body | Low | — | STYLE-01 (Low) | **TRUE POSITIVE** (style) |

**False positives: 0 in either arm.** Every finding checked out at the cited anchors.

Note: BASELINE's ARCH-02 ("comment contradicts placement") is the same root cause as Finding 1, not a distinct issue — it was counted as elaboration, not a separate true positive.

---

## Coverage comparison

| Metric | ARM-SKILL | ARM-BASELINE |
|--------|-----------|--------------|
| True positives (distinct) | 7 | 6 (5 distinct + 1 elaboration) |
| False positives | 0 | 0 |
| Missed real issues | 2 (findings 8, 9 — both Low/style) | 3 (findings 5, 6, 7 — one Med + two Low) |
| Caught startup-readiness bug | **Yes** (ARCH-01, High) | **Yes** (ERR-01, High) |

---

## Severity calibration

| # | My severity | SKILL | BASELINE | Calibration |
|---|-------------|-------|----------|-------------|
| 1 | High | High | High | Both correct |
| 2 | Medium | Medium | Medium | Both correct |
| 3 | Medium | Medium | Medium | Both correct |
| 4 | Medium | Medium | Medium | Both correct |
| 5 | Low–Med | Medium | — | Slightly generous (local POC) |
| 6 | Low | Low | — | Correct |
| 7 | Low | Low | — | Correct |
| 8 | Low | — | Low | Correct |
| 9 | Low | — | Low | Correct |

Both arms calibrated well. SKILL's only stretch is calling 429-not-retried "Medium" for a local POC — defensible but slightly generous.

---

## Verdict assessment

### Did the skill arm beat baseline on coverage?
**Yes, marginally.** SKILL caught 7 true positives vs BASELINE's 5–6 distinct findings. SKILL's extras (429 retry, IPv6, wall-clock test) are more substantive than BASELINE's extras (discarded return value, misplaced import). SKILL covered the error-handling and security dimensions that BASELINE missed entirely.

### Did the skill arm beat baseline on precision?
**Tie.** Both achieved 0 false positives. Both anchors were accurate.

### Did the skill arm catch the startup-readiness class?
**Yes.** Both arms caught it and correctly rated it High. SKILL's description was slightly more precise (quantified the worst-case at 300s for 10 entries with the timeout×retry math). BASELINE's explanation was equally detailed and added the operational irony ("the dashboard that should show 'Airflow unreachable' is itself unreachable").

### Verdict comparison
- SKILL: `request_changes` — correct given a High-severity ship-blocker
- BASELINE: `approve_with_comments` — **too lenient** given the startup-readiness bug makes the dashboard unusable during exactly the incident it's supposed to communicate

### Is the skill ready to wrap in an agents/ subagent?

**Almost — two blockers to fix first:**

1. **Artifact persistence.** Both arms failed to save findings to disk (Write tool denied). The skill MUST be able to produce `./reviews/*.json` to be useful in automated pipelines. Either the skill should be granted Write permission for `./reviews/` specifically, or it should fall back to Bash `cat > file` if Write is blocked. This is a harness/permission config issue, not a skill logic issue.

2. **Bash access for test suite.** The skill was denied ALL Bash access while baseline got test-runner access. The skill should minimally have `uv run pytest` permission — running the test suite is explicitly in scope and BASELINE used it to confirm 97 tests pass. Without it, the skill can't confirm theories against live behavior.

**No logic/quality fixes needed in the skill itself.** It outperformed baseline on coverage, matched on precision, caught the target regression class, and its severity calibration was accurate. Once the permission harness grants `Write ./reviews/*` and `Bash uv run pytest`, it's ready for subagent wrapping.
