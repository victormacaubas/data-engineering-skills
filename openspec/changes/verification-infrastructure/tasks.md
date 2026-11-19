# Tasks

## 1. Validation command

- [ ] 1.1 Write `scripts/validate_repo.py` with the catalog checks and the skill directory checks from the `repo-validation` spec, the output format from design Decision 2, and no third-party import; verify that `uv run scripts/validate_repo.py` exits with status zero on the current repository, or lists real defects
- [ ] 1.2 Add the agent checks: three variants, `name` equal to the file name, no different agent name in a `description`, and each Claude Code preload resolved to a cataloged `<group>:<skill>`; verify that the command passes on the current agent files
- [ ] 1.3 Add the mod checks and the `bash -n` check for each script under `scripts/`; verify that the command passes on the current mods and scripts
- [ ] 1.4 Run the control cases from design Decision 3 on a temporary copy of the repository, one defect at a time: a skill removed from one catalog, invalid JSON, a directory that is not cataloged, a name in two groups, an in-progress skill in a catalog, a missing Codex variant, a description that names a different agent, a preload that does not resolve, a mod with no entry, and a shell syntax error; verify that each case fails with one line that names the file and the rule
- [ ] 1.5 Run the command and then `git status --porcelain`; verify that the command changed no file
- [ ] 1.6 Correct each real defect that 1.1 to 1.3 found, or record it for the user when the correction is not in the scope of this change; verify that the command exits with status zero
- [ ] 1.7 In `AGENTS.md` and in the release checklist of `docs/authoring.md`, name the validation command as the method for the structural checks; verify that neither file gives the manual list as the only method

## 2. Project verify skill

- [ ] 2.1 Read the current Claude Code skills documentation for the behavior of a project skill named `verify`: when the commit instructions run it, which locations count, and the exception for docs and tests; verify that the points and the page link are in the session
- [ ] 2.2 Change `.gitignore` so that the content of `.claude/` stays ignored and `.claude/skills/verify/` is tracked; verify with `git check-ignore -v` that `.claude/settings.local.json` is ignored and `.claude/skills/verify/SKILL.md` is not, and with `git status` that no other file under `.claude/` shows as new
- [ ] 2.3 Load `skill-creator`, enter plan mode, and show the user the planned `.claude/skills/verify/SKILL.md` with the four steps from design Decision 5; verify by the user's approval in the session
- [ ] 2.4 Write `.claude/skills/verify/SKILL.md`; verify by invoking the skill in a new session after a skill edit, with the validation command run and its output reported
- [ ] 2.5 In `AGENTS.md`, add the exception for the project `verify` skill to the skill location rule, and state that a session runs `verify` before a commit; verify that the rule against skills outside `skills/<group>/` still applies to release skills
- [ ] 2.6 In a new session, make a `SKILL.md`-only change and ask for a commit, then make a mod change and ask for a commit; verify in each case if Claude Code runs `verify` without a request, and record the result in `docs/authoring.md`

## 3. architecture-baseline: generated verify skill

- [ ] 3.1 Read the current prompting guide for the model of the main session, load `skill-creator`, enter plan mode, and show the user the planned text for `skills/craft/architecture-baseline/SKILL.md`, `references/enforcement.md`, and the new `references/verify-skill.md`; verify by the user's approval in the session
- [ ] 3.2 Write `references/verify-skill.md` with the four-part template from design Decision 7 and one example for each project type that the skill describes; verify that each example has a start command, a fixed input, the evidence, and a pass condition
- [ ] 3.3 In `SKILL.md`, add the step that writes `.claude/skills/verify/SKILL.md` in the target project, the rule from design Decision 8 for a project with no entry point that runs, and the confirmation for an existing file; verify that the step says to ask the person when the design document names no entry point
- [ ] 3.4 In `SKILL.md`, change the definition of done in the generated `AGENTS.md` to name the gate and the verify skill with its path, and replace the sentence "The gate proves the code runs"; verify by `grep -rn "proves the code runs" skills/craft/architecture-baseline/` that the sentence is not there
- [ ] 3.5 In `references/enforcement.md`, state in the gate section that the gate does not start the program and that the verify skill does; verify that the gate command block is unchanged
- [ ] 3.6 In `SKILL.md`, add the hand-over text from the `baseline-verify-skill` spec about when the skill runs in Claude Code and what other tools do, with the facts from task 2.1; verify that the text names no Claude Code version that task 2.1 did not confirm
- [ ] 3.7 Read the pre-commit documentation for hook stages and for the installation of a pre-push hook; verify that the stage name and the install option for the hook example have a documentation link in the session
- [ ] 3.8 In the pytest block of `references/enforcement.md`, add the marker expression from design Decision 16 and the explicit command for the integration lane; verify in a scratch project that `uv run pytest` does not select a test with the `integration` marker, that it selects a test with no marker that stands for the registry test, and that `uv run pytest -m integration` selects the integration test
- [ ] 3.9 In the CI section of `references/enforcement.md`, replace the sentence that leaves the slow checks to CI with the three tiers from design Decision 15, and add the pre-push hook and the install instruction to the example; verify in a scratch repository that a commit runs only the fast hooks and that a push runs `make check` before it completes, and by `grep -n "left to CI" skills/craft/architecture-baseline/references/enforcement.md` that the sentence is not there
- [ ] 3.10 In `SKILL.md`, add to the definition of done in the generated `AGENTS.md` that the gate runs on the local machine before a push or a pull request and that CI confirms it; verify that the bullet "CI runs the gate command rather than a list of its own" is unchanged
- [ ] 3.11 If the `standards-verification-rules` change is applied, compare the hook example and the pytest block with those in `skills/craft/python-engineering-standards/references/tooling.md`; verify that the two skills give the same tiers and the same marker expression
- [ ] 3.12 Run the baseline on a short design document for a command-line tool in a scratch directory; verify that `.claude/skills/verify/SKILL.md` exists with the four parts, that it contains no command that the design document did not give, that the generated `AGENTS.md` names the gate, the run before a push, and the skill path, and that the hook configuration has the gate at the pre-push stage
- [ ] 3.13 Read `skills/craft/README.md` and both catalog descriptions for `craft`; update them only if a statement about the skill is now wrong; verify with the validation command

## 4. agent-write-guard: gate-configuration rule with a mode

- [ ] 4.1 Load the `plugin-authoring` skill and read the `userConfig` and log types in `mods/agent-write-guard/.claude-plugin/types/`; verify that the session has the manifest shape for a choice field, the way the hooks module reads the value, and the way the test harness sets it
- [ ] 4.2 Add the mode field to `.claude-plugin/plugin.json` with the three values and the default `observe`; verify that `claude plugin validate mods/agent-write-guard` reports no error
- [ ] 4.3 In `hooks/rules.ts`, add the gate-configuration path list from design Decision 13, the deny reason, and a result that carries the rule name and the action; verify with new cases in `tests/guard.test.ts` for each path, for `pyproject.toml` not matching, and for `test-author` not matching
- [ ] 4.4 In `hooks/register.ts`, read the mode, let a matching call proceed with one transcript line in `observe` mode, deny in `enforce` mode, do nothing in `off` mode, and use `observe` with a debug-log line for an invalid value; verify with new test cases for the three modes and the invalid value
- [ ] 4.5 Run the existing tests; verify that every scenario of the two existing rules still passes with each mode value, and that the compiled `.js` files agree with the `.ts` sources
- [ ] 4.6 Run `claude plugin validate`, `claude plugin test`, and `tsc -p` for the mod; verify that the three report no error
- [ ] 4.7 With the mod loaded through `--plugin-dir` in a scratch repository, dispatch `implementer` to edit `ruff.toml` in each mode; verify that `observe` lets the edit proceed and shows one line in the session, `enforce` denies with the reason, and `off` shows nothing
- [ ] 4.8 Update the `agent-write-guard` section of `docs/mods.md`, the `implementer` row of `agents/README.md`, and the mod description in `.claude-plugin/marketplace.json` with the new rule, its modes, and the default; verify with the validation command that the catalogs are valid and that the Cursor catalog is unchanged

## 5. Integration

- [ ] 5.1 Invoke the project `verify` skill on the final tree of this change; verify that the validation command and the mod checks for `agent-write-guard` pass
- [ ] 5.2 Run `openspec validate verification-infrastructure --strict`; verify that it reports no error

## Workflow follow-up

- Examine `design.md` for decisions that bind future changes and promote them to `docs/adr/` before the archive. `docs/adr/` does not exist, so ask the user first.
- Archive the change with `/opsx:archive`.
- Copy the archived change to the vault inbox as `openspec-verification-infrastructure-data-engineering-skills/` and tell the user to run `/process-inbox`.
