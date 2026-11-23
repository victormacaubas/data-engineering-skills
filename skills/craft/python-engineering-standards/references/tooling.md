# Tooling

A baseline `pyproject.toml` toolchain for projects that do not have one yet. Read this when scaffolding a new project or adding lint/type/test configuration to a repo that has none. When the repo already has tooling config, that config wins (see "How to apply these standards" in the root `SKILL.md`).

The stack uses **uv** for environments and dependencies, **Ruff** for linting and formatting, **mypy** for type checking, **pytest** for tests, and **pre-commit** for fast checks before every commit and the full gate before every push. One config file keeps the tools fast and non-overlapping.

**Don't copy version numbers from this page.** Take the Python version from the project's `requires-python`, and pin tool and hook versions to their current release when you write the config (`uv add` resolves the current release for tools; `pre-commit autoupdate` pins hook revs). A version copied from a reference file is stale on the day it lands.

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
# target-version omitted: Ruff infers it from `project.requires-python`,
# so the minimum supported version lives in one place.

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

The root standard aims for `mypy --strict` on core modules and runs it when the project configures it. This config makes that literal:

```toml
[tool.mypy]
# python_version omitted: mypy checks against the interpreter it runs
# under, which uv selects from `requires-python`.
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
addopts = "-ra --strict-markers -m 'not integration and not stress'"
markers = [
    "integration: touches real infrastructure; excluded from default runs",
    "stress: depends on thread timing or load; excluded from default runs",
]
```

`--strict-markers` turns a typo'd marker into an error instead of a test that never runs. The `-m` expression is what excludes the two lanes; declaring a marker excludes nothing. Unit tests run everywhere by default. Run the integration lane with `uv run pytest -m integration` where credentials exist, and the stress lane with `uv run pytest -m stress`; a `-m` on the command line replaces the one in `addopts`. A new lane's marker goes in both the list and the expression.

When the project uses Hypothesis, make the default run repeatable in the root `conftest.py`:

```python
from hypothesis import settings

settings.register_profile("repeatable", derandomize=True)
settings.register_profile("search", derandomize=False, max_examples=1000)
settings.load_profile("repeatable")
```

`derandomize=True` seeds generation from each test function, so every default run tests the same inputs until the test, Hypothesis, or Python changes. A gate that draws new inputs on each run can fail with no code change. Outside the gate, run `uv run pytest --hypothesis-profile=search` to look for new failing inputs, and add each one it finds to the test as an `@example` so the default run keeps it.

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

Checks run in three tiers:

1. On each commit: the fast hooks below (ruff, ruff-format, detect-secrets). A slow commit hook gets bypassed.
2. Before each push or pull request: the full gate on your own machine. That is the project's one gate command; when it has none, the type check and the default test command. A push is not how you find out the suite fails.
3. In CI: the same gate, as the check no contributor can skip.

When the default suite is too slow to run before a push, move the slow tests into a marked lane (see *pytest* above) rather than dropping the second tier.

```yaml
# .pre-commit-config.yaml
default_install_hook_types: [pre-commit, pre-push]
default_stages: [pre-commit]
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.0.0   # replaced by pre-commit autoupdate
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/Yelp/detect-secrets
    rev: v0.0.0   # replaced by pre-commit autoupdate
    hooks:
      - id: detect-secrets
  - repo: local
    hooks:              # replace both with the project's gate command when it has one
      - id: mypy
        name: mypy
        entry: uv run mypy .
        language: unsupported
        pass_filenames: false
        always_run: true
        stages: [pre-push]
      - id: pytest
        name: pytest
        entry: uv run pytest
        language: unsupported
        pass_filenames: false
        always_run: true
        stages: [pre-push]
```

`detect-secrets` guards against committing a credential. See `references/security.md` for why even one leak matters. `default_stages` keeps the fast hooks on the commit, and the two local hooks run only before a push. `language: unsupported` (called `system` before pre-commit 4.4) runs the command as written, with no hook environment. Run `uv run pre-commit autoupdate` once to pin each `rev` to its current release, then `uv run pre-commit install`, which installs both the commit and the push hook because of `default_install_hook_types`. After that, update the pins deliberately, and check the hook ids against each repo's current `.pre-commit-hooks.yaml`, since hook repos rename them occasionally.
