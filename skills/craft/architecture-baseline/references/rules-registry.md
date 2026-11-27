# The Rule Registry

`docs/rules.yaml` holds the structural rules no tool can check, one entry each, with the ADR that holds the reasoning when one does. It is the list a person or agent has to keep in mind while changing the code, because nothing in the gate will catch a violation. An agent reads it before the first edit; a reviewer reads it when judging a change.

A rule a tool checks isn't here. Its contract, lint rule, dependency ban, or test flag is its only statement, with a comment above it naming the ADR. A registry copy of it would say the same thing as the check and drift from it the first time either changes.

## What belongs

Two tests, in order.

**Does it constrain structure or how the repo is governed?** That covers:

- where code lives, and what each package or crate owns
- what may import, call, or construct what
- what crosses a boundary, and in what form (driver types, foreign errors, untrusted input)
- what identifies a record, and what a re-run produces
- which dependencies the system may have, and how one gets added
- how the gate runs: one command, and CI runs that command

Everything else is a convention and goes in `AGENTS.md`: how to log, how to name a test, how to build fixtures, CLI flag habits, doc-comment content, how to size a change. Ask: **if this rule were broken, would the system's shape be different, or only one module's style?**

**Can a tool check it?** Before adding an entry, ask whether a forbidden import/crate contract, a banned-API lint, or a test flag would catch a violation. If one would, write that check and leave the rule out. The registry is for what no tool can see, not for what nobody configured yet.

Not every entry needs an ADR. Apply the test from `references/adr-set.md`: would someone implementing a future change plausibly undo this without knowing why? If so, the reasoning deserves an ADR, and `source` points at it. If the rule explains itself, the entry is its whole record.

### Split rules

Some rules are partly checkable. A linter can ban a deprecated clock call or raw `SystemTime::now()` outside the clock adapter, while review catches a caller bypassing the `Clock` seam through a helper. Configure the mechanical ban, and give the registry only the part the ban misses:

```yaml
  - id: time.clock-seam
    rule: Read the current time through the Clock seam, never by calling the system clock directly.
    applies_to: ["src/**"]
    source: docs/adr/0004-seams.md
```

## Format

```yaml
version: 1
rules:
  - id: seams.injection-required
    rule: A seam is a required constructor argument, never a parameter defaulting to the real implementation.
    applies_to: ["src/mypackage/**"]
    source: docs/adr/0004-seams.md
```

| Field | Holds |
|---|---|
| `id` | `<area>.<slug>`, stable. Review comments cite it, so never rename or reuse one. A retired rule's entry is deleted; the superseded ADR keeps its history. |
| `rule` | One imperative sentence a reader can check a diff against. |
| `applies_to` | Glob patterns, relative to the repo root, for the paths the rule governs. |
| `source` | Optional. The ADR that holds the reasoning. Leave it out when the rule needs no explanation. Never `AGENTS.md`, and never a design doc, which goes stale once the decisions land. |

There's no `why` field, on purpose. The reasoning lives in the ADR `source` names, and a one-line paraphrase of it here would drift from the ADR silently. There's no `enforced_by` field either: every entry is checked by review, which is why it's here.

## Writing a rule

One sentence, imperative, about the code rather than about intentions. The test for each one: **could a reviewer point at a line in a diff and say it breaks this?** If not, it's a value statement, and those belong in the ADR's context. Name the thing, not the quality. "Keep the core clean" can't be checked; "only the composition root constructs concrete implementations" can.

<example>
  - id: gate.ci-runs-the-gate
    rule: CI runs make check itself, never its own list of steps.
    applies_to: [".github/workflows/**"]
    source: docs/adr/0007-toolchain-and-quality-gate.md
</example>

This one constrains how enforcement is wired rather than the code itself, which still makes it governance: a CI job with its own step list is a second gate that drifts from the first.

<example>
  Not a registry rule:
  - id: tech.owner-owns-types
    rule: No sqlite3 type or exception appears outside mypackage.store.
</example>

Structural, but the forbidden contract `Only store touches the database driver` already checks it. That contract, with a comment naming ADR 0002, is the rule.

<example>
  Not a registry rule:
  - id: tests.named-for-assertion
    rule: Name each test for what it asserts.
</example>

A good rule, and it belongs in `AGENTS.md`. Breaking it makes a test harder to read; it doesn't change what any package owns or may touch.

## The registry test

A registry test keeps `docs/rules.yaml` honest inside the gate's default test run. It is gate machinery, like the architectural contracts, which is why the baseline writes it even though Decision 6 creates no feature tests.

Every language's registry test checks four invariants:

1. **Unique, non-empty `id`s** across `rules`.
2. **Exact allowed keys:** `id`, `rule`, and `applies_to` are required; `source` is optional; any extra key (such as `enforced_by`) fails, so the registry cannot quietly grow back into a copy of tool config.
3. **Every `applies_to` glob matches at least one path** in the repo.
4. **Every `source` resolves to an existing file** and is not an instruction file (`AGENTS.md`, `CLAUDE.md`).

The concrete test implementation and its dev-only YAML dependency live in the active language pack (`references/python.md` → `tests/unit/test_rules_registry.py`; `references/rust.md` → `tests/rules_registry.rs`). Record the YAML parser as dev tooling in ADR 0002.

Run it once with a deliberately wrong entry (a missing ADR path, an `applies_to` that matches nothing) and confirm it fails before trusting it, the same way each contract gets made to fail once.
