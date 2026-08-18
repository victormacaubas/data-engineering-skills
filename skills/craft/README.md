# craft

How code gets written and checked: the architectural baseline a project starts from, the language standards it holds itself to, and the two reviews that gate a finished change.

Distributed as the `craft` marketplace plugin. Members invoke as `/craft:<skill-name>`.

| Skill | What it does |
|---|---|
| `architecture-baseline` | Establishes a project's architectural constraints before any feature work. Requires the separately installed `researcher` agent. |
| `python-engineering-standards` | Canonical Python standards for layout, typing, reliability, concurrency, and testing. |
| `code-audit` | Non-destructive, language-agnostic defect review with scored JSON findings. |
| `structure-review` | Senior-engineer review of a finished change for shape, conformance, and maintainability. |

Adding a skill here means adding its path to the `craft` entry's `skills` array in **both** `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`. A skill on disk but absent from the array loads nowhere.

Group membership is part of a skill's public name. Moving a skill out of `craft` is a breaking rename that silently breaks agent preloads — see `CLAUDE.md`.
