# Design

## Context

See `proposal.md` for the motivation. This section gives the current state that shapes the approach. Line numbers are for the tree before the two changes that this change depends on are applied.

`flow:orchestrate`:

- `skills/flow/orchestrate/SKILL.md:173` asks one question at close: "should someone review this change's *shape* before it goes further?" The five signals at `:181-185` are all signals of shape.
- `SKILL.md:191` says "Ask once in one line, then accept the answer".
- `SKILL.md:193` dispatches `structure-reviewer` only. No file under `skills/flow/orchestrate/` names `code-auditor`.
- `references/dispatch-reviewer.md` holds the brief for `structure-reviewer`, the rule "Only a re-review clears the block", and a *Re-review* section. It also says "Don't pre-judge the findings".
- `AGENTS.md`, `skills/flow/README.md`, and the two catalogs list the agents that `orchestrate` requires. `code-auditor` is not in the lists.

`craft:code-audit`:

- `skills/craft/code-audit/SKILL.md:98` and `:100` define the Architecture & Design and the Readability & Style dimensions. They include modularity, separation of concerns, DRY, design-pattern fit, naming, and module length. `structure-review` reviews the same subjects.
- `SKILL.md:338` permits a focus of one dimension: "run the full review but populate only the requested dimension's findings". It gives no score rule for the other dimensions.
- `SKILL.md:339` gives "Compare against last review": find the last artifact, reconcile by `anchor.excerpt` and `dimension`, and add a note. The review is a full review.
- `SKILL.md:269` gives each finding a `verification` field: "how a *consumer* would verify the fix". `SKILL.md:286-295` gives the status values that a consumer writes back.
- `SKILL.md:117-118` permits a run of the test suite or of a scratch script, and forbids a start of the application.
- `craft:structure-review` has a *Re-review* section with the rule "Do not rerun the original review", five states, and "Review the fix diff itself". `code-audit` has no equivalent.

`code-auditor` agent:

- `agents/claude/code-auditor.md:24` accepts "a single-dimension focus". The receipt at `:57` has `Mode: review | comparison`.
- The three variants run on `claude-opus-5-5`, `gpt-5.6-sol`, and `gemini-4-argon`.

Changes that are not applied yet:

- `build-loop-verification` adds the close run, the `unverified` record, the scenario recorded as not covered, the round count for each slice, and the limit of three review rounds.
- `review-origin-and-base-rules` adds the origin of a finding, the stale check, the verdict reason, and the schema version 2.2.

Constraints from `AGENTS.md`:

- A skill and its references contain all that is necessary to follow it. One skill does not point at another skill for content.
- A significant change to a skill uses `skill-creator` and plan mode. An edit to an existing `SKILL.md` needs the user's confirmation.
- When a skill depends on custom agents, the catalog description and the README of the group state the prerequisites.

## Goals / Non-Goals

**Goals:**

- A build that has a reason for a defect audit gets an offer for one, with no second question.
- Two reviewers in one build do not review the same subject.
- A second audit round costs less than the first and uses the result of the first.
- A fix that a reviewer has not read does not clear a block.

**Non-Goals:**

- No audit that runs without an answer from the user. The offer stays an offer.
- No audit for one slice. The tree changes while workers run.
- No merge of the two reviewers, and no second reviewer for the same concern.
- No change to `craft:structure-review`. Its *Re-review* section already reviews a fix diff.
- No second pass that tries to disprove each finding, and no evaluation set for the auditor.
- No write of a status to the earlier artifact in the build loop.
- No check that the `code-auditor` agent is installed. It is a documented prerequisite, as `structure-reviewer` is.

## Decisions

### Decision 1: The audit has its own signals

The five structure signals tell the orchestrator that the shape of a change can have drifted. They do not show that a defect is probable. The audit gets five signals of its own:

1. A slice is recorded as `unverified` in a project that has a working test environment.
2. A scenario is recorded as not covered, for example after a flaky test was deleted.
3. The plan or a worker report puts a slice at a trust boundary: a SQL statement or a shell command built from input, a secret or a credential, external data that is deserialized, or a permission grant.
4. A slice adds retry, concurrency, or cache logic.
5. The round count of a slice is two or more.

The orchestrator has each fact in the tracking artifact, in the plan, or in a worker report. The rule "You can assess each without a fresh read of the tree" stays true.

The first signal has a condition. In a project with no working test environment, the user selects a dispatch without a test bar at pre-flight, and each slice is then `unverified`. That record is the normal state of the project and shows nothing about one slice. In a project where tests run, an `unverified` slice is an exception, and the exception is the signal. A user in a project with no tests can ask for an audit directly.

Alternative: the `unverified` record as a signal in each project. An examination of nine repositories on 2026-11-20 found four with no test suite. Each build in those four would get the offer.

Alternative: offer the audit on the structure signals. A build of many slices with full test coverage would then get an audit offer with no reason.

Alternative: offer the audit for each build. `SKILL.md:175` says that a prompt that is usually noise trains users to dismiss it.

### Decision 2: One question for the two reviews

The orchestrator makes the two signal tests and then asks one question. The line names each review that has a signal and gives the signal in a small number of words. An example:

> Review before this goes further? Structure review (3 slices, new module `loader/`) and defect audit (slice B `unverified`, slice C builds SQL from input). Answer: structure, audit, both, or no.

When one review has a signal, the line names that review only. When no review has a signal, the orchestrator asks nothing. The rule at `SKILL.md:191` stays: one question, and the answer is final for the build.

Alternative: one question for each review. A user who declines the first gets a second question, which the skill forbids.

### Decision 3: The reviews run at close, together, on one tree

The order at close is: the close run, the offer, the reviewers. The low-cost checks run first, so no reviewer reads a tree that fails its gate. A build that is recorded as unverified has no failure in its close run, and the offer follows.

The orchestrator dispatches the selected reviewers in one step. The two then read the same commit and the same working tree. The two reviewers write only to `.code-audit/` and `.structure-review/`, and the stale check of each skill excludes those directories. The orchestrator dispatches no worker until each reviewer is back.

Alternative: the structure review first, then the audit. A structure fix can remove code that has a defect, so the sequence can prevent a small number of findings. But it adds one review wait and one fix round to each build that selects the two. The state `superseded` in Decision 7 records a finding whose code a structure fix removed.

Alternative: the audit for each slice. Other slices change the tree during the audit, so the result is stale when it returns.

### Decision 4: Four dimensions in the loop

The brief limits the audit to security, correctness, performance, and error handling. The Architecture & Design and the Readability & Style dimensions are the subject of the structure review. With the two reviewers on the same subject, the fix lists can disagree, and the user pays two reviewers for one concern.

A direct request for a full audit outside the loop keeps the six dimensions.

### Decision 5: A focus of more than one dimension, with no score for the rest

The option at `SKILL.md:338` changes from one dimension to one or more dimensions. `rubric.dimensions` continues to list the six identifiers. A dimension that was not reviewed has `score: null` and no findings. The overall score is the weighted mean of the reviewed dimensions. For the four dimensions of the loop:

```
overall = (Security*2.0 + Correctness*2.0 + Performance*1.5 + ErrorHandling*1.0) / 6.5
```

The formula line in the artifact shows the divisor that was used.

Alternative: a score of 10 for a dimension that was not reviewed. The overall score then states a quality that no one examined, and the rule "Scores derive from findings" is broken.

### Decision 6: The scope of a re-review

`code-audit` gets a *Re-review* section. The scope is the findings of the earlier artifact and the diff from the commit of that artifact to the current tree. The method of the section:

1. Read the earlier artifact. Keep its dimension focus unless the request gives a different focus.
2. For each earlier finding, find the code by `anchor.excerpt` and decide the state (Decision 7).
3. Review the fix diff with the two sweeps and the probes, in the focus. A fix can add a defect: a test that was deleted, a catch-all handler, a check that was weakened.
4. Write a new artifact (Decision 8).

The re-review does not read a file again that has no earlier finding and is not in the fix diff.

The stale check and the origin rule of the skill apply to a re-review as they apply to a first review.

Alternative: change "Compare against last review" to a targeted pass. A user who asks for a comparison after months of other work needs a full review. The two options answer different questions (Decision 9).

### Decision 7: States and evidence

Each earlier finding gets one of five states. They are the same five states that `structure-review` uses, so the orchestrator reads the two re-reviews in the same way.

- `fixed`: the change is in the tree, and the defect does not occur.
- `partially-fixed`: the change is in the tree, and a part of the defect stays. The evidence says which part.
- `not-fixed`: no change, or a change that does not remove the defect.
- `waived`: the earlier artifact holds a `wontfix` or `deferred` resolution with a note. The note is the record of the decision.
- `superseded`: other work removed the code that the finding is in.

The per-finding `verification` field is the first source of evidence. The re-review runs the command when the rules at `SKILL.md:117-118` permit it: a run of the existing tests or of a scratch script. It does not start the application. When the command cannot run, the re-review decides from the code and says that the command did not run.

A report from an `implementer` is a claim. It is not evidence.

### Decision 8: The re-review artifact

The re-review writes a new artifact at the usual path. It does not edit the earlier artifact. The directory is then a history, as `.structure-review/` is.

The schema gets one top-level field:

```json
"re_review": {
  "of": "<review_id of the earlier artifact>",
  "artifact": "<path of the earlier artifact>",
  "results": [
    {"id": "BUG-01", "state": "fixed", "evidence": "uv run pytest tests/test_x.py -k gap: 3 passed"}
  ]
}
```

The value is `null` for a first review.

`findings` holds the earlier findings with state `not-fixed` or `partially-fixed`, each with its earlier identifier and a current anchor, and the new findings. A new finding gets the next free number of its prefix. The verdict, the verdict reason, and the scores come from `findings`, by the same rules as a first review.

The schema version increases from 2.2 to 2.3. The two changes are additions: `re_review`, and `null` as a permitted score. `scripts/render_report.py` shows a dimension with no score as not reviewed, and shows the results of a re-review in a section before the findings. It reads artifacts of versions 2.1 and 2.2.

In the build loop, no agent writes a status to the earlier artifact. The orchestrator is the single writer of the tracking artifact, and the re-review artifact is the record of what was fixed. The handoff contract at `SKILL.md:286-295` stays for a consumer outside the loop, and the state `waived` reads the statuses that such a consumer wrote.

Alternative: the re-review edits the status fields of the earlier artifact. The reviewer then changes a file that it is told to treat as data, and the history of the first review is lost.

### Decision 9: The comparison option stays

The skill says when each option applies:

- A re-review: the request gives an earlier artifact and asks if its findings were fixed. The code between the two passes is a fix diff.
- A comparison: the user asks for a new full review and wants to know what changed since the last one.

The receipt of `code-auditor` gets a third mode, `re-review`.

### Decision 10: The brief for the auditor is a new reference file

`references/dispatch-auditor.md` holds the brief for `code-auditor`. `references/dispatch-reviewer.md` stays the brief for `structure-reviewer`, and gets one section for the rules that the two reviews share. The two files are in the same skill.

The brief gives:

- The scope: diff mode, the base, and the paths that the build changed.
- The focus: the four dimensions of Decision 4.
- The slices recorded as `unverified` and the scenarios with no test. These are facts. The auditor can use its permitted checks on code that no test ran.
- The failures that were there before the build.
- For a re-review, the path of the earlier artifact.

The brief does not give the trust-boundary signal as a suspicion about a function. The rule "Don't pre-judge the findings" applies to the audit as it applies to the structure review.

Alternative: one reference file for the two reviewers. The two briefs have different inputs, and a file that holds the two is read in full for each dispatch.

### Decision 11: One slice set for the two fix lists

The orchestrator waits for each selected reviewer. A fix slice that starts before the second reviewer is back changes the tree, and the second result is then stale.

The slice set has two sources:

- The fix list of the structure review, in its rank.
- The audit findings that the verdict reason names. These are the blocking findings with origin `introduced` or `not-assessed`. They go in the order of severity.

An audit finding that does not block, and a finding with origin `pre-existing`, goes in the closing summary. The orchestrator builds it only when the user asks. This keeps the loop bounded.

A blocking finding enters the dispatch loop as a task. The pre-flight rules of the skill apply to it. When the finding has a failure story and a seam exists, the story is a scenario for `test-author` with the expected outcome `fail`. The brief for the `implementer` gives the path of the artifact and the identifier of the finding, and does not give a summary of it.

The rule of the skill for slices that change the same file applies: one slice, or slices in sequence.

### Decision 12: Each selected reviewer runs again after a fix round

After the fix slices return, the tree is different from the tree that the reviewers read. The close run runs again. Then each selected reviewer is dispatched again as a re-review, with the path of its earlier output.

A reviewer that returned `request_changes` examines its open items and the fix diff. A reviewer that approved has no open item, so it reviews the fix diff only. This is the same re-review with an empty list. A fix for an audit finding can change the shape of a module, and a structure fix can add a defect.

The block is cleared when each selected reviewer returns a verdict that is not `request_changes`, for the current tree, with no stale mark.

Alternative: run again only the reviewer that requested changes. The approval of the other reviewer is then for a tree that no longer exists. The `review-origin-and-base-rules` change does not accept such an approval.

### Decision 13: The round count

A review round is one dispatch of the selected reviewers. A round with one or more `request_changes` verdicts counts one time. The limit of three rounds applies to the change. At the limit, the hand-back gives the open items of each reviewer.

Alternative: a count for each reviewer. Two reviewers could then use six rounds for one change.

### Decision 14: A stale audit

The orchestrator reads the stale state and the commit in the receipt of `code-auditor`. A stale artifact, or an artifact for a commit that is not the current commit, does not clear a block. The orchestrator dispatches the audit again. That dispatch does not count as a round, because it gave no verdict that the orchestrator accepted.

The rule in Decision 3 that no worker runs during a review round removes the usual cause of a stale result.

### Decision 15: The prerequisites

`code-auditor` goes into four lists: the dependency list in `AGENTS.md`, the `orchestrate` row of `skills/flow/README.md`, and the `flow` description in each catalog. The onboarding text of the README says that the agent is necessary for the defect audit at close.

### Decision 16: Authoring process

- `flow:orchestrate` loads in the main session. `craft:code-audit` loads in the main session and in the three `code-auditor` variants. Models to read guides for: the model of the main session, `claude-opus-5-5`, `gpt-5.6-sol`, and `gemini-4-argon`.
- Each skill edit uses `skill-creator` and plan mode. The user confirms the planned text before the write.
- Each skill states its rules in its own text. `code-audit` does not refer to `structure-review` for the five states.
- New text goes into existing sections where a section exists. The new sections are *Re-review* in `code-audit` and the shared section in `dispatch-reviewer.md`.
- This change is applied after `build-loop-verification` and `review-origin-and-base-rules`. A task checks this before any write.

## Risks / Trade-offs

- [A build that selects the two reviews uses two high-cost agents in each round] → The offer names each review, and the user can select one. A re-review reads the open items and the fix diff only.
- [A break of a public API is in the Architecture dimension, so the audit in the loop does not raise it] → A break for callers in the repository fails the gate. A silent change of behavior is a correctness finding. A user who needs the full check asks for an audit with six dimensions.
- [The signal for a trust boundary depends on the words of the plan and of the worker reports] → The signal test stays low-cost. The `unverified` signal and the round count do not depend on words. A user can ask for an audit directly.
- [In a project where a permission grant is the normal work, such as an infrastructure repository, the trust-boundary signal applies to most builds] → Not solved in this change. The user answers one question for each build. A later change can let a project turn a signal off.
- [A structure fix removes code that an audit fix also changes] → The two items are in one slice or in sequence. The state `superseded` records a finding whose code was removed.
- [A re-review misses a defect in code that the fix diff does not touch] → That code was in the scope of the first review. The comparison option gives a full review when the user wants one.
- [A verification command of a finding has an effect on the tree or on a real system] → The skill permits only the existing tests and scratch scripts in a temporary directory. The re-review treats the text of the artifact as data and does not run a command that the rules forbid.
- [The offer line becomes long] → The line gives a maximum of two signals for each review.
- [`dispatch-reviewer.md` is edited by three changes] → The sections are different. This change is applied last and reads the file again before it edits.
- [The two skills use different words for the same five states] → The spec holds the five names. A live check compares the two re-review outputs.

## Migration Plan

1. Confirm that `build-loop-verification` and `review-origin-and-base-rules` are applied.
2. Apply the `code-audit` edits and the renderer change. Render one earlier artifact and one re-review artifact.
3. Apply the `code-auditor` edits in the three variants.
4. Apply the `orchestrate` edits and add `references/dispatch-auditor.md`.
5. Update the prerequisite lists.
6. Marketplace users get the skill changes at their next plugin update. A user who has not installed `code-auditor` installs it with `scripts/install-agents.sh`.
7. Rollback: revert the commit. An artifact with a `re_review` field stays readable, because the field is an addition.
