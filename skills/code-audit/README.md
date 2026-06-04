# code-audit maintainer notes

This README is for humans maintaining the skill. Runtime instructions live in `SKILL.md`; agents should not need this file to perform a review.

## Adding a language pack

Language packs hold stable, universal idioms for a language: Python mutable defaults and broad catches, SQL join fan-out, JavaScript equality and async hazards, Terraform public ingress. They must not hold per-repo conventions such as "this project uses tenacity for retries" or "this team logs with structlog"; those are discovered at review time and written to the artifact's `conventions` field.

To add a pack:

1. Create `languages/<language>.md`.
2. Add a matching row to the language-pack table in `SKILL.md`.
3. Use the category keys from `SKILL.md` in headings so findings map cleanly to the artifact schema.
4. Keep the pack tight. The reviewer reads each matched pack fully before scoring, so signal matters more than exhaustive taxonomy.
5. For OO languages, invoke the SOLID lens under `architecture`. For declarative languages such as SQL and IaC, frame `architecture` as layering, composability, blast-radius control, and DRY.

## Pack template

````markdown
# Language Pack: <LANGUAGE>

Load when the review scope contains <extensions / config files>. This pack sharpens the universal review categories with <LANGUAGE>-specific footguns; the category keys in parentheses match `../SKILL.md`. Read it fully before scoring.

## Idiom & formatter
- Canonical style guide, formatter, linter, type checker, and what idiomatic code looks like.

## Security (`security`)
- Injection surfaces, secret-handling footguns, TLS/crypto misuse, permission and exposure mistakes.

## Correctness & hidden bugs (`correctness`, `concurrency`, `resource-lifecycle`)
- Silent-wrong-answer traps: equality/identity, null/empty handling, numeric/time pitfalls, concurrency/async hazards, state leakage, resource leaks.

## Performance (`performance`)
- Hot-path and scaling footguns. If mostly not applicable, say so rather than padding.

## Architecture & design (`architecture`, `api-contracts`)
- OO: SOLID. Declarative/IaC: layering, composability, blast-radius, DRY. Coupling, DI seams, design-pattern fit, public API/back-compat for diff scope.

## Error handling & resilience (`error-handling`, `idempotency`, `observability`)
- Idiomatic error handling, retries/backoff, resource cleanup, idempotency, observability conventions.

## Readability & style (`readability`)
- Typing, naming, length, magic values, comment and documentation conventions.

## Grep patterns worth running
```
<pattern>   # what it catches
```

## Calibration hints
- Two to four lines anchoring which language-specific findings are critical/high vs low, tied to the severity guidance in `../SKILL.md`.
````
