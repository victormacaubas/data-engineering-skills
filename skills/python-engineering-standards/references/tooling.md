# Tooling

A baseline `pyproject.toml` toolchain for projects that don't have one yet. Read this when scaffolding a new project, or when adding lint/type/test configuration to a repo that has none. When the repo already has tooling config, that config wins — don't fight it (see "How to apply these standards" in the root `SKILL.md`).

The stack: **uv** for environments and dependencies, **Ruff** for linting and formatting, **mypy** for type checking, **pytest** for tests, **pre-commit** to run the fast checks before every commit. One config file, fast tools, no overlap between them.

## uv

Use uv for environment and dependency management. It replaces pip, venv, and pip-tools with one fast tool and produces a lockfile by default.

```bash
uv init my-project          # scaffold pyproject.toml
uv add boto3 pydantic       # runtime deps
uv add --dev pytest ruff mypy pre-commit
uv run pytest               # run inside the managed env, no activate needed
```

Commit `uv.lock`. The lockfile is what makes "works on my machine" reproducible — `uv sync` on any machine rebuilds the exact environment.

If uv isn't available (locked-down CI images, old infra), `python -m venv` + `pip install` with a pinned `requirements.txt` is the fallback. The principle is the same: pinned, committed, reproducible.

## Ruff

Ruff is both the linter and the formatter — don't add Black or isort alongside it; `ruff format` and the `I` rules cover them.

```toml
[tool.ruff]
line-length = 88
target-version = "py311"    # set to the project's minimum supported version

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

This selection enforces several rules from the root standard mechanically — import grouping, naming, the mutable-default footgun — so reviews don't have to. Add `S` (bandit) for security-sensitive codebases. Suppress per-line with `# noqa: <rule>` and a reason, not blanket ignores.

## mypy

The root standard says to write code as if `mypy --strict` passes. This config makes that literal:

```toml
[tool.mypy]
python_version = "3.11"
strict = true
warn_unreachable = true
```

For third-party libraries without type stubs, override per package — not globally, which would mask real errors everywhere:

```toml
[[tool.mypy.overrides]]
module = "snowflake.connector.*"
ignore_missing_imports = true
```

If `strict = true` is too much for an existing codebase being retrofitted, start with `disallow_untyped_defs = true` on new modules and ratchet up.

## pytest

```toml
[tool.pytest.ini_options]
addopts = "-ra --strict-markers"
markers = [
    "integration: touches real infrastructure; excluded from default runs",
]
```

`--strict-markers` turns a typo'd marker into an error instead of a silently-never-run test. The `integration` marker matches the Testing section of the root standard: unit tests run everywhere by default; integration tests run with `-m integration` in the lane that has credentials.

## pre-commit

Run the fast checks on every commit; leave the slow ones (mypy, full test suite) to CI.

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

`detect-secrets` is the cheap insurance against committing a credential — see `references/security.md` for why that matters even once. Install with `uv run pre-commit install` so the hooks actually fire.
