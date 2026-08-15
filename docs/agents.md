# Authoring a custom agent

This guide walks through creating a new custom agent for Claude Code and installing it locally.

Custom agents are self-contained markdown files with YAML frontmatter that Claude Code loads as subagents. Unlike skills (which are invocable prompt routines), agents are autonomous task workers — they are spawned by Claude Code or another orchestrator to handle a focused piece of work.

---

## 1. Agent file format

Each agent is a single `.md` file in the `agents/` directory:

```
agents/
└── my-agent.md
```

Agent files are not directories. Claude Code reads agent definitions from individual `.md` files in `~/.claude/agents/`.

## 2. Frontmatter fields

Every agent file starts with YAML frontmatter. The supported fields are:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (kebab-case, matches the filename without `.md`) |
| `description` | Yes | One-sentence description shown in agent lists and used by orchestrators to select the agent |
| `model` | No | Claude model ID, or one of `sonnet`, `opus`, `haiku`, `fable`, `inherit` (e.g. `claude-sonnet-4-6[1m]`). Defaults to the platform default if omitted. |
| `tools` | No | Comma-separated list or YAML list of tools the agent is allowed to use (e.g. `Read, Grep, Glob`). Omit to inherit all. |
| `disallowedTools` | No | Tools to deny, removed from the inherited list. Tool-granular only — it cannot scope a tool to a path. If you already use a `tools:` allowlist, that allowlist is the stronger control and `disallowedTools` adds nothing. |
| `effort` | No | Hint to the runtime about response thoroughness (`low`, `medium`, `high`, `xhigh`, `max`). |
| `skills` | No | YAML list of skill names to **preload**. Injects each skill's full `SKILL.md` body into the agent's context at spawn. Controls preloading, not access: without it an agent can still discover and invoke skills via the `Skill` tool. Don't list `Skill` in `tools` when preloading. |
| `permissionMode` | No | `default`, `acceptEdits`, `auto`, `dontAsk`, `plan`, `manual`, or `bypassPermissions`. The agents in this repo use `acceptEdits`; `bypassPermissions` removes the permission gate entirely and no agent here needs it. |
| `maxTurns` | No | Maximum agentic turns before the agent stops. |
| `memory` | No | Persistent memory scope: `user`, `project`, or `local`. |
| `isolation` | No | `worktree` runs the agent in a temporary git worktree. |
| `mcpServers` | No | MCP servers available to the agent (string reference or inline definition). |
| `hooks` | No | Lifecycle hooks scoped to this agent. |
| `color` | No | Display colour: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. |

### A note on `skills:` and token cost

Preloading is all-or-nothing and happens at spawn, before the agent reads anything. A reference-grade `SKILL.md` can run to several thousand tokens, so listing two of them means the agent pays for both on every invocation even when it only runs one. Prefer one skill per agent, and let the split between agents do the routing. When an agent genuinely needs conditional access to several skills, omit `skills:` and let it invoke them through the `Skill` tool instead, trading a round-trip for the preload.

### Example frontmatter

```yaml
---
name: my-agent
description: Does one focused thing and returns a structured result.
model: claude-sonnet-4-6[1m]
tools: Read, Grep, Glob
effort: high
skills:
  - my-skill
---
```

## 3. Authoring steps

### Step 1: Create the file

Agent names are kebab-case, matching the filename without `.md`:

```bash
touch agents/my-agent.md
```

### Step 2: Write the frontmatter

Add YAML frontmatter at the top. At minimum, include `name` and `description`:

```yaml
---
name: my-agent
description: One sentence describing what this agent does and when to use it.
model: claude-sonnet-4-6[1m]
tools: Read, Grep, Glob
---
```

### Step 3: Write the agent instructions

Below the frontmatter, write markdown-formatted instructions that the agent will follow. A good agent file includes:

- **Role definition** — what the agent is and its scope of responsibility.
- **Input contract** — what the orchestrator will pass and how to interpret it.
- **Method** — the ordered steps the agent should take.
- **Output contract** — the exact format the agent should return.
- **Guardrails** — what the agent must NOT do.

### Example structure

```markdown
---
name: my-agent
description: Explores a target directory and returns a structured summary.
model: claude-sonnet-4-6[1m]
tools: Read, Grep, Glob
---

# my-agent

You are a read-only explorer. Return a structured summary for each target directory.

## Input

Expect a target directory path and an optional focus area.

## Method

1. Inventory the directory.
2. Read key files (README, entry points, config).
3. Synthesise findings.

## Output

Return a structured summary covering architecture, key files, conventions, and open questions.

## Guardrails

- Never write or delete files.
- Never ask the user questions mid-task.
```

### Step 4: Update `agents/README.md`

Add a row to the table in `agents/README.md` with the agent's name, model, and description extracted from the frontmatter.

### Step 5: Install and test

```bash
./scripts/install.sh --platform agents --agents my-agent
```

Verify the symlink:

```bash
ls -la ~/.claude/agents/my-agent.md
# Should show: ... -> /path/to/this/repo/agents/my-agent.md
```

Because the install uses a symlink by default, any edit to the agent file is immediately live — no re-install needed.

## 4. Install instructions

### Default install (symlinks)

```bash
./scripts/install.sh --platform agents --agents all
```

Symlinks each agent `.md` file (excluding `README.md`) into `~/.claude/agents/`.

To choose interactively, run:

```bash
./scripts/install.sh
```

The wizard asks for platform, skill, custom-agent, and install-mode selections. Custom agents are installed for Claude Code only.

### Custom target directory

Override the default path with `CLAUDE_AGENTS_DIR`:

```bash
CLAUDE_AGENTS_DIR=/custom/path ./scripts/install.sh --platform agents --agents all
```

### Copy mode

For CI or environments where symlinks are unavailable:

```bash
./scripts/install.sh --platform agents --agents all --copy
```

### Selective install

```bash
./scripts/install.sh --platform agents --agents pathfinder
./scripts/install.sh --platform claude --skills all --agents pathfinder
./scripts/install.sh --platform both --skills all --agents all
```

When both Claude Code and Codex are selected, selected skills install for both platforms. Selected custom agents install for Claude Code only, and the installer prints a note that Codex custom-agent installation is not supported yet.

The direct helper script remains available:

```bash
./scripts/install-agents.sh --agents all
```

## 5. Naming conventions

| Convention | Example |
|------------|---------|
| Kebab-case filename | `pathfinder.md` |
| Short and task-oriented | `test-runner`, `doc-summariser` |
| Noun or noun-phrase preferred | `pathfinder`, `dependency-auditor` |

Keep names short and self-explanatory — the name and description appear together in Claude Code's agent picker.

## 6. Agents vs skills

| Aspect | Skill (`skills/<name>/SKILL.md`) | Agent (`agents/<name>.md`) |
|--------|----------------------------------|----------------------------|
| Invocation | User types `/skill-name` | Spawned by orchestrator or Claude Code |
| Format | Directory with `SKILL.md` | Single `.md` file |
| Install target | `~/.claude/skills/<name>/` | `~/.claude/agents/<name>.md` |
| Tool restrictions | Inherits platform defaults | Configurable via `tools:` frontmatter |
| Typical use | Interactive prompt routines | Autonomous subtask workers |
