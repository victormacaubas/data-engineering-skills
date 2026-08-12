---
name: architecture-baseline
description: Establish a project's architectural constraints before any feature work — layer map, runtime dependencies and libraries, identity model, injected seams, error taxonomy, machine-enforced import contracts, testing conventions, and a specified first change. Use this whenever starting a new codebase, scaffolding a repo, or adding the first module to an empty project, and whenever someone says "set up the project", "what structure should this have", "what libraries should we use", or "let's get this started". Also use it when an existing project keeps needing structural refactors, has grown circular imports or leaking infrastructure types, or has agents producing inconsistent patterns across changes. This decides and documents; it does not build the product. Run it before the first feature change, not after.
---

# Architecture Baseline

The decisions that are cheap now and expensive later, made once, written down in a form a machine can check.

## Why this runs first

Each implementation run starts blind. It reads the code around its task and resolves ambiguity by matching whatever pattern it finds nearby — which is the right instinct, and the reason drift compounds instead of self-correcting. The first module that reaches across a boundary becomes the precedent every later change copies, and by the time it's visible it's in thirty files.

Two things follow, and they shape everything below:

- **Point at the pattern to copy.** The first change this baseline hands off — the walking skeleton — exists partly so later work has something correct to imitate. Say so in `CLAUDE.md` rather than leaving it to be discovered.
- **Constraints beat documentation.** "The store layer owns all database access" is a sentence in a design doc that can be read and still violated, because nothing checks. The same rule as a contract in `pyproject.toml` fails the build.

The exit condition follows from the second: **anything decided here that doesn't end up in the quality gate is a wish.**

## What you're producing

The baseline **decides and declares**. It does not build the product — the first change does that, through the normal propose-and-implement process.

The practical line: declarations are types, Protocols, exception classes, contracts, config, and written conventions. Behavior — functions with logic, SQL, I/O, and the tests that exercise them — is out of scope here.

By the end the repo contains:

- **ADRs** for each decision below, written during the conversation rather than reconstructed later
- **A layer map** in `CLAUDE.md`, plus import contracts that enforce it
- **A closed dependency set** — what the project depends on, and what was deliberately excluded
- **`errors.py`** with the taxonomy and the translation rule
- **Protocols** for each injected seam, each with its fake
- **Domain types** from the identity decision
- **A configured quality gate** — one command, wired into CI
- **A specified first change** — the walking skeleton, with acceptance criteria

It should be small, and most of it is prose and config. If the baseline is taking more than an hour or two of conversation, you have drifted into designing features.

## How to run this

This is a conversation, not a generation task. The decisions belong to the person you're working with — your job is to force each one into the open, offer a default with the reasoning behind it, and record what they actually chose.

For each of the seven decisions below: ask the question, propose a default, get an answer, write it down. Don't batch all seven into one message; the answers depend on each other. Don't hand off the first change with a decision still open — an unmade decision becomes a guess made by whoever writes the code first.

If the person says "you pick," pick, state the reasoning in one line, and flag it as yours in the ADR. A default you named is recoverable. A default nobody noticed is the thing you'll be refactoring in a month.

---

## Decision 1 — Frame: archetype and layer map

**Ask:** What is this thing — a scheduled job, a service, a developer tool, a library? What are the top-level responsibilities, and which of them is allowed to know about which?

Read `references/archetypes.md` for the concrete directory shapes and the reasoning behind one-way dependency flow. Pick the archetype that matches, then adapt it — the trees are starting points, not schemas to satisfy.

The artifact is a table, and it is the single highest-leverage thing produced by this whole process:

| Package | May import | Owns |
|---|---|---|
| `cli` | everything below | argument parsing, exit codes, composition root |
| `core` | `store`, `models`, `utils` | orchestration, business logic |
| `store` | `models` | all database access, all SQL, all driver types |
| `models` | nothing in-project | domain types, no logic, no I/O |

Two rules make the table worth writing:

- **Dependencies flow one way.** If two packages need each other, the shared thing belongs in a third package below both. A circular import is a layering error, not an import puzzle — reaching for `if TYPE_CHECKING:` treats the symptom.
- **A package that owns an external technology owns its types.** Nothing `sqlite3`-shaped leaves `store/`, nothing `boto3`-shaped leaves the S3 adapter, nothing `requests`-shaped leaves the client. The moment a driver type appears in a signature three layers up, that driver is in your architecture whether you meant it or not.

Name packages for responsibilities, never for types. `handlers/`, `managers/`, `classes/`, `misc/`, `helpers/` tell a reader nothing about what's inside or where it sits in the graph.

## Decision 2 — Dependencies and runtime stack

**Ask:** What does this depend on at runtime, and what are we deliberately not using?

This decision gets skipped more reliably than any other, because it doesn't feel like a decision — it feels like a series of imports. But whoever writes the first file picks the CLI framework, the database, the serialization library, and the HTTP client, and nobody revisits any of it. Those choices then shape every layer below them.

Settle, concretely:

- **The entrypoint framework** — argparse, click, typer, a web framework, or nothing
- **Persistence** — which database or file format, and which driver
- **External clients** — the SDKs for whatever services this talks to
- **Anything doing validation, serialization, or config** beyond the standard library

Three rules keep the set honest:

- **The standard library until a dependency earns itself.** Every dependency is something to install, upgrade, audit, and eventually migrate off. `dataclasses` and `argparse` are unglamorous and they never break.
- **Name what you excluded and why.** "No ORM; the queries are simple and hand-written SQL stays legible" is more useful in six months than the absence of an ORM, because it stops the question being re-litigated by someone who assumes nobody considered it.
- **The set is closed after this.** Adding a runtime dependency later is a decision that gets an ADR, not an implementation detail resolved mid-task. This matters most in delegated work: an implementer that hits a task needing a new library should stop and hand it back rather than choosing one.

Then pair each dependency with the package from Decision 1 that owns it — the database driver belongs to `store/`, the HTTP client to its adapter. That pairing is what makes Decision 5's translation rule and Decision 6's forbidden contracts writable at all. A dependency with no owning package is one that will end up imported everywhere.

## Decision 3 — Identity and grain

**Ask:** What is one record? What makes it unique? Is that key stable if the process runs twice?

This decision looks like data modeling and gets skipped by anyone who doesn't think of themselves as doing data modeling. It belongs here because identity changes are breaking, they cascade into the schema, every query, every fixture, and every test, and they tend to surface late — the moment two things you assumed were distinct turn out to collide.

Settle:

- **The grain.** One row of the primary table is one *what*, stated in a sentence. Get this wrong and every aggregate downstream is subtly incorrect.
- **The natural key.** What identifies a record independent of any surrogate id you assign. If the key comes from an external system, decide now whether it's unique in that system or only within some scope — an id that's unique per project is not unique across projects, and qualifying it later is a breaking change.
- **Re-run behavior.** If the same input is processed twice, do you get one record or two? That answer is your upsert key, and it's the difference between an idempotent pipeline and a duplicate-generating one.

For projects with no persistence, the equivalent question is what the core domain entity is and what makes two instances the same thing. It's a shorter conversation, not a skippable one.

## Decision 4 — Seams

**Ask:** Which dependencies get injected behind a Protocol, and which are just constructed where they're used?

A seam is a boundary where you can substitute a real implementation for a test double. Too few and the code is untestable without patching module paths. Too many and you've built indirection a reader walks through to reach the one path that ever runs.

The rule that decides it cleanly: **a dependency is a seam if it crosses a process boundary, is slow, paid, or nondeterministic — or if the only way to test around it would be to patch a module path.**

That last clause is the sharp one. If you can already picture writing `@patch("module.path.thing")` to test a unit, the seam is missing. Patching couples the test to the internal structure of the thing it tests, which is why a suite full of `@patch` decorators seizes up the moment you rename anything. Introducing the seam instead usually deletes the patches wholesale.

Typical seams: the clock, the filesystem, subprocess execution, HTTP clients, the database, any paid API. Typical non-seams: a parsing function, a dataclass, anything pure.

Two constraints keep this from overreaching:

- **Every Protocol ships with its fake, in the same commit.** A Protocol with one implementation and no fake is speculation. A Protocol with a real implementation and a test fake has two implementations, which is the bar.
- **Make injection required, not defaulted.** `def __init__(self, runner: CommandRunner)` beats `runner: CommandRunner | None = None` with a fallback. The default-argument version means a test that forgets to inject silently constructs the real thing — which, for anything paid or destructive, you find out about later and expensively.

Wire the concrete implementations at one composition root: the CLI entrypoint or a `build_*` factory. Nothing below it constructs its own collaborators.

## Decision 5 — Error taxonomy and boundary translation

**Ask:** What can go wrong in a way a caller should handle differently, and where does each failure get translated?

Write `errors.py` now, with a base exception and the handful of domain errors you can already name. You'll add more; the point is that the file exists so the first person to need a domain error doesn't reach for a builtin.

The rule that gives it teeth: **a package translates foreign exceptions at its own boundary.** `store/` catches the driver's errors and raises `StoreError`. The HTTP client catches connection errors and raises `UpstreamError`. Callers depend on your vocabulary, not your dependencies'.

The tell that this rule is missing: an entrypoint catching `sqlite3.Error` or `requests.RequestException`. When that appears, the driver's exception hierarchy has become part of the CLI's contract, and swapping the driver — one of the dependencies you just chose in Decision 2 — is now a user-visible change.

Its corollary is worth stating explicitly, because it's the one that erodes: **once a package has a taxonomy, code inside it stops raising bare `ValueError` and `RuntimeError`.** A bare builtin forces callers into `except ValueError`, which catches every unrelated failure from anywhere in the stack and reports it as though it were the expected one.

At the entrypoint, map domain errors to exit codes in one place — a decorator or a single `try` around the dispatch, not repeated per command.

## Decision 6 — Encode it

Everything above becomes configuration in this step. Read `references/enforcement.md` for the concrete setup.

What lands:

- **Import contracts** expressing the layer map from Decision 1, checked by `import-linter`
- **Forbidden contracts** pinning each Decision 2 dependency to its owning package
- **Ruff, mypy, pytest** configured so the mechanical rules are mechanical
- **One command that runs the whole gate** — `make check`, `just check`, whatever. One command, because a gate with four steps gets run partially.
- **CI running that same command**, so the gate is the same locally and remotely

Then put the gate command in `CLAUDE.md`, because that's what makes it reachable by everyone working in the repo, human or otherwise.

## Decision 7 — Testing conventions

**Ask:** What may a test assert against, and where does shared test data come from?

Nothing in this step creates test files. It sets the rules the first change will follow. Read `references/test-infrastructure.md` for the shapes these describe, and record them in the testing ADR and `CLAUDE.md`.

Settle:

- **One canonical builder per domain type**, living in `tests/factories.py`. The moment a second copy of a builder exists inside a test module, the two start drifting, and a test that passes because its local builder defaults a field differently proves nothing.
- **One fake per seam** from Decision 4, in `tests/fakes.py`, written alongside its Protocol. Tests inject dependencies; they don't patch module paths.
- **What tests may assert against**: behavior through the public surface. No positional access into structured results, no importing underscore-prefixed helpers, no patching anything that has a seam.
- **The litmus test**, which belongs in `CLAUDE.md` verbatim: *if a change that preserves behavior breaks a test, the test was wrong.* It reframes a refactor breaking tests from an expected cost into a finding.
- **The integration lane** exists from day one — a marker, excluded from the default run — so the first test that needs real infrastructure has somewhere to go that isn't the main suite.

Why this is a decision rather than something that accretes: when shared test infrastructure has no declared home, every piece of work writes its own local helper, because there's nothing to import. Those copies drift silently, and eventually the suite becomes the main obstacle to changing the source it exists to protect — at which point improving the code requires rewriting tests, so it doesn't happen.

---

## Handing off: the first change

The baseline stops here. Building the product is the first change, through the normal propose-and-implement process — and that first change is the **walking skeleton**: the shortest path from entrypoint to storage and back, through every layer, with real wiring.

**Scope it as a path, not a feature.** "The smallest feature" is the wrong question and reliably produces something too large, because a real feature carries real logic. The right question is *what is the shortest route from the entrypoint to persistence and back out, with the least logic sitting on it.* Read one input, store one record, read it back. For a service, one endpoint returning one stored thing. The logic is deliberately trivial; proving the wiring is the entire point.

Specify these as the change's acceptance criteria:

- One command or endpoint works end to end against real storage
- The composition root constructs the concrete implementations and passes them down; nothing below it constructs its own collaborators
- Every seam from Decision 4 is injected, with its fake in `tests/fakes.py`
- `tests/conftest.py` and `tests/factories.py` exist and follow Decision 7
- One test drives it through the public entrypoint, so broken wiring fails loudly
- `make check` passes, import contracts included

That last criterion is the real exit condition for the baseline. **Until a change has run the contracts against a real import graph, they are unverified assertions** — package names might be wrong, the layer order might be backwards, a forbidden contract might be scoped to the wrong module. The first change is what proves the baseline was right, which is why it should be the next thing that happens rather than the fifth.

Two things to say in the change proposal, because they don't survive on their own:

- **Keep it to one path.** The second feature is its own change. A skeleton that absorbs "while we're here" work stops being a demonstration of the wiring and becomes the thing everyone copies badly.
- **The skeleton is the reference implementation.** Record that in `CLAUDE.md`. Given that later work resolves ambiguity by copying whatever pattern is nearby, naming the pattern to copy is the cheapest leverage available.

### Why the baseline stops at declarations

The tempting alternative is to sketch the implementation here — class signatures, empty method bodies, module stubs for everything you expect to need. It's weaker for one reason: **a slice is verified and a signature is a guess.** A composition root that runs demonstrably constructs; a signature written before any code exists is a prediction about a shape nobody understands yet, and it hardens into a constraint before anyone has learned whether it's right. That's the same failure as designing the whole architecture upfront, just at a smaller scale.

Types, Protocols, and exception classes are different, and that's why they're in scope. They're contracts, not predicted implementations — a Protocol declares what a caller may depend on, and an exception class declares what a caller may catch. Neither one guesses at how anything works.

---

## Writing it down

**ADRs** capture each decision and its reasoning. Read `references/adr-set.md` for the format and the seven stubs. Write them during the conversation, while the alternatives are still live — an ADR reconstructed after the fact records the decision but loses the thing that makes it useful, which is what else was on the table and why it lost.

**`CLAUDE.md` holds rules and conventions, not inventory.** The line is durability: a rule or a convention describes *how to decide* and stays true as the code changes. An inventory describes *what currently exists*, goes stale at the first refactor, and then actively misleads — worse than being absent, because it still reads as authoritative.

Include: the layer table, the dependency set and what was excluded, the seam list, the gate command, naming and vocabulary conventions, the testing norms, and a pointer to the skeleton as reference implementation.

Leave out: a module-by-module listing of what each file contains. The directory tree already documents that, and it can't go stale.

---

## Retrofit: recovering a baseline mid-project

An existing project can get most of this, in a different order. The constraint is that you can't declare a graph the code already violates and expect a green build.

1. **Measure the real graph before declaring the intended one.** Find what actually imports what. The gap between that and what you assumed is the finding — and the packages with the most inbound edges are usually the ones that quietly became grab bags.
2. **Write the intended contracts with the current violations listed as explicit exceptions.** Every violation is visible and counted, and the build stays green.
3. **Ratchet.** The exception list only shrinks. New violations fail immediately, which stops the bleeding on day one even if the cleanup takes months. This matters more than the cleanup speed: a leak that isn't growing is a scheduling problem, not a risk.
4. **Fix test infrastructure before source structure.** Tests that assert against internals — positional indices, private functions, patched module paths — will block the source cleanup they were meant to protect. This is the step most likely to be skipped and most likely to stall everything else.
5. **Introduce one seam, not all of them.** Pick the boundary with the most patching around it. Measure what that one change deletes before deciding on the next.
6. **Write the ADRs as of today.** Record what the project decided, including the parts nobody decided on purpose. "This was never chosen, and here's what we're choosing now" is a legitimate ADR and a more honest one than a reconstruction.

## How this goes wrong

- **Over-scaffolding.** Directories for phases that don't exist, config layers for one environment, a Protocol per class. The baseline decides *shape*; it doesn't populate it. If a directory is empty at the end, delete it.
- **Designing features.** The questions above are all about structure. The moment the conversation is about what the tool should do rather than how it's arranged, the baseline is over and you're in product design.
- **Rules nobody runs.** A constraint that isn't in the gate is a suggestion, and suggestions lose to whatever pattern is nearest. If you can't make a rule executable, say so in the ADR rather than pretending.
- **Building instead of deciding.** The baseline writes declarations, config, and prose. The moment you're writing a function body with real logic in it, you've crossed into the first change — stop, and put it in the proposal instead.
- **A first change that grows into the whole product.** It stays one path. Its job is to prove the wiring and give later work something correct to copy; the second feature is its own change.
- **Stopping at the ADRs.** The documents are the cheapest part and the least effective. If the session ends with seven ADRs and no import contracts, nothing has actually changed.
