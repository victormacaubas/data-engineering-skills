# Retrofit: the rule set for a repo that already has code

An existing repo doesn't get the seven decisions; its architecture is whatever the code already is. What it can get is the agent-facing half of the baseline: its architectural rules gathered into `docs/rules.yaml`, each naming the check behind it, an `AGENTS.md` every coding agent loads, and the registry test in the gate.

Retrofit gathers and reconciles. It doesn't decide new architecture, add import contracts, restructure packages, or rewrite ADRs. Where the repo is missing a piece of the baseline, the gap report at the end says so, and closing it is a separate change.

Read `references/rules-registry.md` for the registry format and the test before step 4.

## 1. Inventory

Read before writing anything. Collect every place a rule might be stated or enforced:

- **Instruction files:** `AGENTS.md`, `CLAUDE.md`, `CLAUDE.local.md`, `.claude/CLAUDE.md`, `AGENT.md`, any nested ones under subdirectories, `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`
- **Decisions:** `docs/adr/`, `docs/ARCHITECTURE.md`, a design doc if one is linked
- **Checks:** the tool sections in `pyproject.toml` (or `ruff.toml`, `.importlinter`, `mypy.ini`, `setup.cfg`), the Makefile or justfile, CI workflows, `.pre-commit-config.yaml`, the lockfile
- **Meta-tests:** any test that runs a tool and asserts on it, such as one that runs `lint-imports`

Then run the gate once, unchanged, and record what it reports. If it's red before you've touched anything, say so to the person: the retrofit ends green, and they should know which failures were there first.

## 2. Extract the rules

Go through the instruction files and ADRs statement by statement. For each one, decide three things.

**Is it a rule?** The test from SKILL.md applies: does it tell someone how to decide, or what is currently true? A directory tree, a module listing, a count, or a "recently added" note is inventory. Inventory doesn't enter the registry, and it doesn't carry into `AGENTS.md` either.

**Is it architecture?** Apply the scope test in `references/rules-registry.md` → What belongs: would breaking it change the system's shape, or only one module's style? Most of what an instruction file holds is conventions (logging, CLI habits, test style, task sizing, vocabulary), and those go to `AGENTS.md`, not the registry. Expect the registry to come out at a fraction of the rules you found. A structural rule that no ADR records still goes in the registry, without `source`; deleting the old instruction file must never drop a structural rule. If it also passes the ADR test in `references/adr-set.md` (someone would plausibly undo it without knowing why), the gap report lists it as needing an ADR.

**What enforces it?** A rule a tool checks gets that check in `enforced_by`, but only after you've found the check in the config, or the test that asserts it. A rule an instruction file calls "enforced" with no matching contract, lint rule, or test is `review`, and it's also a finding for step 3. A rule only a person can check is `review`.

The same rule usually appears in several places, worded slightly differently each time. It becomes one entry, with its ADR as `source` when one exists.

## 3. Contradictions and dead references

These are what the duplication has been hiding, and finding them is most of what a retrofit is worth. Look for:

- an ADR or instruction file naming a check that isn't configured
- two ADRs that disagree, such as one adopting a tool another rejects
- an ADR whose dependency list doesn't match the lockfile
- an instruction file stating a rule differently from its ADR
- a config setting no ADR or instruction file accounts for, such as an extra lint rule or a relaxed check

Present them as one numbered list. For each item, give both sides with their file and line, and ask which one is right. Don't resolve any of them yourself, and don't edit an ADR silently. A correction that changes a decision supersedes the ADR, following `references/adr-set.md`. A plain factual slip, such as a contract name mistyped in an ADR, can be corrected in place once the person agrees.

A contradiction nobody resolves stays out of the registry. Record it as open in the closing report.

## 4. Write the registry and the test

Write `docs/rules.yaml` from step 2, using the answers from step 3. Add `tests/unit/test_rules_registry.py` from `references/rules-registry.md`, adapting the config paths to where this repo keeps its tool config. Add `pyyaml` and `types-PyYAML` as dev dependencies.

Run the gate. A registry test failure here is usually the registry being wrong (a contract name copied with a typo, an ADR path from before a rename), so fix the entry and re-run. Don't touch the config to make an entry pass: if the check it names doesn't exist, the entry is `review` and the missing check goes in the gap report. Stop when the gate is green, or when the only way to green is changing a decision; that goes back to the person.

## 5. Instruction files

Write `AGENTS.md` with the content SKILL.md lists for it under "Writing it down": what the project is, the pointer to the registry, the layer table if the repo has one, the gate command, the review bar, inherited standards, and the conventions from step 2. The architectural rules that used to live in the old instruction file are now registry entries, so they don't come along; the conventions do. If an `AGENTS.md` already exists, merge into it rather than replacing it.

Then handle what was there before. Each of these needs the person's confirmation, because these are files people have tuned by hand:

- **`CLAUDE.md`** (also `.claude/CLAUDE.md`). While one exists in the directory or anywhere above it, Claude Code reads it instead of `AGENTS.md` by default, so leaving it in place means Claude never sees the new file. Offer two options: delete it, or reduce it to a single `@AGENTS.md` import line followed by any notes that genuinely apply only to Claude Code. Show the person anything in it that didn't move into `AGENTS.md` or the registry before they choose.
- **`CLAUDE.local.md`** blocks `AGENTS.md` the same way, but it's the person's private file and usually not committed. Don't touch it. Tell them it hides `AGENTS.md` from Claude Code and that they can move its notes elsewhere or change Claude Code's project-instructions setting.
- **`AGENT.md`**, singular, is not a name any of the tools reads. If it's a symlink to the old `CLAUDE.md`, offer to remove it.
- **Nested instruction files** in subdirectories stay where they are. Pull their rules into the registry with `applies_to` scoped to that subdirectory, and leave the rest of the file for the person to decide on.

Delete nothing without a yes.

## 6. `docs/ARCHITECTURE.md`

If it exists, add a link to `docs/rules.yaml` near the top and leave the rest alone. If it restates rules, note that in the gap report rather than rewriting it.

## 7. Gap report

Report only. Don't build any of it here. List what the repo lacks compared with a baseline, each item with one line on what closing it would take:

- rules marked `review` that a tool could check, with the check that would do it
- registry rules with no `source` whose reasoning someone would need before changing them; each would benefit from an ADR
- missing pieces: no import contracts, no layer table, no error taxonomy, no `docs/ARCHITECTURE.md`, a gate that isn't one command, CI running something other than the gate
- contradictions left open in step 3

Suggest closing them as their own change, through the project's normal propose-and-implement process.

## When it's done

The retrofit is done when the gate is green with the registry test in it and every contradiction from step 3 is either resolved or listed as open. End with a short report: the files written, the files changed or removed and on whose say-so, the open contradictions, and the gap report.

## Running without anyone to ask

If this runs inside a dispatched worker, nobody can answer the step 3 or step 5 questions. Take the conservative default for each:

- leave every contradiction open and out of the registry
- write `AGENTS.md`, and leave `CLAUDE.md`, `AGENT.md`, `CLAUDE.local.md`, and every ADR untouched
- say plainly in the report that Claude Code won't load the new `AGENTS.md` until `CLAUDE.md` is removed or reduced to an `@AGENTS.md` import

List each default you took in the closing report, so the person can revisit it.
