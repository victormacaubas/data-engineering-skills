# Archetypes

Concrete directory shapes to start from, and the layer table that turns one into a contract. Read this during Decision 1.

These are starting points, not schemas to satisfy. The tree matters much less than the dependency direction it encodes — two projects with different directories and the same one-way flow are architecturally the same; two with identical directories and a cycle between them are not.

## Picking an archetype

| What you're building | Archetype | Entrypoint |
|---|---|---|
| Scheduled job, ETL, backfill | Data pipeline | `main.py` (argparse) |
| HTTP API, long-running server | Service | `main.py` (app factory) |
| Multi-command developer tool | CLI tool | `cli.py` (click/typer) |
| Something imported by other code | Library | no entrypoint; the public API is the contract |

The difference that matters is the entrypoint and where configuration comes from. Everything below the top layer looks similar across all four, because the layering principle doesn't change with the shape.

## Data pipeline / batch job

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

`main.py` stays thin: parse, build config, construct the runner, return its exit code. The moment it grows a branch that decides *what work happens*, that branch belongs in `core/`.

Splitting `io/` from `utils/` is worth doing as soon as the pipeline touches more than one external system, because `io/` is where Decision 5's translation rule lives — each adapter catches its driver's exceptions and raises yours.

## Service

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

`api/` exists so HTTP concerns stay out of `core/`. A function in `core/` shouldn't know it was reached by a POST, shouldn't raise an HTTP exception, and shouldn't return a response model — it takes domain types and returns domain types, and `api/` translates at the boundary. That separation is what lets the same logic serve a route, a CLI backfill, and a test without changing.

The `domain.py` / `wire.py` split follows the same seam: domain types are yours to rename, wire types are a promise to clients. Separate modules stop a refactor in one from silently breaking the other.

## CLI tool

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

Each subcommand should be a few lines in `cli.py` that build arguments into a config object and hand off. When a command body starts doing real work, the tool becomes untestable except through its argument parser — which is slow, awkward, and couples every test to flag names.

If the tool has more than one output format, `render/` earns its own package immediately. Formatting logic that starts inside `core/` never leaves on its own.

## Library

```
package_name/
├── api.py               # The public surface. Everything a caller imports.
├── core/                # Implementation.
├── models/              # Public types — these are part of your contract.
└── errors.py            # Public exceptions — also part of your contract.
```

For a library the layer table is less interesting than the public/private line, because that line *is* the architecture. Decide explicitly which modules callers may import and state it in `CLAUDE.md`. Everything else is free to change.

## Why dependencies flow one way

All of these encode the same rule: entrypoint → core → {models, io, utils}, and never back up the chain.

The payoff is testability at the layer you care about. `utils/` takes values and returns values, so it tests with no setup. `core/` accepts its dependencies, so it tests with fakes. The entrypoint is thin enough that little is left in it to test. Reverse any arrow and that collapses — a `utils/` module that imports from `core/` can't be exercised without constructing the whole workflow, and a `models/` type that reaches for a client drags that client into every test that builds one.

It also makes the import graph readable. When leaves never import upward, you can open any leaf module and know its dependencies are the standard library and its own siblings, without tracing where it sits in a larger flow.

Two consequences worth stating in the ADR:

- **A circular import is a layering error.** If two modules need each other, the shared thing belongs in a third place below both — usually `models/`. `if TYPE_CHECKING:` is the right tool only when the dependency genuinely is hints-only; reaching for it to break a real cycle just hides the cycle from the reader.
- **`models/` holds no logic and no I/O.** It's the bottom of the graph, so anything it imports becomes a dependency of everything above it.

## The layer table

Whichever tree you pick, the artifact that leaves Decision 1 is a table. Write it in `CLAUDE.md` and encode it in `references/enforcement.md`'s contracts.

| Package | May import | Owns |
|---|---|---|
| `cli` | all below | argument parsing, exit codes, composition root |
| `core` | `store`, `models`, `utils` | orchestration, business logic |
| `store` | `models` | all SQL, all driver types and exceptions |
| `render` | `models` | output formatting |
| `models` | nothing in-project | domain types, Protocols |
| `utils` | nothing in-project | leaf helpers |

The "Owns" column matters as much as "May import." It's what tells a later reader where a new piece of code goes — and if two packages both plausibly own something, that ambiguity is a decision you haven't made yet.

## Adapting the shape

Real projects grow directories the archetypes don't name, and that's fine when the addition has a clear responsibility and respects the flow. A pipeline reading and writing several systems may want `io/` split by system. A service with heavy background work may want `workers/` alongside `api/`, at the same layer.

What doesn't survive adaptation is a directory named for a *type* rather than a responsibility. `handlers/`, `managers/`, `classes/`, `misc/`, `helpers/`, `common/` tell a reader nothing about what's inside or where it sits in the graph. If you can't name the responsibility, the code probably belongs in a package that already exists.

## When to skip the tree

For a genuinely small project — one module, a few hundred lines — a flat `tool_name/cli.py` plus `tool_name/core.py` is honest, and premature directory structure costs more than it buys.

Even then, do the rest of the baseline. Identity, seams, error taxonomy, and the test factories are all worth having at any size; the directory tree is the one part that scales with the project rather than preceding it. Split when a module crosses a few hundred lines, not before.
