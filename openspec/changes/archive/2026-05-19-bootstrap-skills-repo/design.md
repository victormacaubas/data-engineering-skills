## Context

This is a greenfield repository with only an initial commit. The goal is to establish conventions that let a single developer (or team) author agent skills once and deploy them to both Codex and Claude Code. Currently skills are scattered or manually copied; this repo centralizes them with install automation.

Key constraints:
- Claude Code stores skills at `~/.claude/skills/<skill-name>/SKILL.md`.
- Codex reads agent instructions from a configurable directory (no single canonical path yet documented publicly); scripts must allow user override.
- Install scripts run on macOS (primary) and Linux (CI/secondary).
- The repo is developer-facing; clarity over cleverness.

## Goals / Non-Goals

**Goals:**
- One canonical layout for skills that works for both agents.
- Single-command install per agent (`./scripts/install-claude.sh`, `./scripts/install-codex.sh`).
- Symlink-first strategy during development for instant feedback.
- Safe installs: backup existing files, never silently overwrite.
- Self-documenting: README and CLAUDE.md provide enough context for a cold start.

**Non-Goals:**
- Package manager distribution (Homebrew, npm) — future scope.
- Automated CI/CD publishing of skills — future scope.
- GUI or interactive installer — scripts are non-interactive by default.
- Supporting Windows natively (WSL is acceptable).

## Decisions

### 1. Symlink-first install strategy

Skills are symlinked from the repo into target directories. This means edits in the repo are immediately reflected without re-running install.

**Alternatives considered:**
- Copy-based install: simpler but requires re-install on every edit.
- Hardlinks: don't work across filesystems and confuse git.

**Rationale:** Developer workflow benefits outweigh the minor complexity of managing symlinks. A `--copy` flag is available for production/CI contexts.

### 2. Environment variables for target paths

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLAUDE_SKILLS_DIR` | `~/.claude/skills` | Where Claude Code reads skills |
| `CODEX_SKILLS_DIR` | `~/.codex/skills` | Where Codex reads skills |

**Rationale:** Paths are not universally standardized and may change. Env vars let users override without editing scripts. Defaults are based on observed conventions.

### 3. Unified `install.sh` dispatcher

A top-level `scripts/install.sh` accepts a `--target` flag (`claude`, `codex`, `all`) and delegates to the agent-specific scripts. This gives users one entry point.

**Alternatives considered:**
- Only individual scripts: forces users to know which script to run.
- Makefile: adds a dependency and isn't idiomatic for shell-first repos.

### 4. Skill directory structure

```
skills/<skill-name>/
├── SKILL.md          # Required — the skill content
├── scripts/          # Optional — helper scripts the skill references
├── assets/           # Optional — images, templates, static files
└── references/       # Optional — external docs, examples
```

**Rationale:** `SKILL.md` is the contract both agents understand. Subdirectories are optional and gitignored-safe. No metadata files beyond what SKILL.md contains.

### 5. Backup before overwrite

Install scripts check if the target path already exists and is NOT a symlink pointing to this repo. If so, the existing file is moved to `<path>.bak.<timestamp>` before proceeding.

**Rationale:** Users may have hand-edited skills or skills from other sources. Silent overwrites destroy work.

## Risks / Trade-offs

- **[Codex path uncertainty]** → Mitigation: default path is configurable; scripts print the resolved path so users can verify.
- **[Symlink confusion]** → Mitigation: install scripts print whether they created a symlink or a copy, and `ls -la` the result.
- **[Stale symlinks after branch switch]** → Mitigation: document that symlinks point to working tree; switching branches may temporarily break skills.
- **[macOS vs Linux path differences]** → Mitigation: scripts use `$HOME` expansion, no hardcoded `/Users/` paths.
