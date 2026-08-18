# Project Layout

Concrete directory shapes for the three kinds of Python project this standard covers. Read this when starting a new project, adding a package to an existing one, or deciding which directory a new file belongs in. When the repo already has a coherent layout, that layout wins — match it rather than importing a shape from here (see "How to apply these standards" in the root `SKILL.md`).

The rules these trees illustrate — one-way dependencies, module size, `__init__.py` as a package marker — are in the root `SKILL.md`'s Module & Project Layout section. This file is the picture; that section is the rule. For whether a given unit should be a class, a function, or a dataclass, see that file's "Choosing a Class, a Function, or a Dataclass" section.

## Picking an archetype

| What you're building | Archetype | Entrypoint |
|---|---|---|
| Scheduled job, ETL, backfill | Data pipeline | `main.py` (argparse) |
| HTTP API, long-running server | Service | `main.py` (app factory) |
| Multi-command developer tool | CLI tool | `cli.py` (click/typer) |

The difference that matters is the entrypoint and where config comes from. Everything below `core/` looks the same in all three, because the layering principle doesn't change with the shape.

## Data pipeline / batch job

argparse CLI, config from env/SSM, orchestrator class that owns the run:

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

`main.py` stays thin: parse, build config, construct the runner, return its exit code. The moment it grows a branch that decides *what work happens*, that branch belongs in `core/`.

`io/` and `utils/` sit at the same layer but do different jobs, and collapsing them is the most common way this tree goes wrong. `io/` talks to external systems and owns their types and exceptions — each adapter catches whatever its driver raises and re-raises something of yours, so nothing `boto3`-shaped or `snowflake`-shaped appears in a signature further up. `utils/` takes values and returns values. Once a pipeline touches more than one external system, keeping them separate is what makes the adapters testable one at a time.

## Service (FastAPI, Flask)

No CLI — config comes from the environment via pydantic-settings:

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

The `api/` layer exists so HTTP concerns stay out of `core/`. A function in `core/` shouldn't know it was reached by a POST, shouldn't raise `HTTPException`, and shouldn't return a response model — it takes domain types and returns domain types. `api/` translates at the boundary. That separation is what lets the same business logic serve a route, a CLI backfill, and a test without changing.

The split between `models/domain.py` and `models/wire.py` follows the same seam: domain types are yours to change, wire types are a contract with clients. Keeping them in separate modules stops a rename in one from silently breaking the other.

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

Each subcommand should be a few lines in `cli.py` that build arguments into a config object and hand off to `core/`. When a command body starts doing real work, the tool becomes untestable except through its argument parser.

## Why the dependencies flow one way

All three trees encode the same rule: `main`/`cli` → `core` → `{models, io, utils}`, and never back up the chain.

The payoff is testability at the layer you care about. `utils/` functions take values and return values, so they test with no setup. `core/` accepts its dependencies, so it tests with fakes. `main.py` is thin enough that there's little left in it to test. Reverse any arrow and that collapses: a `utils/` module that imports from `core/` can't be exercised without constructing the whole workflow, and a `models/` type that reaches for a client stops being a value you can build in a test.

It also makes the import graph readable. When `utils/` never imports upward, you can open any leaf module and know it depends on nothing but the standard library and its own siblings — no need to trace where it sits in a larger flow.

Two consequences worth stating:

- **A circular import is a layering error, not an import puzzle.** If two modules need each other, the shared thing belongs in a third place below both — usually `models/`, sometimes a new `utils/` module. Reaching for `if TYPE_CHECKING:` fixes the symptom; it's the right tool only when the dependency genuinely is hints-only.
- **`models/` holds no logic and no I/O.** It's the bottom of the graph, so anything it imports becomes a dependency of everything above. A dataclass that opens a connection in `__post_init__` drags that connection into every test that builds one.

## Adapting the shape

These are starting points, not a schema to satisfy. Real projects grow directories the archetypes don't name, and that's fine when the addition has a clear responsibility and respects the flow:

- A pipeline reading and writing many systems may want `io/` split by system rather than one module each.
- A service with heavy background work may want `workers/` alongside `api/`, at the same layer.
- A tool with substantial output formatting may want `render/` below `core/`.

What doesn't survive adaptation is a directory named for a *type* rather than a responsibility. `handlers/`, `managers/`, `classes/`, `misc/` tell a reader nothing about what's inside or where it sits in the graph. If you can't name the responsibility, the code probably belongs in an existing directory.

For very small projects — one module, a few hundred lines — skip the tree entirely. A flat `tool_name/cli.py` plus `tool_name/core.py` is honest, and premature directory structure costs more than it buys. Split when a file crosses the size threshold in the root standard, not before.
