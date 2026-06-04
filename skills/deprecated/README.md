# Deprecated skills

Skills in this folder are retired and **not installed**.

They are kept here for reference and history rather than deleted outright.

| Skill | Replaced by | Reason |
|---|---|---|
| `code-reviewer` | `code-audit` | Superseded by `code-audit`, which emits a machine-parseable JSON artifact instead of a graded markdown report. The JSON is a cross-session work order that downstream agents can act on. Language packs carried over unchanged. |
| `python-code-reviewer` | `code-audit` | Superseded by the language-agnostic `code-audit` skill. Python-specific footguns live in `code-audit/references/languages/python.md`. |

To revive a deprecated skill, move its directory back up to `skills/<name>/`.
