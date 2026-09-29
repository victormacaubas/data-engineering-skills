# ADR Format

An Architectural Decision Record captures one decision: what was decided and why. Record the choice and its reasoning, not a filled-in template.

## Template

Keep it short. One paragraph is often enough.

```md
# {Short title of the decision}

{1–3 sentences: the context, what was decided, and why.}
```

### Optional sections

Add sections only when they earn their place. Most ADRs won't need them.

- **Status** (`proposed | accepted | superseded by ADR-NNNN`): when decisions get revisited.
- **Considered options**: only when the rejected alternatives are worth remembering, so nobody re-litigates them in six months.
- **Consequences**: only when a non-obvious downstream effect needs calling out.

## Where it goes

- **Project with an ADR home:** if `docs/adr/` exists, write there. Scan for the highest existing number, then increment it: `0001-slug.md`, `0002-slug.md`. If the project clearly should have one but doesn't, create `docs/adr/` lazily and start at `0001`.
- **No sensible home (a loose idea, no project around it):** present the ADR inline and offer to place it wherever the user wants. Don't invent a directory in an unrelated working directory.
