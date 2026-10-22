## Context

See proposal.md (Why) for the motivation. Constraints that shape the approach:

- A hook `if` field holds exactly one permission rule, matches only its own tool, and does not expand braces: on Claude Code 2.1.308, `Write(**/{tests,__tests__}/**)` and `Write(**/*.{test,spec}.ts)` matched nothing while a literal `Write(**/ok.py)` in the same run blocked. Collapsing the frontmatter therefore needs code, not a better pattern.
- Plugin subagents ignore `hooks`, and `disallowedTools` with a path specifier removes the whole tool, so neither offers a per-agent path rule.
- The mod API already used by `mods/snowflake-query-panel` gives a `tool.call` hook that receives the call's arguments plus `agentId` (absent on the main loop) and may answer `{ deny: reason }` instead of calling `next(e)`. `$.agent.list()` maps an `agentId` to its `type` (`hooks/register.tsx:60`). Mod code runs in-process, so there is no shell, `jq`, or script path to go missing.
- A mod hook that throws is skipped and the call proceeds. The mod API is early access.
- Mods have no `package.json`; adding npm dependencies would be new tooling under `AGENTS.md`.

## Goals / Non-Goals

**Goals:**
- One rule set for both agents' boundaries, unit-tested with `claude plugin test`.
- Agent definitions free of enforcement plumbing.

**Non-Goals:**
- Guarding `Bash`. Shell writes stay covered by instruction, as before.
- Guarding the main session started with `--agent implementer`. Its calls carry no `agentId`; the orchestrated flow always runs these agents as subagents.
- Making the rule set configurable per project. The pattern list is a constant; a configuration surface can come later if a project needs other test layouts.
- Codex or Cursor enforcement.

## Decisions

### 1. An optional mod replaces the frontmatter hook

The mod is the only hard block on Claude Code; without it every platform is prompt-only. The guard catches instruction slips, not evasion, so losing it on installs without the mod is accepted in exchange for clean agent files and a tested rule set.

Alternatives considered:
- **Compact frontmatter.** Flow-style handlers sharing one YAML anchor for the command (verified in a user-level agent on 2.1.308) cut the block to 18 lines with the same guarantee. Rejected because it is still 14 rules, still untestable without running the agent, and cannot express test-author's boundary.
- **Compact frontmatter plus the mod.** Rejected because the test-tree patterns would live in two places and drift.
- **Shell script in a plugin `hooks.json`.** Needs a runtime and a path, and fails open when either is missing. The mod has neither problem.

### 2. One `tool.call` hook per guarded tool

`register` subscribes `tool.call` for `Edit`, `Write`, and `NotebookEdit`. The path is `file_path` for `Edit` and `Write` and `notebook_path` for `NotebookEdit`. A call the rules deny returns `{ deny: reason }`; every other call returns `next(e)` untouched. The hook chains `.catch(($, e, next) => next(e))` as the snowflake mod does, so its own failure never breaks the call. Alternative: `classic.PreToolUse`. Rejected because `tool.call` is the event this repo already uses and tests against, and it carries `agentId` directly.

### 3. Agent type from `$.agent.list()`, exact names

No `agentId` means the main loop: pass. Otherwise the hook looks the id up in `$.agent.list()` and compares `type` to `implementer` and `test-author` exactly. An id not in the list (workflow agents, engine forks) or a list that throws passes, with a `$.ui.log(..., { to: 'debug' })` line. No cache: the lookup runs only on the three file tools, and a cache would need declared state. Fail-closed on an unknown agent was rejected: an API change would then block every file edit in every session.

### 4. Matching rules as data

The seven test-tree patterns, the test-author extras (`.orchestrate/**`, `pytest.ini`, `pyproject.toml`, `setup.cfg`, `tox.ini`, `jest.config.*`, `vitest.config.*`, `playwright.config.*`), and the two deny reasons are constants in one module. The target path is made relative to the session's working directory; a path that resolves outside it is not guarded, so scratch files under `/tmp` stay writable for both agents. Patterns are compiled by a small glob-to-regex function covering `**`, `*`, and literal segments only, which is all the list uses. Alternative: an npm glob library. Rejected as new tooling for a fixed list of seven shapes.

`pyproject.toml` and `setup.cfg` mix runner config with production metadata. test-author may edit them; its instructions keep it to the test sections, as they do today.

### 5. Deny reasons

These are seams the tests assert on:

- implementer: `Test files belong to test-author. If this test looks wrong, list it under Disputed tests.`
- test-author: `Production code belongs to the implementer. Report the change under Needed production changes instead.`

### 6. No state, no types file

The mod keeps nothing between calls, so it has no `types/index.d.ts` and `plugin.json` names no `types`. Layout: `.claude-plugin/plugin.json`, `hooks/hooks.json` (`{ "modules": ["./register.ts"] }`), `hooks/register.ts`, `hooks/rules.ts`, `tests/guard.test.ts`, `tsconfig.json`.

### 7. Verification

`claude plugin test` drives `tool.call` events through the hook with `agent.list` mocked, one test per spec scenario. A live check then loads the mod with `claude --plugin-dir mods/agent-write-guard`, dispatches `implementer` and `test-author` against a scratch repo, and attempts one denied and one allowed write per agent. The live check is what proves the `agentId`-to-type path against the real engine.

## Risks / Trade-offs

- [Mod not installed, so Claude agents are prompt-only] → Accepted by Decision 1. `agents/README.md` and `docs/agents.md` name the mod as the optional hard block.
- [Mod API change silently disables the guard] → The hook fails open by design. Re-run `claude plugin validate`, `claude plugin test`, and the live check after each Claude Code update, as `docs/mods.md` already requires.
- [Agent rename turns the guard off] → The agent names are constants with a test per agent; a rename that skips the constant fails no test, so `docs/agents.md` lists the mod among things to update on a rename.
- [test-author given a `Report to` path outside `.orchestrate/`] → The write is denied. `orchestrate` uses `.orchestrate/<slug>/` by default; the deny reason makes the cause visible, and the path list can grow if a real brief needs it.
- [Subagent running in a different working directory, such as a worktree] → Paths are judged against the session's working directory, so a worktree outside it is unguarded. Accepted; the orchestrated flow does not use worktree isolation today.

## Migration Plan

Agents install as symlinks, so removing the frontmatter hook takes effect on the next session. Users who want the hard block run `/plugin install agent-write-guard@data-engineering-skills`. Rollback is a revert of the agent and docs edits; the mod can be uninstalled independently.
