# Test Infrastructure

The shape of the fixtures, factories, and fakes a project's tests share. Read this twice: during Decision 7, to set the conventions and record them in `CLAUDE.md`; and again when the first change actually creates these files.

The baseline decides this shape but doesn't build it — the files below are written by the first change, alongside the tests that need them.

Why the shape is decided upfront rather than left to accrete: when shared test infrastructure has no declared home, every new piece of work writes its own local helper, because there's nothing to import. Those copies drift apart silently — one builder defaults a field differently from another, and nothing records whether that's meaningful. Eventually the suite is the largest body of code in the repo and the main obstacle to changing the source it exists to protect.

The specific way it becomes an obstacle: tests that assert against internal shapes — positional indices, private functions, patched module paths — fail when the internals change, even though the behavior didn't. At that point improving the source requires rewriting tests, so the improvement doesn't happen.

## The shape

```
tests/
├── conftest.py          # Shared fixtures. Session-wide, not per-test-file.
├── factories.py         # One canonical builder per domain type.
├── fakes.py             # One fake per Protocol from Decision 3.
├── unit/
└── integration/         # @pytest.mark.integration — real infra, opt-in
```

Three files, written during the baseline. They start almost empty and grow with the domain.

## Factories: one builder per type

For each domain type from Decision 3, one function that builds a valid instance with sensible defaults and keyword overrides:

```python
def make_session(
    *,
    session_id: str = "sess-1",
    agent_name: str = "implementer",
    n_turns: int = 3,
    **overrides: object,
) -> Session:
    return Session(
        session_id=session_id,
        agent_name=agent_name,
        n_turns=n_turns,
        **overrides,
    )
```

Keyword-only, because a builder's parameter list grows and positional arguments silently shift meaning when it does.

The rule that makes factories worth having: **one canonical builder per type, imported everywhere.** The moment a second copy exists in a test module, the two start drifting, and a test that passes because its local builder defaults a field differently is a test that proves nothing.

When a test needs a specific value, override that field and leave the rest at defaults. The overrides are then the *point* of the test, visible in one line, rather than buried in a twenty-key literal where a reader can't tell which field matters.

## Fakes: one per seam

Every Protocol from Decision 4 gets a fake here, written in the same commit as the Protocol. In-memory, deterministic, records what it was asked to do:

```python
class FakeCommandRunner:
    def __init__(self, result: str = "") -> None:
        self.result = result
        self.calls: list[list[str]] = []

    def run(self, argv: list[str], *, timeout: float) -> str:
        self.calls.append(argv)
        return self.result
```

The fake is what makes the seam pay for itself. A Protocol with a real implementation and a fake has two implementations, which is the bar for introducing an abstraction at all — and it means tests inject a dependency rather than patching a module path.

That distinction is worth being concrete about. `@patch("mypackage.core.runner.subprocess.run")` names an internal import path, so it breaks when the import moves, and it says nothing about the contract. `CoreRunner(runner=FakeCommandRunner())` breaks only when the contract changes, which is exactly when a test *should* break.

If a fake is hard to write, that usually means the Protocol is too wide. Narrow it to the methods the caller actually uses.

## conftest.py

Fixtures that genuinely need setup and teardown — a temp directory, an initialized store, an isolated home directory.

```python
@pytest.fixture
def store(tmp_path: Path) -> Iterator[Store]:
    with closing(create_store(tmp_path / "test.db")) as conn:
        yield Store(conn)
```

Keep it small. A factory function is simpler than a fixture and composes better — reach for a fixture when there's real lifecycle to manage, not just to avoid a function call.

A `conftest.py` in a subdirectory is available to everything below it, which is the mechanism for integration-only fixtures that unit tests shouldn't be able to reach.

## What a test may assert against

The line to hold: **tests exercise behavior through the public surface.** Everything below follows from that, and each one is a rule that prevents a specific way suites turn into cement.

- **No positional access to structured results.** `row[2]` is a dependency on column order, and reordering columns is a change with no behavioral effect that should never break a test. Use names.
- **No importing underscore-prefixed functions.** If a test needs a private helper, either the helper is actually public or the test is aimed at the wrong level.
- **No patching module paths** for anything that has a seam. Patching is the fallback when injection is unavailable; if you find yourself reaching for it, check whether Decision 4 missed a seam.
- **Name tests by what they assert.** `test_upsert_replaces_row_with_same_key` rather than `test_upsert_2`. The name is what a reader sees when it fails in CI.

The litmus test, worth stating in `CLAUDE.md`: **if a change that preserves behavior breaks a test, the test was wrong.** That reframes a refactor breaking tests from "expected cost" to "finding" — and it's the thing that stops the suite from ossifying the implementation.

## What to cover in the baseline

The skeleton's test is the first one, and it's an end-to-end assertion that the wiring works: invoke the entrypoint, check it returns cleanly and produced what it should. It's a smoke test and that's fine — its job is to fail loudly if the composition root breaks.

Beyond that, don't write feature tests during the baseline. There are no features. Write the infrastructure, prove it works once, stop.

Two things worth setting up now because they're awkward to add later:

- **Determinism.** No network in unit tests (`pytest-socket` enforces it mechanically). Time comes through a seam or a parameter with a default, so tests pass a fixed value instead of reaching for a time-freezing library.
- **The integration lane.** The `integration` marker exists from day one, excluded by default, so the first test that genuinely needs real infrastructure has somewhere to go that isn't the main suite.

## Edge cases worth a standing list

Put these in `CLAUDE.md` as the cases a new test module should consider. They're the ones that get skipped and then found in production:

empty input · a single element · duplicate keys · the natural key colliding across scopes · re-running the same input twice · a partial failure mid-batch · retry exhaustion · a config key missing · the zero-results path of every read command

That last one is the most commonly missed. The empty-window, no-rows-matched path of the main query is rarely covered, and it's the one a user hits on their first run before any data exists.
