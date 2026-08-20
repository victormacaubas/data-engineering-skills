# Project Layout

Concrete directory shapes for the three kinds of Python project this standard covers. Read this when starting a new project, adding a package to an existing one, or deciding which directory a new file belongs in. When the repo already has a coherent layout, match it rather than importing a shape from here (see "How to apply these standards" in the root `SKILL.md`).

The root `SKILL.md`'s Module & Project Layout section contains the rules these trees illustrate: one-way dependencies, module size, and `__init__.py` as a package marker. This file shows the shape; that section defines the rule. For whether a given unit should be a class, a function, or a dataclass, see that file's "Choosing a Class, a Function, or a Dataclass" section.

## Picking an archetype

| What you're building | Archetype | Entrypoint |
|---|---|---|
| Scheduled job, ETL, backfill | Data pipeline | `main.py` (argparse) |
| HTTP API, long-running server | Service | `main.py` (app factory) |
| Multi-command developer tool | CLI tool | `cli.py` (click/typer) |

The entrypoint and config source create the meaningful difference. Everything below `core/` looks the same in all three because the layering principle does not change with the shape.

## Data pipeline / batch job

argparse CLI, config from env/SSM, and an orchestrator class that owns the run:

```
pipeline_name/
├── main.py              # argparse CLI. Parse args, build config, call runner.
├── core/                # Orchestration. Composes io and models into a workflow.
│   └── runner.py        # PipelineRunner class — owns state (clients, config, logger).
├── io/                  # Adapters to external systems. Owns their types and errors.
│   ├── warehouse.py
│   └── object_store.py
├── models/              # Dataclasses, enums, domain types. No I/O, no logic.
│   └── config.py
└── utils/               # Leaf helpers: retries, parsing. Knows nothing about core.
    └── retries.py
```

`main.py` stays thin: parse, build config, construct the runner, and return its exit code. Any branch that decides *what work happens* belongs in `core/`.

`io/` and `utils/` sit at the same layer but do different jobs. Collapsing them is the most common way this tree goes wrong. `io/` talks to external systems and owns their types and exceptions: each adapter catches whatever its driver raises and re-raises something of yours, so no `boto3`-shaped or `snowflake`-shaped type appears in a higher signature. `utils/` takes values and returns values. Once a pipeline touches more than one external system, keeping them separate makes the adapters testable one at a time.

## Service (FastAPI, Flask)

No CLI; config comes from the environment via pydantic-settings:

```
service_name/
├── main.py              # App factory, lifespan wiring, uvicorn entrypoint.
├── config.py            # Config(BaseSettings) — env-driven, fail-fast validators.
├── api/                 # HTTP layer. Routes, deps, response schemas.
│   ├── routes.py
│   ├── deps.py
│   └── schemas.py
├── core/                # Business logic. Services, caches, state machines.
│   ├── service.py
│   └── cache.py
├── models/              # Domain types (dataclasses) and wire types (Pydantic).
│   ├── domain.py
│   └── wire.py
└── io/                  # External clients. Owns their types and errors.
    └── client.py
```

The `api/` layer keeps HTTP concerns out of `core/`. A function in `core/` should not know it was reached by a POST, raise `HTTPException`, or return a response model. It takes domain types and returns domain types. `api/` translates at the boundary. This separation lets the same business logic serve a route, a CLI backfill, and a test without changing.

The split between `models/domain.py` and `models/wire.py` follows the same seam: domain types are yours to change, and wire types are a contract with clients. Keeping them in separate modules stops a rename in one from silently breaking the other.

## CLI tool / developer utility

click or typer when the tool has several subcommands:

```
tool_name/
├── cli.py               # click/typer group. Parse commands, wire deps, call core.
├── core/                # Orchestration and processing logic.
│   ├── orchestrator.py  # Top-level workflow class — owns state, composes steps.
│   └── processor.py
├── models/              # Config, domain types, enums.
│   └── config.py
└── utils/               # Formatting, parsing, leaf helpers.
    └── render.py
```

Each subcommand should be a few lines in `cli.py` that build a config object from arguments and hand off to `core/`. When a command body starts doing real work, the tool is testable only through its argument parser.

## Why the dependencies flow one way

All three trees encode the same rule: `main`/`cli` → `core` → `{models, io, utils}`, and never back up the chain.

The payoff is testability at the layer you care about. `utils/` functions take values and return values, so they test with no setup. `core/` accepts dependencies, so it tests with fakes. `main.py` is thin enough that little remains to test. Reverse any arrow and the structure collapses: a `utils/` module that imports from `core/` requires the whole workflow for testing, and a `models/` type that reaches for a client is no longer a value you can build in a test.

It also makes the import graph readable. When `utils/` never imports upward, you can open any leaf module and know it depends only on the standard library and its own siblings. You do not need to trace its place in a larger flow.

Two consequences worth stating:

- **A circular import is a layering error, not an import puzzle.** If two modules need each other, put the shared thing in a third place below both, usually `models/` or sometimes a new `utils/` module. Reaching for `if TYPE_CHECKING:` fixes the symptom; it is the right tool only when the dependency genuinely is hints-only.
- **`models/` holds no logic and no I/O.** It sits at the bottom of the graph, so anything it imports becomes a dependency of everything above. A dataclass that opens a connection in `__post_init__` makes every test that builds one depend on that connection.

## Adapting the shape

These are starting points, not a schema to satisfy. Real projects grow directories that the archetypes do not name. That is fine when the addition has a clear responsibility and respects the flow:

- A pipeline reading and writing many systems may want `io/` split by system rather than one module each.
- A service with heavy background work may want `workers/` alongside `api/`, at the same layer.
- A tool with substantial output formatting may want `render/` below `core/`.

Do not adapt a directory named for a *type* rather than a responsibility. `handlers/`, `managers/`, `classes/`, and `misc/` do not tell a reader what is inside or where it sits in the graph. If you cannot name the responsibility, the code probably belongs in an existing directory.

For very small projects (one module, a few hundred lines), skip the tree entirely. A flat `tool_name/cli.py` plus `tool_name/core.py` is appropriate, and premature directory structure costs more than it buys. Split when a file crosses the root standard's size threshold, not before.
