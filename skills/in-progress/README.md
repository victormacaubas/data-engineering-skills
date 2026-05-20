# In-progress skills

Skills in this folder are under active development and not ready to ship. expect rough edges, breaking changes, and abandoned experiments.

**They are not installed by `scripts/install.sh`.** The install scripts only look one level deep in `skills/` — any skill nested inside `in-progress/` is invisible to them.

## Workflow

1. Create your skill here: `skills/in-progress/<name>/SKILL.md`
2. Iterate until it's ready.
3. Graduate it: move the directory up to `skills/<name>/`.
4. Run `./scripts/install.sh` to deploy.
