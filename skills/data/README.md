# data

The warehouse surface: writing analytical SQL that can be trusted, and answering governance questions about who can see what.

Distributed as the `data` marketplace plugin. Members invoke as `/data:<skill-name>`.

| Skill | What it does |
|---|---|
| `sql-data-analysis` | Canonical SQL standards for analytics, transformation, review, performance, and cost control. |
| `data-governance` | Queries Snowflake `ACCOUNT_USAGE` for masking, row access, classification, tags, access history, grants, logins, and query auditing. |

Adding a skill here means adding its path to the `data` entry's `skills` array in **both** `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`. A skill on disk but absent from the array loads nowhere.

Group membership is part of a skill's public name. Moving a skill out of `data` is a breaking rename that silently breaks agent preloads — see `CLAUDE.md`.
