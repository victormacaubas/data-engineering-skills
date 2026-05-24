# Active OpenSpec Change Mode

Use this reference when active OpenSpec change mode is in effect. Contains the full workflow and artifact discipline rules.

## Workflow

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
   - Route each resolved decision to the narrowest appropriate artifact. Read [artifact-routing.md](artifact-routing.md) before writing.
   - Do not batch unrelated artifact edits.
   - Do not update files from a guess when the user has not accepted or corrected the recommendation.
   - Update `tasks.md` only after the underlying proposal, design, or spec decision is stable.

5. Continue until the change is coherent enough to implement or the user stops.
   - Track the remaining unresolved branches conversationally.
   - Stop if implementation work starts; this skill sharpens the change, it does not implement it.

## Artifact Discipline

- Treat `proposal.md` as intent and scope, not implementation.
- Treat `design.md` as the home for architecture, alternatives, trade-offs, risks, and sequencing.
- Treat `specs/**/spec.md` as observable behavior written as requirements and scenarios.
- Treat `tasks.md` as implementation work derived from resolved artifacts.
- Treat canonical `openspec/specs/**` as the current contract to challenge against.
