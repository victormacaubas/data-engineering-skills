## 1. Prompting groundwork

- [x] 1.1 Read the current Claude Haiku 5.5 prompting guide and the guide for the pinned GPT-5.6 model, and record in the apply notes any rule that differs from `docs/prompting.md`; verify by listing the guide URLs and the differences found (or "none")

## 2. test-author agent

- [x] 2.1 Write `agents/claude/test-author.md` with frontmatter `name: test-author`, `model: claude-haiku-5-5[1m]`, `effort: high`, `permissionMode: acceptEdits`, tools `Read, Write, Edit, Bash, Grep, Glob`, and a body covering a source-agnostic input contract (scenarios and named seams from the brief), scenario triage, named-seams-only rule, lean-suite rules, test-tree ownership, no production edits, the expected-outcome check, the task-to-selector map (or single command when the brief has no tasks), and the report and receipt from design Decision 8; verify the frontmatter parses and every requirement in `specs/test-authoring` that names `test-author` maps to a section of the body
- [x] 2.2 Write `agents/codex/test-author.toml` with the same role and safety intent, `model = "gpt-5.6-luna"`, high reasoning, 1M context, `sandbox_mode = "workspace-write"`; verify the TOML parses and `name` matches the filename
- [x] 2.3 Write `agents/cursor/test-author.md` with the same role and safety intent, `model: gpt-5.6-luna[reasoning=high,context=1m,fast=false]`, no `readonly`; verify the frontmatter parses and `name` matches the filename

## 3. Implementer changes

- [x] 3.1 Show the user the planned edits to all three `implementer` variants and get confirmation before writing; verify by the user's go-ahead in the session
- [x] 3.2 Edit `agents/claude/implementer.md`: drop tests from the description, change method step 4 to code only, change step 5 to run the selectors the brief supplies plus the existing suite, add the test-tree rule to guardrails (including mixed files and Bash), add `## Disputed tests` to the report and `Disputed tests:` to the receipt per design Decision 7, and add the `hooks` block from design Decision 4 with an `Edit` and a `Write` handler for each of the seven patterns; verify the frontmatter parses and the hook block lists all fourteen handlers
- [x] 3.3 Apply the same contract edits, minus the hook, to `agents/codex/implementer.toml` and `agents/cursor/implementer.md`; verify the TOML and frontmatter parse and each variant contains the test-tree rule and the `Disputed tests` field

## 4. Orchestrate skill

- [x] 4.1 Invoke `skill-creator` and enter plan mode for the `orchestrate` edits; show the user the planned changes to `skills/flow/orchestrate/SKILL.md` and get confirmation before writing; verify by the approved plan
- [x] 4.2 Edit `skills/flow/orchestrate/SKILL.md`: add the pre-flight check (testable scenarios have a named seam, no placeholders in asserted values), add the test-author dispatch step before the implementer loop with expected outcome `fail`, treat "Verify with a test that ..." clauses as test-author input, and add dispute arbitration to the dispatch loop; verify each `Orchestrate sequences test-author and implementers` scenario is covered by a passage in the skill
- [x] 4.3 Add `skills/flow/orchestrate/references/dispatch-test-author.md` (brief contract: scenarios, named seams, settled values, expected outcome, report path, capability split for large changes; acting on the receipt), and update `references/dispatch-implementer.md` so the brief carries task selectors and the after-return section handles `Disputed tests`; verify `SKILL.md` links the new reference and the implementer playbook mentions selectors and disputes

## 5. Docs and catalogs

- [x] 5.1 Add `test-author` to `agents/README.md` (table row with models and the prompt-only Codex/Cursor enforcement as an intentional difference) and update the `implementer` row; verify the table lists six agents
- [x] 5.2 Update `docs/agents.md`: document frontmatter `hooks` for Claude agents, the `if`-pattern approach, the minimum Claude Code version for `if`, and that hooks are verified by running the agent; verify the section exists and names the version
- [x] 5.3 Add `test-author` to the `/flow:orchestrate` prerequisites in `AGENTS.md`, `skills/flow/README.md`, and the `flow` description in both `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`; verify both catalogs still parse as JSON and their `skills` arrays are unchanged

## 6. End-to-end verification

- [ ] 6.1 Install with `./scripts/install-agents.sh --platform claude --agents test-author,implementer` and run the Claude `implementer` in a scratch repo, asking it to Write `tests/test_x.py`, Write `src/foo.test.ts`, Edit an existing `tests/conftest.py`, and Write `src/foo.ts`; verify the first three are denied with the test-author message visible to the model and the fourth succeeds. If any test path is allowed, switch the hook to the inline `jq` fallback from design Decision 4, document `jq` as a prerequisite, and re-run
- [ ] 6.2 Run `test-author` on a small sample change with at least one testable, one command-verified, one manual, and one placeholder scenario, briefed with expected outcome `fail`; verify the receipt triages all four correctly, the new tests fail before implementation, the report contains a task-to-selector map, and no test contains a task id
- [ ] 6.3 Run `test-author` a second time with a brief that supplies scenarios for code that already exists and expected outcome `pass`; verify the receipt reports outcomes against that expectation, lists any failing test as an unexpected outcome without editing it, and that no backfill-specific steps run
- [ ] 6.4 Run `openspec validate add-test-author-agent --strict`; verify it passes
