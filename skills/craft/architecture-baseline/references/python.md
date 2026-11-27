# Language Pack: Python

Concrete directory shapes, declarations, testing conventions, enforcement config, registry test, and `verify` examples for Python projects. Load this pack once the project is confirmed as Python. Coherent tooling config that already exists in the repo wins over the defaults below.

**Don't copy version numbers from an example.** Take the Python version from the project's `requires-python`, and pin tool and hook versions to their current release when you write the config (`uv add` resolves the current release for tools; `pre-commit autoupdate` pins hook revs). A version copied from a reference file is stale on the day it lands.

## Contents

- Archetypes and layer map
- Declarations and docstrings
- Testing homes and conventions
- Enforcement toolchain (`uv`, Ruff, mypy, pytest, `import-linter`)
- The ratchet, when the graph already has violations
- The gate and three-tier hooks
- The rules registry test (`tests/unit/test_rules_registry.py`)
- Verify skill examples

## Archetypes and layer map

These trees are starting points, not schemas to satisfy. The tree matters much less than the dependency direction it encodes — two projects with different directories and the same one-way flow are architecturally the same; two with identical directories and a cycle between them are not.

| What you're building | Archetype | Entrypoint |
|---|---|---|
| Scheduled job, ETL, backfill | Data pipeline | `main.py` (argparse) |
| HTTP API, long-running server | Service | `main.py` (app factory) |
| Multi-command developer tool | CLI tool | `cli.py` (click/typer) |
| Something imported by other code | Library | no entrypoint; the public API is the contract |

The difference that matters is the entrypoint and where configuration comes from. Everything below the top layer looks similar across all four, because the layering principle doesn't change with the shape.

### Data pipeline / batch job

```
pipeline_name/
├── main.py              # argparse CLI. Parse args, build config, call the runner.
├── core/                # Orchestration. Composes io and models into a workflow.
│   └── runner.py        # PipelineRunner — owns state (clients, config, logger).
├── io/                  # Adapters to external systems. Owns their types and errors.
│   ├── warehouse.py
│   └── object_store.py
├── models/              # Dataclasses, enums, domain types. No I/O, no logic.
│   └── config.py
└── utils/               # Leaf helpers: retries, parsing. Knows nothing about core.
    └── retries.py
```

`main.py` stays thin: parse, build config, construct the runner, return its exit code. The moment it grows a branch that decides *what work happens*, that branch belongs in `core/`. Splitting `io/` from `utils/` is worth doing as soon as the pipeline touches more than one external system, because `io/` is where Decision 5's translation rule lives — each adapter catches its driver's exceptions and raises yours.

### Service

```
service_name/
├── main.py              # App factory, lifespan wiring, server entrypoint.
├── config.py            # Env-driven settings, fail-fast validation.
├── api/                 # HTTP layer. Routes, dependencies, request/response schemas.
│   ├── routes.py
│   └── schemas.py
├── core/                # Business logic. Services, caches, state machines.
│   └── service.py
├── models/              # Domain types (yours) and wire types (the client contract).
│   ├── domain.py
│   └── wire.py
└── io/                  # External clients. No business logic.
    └── client.py
```

`api/` keeps HTTP concerns out of `core/`. A function in `core/` takes domain types and returns domain types, and `api/` translates at the boundary. The `domain.py` / `wire.py` split stops a refactor in domain types from silently breaking the client contract.

### CLI tool

```
tool_name/
├── cli.py               # Command group. Parse commands, wire deps, call core.
├── errors.py            # Exception taxonomy (see Decision 5).
├── core/                # Orchestration and processing.
│   └── orchestrator.py
├── store/               # Persistence. Owns all SQL and all driver types.
│   ├── schema.py
│   └── operations.py
├── models/              # Config, domain types, enums, Protocols.
└── render/              # Output formatting. Reads domain types, emits text.
```

Each subcommand in `cli.py` builds arguments into a config object and hands off. If the tool has more than one output format, `render/` earns its own package immediately; formatting logic that starts inside `core/` never leaves on its own.

### Library

```
package_name/
├── api.py               # The public surface. Everything a caller imports.
├── core/                # Implementation.
├── models/              # Public types — these are part of your contract.
└── errors.py            # Public exceptions — also part of your contract.
```

For a library, the public/private line *is* the architecture. Decide explicitly which modules callers may import and state it as a rule in `docs/rules.yaml`. Everything else is free to change.

### Why dependencies flow one way

All four encode the same rule: `entrypoint → core → {models, io, utils}`, and never back up the chain.

- **A circular import is a layering error.** If two modules need each other, the shared thing belongs in a third place below both — usually `models/`. `if TYPE_CHECKING:` is right only when the dependency genuinely is hints-only; reaching for it to break a real cycle hides the cycle from the reader.
- **`models/` holds no logic and no I/O.** It sits at the bottom of the graph, so anything it imports becomes a dependency of everything above it.
- **A package that owns an external technology owns its types.** Nothing `sqlite3`-shaped leaves `store/`, nothing `boto3`-shaped leaves the S3 adapter, nothing `requests`-shaped leaves the HTTP client.

### The layer table

| Package | May import | Owns |
|---|---|---|
| `cli` | all below | argument parsing, exit codes, composition root |
| `core` | `store`, `models`, `utils` | orchestration, business logic |
| `store` | `models` | all SQL, all driver types and exceptions |
| `render` | `models` | output formatting |
| `models` | nothing in-project | domain types, Protocols |
| `utils` | nothing in-project | leaf helpers |

For a genuinely small project (one module, a few hundred lines), a flat `tool_name/cli.py` plus `tool_name/core.py` is honest — skip the directory tree until a module crosses a few hundred lines, while still completing Decisions 2 through 7.

## Declarations and docstrings

- **Dependencies (Decision 2):** stdlib first (`dataclasses`, `argparse`, `sqlite3`, `pathlib`) until a dependency earns itself. Pair each runtime dependency with its owning package.
- **Domain types (Decision 3):** dataclasses and enums in `models/`.
- **Seams (Decision 4):** `typing.Protocol`. If you can picture writing `@patch("module.path.thing")` to test a unit, the seam is missing. Injection is required (`def __init__(self, runner: CommandRunner)`), never defaulted to `None` with a fallback constructing the real implementation.
- **Errors (Decision 5):** `errors.py` with a base exception and initial domain errors. Adapters translate foreign exceptions at their boundary (`store/` catches `sqlite3.Error` and raises `StoreError`); once a package has a taxonomy, code inside it stops raising bare `ValueError` and `RuntimeError`. Map domain errors to exit codes in one place at the entrypoint.
- **Docstrings:** **Google style** — a one-line summary, then `Args:`, `Returns:`, `Raises:`, `Yields:` as the signature requires, enforced by Ruff's `pydocstyle` with `convention = "google"`. Skip a docstring the signature already gave:

```python
def user_count(rows: list[Row]) -> int:
    """Return the number of users."""      # delete it


class Clock(Protocol):
    def now(self) -> datetime:
        """The current time.

        Returns:
            An aware ``datetime`` in UTC. A naive one compares wrong, and
            silently, against timestamps read back from `store`.
        """
```

## Testing homes and conventions

- **Runner:** `pytest`. Enforce no network in unit tests mechanically with `pytest-socket` in config. Time enters through a `Clock` seam or a parameter with a default rather than freezing the clock globally.
- **Declared homes** (create them empty at baseline time so later changes don't invent drifting local helpers):

```
tests/
├── conftest.py          # fixtures with real lifecycle to manage, and only those
├── factories.py         # one canonical keyword-only builder per domain type
├── fakes.py             # one fake per Protocol seam from Decision 4
├── unit/
└── integration/         # @pytest.mark.integration, excluded from the default run
```

- **Assertions:** no positional indexing into structured results (`row[2]`), no importing underscore-prefixed helpers, no `@patch` on anything that has a seam.

## Enforcement toolchain

The stack is **uv** for environments, **Ruff** for lint and format, **mypy** for types, **pytest** for tests, and **import-linter** for the layer map. One config file (`pyproject.toml`), one gate command, no overlap between tools.

### uv

```bash
uv init my-project
uv add <runtime deps>
uv add --dev pytest ruff mypy import-linter pre-commit pyyaml types-PyYAML
uv run pytest
```

`pyyaml` and its stubs are dev-only, for the rules registry test below. Commit `uv.lock`. Run every command through `uv run` — bare `python` and `pip` bypass the managed environment.

### Ruff

Linter and formatter in one — don't add Black or isort alongside it.

```toml
[tool.ruff]
line-length = 88
# target-version omitted: Ruff infers it from `project.requires-python`,
# so the Python version lives in one place.

[tool.ruff.lint]
select = [
    "E", "W",   # pycodestyle
    "F",        # pyflakes — undefined names, unused imports
    "I",        # isort — import grouping and order
    "N",        # pep8-naming
    "UP",       # pyupgrade
    "B",        # bugbear — mutable default args and friends
    "C4",       # comprehensions
    "SIM",      # simplify
    "TID",      # tidy-imports
    "D",        # pydocstyle — Google docstring format
    "RUF",
]

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["D"]               # test names carry the intent; docstrings there are noise
"**/__init__.py" = ["D104"]      # baseline packages start as empty __init__.py files
```

The `__init__.py` ignore matters at baseline time: `D104` fires on an empty `__init__.py`, and every package the layer contract names starts as one.

`TID` (`flake8-tidy-imports`) bans specific modules or attributes for narrower rules that aren't about layering:

```toml
[tool.ruff.lint.flake8-tidy-imports.banned-api]
"datetime.datetime.utcnow".msg = "Use datetime.now(timezone.utc) — utcnow returns a naive datetime."
```

Add `S` (bandit) for security-sensitive code. Suppress per line with `# noqa: <rule>` and a reason, never a blanket ignore.

### mypy

```toml
[tool.mypy]
# python_version omitted: mypy checks against the interpreter it runs
# under, which uv selects from `requires-python`.
strict = true
warn_unreachable = true
```

Start strict. For third-party packages without stubs, override per package rather than globally:

```toml
[[tool.mypy.overrides]]
module = "some_untyped_lib.*"
ignore_missing_imports = true
```

Note that strict mode won't catch unverified key access on a `dict[str, Any]` crossing a boundary — give known payload shapes a dataclass in `models/`.

### pytest

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers -m 'not integration'"
markers = [
    "integration: touches real infrastructure; excluded from default runs",
]
```

`--strict-markers` turns a typo'd marker into an error rather than a test that silently never runs. `-m 'not integration'` in `addopts` excludes the `integration` lane from default runs so `uv run pytest` — and the gate with it — needs no credentials. Run the integration lane explicitly with `uv run pytest -m integration` where credentials exist (a `-m` on the command line replaces the one in `addopts`). The registry test has no marker, so the default run keeps it.

### `import-linter` — the layer map, enforced

Everything above is standard hygiene; this is what encodes *your* architecture statically with `uv run lint-imports`. Three contract types cover almost everything Decisions 1 and 2 produce.

Put a comment naming the ADR above every contract — a rule a tool checks lives only in its check, not in `docs/rules.yaml`, so the comment is the sole link back to its reasoning.

Set `include_external_packages = true` once at the top. Without it, any forbidden contract naming a module outside the root package (standard library included) fails before checking anything.

**Layers** (top to bottom — each may import anything below it, nothing above):

```toml
[tool.importlinter]
root_package = "mypackage"
include_external_packages = true

# docs/adr/0001-layer-map.md
[[tool.importlinter.contracts]]
name = "Layered architecture"
type = "layers"
layers = [
    "mypackage.cli",
    "mypackage.core",
    "mypackage.ingest | mypackage.store | mypackage.render",   # independent: no imports between them
    "mypackage.models : mypackage.utils",                      # same level, may import each other
]
```

`|` makes siblings independent; `:` places them at the same level with no check between them. Getting this backwards fails silently in the dangerous direction, so use `|` unless siblings genuinely need each other and comment the choice.

An empty package holding only `__init__.py` resolves fine; a named layer with no directory on disk fails the run. Create every package named in the contracts with an empty `__init__.py` at baseline time (and only those packages).

**Forbidden** (pins each Decision 2 external dependency to its owning package):

```toml
# docs/adr/0002-runtime-stack-and-dependencies.md
[[tool.importlinter.contracts]]
name = "Only store touches the database driver"
type = "forbidden"
source_modules = [
    "mypackage.cli",
    "mypackage.core",
    "mypackage.render",
]
forbidden_modules = ["sqlite3"]
```

**Independence** (enforces "these siblings don't know about each other"):

```toml
# docs/adr/0001-layer-map.md
[[tool.importlinter.contracts]]
name = "Adapters are independent"
type = "independence"
modules = [
    "mypackage.io.warehouse",
    "mypackage.io.object_store",
]
```

**Make each contract fail once:** for each contract, add one import it should forbid, run `uv run lint-imports`, confirm it reports `BROKEN`, and revert. Record in ADR 0007 that each was seen to fail.

## The ratchet, when the graph already has violations

A genuinely empty project has nothing to ignore. A project that was a prototype until this morning usually does. Don't weaken the contracts — list current violations explicitly:

```toml
ignore_imports = [
    "mypackage.parser.extraction -> mypackage.store.models",
]
unmatched_ignore_imports_alerting = "error"
```

New violations fail immediately, and fixing a listed violation fails the build until its entry is deleted. Set `unmatched_ignore_imports_alerting = "error"` explicitly even though it is the default, so a future reader sees the ratchet is intentional. If the list is long enough that clearing it is its own project, stop and say so.

## The gate and three-tier hooks

One command, ordered fast-to-slow:

```makefile
.PHONY: check
check:
	uv run ruff format --check .
	uv run ruff check .
	uv run lint-imports
	uv run mypy
	uv run pytest
```

`tests/unit/test_rules_registry.py` runs inside `uv run pytest`, so it needs no line of its own. The gate doesn't start the program — it shows that static checks and tests pass; starting the program and driving one flow is the verify skill's job (`references/verify-skill.md`).

CI runs `make check` — the same command, never a separate list of steps. Checks run in three tiers:

1. **On each commit**: fast hooks (ruff, ruff-format, detect-secrets).
2. **Before a push or a pull request**: `make check` locally via a pre-push hook.
3. **In CI**: the same `make check`, as confirmation.

```yaml
# .pre-commit-config.yaml
minimum_pre_commit_version: "4.4.0"   # language: unsupported
default_install_hook_types: [pre-commit, pre-push]
default_stages: [pre-commit]           # fast hooks run on commit only
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: <current release>   # filled in by `pre-commit autoupdate`
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/Yelp/detect-secrets
    rev: <current release>
    hooks:
      - id: detect-secrets
  - repo: local
    hooks:
      - id: gate
        name: make check
        entry: make check
        language: unsupported
        pass_filenames: false
        always_run: true
        stages: [pre-push]
```

Run `uv run pre-commit autoupdate` once to pin each `rev` to its current release, then `uv run pre-commit install` to install both commit and pre-push hooks. Check the hook ids against each repo's current `.pre-commit-hooks.yaml` when pinning.

## The rules registry test

Write `tests/unit/test_rules_registry.py` at baseline time (needs dev-only `pyyaml` and `types-PyYAML`, recorded in ADR 0002 as dev tooling):

```python
"""The rule registry's references resolve to files that exist."""

from pathlib import Path
from typing import Any

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_KEYS = {"id", "rule", "applies_to"}
ALLOWED_KEYS = REQUIRED_KEYS | {"source"}
INSTRUCTION_FILES = {"AGENTS.md", "CLAUDE.md"}
RULES: list[dict[str, Any]] = yaml.safe_load(
    (ROOT / "docs" / "rules.yaml").read_text(encoding="utf-8")
)["rules"]


def test_rule_ids_are_unique() -> None:
    ids = [rule.get("id") for rule in RULES]
    assert len(ids) == len(set(ids)), "duplicate rule ids"


@pytest.mark.parametrize("rule", RULES, ids=lambda rule: str(rule.get("id")))
def test_rule_references_resolve(rule: dict[str, Any]) -> None:
    assert REQUIRED_KEYS <= rule.keys() <= ALLOWED_KEYS, f"keys: {sorted(rule)}"
    for pattern in rule["applies_to"]:
        assert any(ROOT.glob(pattern)), f"applies_to {pattern} matches nothing"
    if (source := rule.get("source")) is not None:
        assert Path(source).name not in INSTRUCTION_FILES, f"{source} is an instruction file"
        assert (ROOT / source).is_file(), f"source {source} does not exist"
```

Run it once with a deliberately wrong entry (a missing ADR path, an `applies_to` that matches nothing) and confirm it fails before trusting it.

## Verify skill examples

Illustrations of shape for `.claude/skills/verify/SKILL.md` (`references/verify-skill.md`). In a real project, every command comes from the design doc or the person.

**Data pipeline** (`main.py`, argparse):
- Start: `uv run python -m pipeline.main --run-date 2024-01-01 --source tests/fixtures/orders_small.csv --target-db /tmp/verify.duckdb`
- Drive: one run on the 20-row fixture.
- Evidence: exit status; `SELECT count(*), count(DISTINCT order_id) FROM orders` against the target.
- Pass: exit 0, 20 rows, 20 distinct `order_id` (one row per order, the declared grain). A second run gives the same counts.

**Service** (`main.py`, app factory):
- Start: `uv run uvicorn service.main:create_app --factory --port 8765`, in the background.
- Drive: `curl -s -w '%{http_code}' -X POST localhost:8765/quotes -d @tests/fixtures/quote_request.json`
- Evidence: the status code and the response body. Stop the server after.
- Pass: 201, and the body has the `id` and `total` fields with `total` equal to the fixture's expected value.

**CLI tool** (`cli.py`, click or typer):
- Start: `uv run tool-name summarize tests/fixtures/sample.log`
- Drive: the one command on the fixture.
- Evidence: the exit status and stdout.
- Pass: exit 0, and stdout equals `tests/fixtures/sample.summary.txt`.

**Library** (no entry point; the public API is the contract):
- Start: `uv run python -c "from package_name.api import parse; print(parse(open('tests/fixtures/input.txt').read()))"`
- Drive: one call through the public API, the way a caller imports it.
- Evidence: the printed result.
- Pass: it equals `tests/fixtures/input.expected.txt`, and the import uses only names from `api.py`.
