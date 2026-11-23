# Proposal

## Why

This repository has no automatic check of its own rules. `AGENTS.md` lists validations that a person does by hand: catalog parity, agreement between the `skills` arrays and the directories, unique skill names, and matching agent variants. No script does them, and there is no CI. One rule, that an agent description does not name a different agent, was broken in six files until 2026-11-19.

The same gap is in what the repository gives to other projects. `craft:architecture-baseline` declares a gate and says that it "proves the code runs", but no step of the gate starts the program. It leaves the slow checks to CI, and its pytest configuration calls the `integration` marker "excluded from default runs" but does not deselect it, so the gate selects tests that need credentials. The `agent-write-guard` mod can only deny, so a new rule cannot be measured before it blocks work.

The Anthropic article "How the Claude Code team thinks about verification" (2026-11-16) recommends a `verify` skill that runs the change, low-cost checks before a commit, and an observe mode for a new gate.

## What Changes

- Add one validation command, `scripts/validate_repo.py`, that does the checks that `AGENTS.md` lists.
- Add a project `verify` skill at `.claude/skills/verify/` that runs the validation command and the mod checks. Track that directory in git.
- Make `craft:architecture-baseline` generate a `verify` skill in the target project and name it in the generated `AGENTS.md`.
- Make the baseline ask the person if commits carry verification trailers, and write the answer in the definition of done of the generated `AGENTS.md`.
- Remove the statement that the gate proves that the code runs.
- Replace "the slow ones left to CI" in the baseline with three tiers: fast checks on each commit, the gate on the local machine before a push or a pull request, and the same gate in CI. The generated `AGENTS.md` tells the contributor to run the gate before a push.
- Make the pytest configuration of the baseline deselect the `integration` marker in the default run, so that the gate needs no credentials.
- Add a gate-configuration rule to the `agent-write-guard` mod with three modes: `off`, `observe`, and `enforce`. The default is `observe`.

The two existing rules of the mod do not change. No change is **BREAKING**.

## Capabilities

### New Capabilities

- `repo-validation`: the validation command of this repository, the checks that it does, and the project `verify` skill that runs it.
- `baseline-verify-skill`: what "verified" means in a project that starts from `architecture-baseline`: the `verify` skill that the baseline generates, what the gate selects, when the gate runs, and how the generated `AGENTS.md` states the definition of done.

### Modified Capabilities

- `agent-write-guard`: adds a gate-configuration rule for the `implementer`, with a mode that the user sets. No existing requirement changes.

## Impact

- New script: `scripts/validate_repo.py`. Python standard library only. It introduces Python as a tool for contributors, through `uv run`.
- New project skill: `.claude/skills/verify/SKILL.md`. It is not a plugin skill and is not in a catalog.
- Edited: `.gitignore` (an exception for `.claude/skills/verify/`), `AGENTS.md` (the validation command, and an exception to the rule that skills live under `skills/<group>/`), `docs/authoring.md` (release checklist).
- Edited skill files: `skills/craft/architecture-baseline/SKILL.md` and `references/enforcement.md`. New reference file: `references/verify-skill.md`.
- Edited mod files: `mods/agent-write-guard/.claude-plugin/plugin.json`, `hooks/rules.ts`, `hooks/register.ts`, `tests/guard.test.ts`. The three stale compiled `.js` files (`hooks/register.js`, `hooks/rules.js`, `tests/guard.test.js`) are removed: Claude Code loads `register.ts` as an ES module and does not load them.
- Edited docs: `docs/mods.md`, `agents/README.md`, and the mod description in `.claude-plugin/marketplace.json`.
- New living specs at archive: `openspec/specs/repo-validation/spec.md`, `openspec/specs/baseline-verify-skill/spec.md`. Updated living spec: `openspec/specs/agent-write-guard/spec.md`.
- No change to the install scripts or to the Cursor catalog.
- Depends on the early-access mod API. The mod checks must run again after a Claude Code update.
- Related change: `build-loop-verification` adds an instruction for the `implementer` and a diff check in the orchestrator for the same gate-configuration files. It also makes the orchestrator read the trailer line that the baseline writes. This change does not depend on it. The generated line gives the format of the trailers in full.
- Related change: `standards-verification-rules` puts the same three tiers and the same marker correction in `craft:python-engineering-standards`. Each skill states the rule in full.
