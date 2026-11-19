# Design

## Context

See `proposal.md` for the motivation. This section gives the current state that shapes the approach.

- `skills/craft/code-audit/SKILL.md:22` says "Don't flag unchanged code" in diff scope and sends load-bearing issues to the top-level `notes`. Line `:58` reads `CLAUDE.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/adr/`, and tool configuration from the working tree, and says "A deviation an ADR records as deliberate is not a defect". Line `:184` derives the verdict from severity with no stated reason. The artifact schema is version 2.1.
- `skills/craft/structure-review/SKILL.md:47` raises problems "that predate the change" in a touched module. Line `:367` says "A declaration that blesses the thing you're about to raise makes it a decision, not a defect". Lines `:213-221` decide where a lesson goes, and "Nowhere" is the default. The skill uses leverage tiers 1 to 5 and rejects severity for structure findings.
- The two skills record a short commit hash and a dirty flag. They do not read the commit again before they write.
- The two skills use `main` as the default base.
- `skills/flow/orchestrate/references/dispatch-reviewer.md` says "Only a re-review clears the block".

Constraints from `AGENTS.md`:

- A skill and its references contain all that is necessary to follow it. One skill does not point at another skill for content. Each skill gets its own text for the shared rules.
- A significant change to a skill uses `skill-creator` and plan mode. An edit to an existing `SKILL.md` needs the user's confirmation.

## Goals / Non-Goals

**Goals:**

- A change cannot remove a finding with an edit to a rule in the same change.
- An author is not blocked by a defect that the change did not cause, and the defect stays visible.
- A verdict cannot be applied to a commit that the reviewer did not read.

**Non-Goals:**

- No `REVIEW.md`. Only the managed Code Review service reads that file. The local `/code-review` command and custom agents do not.
- No merge of the two reviewers. They cover different concerns.
- No second pass that tries to disprove each finding, and no evaluation set. These are possible later changes.
- No protection for test files that the change edits. A change edits tests as normal work. The `test-authoring` capability covers who can edit them.
- No replacement of the leverage tiers in `structure-review`.

## Decisions

### Decision 1: How the reviewer finds the origin

The reviewer applies two tests in sequence.

1. Line test. The anchor line is in the added or modified lines of `git diff <base>...HEAD`. The origin is `introduced`.
2. Cause test. The anchor line is unchanged, but the change makes it wrong or newly reachable. The origin is `introduced`, and the explanation says how.

When the two tests fail, the origin is `pre-existing`. When the reviewer cannot decide, the origin is `introduced`. This agrees with the `implementer` rule "when in doubt, treat it as yours".

Alternative: the line test only. A change that sends user input to an old unsafe function would then be `pre-existing`, and the verdict would ignore it.

### Decision 2: The threshold for old defects in code-audit does not change

Today `code-audit` notes "load-bearing unchanged-code issues" only. The same threshold applies to `pre-existing` findings: the defect is in the context lines of a changed hunk, or in code that the change calls. The reviewer does not sweep the full file for old defects. This keeps the "don't pad" position of the skill.

The container changes from `notes` to `findings`. A finding has an anchor, a severity, and a fix. A note has none of these.

### Decision 3: The code-audit artifact schema

- Each finding gets `origin`: `introduced`, `pre-existing`, or `not-assessed`.
- The top level gets `rule_changes`: a list of `{path, change, effect}`, where `change` is `added`, `edited`, or `deleted`.
- The top level gets `stale`: `false`, or an object with the start commit and the end commit.
- The top level gets `verdict_reason`: one sentence that names finding identifiers.
- `target` gets the resolved base and the place that the rules were read from: `base` or `working-tree`.
- `stats` gets a count for each origin.
- The schema version becomes 2.2.

All changes are additions. The reconciliation key for "compare against last review" stays `anchor.excerpt` plus `dimension`. A finding from a 2.1 artifact reads as `not-assessed`.

`scripts/render_report.py` shows the origin, puts `pre-existing` findings in their own section, and shows the rule changes and the stale state at the top. It reads 2.1 artifacts.

### Decision 4: Origin in structure-review is a mark, not a tier

A fix-list line becomes `path:line · <tier> · <origin> · <why>`. The tiers stay. The *Standing debt* section stays for a problem that an earlier report already raised.

The verdict rule gets one sentence: an item with origin `pre-existing` does not block by itself. The reviewer still raises the item, as line `:47` directs. A change that makes an old problem worse is `introduced` by the cause test.

Alternative: replace tiers with must-fix, should-fix, and nit. The skill rejects severity for structure findings, and the tiers hold more information.

### Decision 5: Which version of a rule the reviewer reads

The reviewer compares each rule source at the base tip and at the head: `git diff --name-only <base> HEAD -- <rule source paths>`. For each file that is different, it reads the base version with `git show <base>:<path>`. For a file that the change adds, there is no base version, so the file gives no permission.

The comparison uses the base tip, not the merge base. A change must satisfy the rules of the branch that it merges into, and those rules can be newer than the branch point.

When the reviewer runs the gate or the tests, the tools use the working tree configuration. The reviewer cannot run a tool with the base configuration in a simple way. The rule-change list tells the person that the configuration changed.

Alternative: check out the base in a worktree and run the tools there. This is slow, and the base tools cannot check the new code.

### Decision 6: The list of rule sources

- Project instruction files: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, and nested copies.
- Architecture documents: `docs/ARCHITECTURE.md`, `docs/adr/**`.
- The rule registry: `docs/rules.yaml`.
- Tool configuration: linter, formatter, and type-checker files and sections, import contracts, pre-commit configuration.
- The gate definition: the gate target of the `Makefile` and CI workflow files.

Each skill carries this list in its own text. `code-audit` does not read `docs/rules.yaml` today, so its list names only the sources that it already reads.

### Decision 7: OpenSpec artifacts of the change are intent

Files under `openspec/changes/<name>/` are not rule sources. Pass 1 of `structure-review` checks the code against them, and they are new in every change. The reviewer reads them from the working tree.

A design document does not override a repository rule. When the design of the change conflicts with a base rule, the reviewer reports the conflict.

### Decision 8: A rule edit is listed, not blocked

A rule edit is frequently correct. The reviewer lists it with one line on its effect and leaves the approval to a person. A deviation that only the edited rule permits is a normal finding, judged by the base rule. Its explanation names the rule edit.

`structure-review` puts the list in a *Rule changes* section before the *Declarations* table.

Alternative: `request_changes` for each rule edit. This blocks correct rule changes and makes the verdict less useful.

### Decision 9: The default base

The reviewer runs `git symbolic-ref --short refs/remotes/origin/HEAD` and removes the remote prefix. When the command fails, the base is `main`. A base from the user always wins. The output states the base.

### Decision 10: The stale check

At the start, the reviewer records three values: `git rev-parse HEAD`, a digest of `git diff HEAD`, and a digest of `git status --porcelain`. The digests exclude `.code-audit/` and `.structure-review/`, because the reviewers write there.

Before the write, the reviewer reads the three values again. A difference marks the output as stale. The reviewer writes the output with the mark and does not start again.

Alternative: start the review again automatically. While workers are active, the tree can change on each pass, and the review does not end. The orchestrator decides when to dispatch again.

### Decision 11: The verdict reason

`code-audit` writes `verdict_reason` in the artifact. `structure-review` writes the reason on the verdict line and names fix-list items by position. The reason is one sentence. It lets the person see why a review asks for a person, without the diff.

### Decision 12: The test for a new rule

The section "Fix the instance, then decide where the lesson goes" gets two conditions before a gate check or an instruction-file rule is proposed:

1. The problem occurred in a minimum of two changes. Evidence is an earlier report under `.structure-review/`, or a statement in the brief.
2. A reader can see the trigger in a diff.

The proposal has three parts: trigger, check, sources. "Nowhere" stays the default for a first occurrence. The reviewer is read-only on source, so a person writes the rule.

The article adds an adversarial step and human approval in a pull request. The human approval is kept. The adversarial step is not in scope.

### Decision 13: Authoring process

- The two skills load in the main session and in the reviewer agents. Models to read guides for: `claude-opus-5-5` (Claude reviewers), `gpt-5.6-sol` (Codex reviewers), `gemini-4-argon` (Cursor reviewers).
- Each skill edit uses `skill-creator` and plan mode. The user confirms the planned text before the write.
- Each skill states the shared rules in its own words. No skill refers to the other.

## Risks / Trade-offs

- [More findings in a diff-scoped audit] → The threshold in Decision 2 does not change. Old defects that are not load-bearing stay out.
- [A correct rule edit looks like a problem] → The list is information, not a finding. One line for each file.
- [The base cannot be read in a shallow clone or a repository with no remote] → The reviewer reads the working tree and says so in the output.
- [The stale check marks a review as stale because of an unrelated file] → The output directories are excluded. A different unrelated edit is a real change to the tree, and a second review is the safe result.
- [An author uses `pre-existing` to avoid a fix] → The cause test and the "use `introduced` when not clear" rule limit this. The finding stays in the report with its severity.
- [The two skills drift apart on the shared rules] → The spec holds the shared contract. A live check runs the two reviewers on the same fixture.
- [`dispatch-reviewer.md` is edited by two changes] → The sections are different. The second change to be applied reads the file again before it edits.

## Migration Plan

1. Apply the `code-audit` edits and the renderer change. Render one 2.1 artifact and one 2.2 artifact.
2. Apply the `structure-review` edits.
3. Apply the agent receipt edits and the `dispatch-reviewer.md` edit.
4. Marketplace users get the skill changes at their next plugin update. Agents install as symlinks.
5. Rollback: revert the commit. Artifacts with schema 2.2 stay readable, because the fields are additions.

## Open Questions

- An evaluation set for the two reviewers, built from real misses, is not designed here. It does not change this change.
