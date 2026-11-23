---
name: verify
description: Run this repository's structural checks before a commit, and when asked to verify, check, or validate the repo. Runs the validation command, runs the three mod checks for each mod the change touches, flags agent preload changes that need a live run, and reports each result. Use it before every commit in this repository, including commits that change only SKILL.md or other Markdown files, because a skill or catalog edit is the most common source of a structural defect here.
---

# Verify

Run the steps in order. Do all of them, also when one fails, then report.

## 1. Find what the change touches

    git diff --name-only HEAD
    git ls-files --others --exclude-standard

Use the union of the two lists. A commit in progress can have staged and unstaged files; both count. If both lists are empty (the change is already committed), use `git diff --name-only main...HEAD` instead.

## 2. Run the validation command

    uv run scripts/validate_repo.py

It is read-only and needs no network. Run it for every change.

## 3. Run the mod checks for each touched mod

For each `mods/<name>/` that has a path in the list from step 1:

    claude plugin validate mods/<name>
    claude plugin test mods/<name>
    tsc -p mods/<name>

`tsc -p` works only after the engine has loaded the mod one time, which writes `mods/<name>/.claude-plugin/types/tsconfig.json`. If that file is not there, do not run `tsc`. Report it as not run, and tell the person to load the mod one time with `claude --plugin-dir mods/<name>` in an interactive session.

## 4. Flag agent preload changes

If a path from step 1 is under `agents/claude/` and its diff changes the `skills:` list, a check cannot confirm the preload. Claude Code skips a preload that does not resolve, and writes only a debug-log line. Do not run the agent yourself. Report it as an open item: run that agent one time and confirm that the preloaded skill is in its context.

## Report

One block for each command that ran or was skipped:

    <command>: pass | fail | not run (<reason>)
    <last lines of its output; all failure lines for the validation command>

Then one line: `verify: pass` when each command that ran passed and no item is open, else `verify: fail` or `verify: open items`, with the reason. A failure blocks the commit until it is corrected or the person accepts it.
