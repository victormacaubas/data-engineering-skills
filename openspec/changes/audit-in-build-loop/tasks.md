# Tasks

## 1. Preparation

- [x] 1.1 Confirm that `build-loop-verification` and `review-origin-and-base-rules` are applied; verify by `grep -n "unverified" skills/flow/orchestrate/SKILL.md` and `grep -n "pre-existing" skills/craft/code-audit/SKILL.md` that each gives a result, and stop and tell the user if one gives none
- [x] 1.2 Read the current prompting guide for each model in design Decision 16 and list the points that apply to these edits; verify that the list is in the session before any file is written
- [x] 1.3 Load `skill-creator`, enter plan mode, and show the user the planned text for `skills/craft/code-audit/SKILL.md`; verify by the user's approval in the session
- [x] 1.4 In the same plan, show the user the planned text for `skills/flow/orchestrate/SKILL.md`, `references/dispatch-reviewer.md`, and the new `references/dispatch-auditor.md`; verify by the user's approval in the session
- [x] 1.5 Make a scratch git repository as the audit fixture: a branch with one correctness defect and one error-handling defect that each have a test seam, and one module with a clear shape problem and no defect; verify that `git diff <base>...HEAD` shows the three items

## 2. code-audit skill: dimension focus and re-review

- [x] 2.1 In *When the user wants something slightly different*, change the focus option to one or more dimensions with the score rule from design Decision 5; in the scoring section, add the overall formula for a focus; verify that the text says that a dimension that was not reviewed has `score: null` and that the formula line shows the divisor
- [x] 2.2 Add the *Re-review* section with the scope and the method from design Decision 6; verify that the section says not to do the full review again, names the two inputs, and keeps the focus of the earlier artifact
- [x] 2.3 In the *Re-review* section, add the five states and the evidence rule from design Decision 7; verify that the text names each state, says when the verification command runs and when it does not, and says that a worker report is not evidence
- [x] 2.4 In the artifact schema, add `re_review` and the `null` score, and set the schema version to 2.3; add the rules for carried and new findings from design Decision 8; verify that the schema example contains `re_review` and that the text says that the earlier artifact is not edited
- [x] 2.5 In the "Compare against last review" option and in the handoff contract, say when a comparison applies and when a re-review applies, as design Decision 9 states; verify that the comparison option still describes a full review with a note
- [x] 2.6 Update `scripts/render_report.py` to show a dimension with no score as not reviewed and to show the re-review results in a section before the findings; verify by rendering one 2.1 artifact, one 2.2 artifact, and one re-review artifact with `uv run python`, with no error and with the new section in the third
- [x] 2.7 Read `skills/craft/README.md` and both catalog descriptions for `craft`; update them only if a statement about `code-audit` is now wrong; verify that both catalogs parse as JSON and are in parity

## 3. code-auditor variants

- [x] 3.1 In `agents/claude/code-auditor.md`, change the input contract to accept a focus of one or more dimensions and the path of an earlier artifact, and add the mode `re-review`, the dimensions reviewed, and the count for each state to the receipt template; verify that the sentence that lists the six dimensions as the subject agrees with a focus
- [x] 3.2 Copy the edits from 3.1 to `agents/codex/code-auditor.toml` and `agents/cursor/code-auditor.md`; verify with a diff of the input contract and the receipt template across the three variants that only platform wording differs, apart from the differences that were there before this change (the `Assumptions` heading and its body in the receipt), which stay out of scope
- [x] 3.3 Verify that the two Markdown variants have valid frontmatter, that the TOML variant parses, and that no `description` names a different agent; update the `code-auditor` row in `agents/README.md` if a statement about the agent is now wrong
- [ ] 3.4 Run the Claude `code-auditor` on the fixture branch with the focus of four dimensions; verify that the artifact has no architecture or readability finding, that those two dimensions have `score: null`, that the formula line has the divisor 6.5, and that the receipt names the four dimensions
- [ ] 3.5 Fix one of the two defects in the fixture and run the Claude `code-auditor` as a re-review with the path of the first artifact; verify one `fixed` result with its evidence and one `not-fixed` result, a new artifact with the open finding under its earlier identifier, the first artifact unchanged by `git diff --no-index` against a copy, and the receipt with mode `re-review` and the count for each state

## 4. orchestrate: signals, offer, and the two reviews

- [x] 4.1 In `SKILL.md` *Closing the build*, add the five audit signals from design Decision 1 next to the structure signals; verify that each signal names where the orchestrator gets the fact, that the `unverified` signal has the condition of a working test environment, and that the rule against a new read of the tree stays
- [x] 4.2 In `SKILL.md` *Making the offer*, replace the question about the shape with the combined offer from design Decision 2; verify that the text has the cases for two reviews, one review, and no review, and that "Ask once in one line" is unchanged
- [x] 4.3 In `SKILL.md` *Closing the build*, add the order from design Decision 3: the close run, the offer, the selected reviewers in one step, and no worker during a review round; verify that the text says that `code-auditor` is not dispatched for one slice
- [x] 4.4 Write `references/dispatch-auditor.md` with the brief from design Decision 10, the handling of an audit return from design Decision 11, and the re-review brief; verify that the brief block names the four dimensions, the changed paths, the base, the `unverified` slices, the scenarios with no test, and the earlier artifact path for a re-review, and that it has the rule against suspicions
- [x] 4.5 In `references/dispatch-reviewer.md`, add one section for the rules that the two reviews share: the wait for each reviewer, the one slice set, the re-review of each selected reviewer after a fix round, the round count, and the stale rule, from design Decisions 11 to 14; verify that "Only a re-review clears the block" now covers the two reviewers
- [x] 4.6 In `SKILL.md`, update the pointer at the end of *Making the offer* so that it names the two reference files and the reviewer that each is for; verify by `grep -n "dispatch-auditor" skills/flow/orchestrate/SKILL.md` that the file is named
- [x] 4.7 Add `code-auditor` to the dependency list in `AGENTS.md`, to the `orchestrate` row and the onboarding text of `skills/flow/README.md`, and to the `flow` description in each catalog; verify that both catalogs parse as JSON, that the skill-group entries are in parity, and by `grep -rn "structure-reviewer" AGENTS.md skills/flow/README.md .claude-plugin/marketplace.json .cursor-plugin/marketplace.json` that each line that lists the agents of `orchestrate` also names `code-auditor`

## 5. Live checks

- [ ] 5.1 In a scratch repository with a working test environment, close a build of one slice that is recorded as `unverified`, then a build of three slices that adds a module and has one `unverified` slice, then a build of one verified slice; verify that the first question names the audit only, that the second names the two reviews with their signals in one line, and that the third build gets no question; then, in a scratch repository with no test environment, close a build of one slice that was dispatched without a test bar and verify that it gets no audit offer
- [ ] 5.2 In the second build of 5.1, answer "both"; verify that the two reviewers are dispatched in one step, that the two receipts state the same commit, and that the audit brief names the four dimensions and no suspected defect
- [ ] 5.3 With one `request_changes` from the audit and an approval from the structure review, verify that the orchestrator makes one slice set from the blocking findings, lists the findings that do not block in the closing summary, runs the close run again after the fix slices, and then dispatches the two reviewers again
- [ ] 5.4 In the re-review round of 5.3, verify that the Claude `structure-reviewer` with an empty fix list reviews the fix diff only, and that the states in its report and in the audit artifact use the same five names
- [ ] 5.5 Make a commit while an audit runs; verify that the orchestrator does not clear the block on the stale result, dispatches the audit again, and does not increase the round count
- [ ] 5.6 Run `openspec validate audit-in-build-loop --strict`; verify that it reports no error
