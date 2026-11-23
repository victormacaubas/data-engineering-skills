# Tasks

## 1. Preparation

- [x] 1.1 Read the current prompting guide for each model in design Decision 13 and list the points that apply to these edits; verify that the list is in the session before any file is written
- [x] 1.2 Load `skill-creator`, enter plan mode, and show the user the planned text for `skills/craft/code-audit/SKILL.md`; verify by the user's approval in the session
- [x] 1.3 In the same plan, show the user the planned text for `skills/craft/structure-review/SKILL.md`; verify by the user's approval in the session
- [x] 1.4 Make a scratch git repository as the review fixture: a base commit with one old defect in code that the change calls, and a branch that adds one new defect, breaks one declared rule, and adds an ADR that permits the break; verify that `git diff <base>...HEAD` shows the three items

## 2. code-audit skill

- [x] 2.1 In the scope table, replace "Don't flag unchanged code" for diff scope with the origin rule and the threshold from design Decisions 1 and 2; verify that the repeated statement in the hard rules agrees with the new text
- [x] 2.2 In the finding schema, add `origin`; in the top-level schema, add `rule_changes`, `stale`, `verdict_reason`, the resolved base, and the rules source; set the schema version to 2.2; verify that the schema example in `SKILL.md` contains each new field
- [x] 2.3 In the scoring section, state that scores and the verdict use `introduced` and `not-assessed` findings only, and add the count for each origin to `stats`; verify that the verdict rule names the origin condition
- [x] 2.4 In *Read the declared conventions*, add the base read from design Decision 5 with the rule sources that this skill reads, and the rule that an added source gives no permission; verify that the sentence about an ADR that records a deviation now has the base condition
- [x] 2.5 Replace the fixed default base with the default-branch resolution from design Decision 9; verify by `grep -n "main" skills/craft/code-audit/SKILL.md` that `main` appears only as the fallback
- [x] 2.6 In the artifact step, add the stale check from design Decision 10; verify that the step names the three recorded values and the excluded directories
- [x] 2.7 Update `scripts/render_report.py` to show the origin, a separate section for `pre-existing` findings, the rule changes, the stale state, and the verdict reason; verify by rendering one 2.1 sample artifact and one 2.2 sample artifact with `uv run python`, with no error and with the new sections in the second
- [x] 2.8 Read `skills/craft/README.md` and both catalog descriptions for `craft`; update them only if a statement about `code-audit` is now wrong; verify that both catalogs parse as JSON and are in parity

## 3. structure-review skill

- [x] 3.1 In *Debt the change didn't cause* and the fix-list template, add the origin mark from design Decision 4; verify that the template line has the four parts and that the leverage tiers are unchanged
- [x] 3.2 In the verdict rule, add that a `pre-existing` item does not block by itself, and add the verdict reason from design Decision 11; verify that the report template shows the reason on the verdict line
- [x] 3.3 In *Step 2*, add the base read from design Decision 5, the rule-source list from design Decision 6, and the OpenSpec exception from design Decision 7; add a *Rule changes* section to the report template; verify that the guardrail "Check for permission before flagging" has the base condition
- [x] 3.4 Replace the fixed default base with the default-branch resolution; verify by `grep -n "main" skills/craft/structure-review/SKILL.md` that `main` appears only as the fallback
- [x] 3.5 In *Step 5* and in *Re-review*, add the stale check and the stale line in the report header; verify that the re-review output also carries the mark
- [x] 3.6 In "Fix the instance, then decide where the lesson goes", add the two conditions and the three-part proposal from design Decision 12; verify that "Nowhere" is still the default for a first occurrence

## 4. Reviewer agents and the orchestrator reference

- [x] 4.1 In the three `code-auditor` variants, add the origin counts, the rule changes, the base, and the stale state to the receipt template; verify with a diff of the receipt templates across the three variants
- [x] 4.2 In the three `structure-reviewer` variants, add the same fields to the receipt template; verify with a diff of the receipt templates across the three variants
- [x] 4.3 Verify that the four Markdown variants have valid frontmatter, that the two TOML variants parse, and that no agent `description` names a different agent
- [x] 4.4 In `skills/flow/orchestrate/references/dispatch-reviewer.md`, add the rule that a stale review, or a review of a commit that is not the current commit, does not clear a block; verify that the text about pre-existing failures agrees with the origin rule

## 5. Live checks

- [x] 5.1 Run the Claude `code-auditor` on the fixture branch; verify one `introduced` finding, one `pre-existing` finding that does not change the verdict or the scores, the rule break reported with the ADR named, and the ADR in `rule_changes`
- [x] 5.2 Run the Claude `structure-reviewer` on the fixture branch; verify the origin mark on each fix-list item, the *Rule changes* section, and a verdict reason that names items
- [x] 5.3 Start a review on the fixture and make a commit before it ends; verify that the output is marked stale with the two commits, and that a review with no change is not marked stale
- [x] 5.4 Set the default branch of the fixture to a name other than `main` and give no base; verify that the output states that branch as the base
- [x] 5.5 Run `openspec validate review-origin-and-base-rules --strict`; verify that it reports no error
