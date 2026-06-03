# OpenSpec Specification Alignment

This reference is loaded only when the repo under review uses OpenSpec (`openspec/changes/` exists with non-archived entries). It adds a Specification Alignment check to the review workflow.

## How to check for active changes

```
openspec/changes/               ← run `ls` on top level only, do not recurse into archive/
openspec/changes/archive/       ← ignore this; archived changes are shipped
openspec/specs/                 ← canonical capability specs
```

Three cases:

1. **No `openspec/` directory, or only archived changes.** Skip this entirely. Do not mention OpenSpec in the report — it adds noise when it doesn't apply.
2. **`openspec/changes/` has non-archived entries but none touch your review scope.** Read each `proposal.md` headline to confirm they're unrelated. Note briefly in *Notes & limitations* that OpenSpec was checked and no active change overlaps. Do not generate a Specification Alignment section.
3. **An active change's scope overlaps the files you're reviewing** (touches the same module / adds-or-modifies-requirements for the same capability). Read that change's `proposal.md`, `design.md` (if present), `tasks.md`, and any file under its `specs/`. Hold those specs in your head as the reviewer's source of truth — they describe what the code *should* be doing right now. Then when reading the source, compare behavior against the spec.

## What counts as a contradiction

Two signals count as contradiction, not stylistic drift:

- The code contradicts a **SHALL / MUST** requirement in an active spec (e.g., spec says "freshness computation treats overdue jobs as stale", code marks overdue jobs as healthy).
- The code has already implemented a `- [x]` checked task from `tasks.md` in a way that diverges from the proposal's design, *and* the diff is the one that introduced the divergence.

Missing implementation of `- [ ]` (unchecked) tasks is **not** a contradiction — that work hasn't been done yet. Only flag it if the PR claims to complete the task but doesn't.

## Scoring interaction

A Specification Alignment contradiction **does not** enter the weighted score formula. Contract violations are surfaced as a top-of-report blocker instead of as a numeric penalty, because a PR can be technically clean and still violate the spec, and conversely a PR can be spec-aligned but quality-poor — they're independent signals.

Do not bury a spec contradiction inside SOLID or any other dimension — readers skim for the blocker section specifically.

## Report template section

Insert this section immediately after the header metadata and before `## Summary`. Include it **only** when an active OpenSpec change overlaps the review scope.

```markdown
## Specification Alignment

<Form A — clean. One line:>
✅ **Aligned.** Checked active OpenSpec changes (`<change-a>`, `<change-b>`); no contradictions found with the code under review.

<Form B — contradiction(s). Upgrade to a blocker block:>
🛑 **BLOCKER — code contradicts an active OpenSpec change.** Merge is not advised until the author either reconciles the code with the spec or amends the proposal.

- **[SPEC-01] <short title>**
  - **Active change:** `openspec/changes/<change-name>/`
  - **Spec reference:** `specs/<capability>/spec.md` → `<requirement heading or anchor>` (quote the SHALL/MUST line verbatim)
  - **Code location:** `path/to/file.py:42`
  - **What the spec says:** <the normative requirement, quoted>
  - **What the code does:** <the observed behavior, with enough detail to point at a specific branch or value>
  - **Resolution options:** (1) change the code to match the spec, or (2) amend the change proposal to reflect the new intent and re-align the tasks list.

<If there are multiple contradictions, list each as [SPEC-02], [SPEC-03], etc.>
```

## Suggested order of fixes

When spec contradictions exist, they go first in the "Suggested order of fixes" section — they block merge regardless of scores.

## Notes & limitations

If Step 0 found active OpenSpec changes that didn't overlap scope, mention it: "Active OpenSpec changes `<change-a>`, `<change-b>` were checked; neither touches the files in scope."

## User-requested spec checks

When the user asks **"Check if we're still aligned with the spec"** — run the OpenSpec check thoroughly. If there are active changes overlapping scope, produce the Specification Alignment section as the primary deliverable; the rubric can be shorter or note "quality axes not reviewed in this pass". If there are no active changes, tell the user plainly — don't manufacture a section.
