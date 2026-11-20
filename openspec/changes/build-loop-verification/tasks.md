# Tasks

## 1. Preparation

- [ ] 1.1 Read the current prompting guide for each model in design Decision 15 and list the points that apply to these edits; verify that the list is in the session before any file is written
- [ ] 1.2 Load `skill-creator`, enter plan mode, and show the user the planned text for `skills/flow/orchestrate/SKILL.md` and the three dispatch references; verify by the user's approval in the session
- [ ] 1.3 Show the user the planned text for the six agent files; verify by the user's approval in the session

## 2. Orchestrate: round limit and round context

- [ ] 2.1 In `SKILL.md` *Dispatch loop*, add the round count, the definition of a round from design Decision 2, and the rule that independent slices continue; verify that the section states the limit of three and that the count goes in the tracking artifact
- [ ] 2.2 In `SKILL.md`, change the sentence at "keep a disputed task open until its selector passes" to include the round limit, and add the limit to the stop list in *Keep the loop moving*; verify by `grep -n "until its selector passes" skills/flow/orchestrate/SKILL.md` that no sentence keeps the unlimited form
- [ ] 2.3 In `SKILL.md` *Guardrails*, add the five hand-back items from design Decision 4 to "Hand back on blocking questions"; verify that the five items are named
- [ ] 2.4 In `references/dispatch-implementer.md`, add an "Earlier rounds" slot to the brief block, the round suffix for the report path, and the count step in *After the worker returns*; verify that the brief block names the earlier report paths and the failing output
- [ ] 2.5 In `references/dispatch-test-author.md`, add the same round context to the dispute re-dispatch; verify that the re-dispatch payload names the earlier report and the failing output
- [ ] 2.6 In `references/dispatch-reviewer.md`, add the limit of three `request_changes` verdicts and the hand-back; verify that the section states what the orchestrator does after the third verdict

## 3. Orchestrate: unverified slices, close run, stamp, gate configuration

- [ ] 3.1 In `SKILL.md` *Pre-flight*, keep the dispatch without a test bar and add the `unverified` record; verify that the bullet says where the record goes and that the closing summary lists it
- [ ] 3.2 In `SKILL.md` *Closing the build*, add the close run from design Decision 7, including the declared gate, the question for a found gate, the command-verified scenarios, the project `verify` skill, and the case with no gate; verify that the section says that a found gate does not run without approval, that the question occurs one time for each build, and that it gives the condition and the sequence for the verify flow, the `not run` record, and what a failure does; add to the closing summary the line with the state of the verification trailers and the reason, from design Decision 8, and verify that the text names the four reasons
- [ ] 3.3 In `SKILL.md` *Guardrails*, add the opt-in verification trailers to the git bullet with the two conditions and the format from design Decision 8, the `Unverified:` trailer, the re-run rule for a changed tree, and the rule that the value names `verify` only when the verify flow passed at close; verify that the bullet says that the project line is in the definition of done of the project instructions, that a statement there can turn the trailers off, that a commit has no trailer when neither condition is true, and that it still says the orchestrator commits only on request
- [ ] 3.4 In `references/dispatch-implementer.md` *After the worker returns*, add the gate-configuration diff check and the ruling from design Decision 10; verify that the step lists the paths and the two rulings
- [ ] 3.5 In `references/dispatch-test-author.md`, add the four differential slots to the brief block, the pre-flight check for a missing oracle, and the ruling for a `flaky` dispute; verify that each slot is named and that a deleted test is recorded as not covered
- [ ] 3.6 Read `skills/flow/README.md` and both catalog descriptions for `flow`; update them only if a statement about `orchestrate` is now wrong; verify that both catalogs still parse as JSON and are in parity

## 4. Implementer variants

- [ ] 4.1 In `agents/claude/implementer.md`, add the limit of three attempts and the attempt list to step 5 and to the report template; verify that the template has a place for each attempt and its result
- [ ] 4.2 In `agents/claude/implementer.md`, add the gate-configuration rule to *Test code* or its neighbour section and a report field for a needed configuration change; verify that the rule names the exception for a task that requests the change
- [ ] 4.3 In `agents/claude/implementer.md`, add the reason `flaky` to the *Disputed tests* template with the two outputs, and the rule against repeated runs; verify that one confirming run is permitted and more are not
- [ ] 4.4 Copy the real-check rule and the edits from 4.1 to 4.3 to `agents/codex/implementer.toml` and `agents/cursor/implementer.md`; verify with a diff of step 5, *Disputed tests*, and the report template across the three variants that only command names differ
- [ ] 4.5 Verify that the two Markdown variants have valid frontmatter and that the TOML variant parses; update the `implementer` row in `agents/README.md` if an intentional difference changed

## 5. Test-author variants

- [ ] 5.1 In `agents/claude/test-author.md` *Test rules*, add the property-based test rule from design Decision 11; verify that the rule names the four kinds of law, the declared-library condition, the fixed seed, and the rule against a new dependency
- [ ] 5.2 In `agents/claude/test-author.md`, add the differential test rule and the oracle exception to the anti-tautology rule, and add the four slots to *Input contract*; verify that a scenario with no named oracle goes to `blocked`
- [ ] 5.3 In `agents/claude/test-author.md`, add the flaky-test rule and the limit of three attempts; verify that the report template has a place for a deleted test, its reason, and the scenario with no test
- [ ] 5.4 Copy the edits from 5.1 to 5.3 to `agents/codex/test-author.toml` and `agents/cursor/test-author.md`; verify with a diff of *Test rules*, *Input contract*, and the report template across the three variants
- [ ] 5.5 Verify that the two Markdown variants have valid frontmatter and that the TOML variant parses; update the `test-author` row in `agents/README.md` if an intentional difference changed

## 6. Live checks

- [ ] 6.1 In a scratch git repository with a selector that cannot pass, run `/flow:orchestrate`; verify that the orchestrator stops after the third round, that three report files exist for the slice, and that the hand-back contains the five items
- [ ] 6.2 Dispatch the Claude `test-author` with a round-trip scenario in a project that declares Hypothesis, then in a project that does not; verify one property-based test with a fixed seed in the first case, and an example-based test with a reported missing library in the second
- [ ] 6.3 Dispatch the Claude `test-author` with a differential scenario with a named oracle and one approved difference, then with no oracle; verify a comparing test and a data file with the reason in the first case, and `blocked` in the second
- [ ] 6.4 Dispatch the Claude `implementer` on a slice with a test that depends on test order; verify that the receipt lists the test as `flaky` with two outputs, and that `test-author` then fixes the cause or deletes the test with a recorded reason
- [ ] 6.5 Dispatch the Claude `implementer` on a slice where a lint rule fails and the task names no configuration change; verify that the lint configuration is unchanged and that the report names the rule
- [ ] 6.6 In the scratch repository, add a line to `AGENTS.md` that says that commits carry the `Verified:` trailer, close a build, and ask for a commit; verify that `git log --format='%(trailers:key=Verified,valueonly)' -1` shows the gate command, shows `none` for a build recorded as unverified, and that a build with a gate that passed and one `unverified` slice also has an `Unverified:` trailer with the name of the slice; then remove the line and verify that a commit has no verification trailer, that the closing summary states the checks, and that it says that the trailers are not enabled and that no source names them
- [ ] 6.7 In the scratch repository, add `.claude/skills/verify/SKILL.md` with one flow and close a build three times: with a flow that passes, with a flow that fails its pass condition, and with the file removed; verify that the closing summary states the verify command and the trailer names `verify` in the first case, that a slice opens and the build is not reported as finished in the second, and that the close run has the gate only in the third
- [ ] 6.8 In a scratch repository with a `Makefile` that has a `test` target and with no gate in the project instructions, close a build; verify that the orchestrator names `make test` in one question and does not run it before the answer, that it runs none of the found commands when the answer is no, and that it does not ask again in the same build; then name the command in `AGENTS.md` as the definition of done and verify that the next build runs it with no question
- [ ] 6.9 Run `openspec validate build-loop-verification --strict`; verify that it reports no error
