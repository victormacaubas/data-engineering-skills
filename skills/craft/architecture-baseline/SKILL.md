---
name: architecture-baseline
description: Turn a design doc into a project's architectural constraints before any feature work — layer map, runtime dependencies and libraries, identity model, injected seams, error taxonomy, machine-enforced import contracts, testing conventions, a quality gate that checks all of it, and a reviewer-facing `docs/ARCHITECTURE.md` indexing the ADRs. Use this whenever starting a new codebase, scaffolding a repo, or adding the first module to an empty project, whenever someone hands over a design doc or technical proposal to build from, and whenever someone says "set up the project", "what structure should this have", "what libraries should we use", or "let's get this started". This decides and declares; it does not build the product. Run it before the first feature change, not after. It declares a graph rather than repairing one, so it is not the tool for a project that already has substantial code.
---

# Architecture Baseline

The decisions that are cheap now and expensive later, made once, written down in a form a machine can check.

## Why this runs first

Each implementation run starts blind. It reads the code around its task and resolves ambiguity by matching whatever pattern it finds nearby — which is the right instinct, and the reason drift compounds instead of self-correcting. The first module that reaches across a boundary becomes the precedent every later change copies, and by the time it's visible it's in thirty files.

Two things follow, and they shape everything below:

- **Put the pattern where it will be copied.** The declarations this baseline writes — the error taxonomy, the Protocols, the domain types — are the first thing later work reads and imitates. That's why they're real files in real packages rather than a description of files.
- **Constraints beat documentation.** "The store layer owns all database access" is a sentence in a design doc that can be read and still violated, because nothing checks. The same rule as a contract in `pyproject.toml` fails the build.

The exit condition follows from the second: **anything decided here that doesn't end up in the quality gate is a wish.**

## What you're producing

The baseline **decides and declares**. It does not build the product — the first change does that, through the normal propose-and-implement process.

The practical line: declarations are types, Protocols, exception classes, contracts, config, and written conventions. Behavior — functions with logic, SQL, I/O, and the tests that exercise them — is out of scope here.

By the end the repo contains:

- **ADRs** for each decision below, written during the conversation rather than reconstructed later
- **The layer table** in `CLAUDE.md`, plus import contracts that enforce it
- **A closed dependency set** — what the project depends on, and what was deliberately excluded
- **`errors.py`** with the taxonomy and the translation rule
- **Protocols** for each injected seam
- **Domain types** from the identity decision
- **Testing conventions**, and the declared homes for factories and fakes
- **A configured quality gate** — one command, wired into CI, and green against the declarations above
- **`docs/ARCHITECTURE.md`** — the reviewer-facing map: what the system is, and which ADR to open

It should be small, and most of it is prose and config. If the baseline is taking more than an hour or two of conversation, you have drifted into designing features.

## How to run this

This is a conversation, not a generation task. The decisions belong to the person you're working with — your job is to force each one into the open, offer a default with the reasoning behind it, and record what they actually chose.

For each of the seven decisions below: ask the question, propose a default, get an answer, write it down. Don't batch all seven into one message; the answers depend on each other. Don't hand off the first change with a decision still open — an unmade decision becomes a guess made by whoever writes the code first.

If the person says "you pick," pick, state the reasoning in one line, and flag it as yours in the ADR. A default you named is recoverable. A default nobody noticed is the thing you'll be refactoring in a month.

**Write the artifacts yourself, inline.** They are the record of a conversation you're in, and they're prose and config rather than code. The first *change* gets delegated; the baseline doesn't.

**Dispatch `researcher` when a decision turns on something you'd otherwise guess at.** Decision 2 is the usual case: whether a library is still maintained, what its current API shape is, which of two options the ecosystem actually settled on. Read the return as data and bring it back into the conversation — dispatch to close a fact, never to make the decision.

### Start from the design doc

Ask for it before Decision 1. A design doc usually settles the archetype, sketches the stack, and names the entities, so Decisions 1 through 3 arrive part-drafted and your job on those is to confirm rather than elicit.

Read it as input, not as authority. Two things to pull out: what it decided implicitly, and what it left open. A stack list with no exclusions hasn't done Decision 2; a component diagram with no dependency direction hasn't done Decision 1. Both are still open decisions and still get asked.

If there is no design doc, ask whether one exists elsewhere. If not, run the conversation as it stands — the questions don't change, you just start with fewer answers.

Either way the design doc doesn't survive the baseline. It's a proposal, and proposals go stale the moment the decisions land somewhere checkable. `docs/ARCHITECTURE.md` is what replaces it.

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

Then pair each dependency with the package from Decision 1 that owns it — the database driver belongs to `store/`, the HTTP client to its adapter. That pairing is what makes Decision 5's translation rule and Decision 7's forbidden contracts writable at all. A dependency with no owning package is one that will end up imported everywhere.

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

- **A Protocol earns its place by having two implementations.** One real implementation and no fake is speculation; a real one plus a test fake is an abstraction with a reason to exist. The baseline declares the Protocol; the change that writes the real implementation writes the fake alongside it, in the same commit rather than eventually.
- **Make injection required, not defaulted.** `def __init__(self, runner: CommandRunner)` beats `runner: CommandRunner | None = None` with a fallback. The default-argument version means a test that forgets to inject silently constructs the real thing — which, for anything paid or destructive, you find out about later and expensively.

Wire the concrete implementations at one composition root: the CLI entrypoint or a `build_*` factory. Nothing below it constructs its own collaborators.

## Decision 5 — Error taxonomy and boundary translation

**Ask:** What can go wrong in a way a caller should handle differently, and where does each failure get translated?

Write `errors.py` now, with a base exception and the handful of domain errors you can already name. You'll add more; the point is that the file exists so the first person to need a domain error doesn't reach for a builtin.

The rule that gives it teeth: **a package translates foreign exceptions at its own boundary.** `store/` catches the driver's errors and raises `StoreError`. The HTTP client catches connection errors and raises `UpstreamError`. Callers depend on your vocabulary, not your dependencies'.

The tell that this rule is missing: an entrypoint catching `sqlite3.Error` or `requests.RequestException`. When that appears, the driver's exception hierarchy has become part of the CLI's contract, and swapping the driver — one of the dependencies you just chose in Decision 2 — is now a user-visible change.

Its corollary is worth stating explicitly, because it's the one that erodes: **once a package has a taxonomy, code inside it stops raising bare `ValueError` and `RuntimeError`.** A bare builtin forces callers into `except ValueError`, which catches every unrelated failure from anywhere in the stack and reports it as though it were the expected one.

At the entrypoint, map domain errors to exit codes in one place — a decorator or a single `try` around the dispatch, not repeated per command.

## Decision 6 — Testing conventions

**Ask:** What may a test assert against, and where does shared test data come from?

Nothing here creates test files. It sets the rules the first change will follow, and records them in the testing ADR and `CLAUDE.md`. Three things get settled: the floor every test meets, where shared test infrastructure lives, and what a test is allowed to reach for.

**The floor.** `pytest`. No network in unit tests, enforced mechanically rather than by habit — `pytest-socket` does it in one line of config. Time enters through a seam or through a parameter with a default, so a test passes a fixed value instead of freezing the clock globally. Tests are named for what they assert: `test_upsert_replaces_row_with_same_key`, not `test_upsert_2`, because the name is what a reader sees when it fails in CI.

**The homes.** Declare them now, empty:

```
tests/
├── conftest.py          # fixtures with real lifecycle to manage, and only those
├── factories.py         # one canonical builder per domain type
├── fakes.py             # one fake per seam from Decision 4
├── unit/
└── integration/         # @pytest.mark.integration, excluded from the default run
```

**The rules.** Three, and each one prevents a specific way suites turn into cement:

- **One canonical builder per type**, keyword-only, in `tests/factories.py`. The moment a second copy of a builder exists inside a test module, the two start drifting, and a test that passes because its local builder defaults a field differently proves nothing. Keyword-only because a builder's parameter list grows, and positional arguments silently shift meaning when it does.
- **One fake per seam**, in `tests/fakes.py`, written in the same commit as its Protocol. A Protocol with a real implementation and a fake has two implementations, which is the bar for introducing an abstraction at all. It also means tests inject rather than patch: `@patch("mypackage.core.runner.subprocess.run")` names an internal import path, so it breaks when the import moves and says nothing about the contract, while `CoreRunner(runner=FakeCommandRunner())` breaks only when the contract changes — which is exactly when a test should break.
- **Tests assert against behavior through the public surface.** No positional access into structured results, because `row[2]` is a dependency on column order and reordering columns should never break a test. No importing underscore-prefixed helpers; if a test needs one, either it's actually public or the test is aimed at the wrong level. No patching anything that has a seam — reaching for a patch is the signal that Decision 4 missed one.

And one norm, which goes in `CLAUDE.md` verbatim because it's the one thing here that can't be checked mechanically: **if a change that preserves behavior breaks a test, the test was wrong.** That reframes a refactor breaking tests from an expected cost into a finding, and it's what stops the suite from ossifying the implementation.

Last, the standing list of cases a new test module should consider. These are the ones that get skipped and then found in production, and several of them come straight out of Decision 3. Put it in `CLAUDE.md`:

empty input · a single element · duplicate keys · the natural key colliding across scopes · re-running the same input twice · a partial failure mid-batch · retry exhaustion · a missing config key · the zero-results path of every read

That last one is the most commonly missed. The empty-window, no-rows-matched path of the main query is rarely covered, and it's the one a user hits on their first run before any data exists.

Why this is a decision rather than something that accretes: when shared test infrastructure has no declared home, every piece of work writes its own local helper, because there's nothing to import. Those copies drift silently, and eventually the suite becomes the main obstacle to changing the source it exists to protect — at which point improving the code requires rewriting tests, so it doesn't happen.

## Decision 7 — Toolchain and quality gate

**Ask:** Which tools enforce all of this, how strict, and what single command runs them?

Everything decided above becomes configuration in this step. Read `references/enforcement.md` for the concrete setup: the toolchain, the import contracts that encode the layer map, and the gate that runs them.

What lands:

- **Import contracts** expressing the layer map from Decision 1, checked by `import-linter`
- **Forbidden contracts** pinning each Decision 2 dependency to its owning package
- **Ruff, mypy, pytest** configured so the mechanical rules are mechanical, including Decision 6's integration marker
- **One command that runs the whole gate** — `make check`, `just check`, whatever. One command, because a gate with four steps gets run partially.
- **CI running that same command**, so the gate is the same locally and remotely

The substance here isn't the tool list. It's the commitment that architectural rules are enforced mechanically rather than by review, and that's the part worth recording in the ADR because it's invisible in the config file. Deliberate exceptions belong there too: if mypy is strict everywhere except one package, say so, with the reason and ideally the condition under which it goes away.

Then put the gate command in `CLAUDE.md`, because that's what makes it reachable by everyone working in the repo, human or otherwise.

### Run it before you stop

**Until the contracts have run against a real import graph, they are unverified assertions.** Package names might be wrong, the layer order might be backwards, a forbidden contract might be scoped to the wrong module. A `pyproject.toml` that has never been executed is not a contract, and shipping one means the first change spends its opening hour debugging your config instead of building.

You already have what you need to check it. The declarations from Decisions 3, 4, and 5 are real files in real packages: the domain types, the Protocols, the exception classes. Put them where the layer map says they go, add an `__init__.py` for each package the contract names, and run the gate.

The baseline is done when it comes back green. Not "should pass" — green.

Create only the packages the contract names, and give each one an `__init__.py`. An empty package is analyzed and kept, so a layer that holds nothing yet still checks; a layer with no directory at all fails the run outright. A directory that exists only to make a tree look complete is the over-scaffolding this skill is meant to prevent — the first change creates those.

---

## Writing it down

**ADRs** capture each decision and its reasoning. Read `references/adr-set.md` for the format and the seven stubs. Write them during the conversation, while the alternatives are still live — an ADR reconstructed after the fact records the decision but loses the thing that makes it useful, which is what else was on the table and why it lost.

Creating `docs/adr/` here is also what makes the habit cheap to keep: once the directory exists, a decision that surfaces mid-change has an obvious place to go instead of prompting a conversation about whether to start keeping ADRs.

**`CLAUDE.md` holds rules and conventions, not inventory.** The line is durability: a rule or a convention describes *how to decide* and stays true as the code changes. An inventory describes *what currently exists*, goes stale at the first refactor, and then actively misleads — worse than being absent, because it still reads as authoritative.

Include:

- the layer table, and the rule that a package owning a technology owns its types
- the dependency set, what was excluded, and that additions are ADRs rather than implementation details
- the seam list, and where the composition root is
- the gate command, as the definition of done
- the review bar, a change is not done when the gate passes, only when its structure has also been reviewed against the declarations above, and that a review asking for changes blocks the archive. The gate proves the code runs; nothing in it proves the code is shaped the way this project decided. Ask what performs that review here and name it, the same way you named the coding standards.
- the testing norms from Decision 6, with the litmus test verbatim
- naming and vocabulary conventions
- **the docstring rule.** The format, enforced in the gate; and the part the gate can't check — a docstring states what a caller needs and stops there, rather than restating a decision that already lives in an ADR. Written out below.
- **the coding standards this project inherits.** Ask which ones apply and name them explicitly. Whether a standard gets picked up otherwise depends on how a given task happens to be phrased, while a line in `CLAUDE.md` is always loaded — so for a standard meant to govern every file of a given kind in the repo, don't leave it to chance. Name the ones that govern a whole class of work (the language standard, a SQL standard if the repo has that surface), not everything available on the machine; the second kind is inventory and it rots.
- **that changes are vertical slices.** One path through the layers at a time, not one layer at a time. This is what keeps the wiring exercised from the first change onward, and it's durable in a way "here is what the first change should be" isn't.

Leave out anything that describes what currently exists:

- **a directory tree.** This is the most common one and the most tempting, because it looks like the layer map. It isn't. The table says which packages may import which and what each owns, and it stays true through every refactor that respects it. A tree says which files exist today, and it's wrong the first time one is added. The filesystem already answers that question and can't drift.
- a module-by-module listing of what each file contains
- inventories of the functions, classes, or commands that exist
- file counts, module sizes, "recently added" notes, or anything else that reads as a status report

The test to apply to any line before it goes in: **does this tell someone how to decide, or what is currently true?** The first belongs. The second goes stale, and a stale line in `CLAUDE.md` is worse than a missing one, because it still reads as authoritative and gets followed after it stops being correct.

### `docs/ARCHITECTURE.md`

One page, written for a reviewer — someone who arrives at a finished change without having been in this conversation and has to judge whether it fits. That is a different question from "how do I write code here," which `CLAUDE.md` already answers, so this document doesn't repeat it: no import rules, no testing norms, no gate command. It carries the shape of the system and a map into the ADRs.

Six sections, in this order, each a few lines:

```markdown
# Architecture

## What this is
Archetype, entrypoint, runtime stack.

## Shape
How work flows through the packages, and what each owns.

## Identity
The grain, the natural key, what a re-run produces.

## Seams
The injected boundaries, and where they're wired.

## Failure model
The base exception, and which package translates what.

## Decisions
The ADR index.
```

Shape is descriptive — the flow, not the rule. That `store` sits below `core` and owns the SQL is orientation; the "may import" table that makes it enforceable stays in `CLAUDE.md`, and a second copy here just gives a reviewer two versions to reconcile.

The index is the part a reviewer actually uses:

| ADR | What it decides |
|---|---|
| [0001 — Layer map](adr/0001-layer-map.md) | Package boundaries and dependency direction. A package owning a technology owns its types, so nothing driver-shaped leaves its adapter. |
| [0003 — Identity and grain](adr/0003-identity.md) | What one row is, the natural key, and whether re-running the same input yields one record or two. |

Three lines each at most, written so a reviewer can tell **whether to open it**. "Architecture decisions" fails that; naming the surface the ADR governs passes, because someone reviewing a change under `store/` can then see at a glance which two ADRs constrain it. Every ADR gets a row, including the ones that surface later.

The staleness test is not `CLAUDE.md`'s here, since this document is descriptive by design. Ask instead: **would this line change if a decision changed, or if a file was added?** The first belongs. The second is inventory — no directory trees, no module listings, no counts.

### Docstrings

The Protocols, exception classes, and domain types written above carry the first docstrings this repo will have, which makes them the ones every later module imitates. Settle the rule while there are eight of them rather than eight hundred.

**Google style** — a one-line summary, then `Args:`, `Returns:`, `Raises:`, `Yields:` as the signature requires. Put it in the gate rather than in a style discussion; Ruff's pydocstyle rules with `convention = "google"` make the format mechanical, which is Decision 7 applied to prose.

**A docstring serves the caller.** What to pass, what comes back, what may be raised, and any constraint the signature cannot express — a unit, a timezone, whether an argument is mutated, whether calling twice is safe. That is the whole job.

What it is not is the ADR. Not the reasoning, not the alternatives, not where this sits in the layer map. That content already exists in `docs/adr/` and `CLAUDE.md`, and a paraphrase of it inside a docstring is the same failure as an inventory in `CLAUDE.md`, with one thing worse: nothing checks a docstring against the decision it restates, so the two drift silently and a reader has no way to tell which one is current. Someone who wants to know *why* the seam exists is one grep from the ADR. Someone reading the Protocol wants to know what to implement.

And a docstring the signature already gave is worse than none, because it is a line to maintain that carries nothing:

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

The second earns its place because the UTC requirement and what breaks without it are not in the signature, and a caller who gets it wrong finds out in production.

The format goes in the gate. The rest goes in `CLAUDE.md`, because no linter can tell a contract from a story.

---

## Where this ends

The baseline ends when the gate is green and the decisions are written down. Building the product is the next thing, and it goes through the project's normal propose-and-implement process rather than continuing here — in this repo, that means proposing the first change with `/opsx:propose`.

**The repo is the handoff.** Every constraint decided here is already in it in a form the next agent hits whether or not it reads any prose — the contracts are in `pyproject.toml`, the taxonomy and Protocols are real files, the rules are in `CLAUDE.md`, the reasoning is in the ADRs. Nothing written at the end restates any of that; a second copy of something already checkable is the exact failure these seven decisions exist to avoid.

`docs/ARCHITECTURE.md` carries the one thing the repo doesn't hand over cheaply, and it's aimed at the reviewer rather than the builder: what this system is in a page, and which ADR bears on the change in front of them.

### Why the baseline stops at declarations

The tempting alternative is to sketch the implementation here — class signatures, empty method bodies, module stubs for everything you expect to need. It's weaker for one reason: **a signature written before any code exists is a guess.** It's a prediction about a shape nobody understands yet, and it hardens into a constraint before anyone has learned whether it's right. That's the same failure as designing the whole architecture upfront, just at a smaller scale.

Types, Protocols, and exception classes are different, and that's why they're in scope. They're contracts, not predicted implementations — a Protocol declares what a caller may depend on, and an exception class declares what a caller may catch. Neither one guesses at how anything works.

And for the same reason this is the wrong tool on a project that already has substantial code: you can't declare a graph the code already violates and expect a green build. Recovering a baseline mid-project is a different job with a different order — measure the real graph first, then ratchet toward the intended one — and it isn't this one.

---

## How this goes wrong

- **Over-scaffolding.** Directories for phases that don't exist, config layers for one environment, a Protocol per class. The baseline decides *shape*; it doesn't populate it. If a directory is empty at the end, delete it.
- **Designing features.** The questions above are all about structure. The moment the conversation is about what the tool should do rather than how it's arranged, the baseline is over and you're in product design. Picking and scoping the first change counts: the baseline constrains changes, it doesn't choose them.
- **Rules nobody runs.** A constraint that isn't in the gate is a suggestion, and suggestions lose to whatever pattern is nearest. If you can't make a rule executable, say so in the ADR rather than pretending.
- **Building instead of deciding.** The baseline writes declarations, config, and prose. The moment you're writing a function body with real logic in it, you've crossed into the first change — stop, and put it in the proposal instead.
- **Docstrings that retell the ADRs.** This baseline is mostly a writing exercise, and the voice carries into the files it creates — a Protocol whose docstring argues for the seam, an `errors.py` narrating the translation rule. Each one is a second copy of a decision that already has a home, and it starts drifting the moment either side changes. The declaration states its contract; the ADR holds the reasoning.
- **An `ARCHITECTURE.md` that restates `CLAUDE.md`.** The layer rules and testing norms are already loaded on every task; copied into a page nothing checks, they drift, and a reviewer who can't tell which version is current stops trusting the one that isn't enforced. Orientation and the ADR index, nothing else.
- **Stopping at the ADRs.** The documents are the cheapest part and the least effective. If the session ends with seven ADRs and no import contracts, nothing has actually changed.
- **Stopping at a gate that was never run.** Same failure one step later. Config that has never been executed is a claim about the architecture, not a check on it.
