## Why

The `implementer` writes both the code and its tests, slice by slice, on Sonnet at high effort. On large changes this is slow and expensive, because every task's "Verify with a test that..." clause turns into a per-slice test-first loop. It also lets the suite drift from the spec: in `2026-10-08-add-mods-group-snowflake-panel`, two spec scenarios ended up with no test, and the suite reached 573 test lines for 380 lines of code, largely from tests with no scenario behind them. A dedicated, cheap test writer that works from the spec before any code exists fixes the cost, closes scenario gaps by construction, and keeps tests independent of the implementation they verify.

## What Changes

- Add a `test-author` custom agent with Claude Code, Codex, and Cursor CLI variants. The Claude variant pins `claude-haiku-5-5[1m]` at effort `high`.
- `test-author` writes tests for the scenarios and named seams its brief supplies, and checks each test against the expected outcome the brief states. For a change, `orchestrate` runs it once before any implementation, from the change's spec scenarios, with expected outcome `fail`. It sorts every scenario into testable-through-a-public-seam, verified-by-command, manual, or blocked-on-placeholder, writes one test per testable scenario, and reports the rest without writing tests for them.
- `test-author` tests only public seams the brief or plan names, never invents module or function names, and follows language-neutral rules that keep the suite lean.
- `test-author` owns the test tree: test files, `conftest.py`, fixtures, fakes, and fixture data.
- **BREAKING** (agent contract): the `implementer` no longer creates or edits test files. The Claude variant enforces this with a frontmatter `PreToolUse` hook on `Edit|Write`; Codex and Cursor variants enforce it by prompt. The implementer's report and receipt gain a `Disputed tests` field for tests it believes are wrong.
- The `orchestrate` skill gains a pre-flight gate (testing seams named, no placeholders in anything a test asserts on), dispatches `test-author` before any implementer, hands each implementer the selector for its own tasks' tests, and rules on disputed tests.
- Update `agents/README.md`, `docs/agents.md`, the `flow` README, both catalog descriptions, and the `AGENTS.md` dependency list so `/flow:orchestrate` names `test-author` as a prerequisite.

## Capabilities

### New Capabilities
- `test-authoring`: the `test-author` agent's contract, the implementer's test-file boundary and dispute channel, and how `orchestrate` sequences, briefs, and arbitrates between them.

### Modified Capabilities
- `agent-install`: the Codex install scenario's enumerated agent list gains `test-author`.

## Impact

- New files: `agents/claude/test-author.md`, `agents/codex/test-author.toml`, `agents/cursor/test-author.md`.
- Edited agents: all three `implementer` variants (description, method step 4 and 5, output contract, receipt, guardrails; Claude variant gains `hooks`).
- Edited skill: `skills/flow/orchestrate/SKILL.md` and its `references/` (new `dispatch-test-author.md`; `dispatch-implementer.md` updated). This is an existing SKILL.md, so edits need the user's confirmation at apply time.
- Docs and catalogs: `agents/README.md`, `docs/agents.md`, `skills/flow/README.md`, `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json` (`flow` description only; no `skills` array change), `AGENTS.md`.
- No installer change: `scripts/install-agents.sh` discovers agents from the platform directories.
- The contract does not rule out backfilling tests for existing code, but this change adds no backfill-specific guidance (behavior inventory, characterization markers, suspected-bug handling).
