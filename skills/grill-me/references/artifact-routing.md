# Artifact Routing

Use this reference before editing OpenSpec artifacts during `grill-me` active change mode. Route each resolved decision to the narrowest artifact that preserves it.

## Routing Table

| Decision or clarification | Write target | Notes |
| --- | --- | --- |
| Problem statement, motivation, user value, business reason | `proposal.md` | Keep it about why the change exists. |
| In-scope or out-of-scope behavior | `proposal.md` | Use explicit scope or non-goal language. |
| Affected capability list | `proposal.md` | Name capabilities, but keep detailed behavior in specs. |
| Architectural approach, data flow, boundaries, dependencies | `design.md` | Include enough context for a future reader to understand why. |
| Alternative considered and rejected | `design.md` | Capture real trade-offs, not strawmen. |
| Risk, migration concern, rollout sequencing, compatibility concern | `design.md` | Include mitigation when known. |
| Externally observable behavior | `specs/<capability>/spec.md` | Write as requirements and scenarios. |
| Acceptance edge case, error behavior, idempotency, permission outcome | `specs/<capability>/spec.md` | Prefer concrete `WHEN` / `THEN` scenarios. |
| Implementation step required to realize a resolved artifact | `tasks.md` | Update only after proposal/design/spec is stable. |
| Test, verification, or migration task | `tasks.md` | Keep tasks actionable and checkable. |
| Durable cross-change architectural decision | Out of scope | Suggest a future ADR skill or explicit ADR request. |

## Conflict Rules

- If a statement conflicts with canonical `openspec/specs/**`, ask which contract should change before editing files.
- If a statement conflicts with code, show the concrete code behavior and ask whether the plan or code is authoritative.
- If a decision could fit both `design.md` and a spec, use this split:
  - Put why this shape was chosen in `design.md`.
  - Put what the system must do in `specs/<capability>/spec.md`.
- If a task uncovers a missing requirement, update the spec first, then derive the task.

## Edit Rules

- Make one conceptual artifact update per resolved question.
- Do not rewrite whole artifacts unless the user asks for a consolidation pass.
- Preserve existing user wording when it is accurate.
- Mark uncertainty explicitly in conversation, not in committed artifact text.
- Do not add implementation details to `proposal.md`.
- Do not add task checkboxes for speculative work.
