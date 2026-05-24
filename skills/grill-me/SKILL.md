---
name: grill-me
description: Pressure-test a raw idea, drafted implementation plan, or active OpenSpec change before work begins. Use when the user asks to be grilled, challenged, stress-tested, or questioned about an idea, plan, proposal, design, spec delta, or OpenSpec change; sharpen value, scope, terminology, trade-offs, requirements, scenarios, and tasks one question at a time, updating OpenSpec artifacts only when an active change exists and the user confirms the decision.
---

# Grill Me

Pressure-test plans before implementation by challenging unclear terms, weak trade-offs, missing scenarios, and mismatches between the plan, OpenSpec artifacts, and code.

## Start

Determine the mode before asking design questions:

1. **Active OpenSpec change mode**: Use when the user names an OpenSpec change, the conversation clearly identifies one, or exactly one active change exists. If this mode applies, read `references/openspec-mode.md` for the full workflow.
2. **Plan conversation mode**: Use when the user has a plan or has just finished a planning session, but there is no active OpenSpec change to update.
3. **Idea mode**: Use when the user has a raw idea, early concept, or one-sentence change request and wants it challenged before turning it into a plan or OpenSpec change.

If multiple active changes exist and the user did not name one, ask which change to grill. If no active change exists, do not create one from this skill; choose plan conversation mode or idea mode based on how formed the input is, and suggest `openspec-propose` only when the user wants files created.

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
- Challenge actors: "Who actually triggers this? An admin, an end-user, a cron job? The answer changes the permission model."
- Challenge sequencing: "Why does X need to happen before Y? What breaks if they're reversed?"
- Challenge definition of done: "How will you know this is complete? What does the acceptance signal look like?"
- Challenge failure modes: "What happens when the upstream service is down for 30 minutes? Is the behavior silent failure, retry, or user-visible error?"
- Challenge prior attempts: "Has anyone tried solving this differently before? Why didn't it hold?"
- Challenge implicit dependencies: "This assumes the auth service responds in under 100ms. Is that guaranteed, and what happens when it isn't?"
- Challenge naming consistency: "This uses 'pipeline' here but 'job' in the existing spec. Are these the same concept?"

Ask for decisions, not essays. When the user accepts the recommendation, make the smallest artifact update that preserves the decision.

## Convergence

After 6-8 questions without surfacing a new structural concern, shift from divergent questioning to convergent summary:

- Offer a one-paragraph summary of resolved decisions and any known risks or assumptions.
- Distinguish explicitly between remaining structural concerns (which block coherent implementation) and clarification questions (which can be deferred).
- Say "I have no remaining structural concerns" when that is true. Do not manufacture more questions to fill space.
- If the user has resolved all major branches, propose a concrete next step: start implementing, run `openspec-propose` to create a change, or name what to do first.

Do not summarize prematurely. If a new structural concern arises mid-summary, surface it before closing.

## Handling Pushback

When the user pushes back on a question:

- "Out of scope" or "not now" — accept it. If the dismissed point is a genuine risk, note it as a known assumption once, then move on. Do not return to it.
- "I don't care" about a structural decision — push once with a concrete scenario showing why the choice has consequences. If the user still dismisses it, accept their position and move on.
- New information that contradicts a prior recommendation — update your model. Do not defend the original recommendation.
- Never repeat a question the user has already dismissed, even in different framing.

## Out Of Scope

- Do not create standalone ADRs.
- Do not create new OpenSpec changes.
- Do not implement code changes.
- Do not replace `openspec-propose`, `openspec-apply-change`, or `openspec-archive-change`.
- Do not update archived OpenSpec artifacts unless the user explicitly asks for historical correction.
