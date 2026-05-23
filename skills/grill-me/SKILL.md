---
name: grill-me
description: Pressure-test a raw idea, drafted implementation plan, or active OpenSpec change before work begins. Use when the user asks to be grilled, challenged, stress-tested, or questioned about an idea, plan, proposal, design, spec delta, or OpenSpec change; sharpen value, scope, terminology, trade-offs, requirements, scenarios, and tasks one question at a time, updating OpenSpec artifacts only when an active change exists and the user confirms the decision.
---

# Grill Me

Pressure-test plans before implementation by challenging unclear terms, weak trade-offs, missing scenarios, and mismatches between the plan, OpenSpec artifacts, and code.

## Start

Determine the mode before asking design questions:

1. **Active OpenSpec change mode**: Use when the user names an OpenSpec change, the conversation clearly identifies one, or exactly one active change exists.
2. **Plan conversation mode**: Use when the user has a plan or has just finished a planning session, but there is no active OpenSpec change to update.
3. **Idea mode**: Use when the user has a raw idea, early concept, or one-sentence change request and wants it challenged before turning it into a plan or OpenSpec change.

If multiple active changes exist and the user did not name one, ask which change to grill. If no active change exists, do not create one from this skill; choose plan conversation mode or idea mode based on how formed the input is, and suggest `openspec-propose` only when the user wants files created.

Before updating artifacts, read [artifact-routing.md](references/artifact-routing.md).

## Active OpenSpec Change Mode

1. Select the change.
   - Prefer an explicitly named change.
   - Infer from conversation only when the reference is unambiguous.
   - Auto-select only when there is exactly one active non-archived change.
   - Never select archived changes unless the user explicitly asks to review history.

2. Load context.
   - Run `openspec status --change "<name>" --json` when available to understand the schema and artifact state.
   - Read the change artifacts that exist: `proposal.md`, `design.md`, `tasks.md`, and `specs/**/spec.md`.
   - Read canonical specs under `openspec/specs/**` for affected capabilities.
   - Inspect code instead of asking when the question can be answered from the repository.

3. Grill one unresolved branch at a time.
   - Ask exactly one question per turn.
   - Provide a recommended answer with the question.
   - Explain why the question matters when the trade-off is not obvious.
   - Prefer concrete scenarios over abstract debate.
   - Challenge terms that conflict with existing specs, artifacts, or code.
   - Surface contradictions immediately before asking the next question.

4. Update artifacts only after the user resolves the question.
   - Route each resolved decision to the narrowest appropriate artifact.
   - Do not batch unrelated artifact edits.
   - Do not update files from a guess when the user has not accepted or corrected the recommendation.
   - Update `tasks.md` only after the underlying proposal, design, or spec decision is stable.

5. Continue until the change is coherent enough to implement or the user stops.
   - Track the remaining unresolved branches conversationally.
   - Stop if implementation work starts; this skill sharpens the change, it does not implement it.

## Plan Conversation Mode

Use this mode when the user wants to be grilled about a plan but there is no active OpenSpec change.

1. Reconstruct the plan from the conversation and any files the user points to.
2. Ask one question at a time, with a recommended answer.
3. Inspect the codebase when repository facts can answer the question.
4. Maintain a conversational artifact mapping:
   - What belongs in `proposal.md`
   - What belongs in `design.md`
   - What belongs in `specs/<capability>/spec.md`
   - What belongs in `tasks.md`
5. Do not create or update OpenSpec files in this mode unless the user explicitly asks to turn the plan into a change.

## Idea Mode

Use this mode when the user has a raw idea but not yet a plan.

1. Restate the idea in one sentence before challenging it.
2. Ask one question at a time, with a recommended answer.
3. Focus on whether the idea is coherent, valuable, scoped, and worth turning into an OpenSpec change.
4. Inspect the codebase or existing specs when they can reveal whether the idea already exists, conflicts with current behavior, or affects a known capability.
5. Maintain a conversational change seed:
   - Possible change name
   - Proposal seed: problem, motivation, scope, non-goals, and impact
   - Open design questions
   - Likely affected specs or capabilities
   - Reasons not to proceed yet
6. Do not create or update OpenSpec files in this mode unless the user explicitly asks to convert the idea into a change.

## Question Style

Be direct and specific:

- Challenge vague terms: "You said account. Do you mean User, Customer, Workspace, or Billing Account?"
- Challenge scope drift: "Is this requirement part of the current change or a follow-up?"
- Challenge reversibility: "If this API shape is wrong later, how expensive is migration?"
- Challenge observable behavior: "What should happen when the source emits the same event twice?"
- Challenge implementation claims with code: "The code currently validates at ingestion, but the plan says validation happens during transformation. Which boundary is intended?"

Ask for decisions, not essays. When the user accepts the recommendation, make the smallest artifact update that preserves the decision.

## Artifact Discipline

- Treat `proposal.md` as intent and scope, not implementation.
- Treat `design.md` as the home for architecture, alternatives, trade-offs, risks, and sequencing.
- Treat `specs/**/spec.md` as observable behavior written as requirements and scenarios.
- Treat `tasks.md` as implementation work derived from resolved artifacts.
- Treat canonical `openspec/specs/**` as the current contract to challenge against.

## Out Of Scope

- Do not create standalone ADRs.
- Do not create new OpenSpec changes.
- Do not implement code changes.
- Do not replace `openspec-propose`, `openspec-apply-change`, or `openspec-archive-change`.
- Do not update archived OpenSpec artifacts unless the user explicitly asks for historical correction.
