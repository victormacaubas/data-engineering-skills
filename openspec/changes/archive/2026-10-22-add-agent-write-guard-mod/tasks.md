## 1. Mod scaffold

- [x] 1.1 Create `mods/agent-write-guard/` with `.claude-plugin/plugin.json` (`name: agent-write-guard`, description, author, no `version`, no `types`), `hooks/hooks.json` naming `./register.ts`, and `tsconfig.json` extending `./.claude-plugin/types/tsconfig.json`; verify `claude plugin validate mods/agent-write-guard` reports no errors once task 2.2 exists

## 2. Guard rules and hook

- [x] 2.1 Write `hooks/rules.ts` with the test-tree patterns, the test-author extras, the two deny reasons from design Decision 5, the guarded agent names, and a glob-to-regex matcher for `**`, `*`, and literal segments; verify the `Test tree definition` scenarios pass under `claude plugin test`
- [x] 2.2 Write `hooks/register.ts`: a `tool.call` hook for `Edit`, `Write`, and `NotebookEdit` that reads `file_path` or `notebook_path`, passes main-loop calls and paths outside the working directory, resolves the agent type through `$.agent.list()`, returns `{ deny }` per design Decisions 2 to 4, logs unknown agents and lookup errors to the debug log, and chains `.catch(($, e, next) => next(e))`; verify every `agent-write-guard` scenario passes under `claude plugin test`
- [x] 2.3 Load the mod once with `claude --plugin-dir mods/agent-write-guard`, then run `tsc -p mods/agent-write-guard`; verify it reports no errors

## 3. Live check

- [x] 3.1 With the mod loaded via `--plugin-dir` in a scratch git repo, dispatch `implementer` to `Write` `tests/test_x.py` and `src/foo.ts`, and `test-author` to `Write` `tests/test_y.py` and `Edit` `src/foo.ts`; verify the implementer test write and the test-author production edit are denied with the design Decision 5 reasons and the other two succeed

## 4. Agent and docs

- [x] 4.1 Show the user the planned edits to `agents/claude/implementer.md` (remove the frontmatter `hooks` block; in *Test tree*, replace the hook sentence with one naming the optional `agent-write-guard` mod) and get confirmation before writing; verify by the user's go-ahead in the session
- [x] 4.2 Apply the 4.1 edits; verify the frontmatter parses, has no `hooks` field, and the *Test tree* paragraph still lists all seven patterns
- [x] 4.3 Update `agents/README.md` `implementer` and `test-author` rows to say enforcement on Claude Code comes from the optional `agent-write-guard` mod; verify neither row mentions frontmatter hooks
- [x] 4.4 Replace the *Restricting an agent's writes with hooks* section of `docs/agents.md` with a short section naming the mod, why frontmatter `if` hooks were dropped (one rule per handler, one tool per rule, no brace globs), and that renaming `implementer` or `test-author` needs a matching change in the mod; verify no example `hooks:` block remains in the file
- [x] 4.5 Add `agent-write-guard` under *Available mods* in `docs/mods.md` with what it denies, that it is optional, and that it does not cover `Bash`; verify the section exists
- [x] 4.6 In `skills/flow/orchestrate/references/dispatch-implementer.md`, change "(a hook blocks it on Claude Code)" to name the optional mod; verify by `grep -n "hook blocks" skills/flow/orchestrate/references/dispatch-implementer.md` returning nothing

## 5. Catalog

- [x] 5.1 Add an `agent-write-guard` entry to `.claude-plugin/marketplace.json` with `source: ./mods/agent-write-guard`, no `skills` array, `strict: false`, and a description starting "Claude Code only." and stating it is optional; verify the JSON parses, every `mods/*/.claude-plugin/plugin.json` has exactly one entry, no plugin name repeats, and `.cursor-plugin/marketplace.json` is unchanged
