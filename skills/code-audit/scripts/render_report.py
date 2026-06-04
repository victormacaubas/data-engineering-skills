#!/usr/bin/env python3
"""Render a code-review JSON artifact into a human-readable markdown view.

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


def _severity_rank(finding: dict[str, Any]) -> int:
    return SEVERITY_ORDER.get(finding.get("severity", "low"), 99)


def _fmt_target(target: dict[str, Any]) -> str:
    mode = target.get("mode", "?")
    if mode == "diff":
        return f"`diff` — {target.get('base_ref', '?')} → {target.get('head_ref', '?')}"
    scope = ", ".join(target.get("scope", [])) or "(unspecified)"
    return f"`{mode}` — ref {target.get('ref', '?')}; scope: {scope}"


def _render_anchor(finding: dict[str, Any]) -> list[str]:
    """Render whichever of the three location shapes is present.

    ``occurrences``/``locations`` are finding-level fields (repeated
    antipattern); ``file``/``scope`` live inside ``anchor`` (located/systemic).
    """
    lines: list[str] = []
    anchor = finding.get("anchor", {})
    locations = finding.get("locations")

    if locations:
        occ = finding.get("occurrences", len(locations))
        lines.append(f"- **Occurrences:** {occ} location(s)")
        for loc in locations:
            hint = loc.get("line_hint")
            span = f":{hint[0]}-{hint[1]}" if isinstance(hint, list) and len(hint) == 2 else ""
            lines.append(f"  - `{loc.get('file', '?')}{span}`")
    elif "file" in anchor:
        hint = anchor.get("line_hint")
        span = f":{hint[0]}-{hint[1]}" if isinstance(hint, list) and len(hint) == 2 else ""
        lines.append(f"- **Where:** `{anchor.get('file', '?')}{span}`")
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
        f"#### [{finding.get('id', '?')}] {finding.get('title', '(untitled)')} "
        f"— **{sev}** · confidence: {conf}",
        f"- **Category:** {finding.get('category', '?')}",
    ]
    lines += _render_anchor(finding)
    lines.append(f"- **Problem:** {finding.get('explanation', '')}")
    lines.append(f"- **Suggestion:** {finding.get('suggestion', '')}")
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


def render(artifact: dict[str, Any]) -> str:
    """Return the full markdown rendering of an artifact."""
    lines: list[str] = []
    target = artifact.get("target", {})

    lines.append(f"# Code Review — {artifact.get('review_id', '(no id)')}")
    lines.append("")
    lines.append(f"- **Reviewer:** {artifact.get('reviewer', '?')}")
    lines.append(f"- **Repo:** {artifact.get('repo', '?')}")
    lines.append(f"- **Target:** {_fmt_target(target)}")
    lines.append(f"- **Created:** {artifact.get('created_at', '?')}")
    lines.append(f"- **Verdict:** **{artifact.get('verdict', '?')}**")
    if artifact.get("conventions"):
        lines.append(f"- **Conventions:** {artifact['conventions']}")
    lines.append("")

    stats = artifact.get("stats", {})
    lines.append("## Summary")
    lines.append("")
    lines.append(artifact.get("summary", ""))
    lines.append("")
    lines.append(
        f"**Findings:** {stats.get('critical', 0)} critical · "
        f"{stats.get('high', 0)} high · {stats.get('medium', 0)} medium · "
        f"{stats.get('low', 0)} low"
    )
    lines.append("")

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

    findings = artifact.get("findings", [])
    lines.append("## Findings")
    lines.append("")
    if not findings:
        lines.append("_No findings — the reviewed code is clean in scope._")
        lines.append("")
    else:
        for finding in sorted(findings, key=_severity_rank):
            lines += _render_finding(finding)

    return "\n".join(lines).rstrip() + "\n"


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a code-review JSON artifact as markdown (read-only)."
    )
    parser.add_argument("artifact", help="Path to the JSON artifact.")
    parser.add_argument(
        "-o",
        "--output",
        help="Write markdown here instead of stdout.",
    )
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
