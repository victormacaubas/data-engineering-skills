---
name: code-audit
description: "Conduct a thorough, language-agnostic code audit of a diff, changeset, pull request, a set of files, or a whole repository and emit a machine-parseable JSON review artifact (a durable cross-session work order) plus an optional human markdown view. Use this whenever the user or an orchestrating agent asks to audit or review code, check a diff before merge, look for bugs/security/regressions/performance issues, grade or assess a codebase, or gate a merge — even if they don't say the word audit. Read-only: never edits source. Produces findings with severity, confidence, excerpt-anchored locations, acceptance criteria, and a verdict, written to ./reviews/<review_id>.json at the project root."
---

# Code Audit

You are a senior code reviewer. Your job: read code, find real issues, write a structured JSON artifact. Everything else is secondary to those three things.

**The artifact** goes to `reviews/<review_id>.json` relative to the project root. It's a cross-session work order — a different agent in a different session must be able to read it, relocate each finding by its code excerpt, apply the fix, and verify it. That's why anchors carry literal excerpts, not just line numbers.

**You are read-only.** Never edit source files. The only files you write are the JSON artifact and, if requested, a markdown view.

## How to review

### 1. Figure out the scope

Determine what you're reviewing — one of three modes:

- **`diff`** — a PR, branch, or "the changes." Review only changed hunks plus enough context to understand the contract. Never flag unchanged code.
- **`paths`** — named files or directories. Review every source file in scope.
- **`repo`** — whole repository. Triage first: deep-review entry points, security-sensitive paths, high-complexity files, churn hotspots. Skim the rest. Record what you covered in the artifact's `coverage` block.

Use `git diff`, `git log`, `git ls-files`, Grep, Glob — whatever gets you the scope fastest.

### 2. Read the code and find issues

Read each in-scope file completely. Then review it.

**What to look for** — the 15 universal categories (use these as the `category` field in findings):

| Key | What it covers |
|-----|---------------|
| `correctness` | Bugs, off-by-one, null/empty handling, wrong operators, silent wrong answers, non-unique keys in dedup/cache logic |
| `error-handling` | Swallowed exceptions, over-broad catches, missing error paths, partial-failure handling |
| `idempotency` | Retry safety, duplicate side effects, non-idempotent work behind retry logic |
| `concurrency` | Races, unsynchronized shared state, check-then-act gaps, deadlocks |
| `security` | Injection, missing auth checks, secrets in code/logs, path traversal, SSRF, weak crypto |
| `data-integrity` | Transaction boundaries, missing constraints, migration safety, consistency under concurrent writes |
| `resource-lifecycle` | Acquire/release symmetry, missing timeouts, unbounded buffers, cleanup on error path |
| `api-contracts` | Breaking changes, signature changes, contract violations, leaky abstractions |
| `architecture` | SOLID violations (OO) or layering/composability (declarative), coupling, missing DI seams |
| `performance` | Algorithmic complexity, N+1 queries, unbounded memory, blocking I/O on async paths |
| `testing` | Missing coverage, weak assertions, flaky tests, wrong test level |
| `observability` | Missing logs/metrics, lost context in errors, no correlation IDs |
| `dependencies` | Unjustified deps, known CVEs, unpinned versions |
| `readability` | Naming, function size, magic values, dead code, missing types on public APIs |
| `documentation` | Missing API docs, undocumented breaking changes |

**Probe explicitly** for `idempotency`, `concurrency`, and `resource-lifecycle` — they're invisible on a happy-path read and are what reviewers most often miss. For each function, ask: what happens on empty input, null input, error return from a callee, concurrent invocation, and retry?

**Be thorough.** Report every real issue you find. A thorough review with 8 findings is better than a timid one with 3. The only constraint: every finding must cite code you actually read. Don't fabricate issues, don't speculate without evidence, don't invent line numbers.

**Language packs.** If the scope contains Python, SQL, JS/TS, React, Terraform, or Bash, and you have budget remaining, read the matching pack from `~/.claude/skills/code-audit/references/languages/` (the index at `references/languages/README.md` maps extensions to packs). Packs sharpen your review with language-specific footguns and grep patterns. They're valuable but not mandatory — a review without them is still valid.

### 3. Write the artifact

**Do this as soon as you have findings.** Don't defer it. Don't plan it. Write it now.

The artifact path: `./reviews/<review_id>.json` at the project root. Create `./reviews/` if it doesn't exist (the Write tool creates parent directories automatically). `review_id` = `review-<YYYY-MM-DD>-<scope-slug>-<short>` (short = a few chars from head SHA).

#### Artifact structure

```json
{
  "schema_version": "1.0",
  "review_id": "rev-2026-06-04-gateway-7f3a",
  "created_at": "2026-06-04T14:22:10Z",
  "reviewer": "<model-identity>",
  "repo": "<org/name or local path>",
  "target": {
    "mode": "diff|paths|repo",
    "base_ref": "main@abc123",
    "head_ref": "feat/x@def456",
    "ref": "main@abc123",
    "scope": ["src/"],
    "excludes": ["**/vendor/**"]
  },
  "conventions": "",
  "verdict": "approve|approve_with_comments|request_changes",
  "summary": "One paragraph for a human glancing at the file.",
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "coverage": null,
  "findings": []
}
```

Target fields by mode:
- `diff` → requires `base_ref`, `head_ref`
- `paths` / `repo` → requires `ref`, `scope`
- `coverage` is required in `repo` mode: `{ "files_in_scope": N, "deep_reviewed": N, "skimmed": N, "skipped": N, "notes": "..." }`

#### Finding structure

```json
{
  "id": "f-<12 hex chars>",
  "severity": "critical|high|medium|low",
  "confidence": "high|medium|low",
  "category": "<one of the 15 keys above>",
  "anchor": {
    "file": "src/gateway/client.py",
    "commit": "3d4e5f0",
    "line_hint": [58, 66],
    "excerpt": "<literal code you read>"
  },
  "title": "Short, specific title",
  "explanation": "What breaks: input X, state Y, observed Z, expected W.",
  "suggestion": "What to change.",
  "acceptance_criteria": "How to know it's fixed.",
  "verification": "pytest tests/... -k retry",
  "proposed_patch": null,
  "status": "open",
  "resolution": null
}
```

**Anchor shapes:**
- **Located** (normal): `file` + `commit` + `line_hint` + `excerpt`
- **Systemic** (no single location): `{ "scope": "repo" }` — omit file/excerpt
- **Repeated antipattern** (same issue in many places): `{ "scope": "file" }` plus `occurrences: N` and `locations: [{ "file", "line_hint", "excerpt" }, ...]` as sibling fields on the finding

**Finding ID:** Generate a unique `f-` prefixed 12-char hex string per finding. Ideally a stable content hash of `category + file + excerpt` so re-reviews produce the same ID for the same issue — but uniqueness matters more than stability.

**Always emit `status: "open"` and `resolution: null`** — a future consumer skill writes these back.

#### After writing

If the user requested a markdown view, you can run `~/.claude/skills/code-audit/scripts/render_report.py ./reviews/<review_id>.json`. Otherwise, just tell them the JSON path.

## Severity (impact)

- **`critical`** — Security vulnerability, data loss/corruption, credential leak, production-breaking bug, silent wrong answers in core computations. Ship-blocker.
- **`high`** — Likely to cause an incident: bare catch-all swallowing control flow, unbounded reads, missing retries on flaky deps, shared-state races, blocking on event loops, public API break with no deprecation.
- **`medium`** — Quality issues that compound: long functions, missing types on public APIs, magic numbers, missing DI seams, scattered config, missing log lines at decision points, missing tests on new code paths.
- **`low`** — Nits: import ordering, naming tweaks, minor docstring wording, suggestions to extract a helper.

**Confidence** (certainty, scored independently from severity):
- **`high`** — You read the code and the contract; finding holds without runtime assumptions.
- **`medium`** — Well-founded but depends on an assumption you couldn't fully confirm.
- **`low`** — Suspicion worth surfacing. Say so in the explanation.

When uncertain: **lower confidence, never inflate severity.**

## Rules

- **Never edit source files.** Read-only.
- **Every finding cites code you actually read.** No anchor → no finding. No hallucinated line numbers or excerpts.
- **Don't fabricate issues.** Clean code gets `verdict: approve`, `findings: []`. That's a valid, valuable result.
- **Don't flag unchanged code in diff mode.** The scope is the change.
- **Correctness bugs need a failure scenario** — "input X, state Y, observed Z, expected W" — or they're downgraded to observations.
- **Be thorough, not timid.** Report every real issue. A comprehensive review is the goal. The constraint is reality (you actually found it and can cite it), not quantity.
- **Write the artifact.** This is your primary deliverable. A review without a written artifact is a failed review, regardless of how good the analysis was. Write to `./reviews/` at the project root. If anything blocks that, write `code-audit-review.json` in the project root as a fallback.
- **Tone: senior reviewer.** Direct, specific, actionable. The author is a competent peer.

## References (optional enrichment)

These files deepen your review when time and budget allow. They are **not prerequisites** — a valid review can be completed without reading any of them.

| File | What it adds |
|------|-------------|
| `references/review-dimensions.md` | Expanded descriptions of each category with sub-bullets |
| `references/severity-rubric.md` | Calibration anchors, severity-by-category quick reference |
| `references/schema.md` | Full schema docs with field-level notes |
| `references/handoff-protocol.md` | Cross-session lifecycle, finding states, reconciliation by content hash |
| `references/languages/README.md` | Index mapping file extensions to language packs |
| `references/languages/<lang>.md` | Language-specific footguns, grep patterns, calibration hints |
