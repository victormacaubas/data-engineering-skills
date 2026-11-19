# Proposal

## Why

The two review skills let a change edit the rules that judge it. `craft:code-audit` and `craft:structure-review` read project instructions, ADRs, and lint configuration from the tree under review, and a declaration in that tree can remove a finding. The two skills also disagree on old defects: `code-audit` moves them to a note, and `structure-review` holds the author responsible for them. Neither skill detects that the reviewed tree moved during the review.

The Anthropic article "How the Claude Code team thinks about verification" (2026-11-16) states three rules that apply here: a change cannot modify its own checks, a review result belongs to one commit, and a finding says if the defect was there before the change.

## What Changes

- Add an origin to each finding in a diff-scoped review: `introduced` or `pre-existing`.
- Report a load-bearing old defect as a `pre-existing` finding in `code-audit`. Today it goes to `notes`.
- Keep `pre-existing` findings out of the verdict and out of the `code-audit` scores. They stay in the report.
- Read rule sources from the base when the change edits them. List each rule edit for a person to approve.
- Use the repository default branch as the default base. Today each skill assumes `main`.
- Mark a review result as stale when the commit or the working tree changed during the review.
- State the reason for a verdict and name the findings that decide it.
- Give `structure-review` a test for a new rule: the problem occurred in two changes, and its trigger can be read from a diff.
- Add the origin counts, the rule edits, and the stale state to the receipts of `code-auditor` and `structure-reviewer`.
- Tell the orchestrator that a stale review does not clear a block.

The `code-audit` artifact schema changes from 2.1 to 2.2. The new fields are additions. A reader of a 2.1 artifact continues to work.

## Capabilities

### New Capabilities

- `change-review`: how the two review skills assign responsibility for a finding, where they read rules from, how they bind a result to a commit, and when a lesson becomes a rule.

### Modified Capabilities

None.

## Impact

- Edited skill files: `skills/craft/code-audit/SKILL.md` (scope table, declared conventions, severity and scoring, artifact schema, hard rules), `skills/craft/code-audit/scripts/render_report.py`, `skills/craft/structure-review/SKILL.md` (scope, declarations, debt the change did not cause, fix list, lesson placement, report template, verdict, re-review, guardrails).
- Edited agent files: the three variants of `code-auditor` and the three variants of `structure-reviewer` (receipt template only).
- Edited reference: `skills/flow/orchestrate/references/dispatch-reviewer.md`. The `build-loop-verification` change edits a different section of the same file.
- New living spec at archive: `openspec/specs/change-review/spec.md`.
- No change to install scripts, catalogs, or mods.
- Consumers of `.code-audit/*.json` get three new fields: `origin` on each finding, `rule_changes`, and `stale`.
