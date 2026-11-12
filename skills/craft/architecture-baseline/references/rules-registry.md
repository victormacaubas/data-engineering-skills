# The Rule Registry

`docs/rules.yaml` holds the project's architectural rules, one entry each, with the check that enforces it and, when one holds the reasoning, the ADR it came from. It's the structural decisions in a form an agent can follow without opening every ADR, read before the first edit and again by a reviewer judging a change. Each statement lives here and nowhere else: `AGENTS.md` points at it, the ADR holds the reasoning, the config holds the check.

What makes it worth having is `enforced_by`. It separates the rules a tool will catch from the ones only a reviewer will, and the second kind is the list a person or agent actually has to keep in mind. That only works while the list is short enough to keep in mind, which is why the scope below is narrow.

## What belongs

A rule belongs in the registry when it constrains the structure of the system:

- where code lives, and what each package owns
- what may import or call what
- what crosses a boundary, and in what form (driver types, foreign exceptions, untrusted input)
- what identifies a record, and what a re-run produces
- which dependencies the system is allowed to have
- how the rules are enforced: the gate is one command, CI runs that command

Everything else is a convention and goes in `AGENTS.md`: how to log, how to name a test, how to build fixtures, CLI flag habits, docstring content, how to size a task or a change. Those rules matter, but none of them changes where code goes or what it may touch, and a registry that holds them grows to sixty entries an agent skims.

The test for a candidate: **if this rule were broken, would the system's shape be different, or only one module's style?** Shape belongs here. Style goes in `AGENTS.md`.

Not every structural rule needs an ADR. Apply the test from `references/adr-set.md`: would someone implementing a future change plausibly undo this without knowing why? If so, the reasoning deserves an ADR, and `source` points at it. If the rule explains itself ("only `cli` parses arguments"), or the comment beside its check already does, it needs no ADR, and the registry entry is its whole record.

## Format

```yaml
version: 1
rules:
  - id: layers.direction
    rule: A package imports only packages below it in the AGENTS.md layer table.
    applies_to: ["src/mypackage/**"]
    enforced_by: ["importlinter:Layered architecture"]
    source: docs/adr/0001-layer-map-and-dependency-direction.md
```

| Field | Holds |
|---|---|
| `id` | `<area>.<slug>`, stable. Other documents and review comments cite it, so never rename or reuse one. A retired rule's entry is deleted; the superseded ADR keeps its history. |
| `rule` | One imperative sentence a reader can check a diff against. |
| `applies_to` | Glob patterns, relative to the repo root, for the paths the rule governs. |
| `enforced_by` | One or more checks, or `["review"]` when no tool checks it. |
| `source` | Optional. The file that holds the reasoning: usually an ADR, sometimes the config file whose comment explains the check. Leave it out when the rule needs no explanation. Never `AGENTS.md`, since the rule no longer lives there, and never a design doc, which goes stale once the decisions land. |

There's no `why` field, on purpose. The reasoning lives in the file `source` names, and a one-line paraphrase of it here would drift from the ADR silently, the same way a docstring that retells an ADR does.

### `enforced_by` values

| Value | Means | Resolves against |
|---|---|---|
| `importlinter:<name>` | an import-linter contract | the exact `name` string of a contract in `[tool.importlinter]` |
| `ruff:<code>` | a Ruff rule or banned-api entry | a code covered by a prefix in `lint.select` and not in `lint.ignore` |
| `mypy` | the type-checker | a `[tool.mypy]` section |
| `pytest:<flag or marker>` | a pytest option | a flag in `addopts` or a marker name in `markers` |
| `test:<path>[::<name>]` | a test the project wrote to enforce the rule | the file exists, and defines the named test when one is given |
| `review` | nothing mechanical | itself; it's the declaration that no tool checks this |

A rule can name more than one check when each covers part of it. Name the check that would fail, not a tool that is merely nearby: `mypy` on a rule about exception translation is a claim mypy doesn't make.

## Writing a rule

One sentence, imperative, about the code rather than about intentions. The test for each one: **could a reviewer point at a line in a diff and say it breaks this?** If not, it's a value statement, and those belong in the ADR's context.

Name the thing, not the quality. "Keep tests clean" can't be checked; "no `@patch` on anything that has a seam" can.

<example>
  - id: tech.owner-owns-types
    rule: No sqlite3 type or exception appears outside mypackage.store.
    applies_to: ["src/mypackage/**"]
    enforced_by: ["importlinter:Only store touches the database driver"]
    source: docs/adr/0002-runtime-stack-and-dependencies.md
</example>

<example>
  - id: seams.injection-required
    rule: A seam is a required constructor argument, never a parameter defaulting to the real implementation.
    applies_to: ["src/mypackage/**"]
    enforced_by: ["review"]
    source: docs/adr/0004-seams.md
</example>

<example>
  - id: time.aware-utc
    rule: Read the current time through the Clock seam; never call datetime.utcnow.
    applies_to: ["src/mypackage/**"]
    enforced_by: ["ruff:TID251", "review"]
    source: docs/adr/0004-seams.md
</example>

<example>
  - id: gate.ci-runs-the-gate
    rule: CI runs make check itself, never its own list of steps.
    applies_to: [".github/workflows/**"]
    enforced_by: ["review"]
    source: docs/adr/0007-toolchain-and-quality-gate.md
</example>

The third one names two checks because Ruff catches `utcnow` and only review catches a `datetime.now()` that skips the seam. The fourth constrains how enforcement is wired rather than the code itself, which still makes it structure: a CI job with its own step list is a second gate that drifts from the first.

<example>
  Not a registry rule:
  - id: tests.named-for-assertion
    rule: Name each test for what it asserts.
</example>

That one is a good rule and it belongs in `AGENTS.md`. Breaking it makes a test harder to read; it doesn't change what any package owns or may touch.

Before marking a rule `review`, ask whether a forbidden contract, a banned-api entry, or a pytest flag would catch it. If one would, write that check and name it. `review` is for what no tool can see, not for what nobody configured yet.

## The registry test

`tests/unit/test_rules_registry.py` keeps the references honest: every `source` given exists and isn't an instruction file, every `applies_to` pattern matches something, and every `enforced_by` check is actually configured. It doesn't test the rules themselves; the checks it points at do that. A registry entry naming a contract that was renamed, or never written, fails the gate here rather than reading as enforced for months.

It is gate machinery, like the contracts, which is why the baseline writes it even though Decision 6 creates no test files. It needs `pyyaml` and `types-PyYAML` as dev dependencies (`references/enforcement.md` → uv), recorded in ADR 0002 as dev tooling.

Adapt the paths if the tool config lives outside `pyproject.toml` (a `ruff.toml`, a `.importlinter` file).

```python
"""The rule registry's references resolve to checks and files that exist."""

import tomllib
from pathlib import Path
from typing import Any

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_KEYS = {"id", "rule", "applies_to", "enforced_by"}
INSTRUCTION_FILES = {"AGENTS.md", "CLAUDE.md"}

RULES: list[dict[str, Any]] = yaml.safe_load(
    (ROOT / "docs" / "rules.yaml").read_text(encoding="utf-8")
)["rules"]
with (ROOT / "pyproject.toml").open("rb") as handle:
    TOOL: dict[str, Any] = tomllib.load(handle).get("tool", {})

CHECKS = [
    (rule.get("id"), check) for rule in RULES for check in rule.get("enforced_by", [])
]


def _check_is_configured(check: str) -> bool:
    kind, _, target = check.partition(":")
    if kind == "review":
        return target == ""
    if kind == "mypy":
        return target == "" and "mypy" in TOOL
    if kind == "importlinter":
        contracts = TOOL.get("importlinter", {}).get("contracts", [])
        return target in {contract["name"] for contract in contracts}
    if kind == "ruff":
        lint = TOOL.get("ruff", {}).get("lint", {})
        selected = any(
            target.startswith(code) or code == "ALL" for code in lint.get("select", [])
        )
        ignored = any(target.startswith(code) for code in lint.get("ignore", []))
        return bool(target) and selected and not ignored
    if kind == "pytest":
        options = TOOL.get("pytest", {}).get("ini_options", {})
        markers = {
            marker.split(":", 1)[0].strip() for marker in options.get("markers", [])
        }
        return target in options.get("addopts", "").split() or target in markers
    if kind == "test":
        path, _, name = target.partition("::")
        test_file = ROOT / path
        if not test_file.is_file():
            return False
        return not name or f"def {name}(" in test_file.read_text(encoding="utf-8")
    return False


def test_rule_ids_are_unique() -> None:
    ids = [rule.get("id") for rule in RULES]
    assert len(ids) == len(set(ids)), "duplicate rule ids"


@pytest.mark.parametrize("rule", RULES, ids=lambda rule: str(rule.get("id")))
def test_rule_has_every_required_field(rule: dict[str, Any]) -> None:
    assert rule.keys() >= REQUIRED_KEYS, f"missing {REQUIRED_KEYS - rule.keys()}"
    assert rule["enforced_by"], (
        "enforced_by is empty; use ['review'] if nothing checks it"
    )


@pytest.mark.parametrize("rule", RULES, ids=lambda rule: str(rule.get("id")))
def test_rule_source_exists_when_given(rule: dict[str, Any]) -> None:
    source = rule.get("source")
    if source is None:
        return
    name = Path(source).name
    assert name not in INSTRUCTION_FILES, f"{source} is an instruction file"
    assert (ROOT / source).is_file(), f"source {source} does not exist"


@pytest.mark.parametrize("rule", RULES, ids=lambda rule: str(rule.get("id")))
def test_rule_applies_to_existing_paths(rule: dict[str, Any]) -> None:
    for pattern in rule["applies_to"]:
        assert any(ROOT.glob(pattern)), f"applies_to {pattern} matches nothing"


@pytest.mark.parametrize(("rule_id", "check"), CHECKS)
def test_enforced_by_names_a_configured_check(rule_id: str, check: str) -> None:
    assert _check_is_configured(check), f"{rule_id}: {check} is not configured"
```

Run it once with a deliberately wrong entry (a misspelled contract name, a missing ADR path) and confirm it fails before trusting it, the same way each contract gets made to fail once.
