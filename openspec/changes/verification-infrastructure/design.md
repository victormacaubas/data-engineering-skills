# Design

## Context

See `proposal.md` for the motivation. This section gives the current state that shapes the approach.

This repository:

- No `.github/`, no pre-commit configuration, no `Makefile`. The five files under `scripts/` are shell scripts for installation.
- `AGENTS.md` lists the structural checks as manual work: "Validate JSON, catalog parity, array/directory agreement, and cross-group name uniqueness". `docs/authoring.md` has a release checklist with the same checks.
- A Claude Code preload that does not resolve is skipped with only a debug-log warning.
- `.gitignore` ignores `.claude/` completely. The directory holds local copies of other skills, session reports, and local settings.
- `AGENTS.md` says "Don't create skills outside `skills/<group>/`".

`craft:architecture-baseline`:

- `references/enforcement.md` defines the gate as `ruff format --check`, `ruff check`, `lint-imports`, `mypy`, and `pytest`.
- `SKILL.md:252` says "The gate proves the code runs; nothing in it proves the code is shaped the way this project decided".
- The skill runs before the first feature change, so the target project can have no code that runs.
- The CI section of `references/enforcement.md` says "Fast checks also run on commit, with the slow ones left to CI". Its hook example has ruff and detect-secrets only.
- The pytest block of `references/enforcement.md` has `addopts = "-ra --strict-markers"` and describes the `integration` marker as "excluded from default runs". pytest does not deselect a marker unless the command or `addopts` has a marker expression, so the `uv run pytest` step of the gate selects the integration tests.

`agent-write-guard` mod:

- One hooks module. A rule match returns a deny. There is no mode.
- `hooks/rules.ts` permits `test-author` to edit `**/pyproject.toml`, and applies no rule to the `implementer` outside the test tree.
- The mod API types show a `userConfig` field in the plugin manifest and two log sinks, `transcript` and `debug`. The API is early access.

Claude Code behavior that this design uses (from the skills documentation, read through a summarizer on 2026-11-19, to be confirmed in the tasks):

- When a session starts with a project skill named `verify`, the commit instructions tell Claude to run it before each commit, with the exception of changes to docs or tests.
- A plugin skill does not count for this behavior. A project, personal, or enterprise skill does.
- A project skill named `verify` replaces the bundled `/verify` command.

## Goals / Non-Goals

**Goals:**

- A contributor finds a structural defect with one command, before a commit.
- A project that starts from the baseline has a written method to run the program, and that method is part of "done".
- A new guard rule can be measured before it denies a call.
- In a baseline project, the gate needs no credentials, and CI is not the first place where it runs.

**Non-Goals:**

- No test suite in the commit hook of a baseline project. The commit hook stays fast.
- No CI workflow for this repository. A check that a change cannot edit needs a protected branch and a workflow on the base. That is a possible later change.
- No commit gate that blocks `git commit`. Claude Code documents no mechanism for it.
- No path rule for `pyproject.toml`, a `Makefile`, or CI workflow files. They hold content that an `implementer` changes as normal work.
- No mode for the two existing guard rules.
- No shipped `verify` skill in a plugin. Claude Code does not run a plugin skill before a commit.
- No evaluation harness for skills.

## Decisions

### Decision 1: The validation command is a Python script with no third-party package

`scripts/validate_repo.py` uses only the standard library: `json`, `tomllib`, `pathlib`, `subprocess` for `bash -n`. The documented command is `uv run scripts/validate_repo.py`. Python 3.11 or later is necessary for `tomllib`.

Agent frontmatter is read with a small line parser for the `name`, `description`, and `skills` fields. The frontmatter in this repository is flat, and a YAML library would be a third-party package.

Alternative: a shell script with `jq`. It adds `jq` as a requirement, and shell has no TOML parser for the Codex agent files.

Alternative: a TypeScript script. The repository has no Node project at its root.

The script is a tool for contributors only. No install script calls it, and a user of the plugins does not need Python.

### Decision 2: The checks and the output

The script does every check, collects the failures, and prints them together. Each line has the form `<file>: <rule>: <detail>`. The last line states the count of failures, or the count of checks that passed.

The checks are those in the `repo-validation` spec. Two of them come from past defects in this repository:

- A description that names a different agent (six files, corrected on 2026-11-19).
- A preload that does not resolve, which Claude Code skips with no visible message.

The script compares the description of each agent with the names of all other agents as whole words.

### Decision 3: The script has control cases

Each check is run one time against a copy of the repository with one deliberate defect. A check that cannot fail is not trusted. The control cases are tasks, not a permanent test suite, because the repository has no Python test setup and this change does not add one.

Alternative: a `tests/` directory with pytest. It adds a test framework and a project file for one script.

### Decision 4: The verify skill is tracked in `.claude/skills/verify/`

Claude Code runs a `verify` skill before a commit only when it is a project, personal, or enterprise skill. A project skill is the one location that a clone and a worktree both get.

`.gitignore` changes from one `.claude/` line to a set of lines that ignore the content of `.claude/` and make an exception for `.claude/skills/verify/`. All other content of `.claude/` stays ignored.

`AGENTS.md` gets one exception to "Don't create skills outside `skills/<group>/`": the project `verify` skill is a tool for this repository, is not a release skill, and is not in a catalog.

Alternative: keep the skill local and not tracked. A second clone, a worktree, and a second contributor do not get it.

Alternative: put it in `skills/flow/`. It would then ship to every user of the plugin, and Claude Code would not run it before a commit.

### Decision 5: What the repository verify skill does

1. Run `uv run scripts/validate_repo.py`.
2. For each `mods/<name>/` that the change touches, run `claude plugin validate`, `claude plugin test`, and `tsc -p` for that mod. `docs/mods.md` gives the condition for `tsc`: the engine must load the mod one time first.
3. For a change to an agent preload, tell the session to run that agent, as `AGENTS.md` requires. The skill does not run an agent itself.
4. Report each command and the last lines of its output. State pass or fail for each.

The skill does not run a skill evaluation. An evaluation is slow, and the skill must be fast to be useful before each commit.

Claude Code makes an exception for changes to docs. Most files in this repository are Markdown, so the exception could apply to a `SKILL.md` edit. A task tests this. `AGENTS.md` also states the rule in words, so the check does not depend on that behavior.

### Decision 6: The baseline keeps the gate and the verify skill apart

The gate stays as static checks and tests. It is fast, has a fixed result, and CI runs it. The verify skill starts the program and drives one flow. The article keeps the same division: tests, build, and linter are the low-cost checks, and the verify skill is the smoke test.

Alternative: add a smoke step to the gate. A smoke step can need a local service or data, and the gate must run in CI with no such setup.

The sentence at `SKILL.md:252` changes. The gate shows that the static checks and the tests pass. The verify flow shows that the program runs.

### Decision 7: The content of a generated verify skill

A new reference file, `references/verify-skill.md`, holds the template and one example for each project type that the skill already describes. The template has four parts:

1. Start: the command that starts the program through its declared entry point.
2. Drive: one flow with a fixed input that is in the repository.
3. Evidence: the output to capture.
4. Pass: the condition that the evidence must satisfy.

The fixed input is small and needs no network, unless the purpose of the program needs it. The template tells the writer to keep the flow short, because a slow check is run less.

### Decision 8: No invented command

The baseline runs before the first feature. When no entry point runs, the generated skill names the entry point from the design document and says that the first feature change must make the flow run. When the design document names no entry point, the baseline asks the person.

This agrees with the rule of the baseline that it decides and declares, and does not build the product.

### Decision 9: The generated AGENTS.md is the reference for all tools

The definition of done in the generated `AGENTS.md` names the gate command and the verify skill, with the path `.claude/skills/verify/SKILL.md`. Codex and Cursor do not load Claude Code project skills, but they read `AGENTS.md` and can open the file.

Alternative: copy the verify steps into `AGENTS.md`. Two copies drift.

### Decision 10: The mode comes from the plugin configuration

`plugin.json` declares one `userConfig` field for the mode of the gate-configuration rule, with the values `off`, `observe`, and `enforce` and the default `observe`. The hooks module reads the value and passes it to the rule function.

The implementer confirms the exact shape of `userConfig`, and how the hooks module and the test harness read it, with the `plugin-authoring` skill and the type files in `.claude-plugin/types/` before the write.

Alternative: an environment variable. The user cannot see or change it in the `/config` menu.

### Decision 11: Only the new rule has a mode

The two existing rules deny as before. Their requirements in the `agent-write-guard` spec say "SHALL deny", and tests pin that behavior. A mode on them would be a change to existing requirements with no benefit.

The rule function returns a result with the rule name and the action. This structure lets a later rule get a mode without a change to the hook.

### Decision 12: Observe mode writes to the transcript

A line in the debug log is not seen. The observe line goes to the `transcript` sink, so the person sees it in the session. The line names the agent type, the tool, the path, and the rule.

The person uses these lines to decide between `enforce` and a change to the path list.

### Decision 13: The path list of the new rule

The rule covers files that hold only gate configuration: `ruff.toml`, `.ruff.toml`, `mypy.ini`, `.mypy.ini`, `.importlinter`, `.pre-commit-config.yaml`, at any depth.

`pyproject.toml` holds dependencies. A `Makefile` and CI workflow files hold targets and jobs that a task can legitimately add. A path rule cannot tell these edits apart. The `build-loop-verification` change covers them with an instruction and a diff check by the orchestrator.

The deny reason in `enforce` mode tells the model to report the configuration change that it needs and not to make it.

### Decision 14: Authoring process

- The repository `verify` skill is a new skill. The `architecture-baseline` edit is a significant change. Each uses `skill-creator` and plan mode, and the user confirms the planned text before the write.
- The two skills load in the main session. The writer reads the prompting guide for the model of the main session.
- The mod change uses the `plugin-authoring` skill. The three mod checks run after the change.
- `scripts/validate_repo.py` is a new script under `scripts/`. It does not touch the install contract, the symlink strategy, or the backup behavior.

### Decision 15: Three tiers of checks in a baseline project

The sentence "Fast checks also run on commit, with the slow ones left to CI" in `references/enforcement.md` is replaced with three tiers:

1. On each commit: the fast hooks that the example has now (ruff, ruff-format, detect-secrets).
2. Before a push or a pull request: the gate command on the local machine.
3. In CI: the same gate command. The rule that CI runs the gate command, and not a separate list of steps, stays.

The hook example gets one local hook at the pre-push stage that runs the gate command. The install instruction is updated so that the pre-push hook is installed. The implementer checks the stage name and the install option in the pre-commit documentation before the write.

The definition of done in the generated `AGENTS.md` then has three parts: the gate passes on the local machine before a push, the verify flow passes, and CI confirms the gate.

The tiers and the verify skill from Decision 6 fit together in this sequence. On a commit, the fast hooks run, and Claude Code runs the verify skill. On a push, the gate runs. In CI, the gate runs again.

Alternative: put the gate in the commit hook. The gate has the type check and the test suite. A slow commit hook is bypassed.

Alternative: a Claude Code Stop hook or a `/goal` that runs the tests. It covers only Claude Code sessions. A git hook covers each contributor and each tool.

### Decision 16: The gate uses a default run that deselects the integration lane

The pytest block changes to `addopts = "-ra --strict-markers -m 'not integration'"`. The gate keeps `uv run pytest`. The integration lane is `uv run pytest -m integration`, in the place that has the credentials. A marker expression on the command line replaces the expression from `addopts`. The implementer confirms this in a scratch project before the write.

The rules registry test has no marker, so the default run selects it. The gate section says this already, and a task checks it.

The description of the marker and the configuration then agree. Today the gate either needs credentials or fails on a machine that has none.

Alternative: keep `addopts` and change the gate to `uv run pytest -m "not integration"`. A contributor who runs `pytest` directly then gets a different selection from the gate.

## Risks / Trade-offs

- [Claude Code does not run `verify` for a Markdown-only change] → `AGENTS.md` states the rule in words. A task tests the behavior and records the result in `docs/authoring.md`.
- [The documented behavior of `verify` changes] → The skill is useful when a person or a session invokes it directly. The pre-commit behavior is an addition.
- [The validation script and `AGENTS.md` drift apart] → `AGENTS.md` names the script as the method. A rule that the script does not check stays in `AGENTS.md` as text.
- [The frontmatter line parser fails on a new field shape] → The script fails with the file name. The control cases include a multi-line `skills` list.
- [The mod API changes] → The three mod checks run after each Claude Code update, as `docs/mods.md` already requires.
- [Observe lines add noise to a session] → One line for each matching call. The mode `off` removes them.
- [A generated verify skill names an entry point that later changes] → The skill is a file in the project. The first feature change updates it, and the generated `AGENTS.md` says so.
- [A contributor bypasses a slow pre-push gate] → The default run deselects the integration lane. CI runs the same gate.
- [The marker expression on the command line does not replace the one in `addopts`] → A task confirms the behavior in a scratch project before the write.
- [The two skills state the three tiers differently] → The `standards-verification-rules` change uses the same decision text. A task compares the two hook examples.
- [A tracked file under `.claude/` conflicts with local content] → Only `.claude/skills/verify/` is tracked. A task checks `git status` in the existing checkout after the `.gitignore` change.

## Migration Plan

1. Add the validation script and run it on the current repository. Correct each defect that it finds, or record it as a follow-up.
2. Change `.gitignore`, add the `verify` skill, and update `AGENTS.md` and `docs/authoring.md`.
3. Apply the `architecture-baseline` edits.
4. Apply the mod change, run the three mod checks, and update the docs.
5. Users of the mod get the new rule in `observe` mode at their next plugin update. No call is denied that was permitted before.
6. Rollback: revert the commit. A user can also set the mode to `off`.
