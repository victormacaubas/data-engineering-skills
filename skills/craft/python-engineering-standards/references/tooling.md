# Tooling

A baseline `pyproject.toml` toolchain for projects that do not have one yet. Read this when scaffolding a new project or adding lint/type/test configuration to a repo that has none. When the repo already has tooling config, that config wins (see "How to apply these standards" in the root `SKILL.md`).

The stack uses **uv** for environments and dependencies, **Ruff** for linting and formatting, **mypy** for type checking, **pytest** for tests, and **pre-commit** for fast checks before every commit. One config file keeps the tools fast and non-overlapping.

## uv

Use uv for environment and dependency management. It replaces pip, venv, and pip-tools with one tool and produces a lockfile by default.

```bash
uv init my-project          # scaffold pyproject.toml
uv add boto3 pydantic       # runtime deps
uv add --dev pytest ruff mypy pre-commit
uv run pytest               # run inside the managed env, no activate needed
```

Commit `uv.lock`. The lockfile makes "works on my machine" reproducible: `uv sync` rebuilds the exact environment on any machine.

If uv is unavailable (locked-down CI images, old infra), use `python -m venv` + `pip install` with a pinned `requirements.txt`. The principle stays the same: pinned, committed, reproducible.

## Ruff

Ruff is both the linter and the formatter. Do not add Black or isort alongside it; `ruff format` and the `I` rules cover them.

```toml
[tool.ruff]
line-length = 88
target-version = "py312"    # set to the project's minimum supported version

[tool.ruff.lint]
select = [
    "E", "W",    # pycodestyle — the PEP 8 mechanics from the Style section
    "F",         # pyflakes — undefined names, unused imports
    "I",         # isort — the three-group import order, enforced
    "N",         # pep8-naming — snake_case / PascalCase conventions
    "UP",        # pyupgrade — modern syntax for the target version
    "B",         # bugbear — catches mutable default args and friends automatically
    "C4",        # comprehensions — simpler, faster literal constructions
    "SIM",       # simplify — collapses needlessly clever code
    "RUF",       # ruff-specific rules
]
```

This selection mechanically enforces several root-standard rules: import grouping, naming, and the mutable-default footgun. Add `S` (bandit) for security-sensitive codebases. Suppress per-line with `# noqa: <rule>` and a reason, not blanket ignores.

## mypy

The root standard says to write code as if `mypy --strict` passes. This config makes that literal:

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_unreachable = true
```

For third-party libraries without type stubs, override per package rather than globally, which would mask real errors everywhere:

```toml
[[tool.mypy.overrides]]
module = "snowflake.connector.*"
ignore_missing_imports = true
```

If `strict = true` is too much for a retrofitted codebase, start with `disallow_untyped_defs = true` on new modules and ratchet up.

## pytest

```toml
[tool.pytest.ini_options]
addopts = "-ra --strict-markers"
markers = [
    "integration: touches real infrastructure; excluded from default runs",
]
```

`--strict-markers` turns a typo'd marker into an error instead of a test that never runs. The `integration` marker matches the Testing section of the root standard: unit tests run everywhere by default; integration tests run with `-m integration` in the lane with credentials.

## import-linter

Nothing above checks the one-way dependency flow in `references/layout.md`. Ruff enforces import *ordering*, but it does not catch a `utils/` module importing from `core/`, which causes the real failure. `import-linter` closes that gap by reading the import graph statically and failing the build on a violation:

```bash
uv add --dev import-linter
```

```toml
[tool.importlinter]
root_package = "mypackage"
include_external_packages = true

[[tool.importlinter.contracts]]
name = "Layered architecture"
type = "layers"
layers = [
    "mypackage.main",
    "mypackage.core",
    "mypackage.io",
    "mypackage.models",
]

[[tool.importlinter.contracts]]
name = "Only io touches the cloud SDK"
type = "forbidden"
source_modules = ["mypackage.core", "mypackage.models", "mypackage.utils"]
forbidden_modules = ["boto3", "snowflake.connector"]
```

The `layers` contract lists packages top to bottom: each may import anything below it and nothing above. The `forbidden` contract keeps a driver's types inside the adapter that owns them; use one for each external technology in the project.

Two mechanics matter on the first run. `include_external_packages = true` is required as soon as a forbidden contract names anything outside the root package, including the standard library; otherwise, the run aborts before checking anything. Every package named in a contract must exist on disk with an `__init__.py`: an empty package is analyzed and kept, but a missing directory fails with `Missing layer 'mypackage.io': module mypackage.io does not exist.`

Run it with `uv run lint-imports`. It executes nothing, so it is fast enough to run at the front of the gate alongside the linters.

## pre-commit

Run fast checks on every commit; leave slow checks (mypy, the full test suite) to CI.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0    # pin; update deliberately
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
```

`detect-secrets` guards against committing a credential. See `references/security.md` for why even one leak matters. Install with `uv run pre-commit install` so the hooks run.
