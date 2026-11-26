# Proposal

## Why

No review in the build loop looks for defects. `flow:orchestrate` offers one closing review, and that review is `structure-reviewer`, which checks the shape of a change and its conformance to the project rules. `code-auditor` finds security, correctness, performance, and error-handling defects, but no step of the loop dispatches it. `craft:code-audit` also has no pass that builds on an earlier pass. Its "Compare against last review" option does the full review again and then reconciles the findings, so each round costs the same as the first.

The Anthropic article "How the Claude Code team thinks about verification" (2026-11-16) says that review rounds build on each other, and that a second reviewer for the same concern is a poor investment. This change gives the audit a place in the loop that agrees with the two statements.

## What Changes

- Add a signal test for a defect audit to *Closing the build* in `flow:orchestrate`. The signals are facts that the orchestrator already has: an `unverified` slice in a project where tests run, a scenario with no test, a slice at a trust boundary, new retry, concurrency, or cache logic, and a slice that needed more than one fix round.
- Replace the review question with one combined offer. One line names each review that has a signal. The user selects the structure review, the audit, both, or neither.
- Dispatch the selected reviewers together, for the same tree, after the close run has no failure. No audit runs for one slice.
- Limit the audit in the loop to four dimensions: security, correctness, performance, and error handling. `structure-review` owns the shape of the change.
- Let `code-audit` accept a focus of more than one dimension, and give a dimension that was not reviewed no score.
- Add a targeted re-review to `code-audit`. It reads the findings of the earlier artifact and the fix diff only, and it records a state and the evidence for each earlier finding.
- Send the blocking items of the two reviewers to the dispatch loop as one slice set.
- After a fix round, dispatch each selected reviewer again as a re-review.
- Count a review round for the change, not for each reviewer. The limit of three rounds stays.
- Add the dimension focus, the re-review mode, and the re-review results to the brief and the receipt of the three `code-auditor` variants.
- Add `code-auditor` to the documented agent prerequisites of `/flow:orchestrate`.

No change is **BREAKING**. The "Compare against last review" option stays. A build with no audit signal gets the same offer as before.

## Capabilities

### New Capabilities

- `closing-review`: how the `orchestrate` skill offers, dispatches, and closes the reviews at the end of a build: which reviews it offers, when they run, how two reviewers share one tree and one fix round, and when a block is cleared.
- `audit-rounds`: how a `code-audit` pass is limited to named dimensions, and how a later pass builds on an earlier artifact.

### Modified Capabilities

None.

## Impact

- Edited skill files: `skills/flow/orchestrate/SKILL.md` (*Closing the build*), `skills/flow/orchestrate/references/dispatch-reviewer.md`. New reference file: `skills/flow/orchestrate/references/dispatch-auditor.md`.
- Edited skill files: `skills/craft/code-audit/SKILL.md` (the dimension focus, a new *Re-review* section, the artifact schema, the handoff contract), `skills/craft/code-audit/scripts/render_report.py`.
- Edited agent files: `agents/claude/code-auditor.md`, `agents/codex/code-auditor.toml`, `agents/cursor/code-auditor.md` (input contract and receipt template).
- Edited docs: `AGENTS.md`, `skills/flow/README.md`, the `flow` description in `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`, and `agents/README.md` where a statement about `code-auditor` changes.
- New living specs at archive: `openspec/specs/closing-review/spec.md`, `openspec/specs/audit-rounds/spec.md`.
- The `code-audit` artifact schema gets additions: a `re_review` object, and a null score for a dimension that was not reviewed. A reader of an earlier artifact continues to work.
- A user of `/flow:orchestrate` must install the `code-auditor` agent.
- A build in which the user selects the two reviews uses two reviewer agents in each review round.
- No change to install scripts or mods. No change to `craft:structure-review`.
- Depends on `review-origin-and-base-rules`: the `pre-existing` origin, the stale check, the verdict reason, and the receipt fields. Without the origin, an old defect near the change blocks the loop.
- Depends on `build-loop-verification`: the close run, the `unverified` record, the scenario recorded as not covered, the round count for each slice, and the limit of three review rounds.
- This change must be applied after the two changes.
