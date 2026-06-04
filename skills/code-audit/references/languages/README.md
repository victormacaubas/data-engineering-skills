# Language Packs — index

Each pack sharpens the universal review dimensions (`../review-dimensions.md`) with stable, language-specific footguns. Packs are loaded **lazily**: only the pack(s) matching the languages in scope get read, so shipping many packs costs no context until a review touches that language.

## Signal → pack

| If the scope contains… | Load |
|---|---|
| `.py`, `pyproject.toml`, `requirements.txt`, shebang `python` | `python.md` |
| `.sql`, dbt models, `dbt_project.yml`, warehouse queries | `sql.md` |
| `.js`, `.ts`, `.mjs`, `.cjs`, Node `package.json` (non-React) | `javascript-typescript.md` |
| `.jsx`, `.tsx`, React components/hooks | `react.md` **and** `javascript-typescript.md` |
| `.tf`, `.tfvars`, Terraform/HCL modules | `terraform.md` |
| `.sh`, `.bash`, shebang `#!/bin/bash` or `#!/bin/sh`, `Makefile` | `bash.md` |

## Loading rules

- **Read the matched pack(s) fully before scoring** — each maps its footguns onto the dimension keys and supplies calibration hints.
- **Mixed scope** (e.g. a PR touching Python and SQL) → load every relevant pack.
- **React** is additive: `.tsx`/`.jsx` loads both `react.md` and `javascript-typescript.md`.
- **No pack for a language in scope** (Go, Rust, YAML, etc.) → don't stop. Review against the universal dimensions, lean on the universal principles, and note in the artifact's `summary` that no dedicated pack was available so language-specific footguns may be under-covered.

## The pack/convention boundary

Packs hold **stable, universal idioms** for a language — Python's mutable defaults and bare `except`, JS `===` vs `==`, SQL join fan-out, Terraform `0.0.0.0/0`. They must **never** hold per-repo conventions like "this repo uses tenacity for retries and structlog for logging." Those are dynamic, discovered at review time, and belong in the artifact's `conventions` field (or a project's CLAUDE.md). Mixing the two is how packs rot.

## Adding a pack

1. Copy the template below to `<language>.md`.
2. Add a row to the **Signal → pack** table above. No `SKILL.md` change is needed — the skill reads this index.
3. Keep it tight — roughly one screen per dimension at most. The reviewer reads the whole pack before scoring, so signal beats completeness.
4. For OO languages, invoke the SOLID lens under `architecture`. For declarative languages (SQL, IaC), state that SOLID doesn't apply and frame `architecture` as layering / blast-radius / DRY.
5. Use the dimension keys from `../review-dimensions.md` in the section headings (in parentheses) so findings map cleanly to a `category`.

### Pack template

````markdown
# Language Pack: <LANGUAGE>

Load when the review scope contains <extensions / config files>. This pack sharpens the universal review dimensions with <LANGUAGE>-specific footguns; the dimension keys in parentheses match `review-dimensions.md`. Read it fully before scoring.

## Idiom & formatter
- The canonical style guide, formatter, linter, type checker. What "idiomatic" looks like here.

## Security (`security`)
- Injection surfaces, secret-handling footguns, TLS/crypto misuse, permission/exposure mistakes.

## Correctness & hidden bugs (`correctness`, `concurrency`, `resource-lifecycle`)
- Silent-wrong-answer traps: equality/identity, null/empty handling, numeric/time pitfalls, concurrency/async hazards, state leakage, resource leaks. Usually the longest section.

## Performance (`performance`)
- Hot-path and scaling footguns. If the language is declarative and this is largely N/A, say so rather than padding.

## Architecture & design (`architecture`, `api-contracts`)
- OO: the SOLID lens. Declarative/IaC: layering, composability, blast-radius, DRY. Coupling, DI seams, design-pattern fit, public-API/back-compat for diff scope.

## Error handling & resilience (`error-handling`, `idempotency`, `observability`)
- Idiomatic error handling, retries/backoff, resource cleanup, idempotency, observability conventions.

## Readability & style (`readability`)
- Typing, naming, length, magic values, comment/doc conventions.

## Grep patterns worth running
```
<pattern>   # what it catches
```

## Calibration hints
- 2–4 lines anchoring which language-specific findings are critical/high vs low, tied to the severity rubric so severities stay comparable across languages.
````
