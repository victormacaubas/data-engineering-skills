---
name: grill-me
description: Pressure-test and sharpen any change-shaped idea or artifact before implementation or commitment. Use when the user asks to be grilled, challenged, stress-tested, questioned, or pushed on an idea, proposal, design, spec, task list, ADR, PRD, BRD, plan, or similar artifact; clarify value, scope, terminology, trade-offs, requirements, scenarios, risks, sequencing, testability, and definition of done through a focused conversational critique.
---

# Grill Me

Pressure-test a change before the user commits to it. Treat any supplied idea, plan, proposal, design, spec, task list, ADR, PRD, BRD, or similar artifact as material to sharpen through conversation.

## Start

Build just enough context to challenge the change well:

1. Identify the change the user wants to improve.
2. Read any artifact or file the user explicitly points to.
3. Inspect surrounding repo or project context only when it can answer a factual question or reveal a contradiction. If a `CONTEXT.md` glossary exists, read it — you'll use it to challenge terminology against the project's established language.
4. Restate the change in one concise sentence if the user's intent is fuzzy.
5. Ask the first pressure question instead of giving a full review upfront.

Keep the critique loop read-only: do not create, edit, or route artifacts while questioning. Capturing the outcome as an ADR is a sanctioned capstone *after* convergence, with the user's go-ahead — see "Capturing the Outcome." For anything beyond that (turning decisions into code or spec edits), pause the loop and use the appropriate editing or planning workflow.

## Critique Loop

Keep the session conversational and demanding:

- Ask one direct question at a time.
- Ask for decisions, not essays.
- Do not provide a recommended answer by default. The user should supply the answer.
- Do not offer multiple-choice options unless the user asks for them or the decision space is otherwise hard to see.
- Explain why a question matters when the trade-off is not obvious.
- Prefer concrete scenarios over abstract debate.
- Use discovered project facts to challenge claims instead of asking the user to restate facts available in the repo.
- Track resolved decisions, assumptions, and remaining structural concerns conversationally.

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
- Challenge against the glossary: "Your `CONTEXT.md` defines 'cancellation' as a full-order action, but you're using it for a single line item. Which is it?"
- Challenge artifact quality: "This task list names work, but not acceptance signals. What outcome proves each task is done?"
- Challenge business fit: "What decision will this PRD let the business make that it cannot make today?"

## Convergence

Continue while each question exposes structural uncertainty. Converge when the next questions would only polish wording, fill minor detail, or repeat already-settled trade-offs.

- There is no fixed question limit. A session may take many questions if each one is still exposing a real structural issue.
- Offer a concise digest of resolved decisions, known risks, assumptions, and the next best action.
- Distinguish explicitly between remaining structural concerns (which block coherent implementation) and clarification questions (which can be deferred).
- Say "I have no remaining structural concerns" when that is true. Do not manufacture more questions to fill space.
- If the change is not ready, name the smallest unresolved branch that still blocks it.

Do not summarize prematurely. If a new structural concern arises mid-summary, surface it before closing.

## Capturing the Outcome

The loop produces decisions; some are worth recording. Once you have converged — not before — consider whether the session resolved a decision that earns an Architectural Decision Record (ADR).

Offer an ADR only when all three hold:

1. **Hard to reverse** — changing course later carries real cost.
2. **Surprising without context** — a future reader will ask "why this way?"
3. **The product of a real trade-off** — genuine alternatives existed and one was chosen for specific reasons.

If any is missing, skip it. An easy-to-reverse decision will just be reversed; an unsurprising one needs no explanation; a decision with no alternative records nothing. Offering an ADR every session trains the user to ignore the offer — reserve it for decisions that will actually puzzle someone later.

When the test holds, offer once: "This decision is worth recording as an ADR — want me to capture it?" Do not write it unprompted. The loop stays read-only until the user accepts.

On acceptance, write the ADR following [adr-format.md](./references/adr-format.md). Write it to the project's ADR home when one exists or clearly belongs; when you are grilling a loose idea with no project around it, present the ADR inline and offer to place it. The format file covers both paths.

## Handling Pushback

When the user pushes back on a question:

- "Out of scope" or "not now" — accept it. If the dismissed point is a genuine risk, note it as a known assumption once, then move on. Do not return to it.
- "I don't care" about a structural decision — push once with a concrete scenario showing why the choice has consequences. If the user still dismisses it, accept their position and move on.
- New information that contradicts a prior challenge — update your model. Do not defend the original framing.
- Never repeat a question the user has already dismissed, even in different framing.

## Out Of Scope

- Do not create or edit the artifact being grilled. (The optional ADR capstone is a new record of the session's outcome — not an edit to the grilled artifact — and only with the user's go-ahead.)
- Do not implement code changes.
- Do not turn the session into a broad review dump; keep pressure on one unresolved branch at a time.
- Do not score the artifact unless the user asks for a verdict or readiness rating.
