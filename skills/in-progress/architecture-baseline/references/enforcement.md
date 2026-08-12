# Enforcement

Turning the decisions into configuration that fails the build. Read this during Decision 6.

The organizing idea: every rule from Decisions 1–5 should end up either in a tool's config or in a test. A rule that lives only in `CLAUDE.md` gets followed until the first time it's inconvenient, and nobody finds out.

The stack is **uv** for environments, **Ruff** for lint and format, **mypy** for types, **pytest** for tests, and **import-linter** for the layer map. One config file, one gate command, no overlap between tools.

## uv

```bash
uv init my-project
uv add <runtime deps>
uv add --dev pytest ruff mypy import-linter pre-commit
uv run pytest
```

Commit `uv.lock`. The lockfile is what makes the environment reproducible across machines and CI.

Everything below assumes commands run through `uv run`. Bare `python` and `pip` bypass the managed environment and will eventually hit a different interpreter than the one the lockfile describes.

## import-linter — the layer map, enforced

This is the piece that makes the baseline stick. Everything else on this page is standard hygiene; this is the part that encodes *your* architecture.

Three contract types cover almost everything Decision 1 produces.

### Layers

Expresses the one-way flow. List packages top to bottom — each may import anything below it, nothing above.

```toml
[tool.importlinter]
root_package = "mypackage"

[[tool.importlinter.contracts]]
name = "Layered architecture"
type = "layers"
layers = [
    "mypackage.cli",
    "mypackage.core",
    "mypackage.store",
    "mypackage.models",
]
```

Packages not listed are unconstrained, which is a useful escape hatch while a package's position is still unsettled — but an unlisted package is an undecided one, so keep the list short by finishing the decision rather than by omitting things.

### Forbidden

Expresses "this package owns this technology." The literal encoding of Decision 1's rule that driver types don't escape their adapter.

```toml
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

Write one of these for each external technology in the project: the database driver, the HTTP client, the cloud SDK, `subprocess`. This contract catches the specific failure where a driver quietly becomes part of the architecture — the import appears in one convenient place, then in five, and by the time it's in a public signature the technology can't be swapped without a user-visible change.

### Independence

Expresses "these siblings don't know about each other." Useful for adapters, for plugins, and for keeping deterministic code free of the expensive kind.

```toml
[[tool.importlinter.contracts]]
name = "Adapters are independent"
type = "independence"
modules = [
    "mypackage.io.warehouse",
    "mypackage.io.object_store",
]
```

A good candidate is any pair of packages you described with the word "separate" during Decision 1. Stated principles like "measured and modeled stay separate" or "ingestion and reporting are independent" hold at the table level for about a month and then quietly stop holding at the import level, because nothing was checking.

### Running it

```bash
uv run lint-imports
```

Add it to the gate. On its own it's a fast check — it reads the import graph statically and doesn't execute anything.

## Retrofit mode: the ratchet

For an existing project, the contracts will fail immediately. Don't weaken them — list the current violations explicitly:

```toml
[[tool.importlinter.contracts]]
name = "Layered architecture"
type = "layers"
layers = ["mypackage.cli", "mypackage.core", "mypackage.store", "mypackage.models"]
ignore_imports = [
    "mypackage.parser.extraction -> mypackage.store.models",
    "mypackage.store.hydration -> mypackage.parser.session",
]
unmatched_ignore_imports_alerting = "error"
```

Two properties make this a ratchet rather than a suppression list:

- **New violations fail** the moment they're introduced, so the leak stops growing on day one even if the cleanup takes months. This is the important half. A bounded problem is a scheduling question; an unbounded one is a risk.
- **A listed exception that no longer matches a real import fails the build.** The moment someone fixes a violation, the build tells them to delete its entry, so the list can't stay long after the problem is gone. This is `unmatched_ignore_imports_alerting`, and `error` is already the default — set it explicitly anyway, because it's the behavior the ratchet depends on and a future reader shouldn't have to know it was inherited.

Treat the count as a tracked number. It only goes down.

## Ruff

Linter and formatter in one — don't add Black or isort alongside it.

```toml
[tool.ruff]
line-length = 88
target-version = "py312"

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
    "RUF",
]
```

`TID` is worth calling out: `flake8-tidy-imports` can ban specific modules or attributes from being imported at all, which overlaps with import-linter's forbidden contracts and is useful for narrower rules that aren't about layering:

```toml
[tool.ruff.lint.flake8-tidy-imports.banned-api]
"datetime.datetime.utcnow".msg = "Use datetime.now(timezone.utc) — utcnow returns a naive datetime."
```

Add `S` (bandit) for security-sensitive code. Suppress per line with `# noqa: <rule>` and a reason, never a blanket ignore — a blanket ignore is how a rule stops applying to a whole package without anyone deciding that.

## mypy

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_unreachable = true
```

Start strict on a new project. Retrofitting strict onto an existing one is painful enough that most teams never do it, which is the argument for spending the cost now while the codebase is a few hundred lines.

For third-party packages without stubs, override per package rather than globally — a global `ignore_missing_imports` masks real errors everywhere:

```toml
[[tool.mypy.overrides]]
module = "some_untyped_lib.*"
ignore_missing_imports = true
```

One thing strict mode won't catch, and it's worth knowing before you rely on it: a `dict[str, Any]` crossing a boundary type-checks green while every key access inside it is unverified. If a payload has a known shape, give it a dataclass. Decision 3's types are the natural home.

## pytest

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers"
markers = [
    "integration: touches real infrastructure; excluded from default runs",
]
```

`--strict-markers` turns a typo'd marker into an error rather than a test that silently never runs.

## The gate

One command. Four separate commands means someone runs three of them.

```makefile
.PHONY: check
check:
	uv run ruff format --check .
	uv run ruff check .
	uv run lint-imports
	uv run mypy
	uv run pytest
```

Order matters a little: the fast, cheap checks run first so a formatting mistake fails in two seconds rather than after the test suite.

Put `make check` in `CLAUDE.md` as the definition of done. That single line is what makes the gate reachable by anyone working in the repo, and it's what turns "the tests pass" into a statement about the architecture as well as the behavior.

## pre-commit and CI

Fast checks on commit, everything in CI.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
```

`detect-secrets` is cheap insurance: a credential committed once is in the history permanently, and rotating it is the only real remedy.

Install the hooks so they actually fire — `uv run pre-commit install` — and pin the `rev` values, updating them deliberately.

CI runs `make check`, the same command, so a green local run means a green pipeline. If CI runs a different set of checks than the gate, the gate is the one that stops being trusted.
