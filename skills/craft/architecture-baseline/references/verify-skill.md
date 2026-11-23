# The project verify skill

The gate runs static checks and tests. It never starts the program. The verify skill does: it starts the program through its declared entry point, drives one flow with a fixed input, and checks the evidence. Write it at `.claude/skills/verify/SKILL.md` in the target project.

## The four parts

1. **Start**: the command that starts the program through the entry point from Decision 1.
2. **Drive**: one flow, with a fixed input that is committed in the repo. Keep the input small and offline, unless the program exists to talk to the network.
3. **Evidence**: what to capture. The exit status and the output, a row count, a response body.
4. **Pass**: the condition the evidence must meet, stated so that two people reading it reach the same verdict.

Keep the flow short. A check that takes minutes gets skipped, and this one runs before every commit.

The skill reports the command it ran and the evidence it captured, then pass or fail. A report that says "looks fine" with no evidence is not a pass.

## Only commands someone gave you

Every command in the skill comes from the design doc or from the person. When the design doc doesn't say how the program starts, ask. Don't write a plausible `python -m` line.

Before the first feature there is usually nothing to run. Then the skill names the declared entry point and says that the flow does not run yet, and that the first feature change makes it run and fills in the command. The skill is a file in the project, so the change that alters the entry point also updates it.

## Template

    ---
    name: verify
    description: Start <project> and drive one real flow before a commit, and whenever asked to verify that the program works. The gate checks code; this checks that the program runs.
    ---

    # Verify

    1. Start: `<command>`
    2. Drive: <the flow, with the fixed input at <path>>
    3. Evidence: capture <what>
    4. Pass: <condition>

    Report the command, the captured evidence, and pass or fail.

## Examples

**Data pipeline** (`main.py`, argparse):
- Start: `uv run python -m pipeline.main --run-date 2024-01-01 --source tests/fixtures/orders_small.csv --target-db /tmp/verify.duckdb`
- Drive: one run on the 20-row fixture.
- Evidence: exit status; `SELECT count(*), count(DISTINCT order_id) FROM orders` against the target.
- Pass: exit 0, 20 rows, 20 distinct `order_id` (one row per order, the declared grain). A second run gives the same counts.

**Service** (`main.py`, app factory):
- Start: `uv run uvicorn service.main:create_app --factory --port 8765`, in the background.
- Drive: `curl -s -w '%{http_code}' -X POST localhost:8765/quotes -d @tests/fixtures/quote_request.json`
- Evidence: the status code and the response body. Stop the server after.
- Pass: 201, and the body has the `id` and `total` fields with `total` equal to the fixture's expected value.

**CLI tool** (`cli.py`, click or typer):
- Start: `uv run tool-name summarize tests/fixtures/sample.log`
- Drive: the one command on the fixture.
- Evidence: the exit status and stdout.
- Pass: exit 0, and stdout equals `tests/fixtures/sample.summary.txt`.

**Library** (no entry point; the public API is the contract):
- Start: `uv run python -c "from package_name.api import parse; print(parse(open('tests/fixtures/input.txt').read()))"`
- Drive: one call through the public API, the way a caller imports it.
- Evidence: the printed result.
- Pass: it equals `tests/fixtures/input.expected.txt`, and the import uses only names from `api.py`.

**Before the first feature** (nothing runs yet):

    1. Start: through `pipeline/main.py` (declared in Decision 1). It does not run yet.
       The first feature change makes this flow run and replaces this step with the command.
    2. Drive: one run on `tests/fixtures/orders_small.csv` (to be added with the first feature).
    3. Evidence: exit status and the row count and distinct key count in the target.
    4. Pass: exit 0; one row per order.

The commands above are illustrations of shape. In a real project, each one comes from the design doc or the person.
