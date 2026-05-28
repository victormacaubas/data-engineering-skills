## Context

The repo houses two categories of AI tooling: **skills** (invocable prompt routines in `skills/`) and **agents** (custom agent definitions in `agents/`). Skills have full install automation and documentation; agents have neither. There is currently one agent (`codebase-explorer.md`) deployed manually. Claude Code expects custom agents at `~/.claude/agents/<name>.md`.

## Goals / Non-Goals

**Goals:**
- Provide a single-command installer for agents, consistent with the existing skill install UX.
- Document agents so users can discover, understand, and contribute them.
- Integrate agent install into the existing `scripts/install.sh` dispatcher.

**Non-Goals:**
- Codex custom-agent installer support. Codex has its own subagent/custom-agent system using files under `~/.codex/agents/` or project-scoped `.codex/agents/`; this change only targets Claude Code markdown agents under `~/.claude/agents/`.
- Agent versioning or registry beyond what git provides.
- Runtime agent management (start/stop/configure) — that's Claude Code's responsibility.

## Decisions

### 1. Agent file format: single `.md` per agent (not a directory)

**Rationale:** Unlike skills which can bundle `references/`, `scripts/`, and `assets/`, Claude Code agents are self-contained markdown files with YAML frontmatter. A flat file structure (`agents/<name>.md`) is simpler and matches how Claude Code loads them. If an agent later needs supporting files, we can introduce an `agents/<name>/` directory convention at that time.

**Alternative considered:** Directory-per-agent mirroring `skills/<name>/SKILL.md`. Rejected because it adds structural overhead for no current benefit — agents are single files.

### 2. Symlink individual files, not the directory

**Rationale:** Symlinking `~/.claude/agents/<name>.md → repo/agents/<name>.md` allows selective installs and avoids deploying the `agents/README.md` or any future non-agent files into the target directory.

**Alternative considered:** Symlinking the entire `agents/` directory. Rejected because it would install `README.md` and any other non-agent files.

### 3. Target directory: `~/.claude/agents/`

**Rationale:** This is where Claude Code looks for custom agent definitions. Overridable via `CLAUDE_AGENTS_DIR` environment variable, consistent with `CLAUDE_SKILLS_DIR`.

### 4. Dispatcher integration: new `--target agents` option

**Rationale:** The existing `scripts/install.sh` dispatches to `install-claude.sh` and `install-codex.sh`. Adding `--target agents` keeps the single-entry-point UX. The `all` target will include agents alongside skills.

### 5. Documentation mirrors skill docs structure

**Rationale:** `docs/agents.md` parallels `docs/authoring.md`. The root README gains an "Agents" table like the "Skills" table. This keeps the repo self-documenting with consistent patterns.

## Risks / Trade-offs

- **[Agent directory convention may change]** → Claude Code is evolving; the `~/.claude/agents/` path may shift. Mitigation: the path is configurable via env var, and a single script change updates all users.
- **[`install.sh --target all` now does more]** → Users who run `install.sh` expecting only skills will now also get agents. Mitigation: acceptable since `all` means "everything in the repo." Print a clear summary of what was installed.
- **[Single-file agents may outgrow the format]** → If agents need supporting files later, the flat-file convention breaks. Mitigation: document that directory-based agents are a future possibility; for now, the format matches Claude Code's expectations.
