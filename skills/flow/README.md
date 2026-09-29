# flow

How work gets driven from an unformed idea to something tracked and built: exploring, pressure-testing, delegating implementation, and capturing the output.

Distributed as the `flow` marketplace plugin. Members invoke as `/flow:<skill-name>`.

| Skill | What it does |
|---|---|
| `scout` | Explores an undecided problem through delegated research. Requires the separately installed `pathfinder` and `researcher` agents. |
| `grill-me` | Pressure-tests a change idea, plan, spec, or ADR before implementation. |
| `orchestrate` | Drives workers to implement a bounded plan. Requires the separately installed `implementer`, `pathfinder`, `researcher`, and `structure-reviewer` agents. |
| `write-ticket` | Writes Jira tickets and comments in plain language using the Atlassian CLI (`acli`). |
| `stash` | Parks raw content in an Obsidian vault inbox for later processing. |
| `atlassian-cli` | Command reference for the Atlassian `acli` CLI: Jira reads and writes, Confluence reads, and the single-profile auth model. |

`write-ticket` and `atlassian-cli` both need the [Atlassian CLI](https://developer.atlassian.com/cloud/acli/) installed and authenticated (`acli auth login`); neither the marketplace plugin nor the install scripts provide the binary.

Adding a skill here means adding its path to the `flow` entry's `skills` array in **both** `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`. A skill on disk but absent from the array loads nowhere.

Group membership is part of a skill's public name. Moving a skill out of `flow` is a breaking rename that silently breaks agent preloads — see `CLAUDE.md`.
