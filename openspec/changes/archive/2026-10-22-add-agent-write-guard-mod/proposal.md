## Why

The Claude `implementer` enforces its test-tree boundary with 14 `PreToolUse` handlers in its frontmatter, because a hook `if` field holds one permission rule, matches one tool, and accepts no brace globs (tested on Claude Code 2.1.308). The block is most of the frontmatter, it can only express "deny these paths", so `test-author`'s production-code boundary stayed prompt-only, and the only way to check it is to run the agent by hand. A mod runs in-process TypeScript, sees which agent made each tool call, and can hold both boundaries as one tested rule set.

## What Changes

- **BREAKING** (Claude enforcement): remove the `hooks` block from `agents/claude/implementer.md`. The test-tree rule stays in the prompt. Without the new mod, the Claude implementer is bounded by instruction only, as the Codex and Cursor variants already are.
- Add an optional Claude Code mod, `agent-write-guard`, at `mods/agent-write-guard/`, cataloged in `.claude-plugin/marketplace.json` only. While installed it:
  - denies `implementer` `Edit`, `Write`, and `NotebookEdit` calls on test-tree paths, with a reason naming `test-author` and the `Disputed tests` field;
  - denies `test-author` `Edit`, `Write`, and `NotebookEdit` calls outside the test tree, its report directory, and test-runner config, with a reason directing it to report the needed production change;
  - leaves every other agent and the main session untouched.
- Update the implementer prompt's *Test tree* paragraph, `agents/README.md`, `docs/agents.md`, `docs/mods.md`, and the `orchestrate` implementer dispatch reference so none of them claims a frontmatter hook, and so they name the mod as the optional hard block.
- Archived `add-test-author-agent` Decisions 4 and 6 are superseded; the archive itself is not edited.

## Capabilities

### New Capabilities
- `agent-write-guard`: the mod's per-agent path rules, which agents and tools it guards, its deny reasons, and how it behaves when it cannot identify the agent.

### Modified Capabilities
- `test-authoring`: "Implementer does not write tests" no longer requires a frontmatter hook on the Claude variant; enforcement comes from the optional mod. "test-author owns the test tree" gains enforcement of the production-code boundary when the mod is installed.

## Impact

- New: `mods/agent-write-guard/` (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.ts`, tests, `tsconfig.json`).
- Edited: `agents/claude/implementer.md` (frontmatter `hooks` removed; one sentence in *Test tree*), `agents/README.md`, `docs/agents.md` (hook section replaced by a pointer to the mod), `docs/mods.md` (*Available mods*), `skills/flow/orchestrate/references/dispatch-implementer.md` (one parenthetical), `.claude-plugin/marketplace.json` (one mod entry).
- No change to Codex or Cursor agent variants, the Cursor catalog, or any install script. Agent installs stay as they are; the mod installs with `/plugin install agent-write-guard@data-engineering-skills`.
- Depends on the early-access mod API; re-run the mod checks after Claude Code updates.
