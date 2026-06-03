## What this skill does

Produces a non-destructive, language-agnostic code review as a markdown report under `./reviews/`. The generic core (`SKILL.md`) defines *how* to review — the six-dimension rubric, severity model, calibration, scoring formula, and report template. Per-language **packs** in `references/` define *what tends to break* in each language and are loaded on demand in Step 2.

## Layout

```
code-reviewer/
├── SKILL.md                 ← generic core (always loaded on trigger)
├── README.md                ← this file (never auto-loaded)
└── references/              ← language packs (loaded only when the scope matches)
    ├── python.md
    ├── sql.md
    ├── javascript-typescript.md
    ├── react.md
    └── terraform.md
```

## The six rubric dimensions

Security ×2.0 · Correctness & Hidden Bugs ×2.0 · Performance ×1.5 · **Architecture & Design** ×1.5 · Error Handling & Resilience ×1.0 · Readability & Style ×1.0.

Note on **Architecture & Design**: SOLID is an object-oriented principle, so it only applies as a lens in OO-capable packs (Python, JS/TS, React). In declarative languages (SQL, Terraform) the same dimension means layering, modularity, blast-radius, and DRY — the packs say so explicitly. Don't reintroduce "SOLID" as the dimension name; keep it "Architecture & Design" so the rubric stays comparable across languages.

## Adding a new language pack

1. Copy the template below to `references/<language>.md`.
2. Register it in the **Step 2** table in `SKILL.md`, mapping the file extensions / config files that should trigger it.
3. Keep it tight — one screen per dimension at most. The reviewer reads the whole pack before scoring, so signal beats completeness.
4. For OO languages, invoke the SOLID lens under Architecture & Design. For non-OO/declarative languages, state that SOLID doesn't apply and frame the dimension as modularity/blast-radius instead.

### Pack template

````markdown
# Language Pack: <LANGUAGE>

Load when the review scope contains <extensions / config files>. This pack sharpens the six generic rubric dimensions with <LANGUAGE>-specific footguns. Read it fully before scoring.

## Idiom & formatter

- The canonical style guide, formatter, linter, and type checker. What "idiomatic" looks like here.

## Security (×2.0)

- Injection surfaces, secret-handling footguns, TLS/crypto misuse, permission/exposure mistakes specific to this language/ecosystem.

## Correctness & Hidden Bugs (×2.0)

- The silent-wrong-answer traps: equality/identity, null/empty handling, numeric/time pitfalls, concurrency/async hazards, state leakage, resource leaks. Usually the longest section.

## Performance (×1.5)

- Hot-path and scaling footguns: unbounded reads, N+1, wrong concurrency primitive, avoidable allocation/recomputation. If the language is declarative and this is largely N/A, say so explicitly rather than padding.

## Architecture & Design (×1.5)

- For OO languages: apply the SOLID lens. For declarative/IaC: state SOLID doesn't apply; frame as layering, composability, blast-radius, DRY. Cover coupling, DI seams, idiomatic module boundaries, design-pattern fit (missing and gratuitous), and public-API/back-compat shapes for diff scope.

## Error Handling & Resilience (×1.0)

- Idiomatic error handling, retries/backoff, resource cleanup, idempotency, and observability conventions for this language.

## Readability & Style (×1.0)

- Typing, naming, length, magic values, comment/doc conventions specific to the language.

## Grep patterns worth running

```
<pattern>   # what it catches
```

## Calibration hints

- 2–4 lines anchoring which language-specific findings are Critical/High vs Low, tied back to the core guardrails in SKILL.md so scores stay comparable across languages.
````

## Provenance

Built on top of the retired `python-code-reviewer` skill (now in `skills/deprecated/`). The rubric, severity buckets, calibration guardrails, scoring formula, and report template are inherited from it; this skill generalizes the core across languages and drops the OpenSpec coupling the original carried.
