# Artifact Schema (canonical)

This is the **single source of truth** for the review artifact. `scripts/validate_artifact.py` implements exactly this; if the two ever disagree, the validator is the bug. The artifact is JSON; a markdown view is *derived* from it via `scripts/render_report.py` and is never canonical.

The artifact is a **cross-session work order**. A consumer with no shared conversation state reads it, rebuilds context from the provenance block, re-locates each finding by its `anchor.excerpt`, acts, verifies, and writes `status` + `resolution` back. The producer (this skill) emits every finding as `open` and never writes any other status.

## Top-level object

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | Currently `"1.0"`. |
| `review_id` | string | yes | `rev-<YYYY-MM-DD>-<scope-slug>-<short>`; `<short>` = a few chars of the head SHA. Versioned so concurrent runs don't clobber. |
| `created_at` | string | yes | ISO-8601 UTC, e.g. `2026-06-04T14:22:10Z`. |
| `reviewer` | string | yes | Identity of the reviewing agent, e.g. `code-review@opus-4.8`. |
| `repo` | string | yes | Repo identifier (org/name or local path). |
| `target` | object | yes | Provenance + scope. See **target** below. |
| `conventions` | string | yes | House rules discovered at review time (retry lib, logging style, disallowed patterns). May be `""` if none found. **Never** holds per-language idioms — those live in language packs. |
| `verdict` | enum | yes | `approve` \| `approve_with_comments` \| `request_changes`. Merge gate in `diff` mode; overall risk/health signal in `repo` mode. |
| `summary` | string | yes | One paragraph for a human glancing at the file. |
| `stats` | object | yes | `{ "critical": N, "high": N, "medium": N, "low": N }` — counts over `findings`. |
| `coverage` | object | conditional | **Required in `repo` mode** (and recommended for large `paths`). See **coverage** below. Omit in `diff` mode. |
| `findings` | array | yes | Zero or more findings. Empty array is the valid clean-code result. |

## `target`

```json
"target": {
  "mode": "diff",                        // diff | paths | repo
  "base_ref": "main@9f2c1a8",            // diff mode only
  "head_ref": "feat/bedrock-retry@3d4e5f0", // diff mode only
  "ref": "main@9f2c1a8",                 // paths | repo mode: HEAD at review time
  "scope": ["src/", "lib/"],             // paths | repo: folders, globs, or file list
  "excludes": ["**/vendor/**", "**/*.lock", "**/generated/**", "**/node_modules/**"]
}
```

- `mode` is always present.
- `diff` mode requires `base_ref` and `head_ref`; `ref`/`scope`/`excludes` are optional there.
- `paths` and `repo` modes require `ref` and `scope`; `excludes` is recommended.
- Anchors resolve against the relevant commit (`head_ref` in diff mode, `ref` otherwise), so the mode switch leaves anchoring untouched.

## `coverage` (repo / large paths mode)

```json
"coverage": {
  "files_in_scope": 142,
  "deep_reviewed": 38,
  "skimmed": 71,
  "skipped": 33,
  "notes": "Deep-reviewed src/gateway and src/auth; skimmed tests; skipped vendored and generated code."
}
```

All four counts are integers; `notes` is a non-empty string explaining the split. The counts need not sum to `files_in_scope` exactly (a file may be both enumerated and skipped), but `notes` should make the accounting legible.

## `findings[]`

Every finding object:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Stable content hash of `category + file + anchor` (see **id**). Same unchanged issue → same id across sessions; per-file hashing makes repeated antipatterns dedupe across shards. |
| `severity` | enum | yes | `critical` \| `high` \| `medium` \| `low`. Impact. See `severity-rubric.md`. |
| `confidence` | enum | yes | `high` \| `medium` \| `low`. Certainty given no runtime context. |
| `category` | string | yes | One of the 15 categories in `review-dimensions.md` (kebab-case key, e.g. `error-handling`, `security`, `idempotency`). |
| `anchor` | object | yes | One of three shapes — **located**, **systemic**, or **repeated**. See **anchor**. |
| `title` | string | yes | Short, specific. |
| `explanation` | string | yes | The concrete failure scenario and why it matters. For correctness, embeds the one-sentence repro. |
| `suggestion` | string | yes | What to change. May reference the repo's conventions. |
| `acceptance_criteria` | string | yes | Definition of done — how a fixer knows it's resolved. |
| `verification` | string \| null | yes | A command or check that proves the fix (e.g. `pytest tests/... -k retry`), or `null` if none is meaningful (e.g. a pure style nit). |
| `proposed_patch` | string \| null | yes | Advisory only; **defaults to `null`** from the read-only producer. |
| `status` | enum | yes | Producer always emits `open`. Consumer may set `fixed` \| `wontfix` \| `deferred`. |
| `resolution` | object \| null | yes | Producer emits `null`. Consumer fills `{ "outcome": ..., "note": ..., "commit": ... }`. |

### `anchor` — three shapes

**Located** (a specific line range — the common diff-mode case):

```json
"anchor": {
  "file": "src/gateway/bedrock_client.py",
  "commit": "3d4e5f0",
  "line_hint": [58, 66],
  "excerpt": "for attempt in range(5):\n    try:\n        return self._invoke(body)\n    except Exception:\n        time.sleep(2 ** attempt)"
}
```

`excerpt` is the **source of truth** for re-location; `line_hint` is a hint only. A consumer matches on normalized excerpt content (trim/whitespace-tolerant), falling back to `line_hint` + surrounding context if the file was reformatted.

**Systemic** (no single location):

```json
"anchor": { "scope": "repo" }   // or "scope": "module"
```

Used for findings like "no integration tests cover the request path". Omits `file`/`excerpt`.

**Repeated antipattern** (same issue across many places — one finding, not N):

```json
"anchor": { "scope": "file" },
"occurrences": 7,
"locations": [
  { "file": "src/api/users.py",  "line_hint": [22, 22], "excerpt": "f\"select * from users where id = {uid}\"" },
  { "file": "src/api/orders.py", "line_hint": [41, 41], "excerpt": "f\"... where id = {oid}\"" }
]
```

When `occurrences`/`locations` are present, each location carries its own `file` + `line_hint` + `excerpt`.

### `id` — content hash

`id` is a short stable hash derived from at least `category`, the anchor's `file` (or `scope` for systemic), and the `excerpt`. Because it incorporates the file path, the same antipattern in two files yields two ids that dedupe cleanly when merging parallel-shard artifacts, and a re-review of an unchanged issue reproduces the same id (so a consumer can reconcile open → fixed). Use the validator's helper to compute it consistently:

```
uv run python scripts/validate_artifact.py --hash <category> <file-or-scope> <excerpt>
```

## Empty-success shape

Clean code is a first-class, unambiguous result — not an omission:

```json
{
  "schema_version": "1.0",
  "review_id": "rev-2026-06-04-charge-7f3a91",
  "created_at": "2026-06-04T14:22:10Z",
  "reviewer": "code-review@opus-4.8",
  "repo": "justworks/llm-gateway",
  "target": { "mode": "diff", "base_ref": "main@9f2c1a8", "head_ref": "feat/x@3d4e5f0" },
  "conventions": "",
  "verdict": "approve",
  "summary": "The change is small and correct; no issues found in scope.",
  "stats": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "findings": []
}
```
