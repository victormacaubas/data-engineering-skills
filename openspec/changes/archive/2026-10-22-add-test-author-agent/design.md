## Context

Today `orchestrate` dispatches `implementer` slices, and each slice writes its own tests because plan tasks carry "Verify with a test that ..." clauses. See proposal.md (Why) for the cost and suite-quality problems this causes.

Constraints that shape the approach:

- Every agent has Claude Code, Codex, and Cursor CLI variants (`agent-install` spec). Only Claude Code supports per-agent hooks. Cursor offers `readonly: true` and nothing path-scoped. Codex offers `sandbox_mode` and nothing path-scoped.
- Claude Code subagent frontmatter supports `hooks`, active only while that subagent runs. Settings-level `Edit(...)` deny rules apply to every agent and the main session. `Write(...)` path rules are accepted but never enforced. `disallowedTools` with a path pattern removes the whole tool.
- Agents install as symlinks into `~/.claude/agents/`, so a hook command cannot reference a script by a path relative to this repo. Agents in `~/.claude/agents/` skip the workspace trust check that gates project-level agent hooks.
- Tests in this repo's own changes are not always Python: the snowflake panel mod used TypeScript on `claude plugin test`. Rules must be language-neutral.
- The archived snowflake panel change shows design.md usually names seams (hooks, tool names, ids, output formats) but not functions or modules, and the good tests drove those seams.

## Goals / Non-Goals

**Goals:**
- A test writer that can run on a cheap model because its input is narrow: scenarios plus named seams in, tests plus a triage report out.
- A test-file boundary on the implementer that cannot be lifted by editing fixtures.
- No change to the installer or the install contract.

**Non-Goals:**
- Backfill-specific guidance. The contract is source-agnostic so a backfill brief can drive it later.
- Blocking Bash-based writes to test files. Bash is covered by instruction only.
- Restricting `test-author` from production code by hook. That rule is prompt-only on every platform (see Decision 6).

## Decisions

### 1. For a change, one test-author pass before any code

`test-author` runs once over the whole change, after pre-flight and before the first implementer dispatch. This is `orchestrate`'s sequencing, not a property of the agent: `test-author` works from whatever scenarios its brief supplies and does not assume code is absent (see Decision 11). Alternatives: a per-slice pass, which re-creates the per-slice loop the change removes; and an after-code pass, which lets the writer see the implementation and test what it sees, the main source of bloat and of tests that pass by construction. Writing before code caps the suite at roughly one test per scenario and keeps tests independent of the implementation.

For large changes the orchestrator may split the pass by capability spec and dispatch several `test-author` workers in one batch. Each owns a disjoint set of test files.

### 2. Seams, not functions, are the interface contract

`test-author` may only drive seams the brief or plan names: commands, entry points, hooks, tool names, identifiers, output formats. Function and module names are not required in the design and must not be invented. If a scenario has no named seam, or a value it would assert on is a placeholder, the scenario is reported as blocked. The orchestrate pre-flight checks the same two conditions so blocked scenarios are rare. Alternative considered: letting `test-author` propose an interface sheet for the orchestrator to approve. Rejected because it makes a cheap model the de facto designer, and a quick approval hides it.

### 3. Task-to-test mapping lives in the report, not the code

`test-author` writes in its report a table mapping each task id to the exact command that runs only that task's tests (a pytest node-id list, a runner's name filter, and so on). The orchestrator copies the relevant selectors into each implementer brief. Alternatives: pytest markers or name prefixes carrying task ids. Rejected because they are framework-specific and because plan ids in code outlive the plan; the implementer already forbids citing task numbers in code, and tests follow the same rule. This also removes the need for marker registration in shared config.

### 4. Implementer enforcement on Claude Code: frontmatter hook with `if` patterns

The Claude implementer gets a `hooks.PreToolUse` entry with `matcher: "Edit|Write"` and two handlers per test-file pattern, one `Edit(...)` and one `Write(...)`. An `if` rule matches only its own tool's calls: tested on Claude Code 2.1.308, `Edit(**/*.test.ts)` did not stop a `Write` to `src/foo.test.ts`, while `Write(**/tests/**)` and `Edit(**/tests/**)` each blocked their own tool. Patterns match relative to the working directory, so each needs the `**/` prefix to match at any depth. Each handler uses a one-line command:

```yaml
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          if: "Edit(**/tests/**)"
          command: "echo 'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.' >&2; exit 2"
        - type: command
          if: "Write(**/tests/**)"
          command: "echo 'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.' >&2; exit 2"
        # an Edit and a Write handler each for: **/__tests__/**, **/conftest.py,
        # **/test_*.py, **/*_test.py, **/*.test.ts, **/*.spec.ts (14 handlers in all)
```

Exit 2 denies the call and shows stderr to the model, steering it to the dispute channel.

Alternatives considered:
- **Inline `jq` command that parses `tool_input.file_path`.** Full glob control, but fails open silently on a machine without `jq` (exit 127 is non-blocking).
- **Shipped script installed to `~/.claude/hooks/`.** Most flexible, but changes the install contract, hard-codes a path that `CLAUDE_AGENTS_DIR` overrides can break, and fails open silently whenever the script is missing.
- **Settings-level deny rules or a global `agent_type` hook.** Affect every session.

The `if` approach has no dependency and nothing that can go missing. Path anchoring and per-tool matching were verified in a scratch run before implementation; running the agent itself (task group 6) confirms the frontmatter scoping. If that run fails, fall back to the inline `jq` command and document `jq` as a prerequisite.

### 5. test-author owns the whole test tree, fixtures included

Fixtures, fakes, and fixture data decide the world a test runs in, so they are part of the assertion. If the implementer could edit them, it could make a locked test pass by weakening a fake. The hook patterns therefore cover `**/tests/**` and `**/conftest.py` with no exceptions. The cost is a round trip when an implementer change breaks a fixture; fixtures built only through named seams keep that rare, and the round trip runs on Haiku.

### 6. Production-code boundary on test-author is prompt-only

The `if` field matches patterns but cannot negate them, so "deny everything except test files" is not expressible without a script. `test-author`'s instructions forbid production edits and require reporting a needed production change instead. The orchestrator checks `Files modified` in the receipt against the test tree.

### 7. Disputed tests shape

Implementer report gains a `## Disputed tests` section; the receipt gains a `Disputed tests:` list. Each entry:

```
- <selector> — <scenario> — <wrong expectation | asserts on an unnamed interface | setup cannot be satisfied> — <one line of evidence>
```

A task blocked only by a disputed test goes under `Tasks not completed` with `blocking: true`, and status is at best `partial`. The orchestrator rules per entry and re-dispatches `test-author` or the implementer.

### 8. test-author output contract

Mirrors the implementer's report-plus-receipt pattern, written to `.orchestrate/<slug>/test-author[-<capability>].md`. The report carries: scenario triage table (scenario, category, test or command or reason), the task-to-selector map (or one command when the brief has no tasks), files modified, the run command, the expected outcome, tests whose outcome differed, suggested scenarios, needed production changes, and decisions. The receipt carries counts per triage category, the report path, files modified, blocked scenarios, and unexpected-outcome tests.

### 9. Models per platform

Claude Code: `claude-haiku-5-5[1m]`, effort `high`. Codex and Cursor CLI: `gpt-5.6-luna` at high reasoning with 1M context, the lightest tier the repo already pins (`pathfinder`). Neither Codex nor Cursor variant is read-only, since the agent writes test files.

### 10. Prompting

Before writing the Claude variant, read the current Claude Haiku 5.5 prompting guide; before writing the Codex and Cursor variants, read the guide for the pinned GPT-5.6 model. Where a guide disagrees with `docs/prompting.md`, the guide wins.

### 11. Expected outcome is a brief parameter

The brief states whether the new tests should `fail` (no implementation yet) or `pass` (the behavior already exists). `test-author` checks each test against it and reports mismatches without editing tests to match. `orchestrate` always briefs `fail` for a change. Alternative: hard-coding "new tests must fail before implementation". Rejected because it ties the agent to spec-first work and would block using it to add tests for existing code; making the expectation a parameter keeps the agent free of any backfill-specific instructions while leaving that use open.

## Risks / Trade-offs

- [`if` patterns do not match as expected, so the hook silently allows test writes] → Verification runs the implementer against both a Write and an Edit on a Python and a TypeScript test path, and against a non-test path. Fall back to the `jq` command if any case misbehaves.
- [A Claude Code version without `if` support runs every handler on every write and blocks all writes] → Loud failure, caught by the same verification. Record the minimum Claude Code version in `docs/agents.md`.
- [Implementer writes tests through Bash] → Out of scope by decision; covered by instruction. The observed failure was instruction-following, not evasion.
- [Haiku writes weak tests from vague scenarios] → Pre-flight requires named seams and settled values; triage reports rather than guesses; `structure-reviewer` still reviews test design at the end.
- [Dispute round trips slow large changes] → Fixtures through seams only; disputes batch per dispatch round.
- [Cursor and Codex enforcement is prompt-only] → Accepted. Documented as an intentional platform difference in `agents/README.md`.
- [A pass-expected brief surfaces a failing test that may be a real bug] → Reported as an unexpected outcome, never auto-resolved; how to treat it is left to a later change.
- [Implementer contract change breaks plans written for the old flow] → `orchestrate` treats "Verify with a test that ..." clauses as `test-author` input, so existing plans still work.

## Migration Plan

Agents are installed as symlinks, so an existing install picks up the implementer change on the next session. `test-author` needs one install run (`./scripts/install-agents.sh --agents test-author`, any platform). Rollback is a revert of the agent files and the `orchestrate` edits; no data or state is involved.

## Open Questions

- Exact Codex and Cursor model for `test-author` if `gpt-5.6-luna` proves too weak in the first runs. Changing it does not affect specs or tasks.
