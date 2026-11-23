"""Render a code-review JSON artifact into a human-readable markdown report.

The JSON artifact is canonical; this markdown is a *derived view* and is never
the source of truth. The script only reads the artifact — it never mutates it.

Stdlib-only so it runs under ``uv run`` with no added dependencies.

Usage:
    uv run python render_report.py <artifact.json>            # markdown to stdout
    uv run python render_report.py <artifact.json> -o out.md  # write to a file

Exit codes:
    0  rendered
    2  usage error / file not found / unparseable JSON
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Order findings worst-first within each grouping.
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# Canonical dimension order + display labels. Findings are grouped by these.
DIMENSIONS: list[tuple[str, str]] = [
    ("security", "Security"),
    ("correctness", "Correctness & Hidden Bugs"),
    ("performance", "Performance"),
    ("architecture", "Architecture & Design"),
    ("error-handling", "Error Handling & Resilience"),
    ("readability", "Readability & Style"),
]

ORIGIN_INTRODUCED = "introduced"
ORIGIN_PRE_EXISTING = "pre-existing"
ORIGIN_NOT_ASSESSED = "not-assessed"
ORIGINS = (ORIGIN_INTRODUCED, ORIGIN_PRE_EXISTING, ORIGIN_NOT_ASSESSED)


def _severity_rank(finding: dict[str, Any]) -> int:
    return SEVERITY_ORDER.get(str(finding.get("severity", "low")).lower(), 99)


def _origin(finding: dict[str, Any]) -> str:
    """Return the finding's origin; a 2.1 finding has none and reads as not-assessed."""
    origin = finding.get("origin")
    return origin if origin in ORIGINS else ORIGIN_NOT_ASSESSED


def _fmt_target(target: dict[str, Any]) -> str:
    mode = target.get("mode", "?")
    if mode == "diff":
        text = f"`diff` — {target.get('base_ref', '?')} → {target.get('head_ref', '?')}"
        if target.get("rules_from"):
            text += f"; rules read from: {target['rules_from']}"
        return text
    scope = ", ".join(target.get("scope", [])) or "(unspecified)"
    return f"`{mode}` — ref {target.get('ref', '?')}; scope: {scope}"


def _render_anchor(finding: dict[str, Any]) -> list[str]:
    """Render whichever of the three location shapes is present.

    ``occurrences``/``locations`` are finding-level fields (repeated
    antipattern); ``file``/``scope`` live inside ``anchor`` (located/systemic).
    """
    lines: list[str] = []
    anchor = finding.get("anchor", {}) or {}
    locations = finding.get("locations")

    def _span(hint: Any) -> str:
        if isinstance(hint, list) and len(hint) == 2:
            return f":{hint[0]}-{hint[1]}"
        return ""

    if locations:
        occ = finding.get("occurrences", len(locations))
        lines.append(f"- **Occurrences:** {occ} location(s)")
        for loc in locations:
            lines.append(f"  - `{loc.get('file', '?')}{_span(loc.get('line_hint'))}`")
    elif "file" in anchor:
        lines.append(
            f"- **Where:** `{anchor.get('file', '?')}{_span(anchor.get('line_hint'))}`"
        )
        excerpt = anchor.get("excerpt")
        if excerpt:
            lines.append("")
            lines.append("  ```")
            for row in str(excerpt).splitlines():
                lines.append(f"  {row}")
            lines.append("  ```")
    elif "scope" in anchor:
        lines.append(f"- **Where:** systemic (scope: {anchor['scope']})")

    return lines


def _render_finding(finding: dict[str, Any]) -> list[str]:
    sev = str(finding.get("severity", "?")).upper()
    conf = str(finding.get("confidence", "?"))
    lines = [
        (
            f"#### [{finding.get('id', '?')}] {finding.get('title', '(untitled)')} "
            f"— **{sev}** · confidence: {conf} · origin: {_origin(finding)}"
        ),
    ]
    lines += _render_anchor(finding)
    if finding.get("explanation"):
        lines.append(f"- **Problem:** {finding['explanation']}")
    if finding.get("suggestion"):
        lines.append(f"- **Proposed change:** {finding['suggestion']}")
    if finding.get("acceptance_criteria"):
        lines.append(f"- **Done when:** {finding['acceptance_criteria']}")
    if finding.get("verification"):
        lines.append(f"- **Verify:** `{finding['verification']}`")
    status = finding.get("status", "open")
    if status != "open":
        resolution = finding.get("resolution") or {}
        note = resolution.get("note", "") if isinstance(resolution, dict) else ""
        lines.append(f"- **Status:** {status} — {note}")
    lines.append("")
    return lines


def _render_rubric(rubric: dict[str, Any]) -> list[str]:
    lines = ["## Rubric", ""]
    dims = {d.get("id"): d for d in rubric.get("dimensions", [])}
    lines.append("| Dimension | Score | Weight | Critical | High | Medium | Low |")
    lines.append("|---|---|---|---|---|---|---|")
    for dim_id, label in DIMENSIONS:
        d = dims.get(dim_id, {})
        s = d.get("stats", {}) or {}
        score = d.get("score", "?")
        weight = d.get("weight", "?")
        lines.append(
            f"| {label} | {score}/10 | ×{weight} | "
            f"{s.get('critical', 0)} | {s.get('high', 0)} | "
            f"{s.get('medium', 0)} | {s.get('low', 0)} |"
        )
    lines.append("")
    if rubric.get("formula"):
        lines.append(f"**Weighted formula:** `{rubric['formula']}`")
        lines.append("")
    return lines


def _render_stale(stale: Any) -> list[str]:
    if not stale:
        return []
    if not isinstance(stale, dict):
        return [
            "> **WARNING: STALE REVIEW.** The reviewed tree changed during the review.",
            "",
        ]
    changed = stale.get("changed", "?")
    warning = (
        f"> **WARNING: STALE REVIEW.** The {changed} changed during the review "
        f"(started at `{stale.get('start', '?')}`, ended at `{stale.get('end', '?')}`). "
        "This result does not describe the current tree. Review again before you rely on it."
    )
    return [warning, ""]


def _render_rule_changes(rule_changes: list[dict[str, Any]]) -> list[str]:
    lines = [
        "## Rule changes",
        "",
        "The change edits these rule sources. A person must approve each edit.",
        "",
    ]
    for rc in rule_changes:
        lines.append(
            f"- `{rc.get('path', '?')}` — {rc.get('change', '?')}: {rc.get('effect', '')}".rstrip()
        )
    lines.append("")
    return lines


def _render_group(findings: list[dict[str, Any]], heading_level: str) -> list[str]:
    """Render findings grouped by dimension, canonical dimensions first."""
    by_dim: dict[str, list[dict[str, Any]]] = {}
    for f in findings:
        by_dim.setdefault(str(f.get("dimension", "other")), []).append(f)
    known = [dim_id for dim_id, _ in DIMENSIONS]
    labels = dict(DIMENSIONS)
    lines: list[str] = []
    for dim_id in [*known, *(d for d in by_dim if d not in known)]:
        group = by_dim.get(dim_id)
        if not group:
            continue
        lines.append(f"{heading_level} {labels.get(dim_id, dim_id)}")
        lines.append("")
        for f in sorted(group, key=_severity_rank):
            lines += _render_finding(f)
    return lines


def render(artifact: dict[str, Any]) -> str:
    """Return the full markdown rendering of an artifact."""
    lines: list[str] = []
    target = artifact.get("target", {}) or {}
    rubric = artifact.get("rubric", {}) or {}

    lines.append(f"# Code Review — {artifact.get('review_id', '(no id)')}")
    lines.append("")
    lines.append(f"- **Reviewer:** {artifact.get('reviewer', '?')}")
    lines.append(f"- **Repo:** {artifact.get('repo', '?')}")
    lines.append(f"- **Target:** {_fmt_target(target)}")
    lines.append(f"- **Created:** {artifact.get('created_at', '?')}")
    lines.append(f"- **Verdict:** **{artifact.get('verdict', '?')}**")
    if artifact.get("verdict_reason"):
        lines.append(f"- **Verdict reason:** {artifact['verdict_reason']}")
    if artifact.get("conventions"):
        lines.append(f"- **Conventions:** {artifact['conventions']}")
    lines.append("")
    lines += _render_stale(artifact.get("stale"))

    rule_changes = artifact.get("rule_changes") or []
    if rule_changes:
        lines += _render_rule_changes(rule_changes)

    stats = artifact.get("stats", {}) or {}
    lines.append("## Summary")
    lines.append("")
    if rubric.get("overall") is not None:
        lines.append(f"**Overall: {rubric['overall']} / 10** (weighted)")
        lines.append("")
    lines.append(artifact.get("summary", ""))
    lines.append("")
    lines.append(
        f"**Totals:** {stats.get('critical', 0)} Critical · "
        f"{stats.get('high', 0)} High · {stats.get('medium', 0)} Medium · "
        f"{stats.get('low', 0)} Low (scored findings only)"
    )
    lines.append("")
    findings = artifact.get("findings", []) or []
    origin_counts = stats.get("origin")
    if not isinstance(origin_counts, dict):
        origin_counts = {
            o: sum(1 for f in findings if _origin(f) == o) for o in ORIGINS
        }
    lines.append(
        "**Origin:** " + " · ".join(f"{origin_counts.get(o, 0)} {o}" for o in ORIGINS)
    )
    lines.append("")

    if rubric.get("dimensions"):
        lines += _render_rubric(rubric)

    coverage = artifact.get("coverage")
    if isinstance(coverage, dict):
        lines.append("## Coverage")
        lines.append("")
        lines.append(
            f"- {coverage.get('files_in_scope', '?')} files in scope · "
            f"{coverage.get('deep_reviewed', '?')} deep-reviewed · "
            f"{coverage.get('skimmed', '?')} skimmed · "
            f"{coverage.get('skipped', '?')} skipped"
        )
        if coverage.get("notes"):
            lines.append(f"- {coverage['notes']}")
        lines.append("")

    notes = artifact.get("notes") or []
    if isinstance(notes, str):
        notes = [notes]
    if notes:
        lines.append("## Notes & limitations")
        lines.append("")
        for note in notes:
            lines.append(f"- {note}")
        lines.append("")

    verification = artifact.get("verification") or []
    if verification:
        lines.append("## Verification run")
        lines.append("")
        for v in verification:
            confirms = ", ".join(v.get("confirms", [])) if v.get("confirms") else ""
            suffix = f" → confirms {confirms}" if confirms else ""
            lines.append(
                f"- `{v.get('command', '?')}` — {v.get('result', '?')}{suffix}"
            )
        lines.append("")

    lines.append("## Findings")
    lines.append("")
    scored = [f for f in findings if _origin(f) != ORIGIN_PRE_EXISTING]
    pre_existing = [f for f in findings if _origin(f) == ORIGIN_PRE_EXISTING]
    if not findings:
        lines.append("_No findings — the reviewed code is clean in scope._")
        lines.append("")
    elif scored:
        lines += _render_group(scored, "###")
    else:
        lines.append("_No findings from this change._")
        lines.append("")

    if pre_existing:
        lines.append("## Pre-existing findings")
        lines.append("")
        lines.append(
            "These defects were in the code before the change. "
            "They do not count in the verdict or in the scores."
        )
        lines.append("")
        lines += _render_group(pre_existing, "###")

    return "\n".join(lines).rstrip() + "\n"


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a code-review JSON artifact as markdown (read-only)."
    )
    parser.add_argument("artifact", help="Path to the JSON artifact.")
    parser.add_argument("-o", "--output", help="Write markdown here instead of stdout.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    path = Path(args.artifact)
    if not path.is_file():
        print(f"error: not a file: {path}", file=sys.stderr)
        return 2

    try:
        artifact = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON in {path}: {exc}", file=sys.stderr)
        return 2

    markdown = render(artifact)

    if args.output:
        Path(args.output).write_text(markdown, encoding="utf-8")
        print(f"wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
