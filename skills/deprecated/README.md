# Deprecated skills

Skills in this folder are retired and **not installed**.

They are kept here for reference and history rather than deleted outright.

| Skill | Replaced by | Reason |
|---|---|---|
| `python-code-reviewer` | `code-audit` | Superseded by the language-agnostic `code-audit` skill. Python-specific footguns live in `code-audit/references/python.md`. |
| `orchestrate-gather` | `orchestrate` | `/opsx:explore` turned out to fill the session-start context-loading role better. The parts worth keeping — the dispatch contract for briefing read-only workers and the rules for acting on their returns — were folded into `orchestrate/references/dispatch-readers.md`. Previously shipped as `context-gather`. |

To revive a deprecated skill, move its directory back up to `skills/<name>/`.
