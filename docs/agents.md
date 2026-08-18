# Authoring a custom agent

Custom agents are autonomous workers installed separately from marketplace skills. Every supported agent has a complete Claude Code definition and a complete Cursor CLI definition.

## Source layout

```text
agents/
├── README.md
├── claude/
│   └── my-agent.md
└── cursor/
    └── my-agent.md
```

Agent files are individual markdown files, not directories. The two platform directories must contain the same kebab-case agent-name set. In each file, the frontmatter `name` must match the filename without `.md`.

## Platform frontmatter

Both variants require `name` and `description`. Use only fields supported and intended for that platform.

| Concern | Claude Code variant | Cursor CLI variant |
|---------|---------------------|--------------------|
| Model | Claude Code model identifier or alias | Cursor CLI-supported model identifier |
| Read-only behavior | Claude tool allowlist or denied tools, backed by prompt guardrails | `readonly: true`, backed by prompt guardrails |
| Background behavior | Express in the prompt or a supported Claude field | `is_background` where intended |
| Tool controls | `tools` and other Claude-supported permission fields | Do not copy Claude-only tool allowlists as if Cursor enforced them |
| Skill preload | `skills`, namespaced as `<group>:<skill-name>` | No equivalent field; name the skill in prose, trying the namespaced form then the bare one |
| Effort and permissions | Claude-supported `effort`, `permissionMode`, and related fields | Omit Claude-only controls and state the intended behavior in the prompt |

Parsing the same frontmatter on both platforms is not capability parity. In particular, a read-only Cursor worker must set `readonly: true`; copying a Claude `tools:` allowlist is not an equivalent restriction.

## Authoring steps

1. Create matching files:

   ```bash
   touch agents/claude/my-agent.md agents/cursor/my-agent.md
   ```

2. Give both files the same `name`, task purpose, input contract, method, output contract, and safety intent.
3. Add platform-specific model and capability fields.
4. Adjust prompt text where one platform cannot express the other's tool, permission, model, or preload behavior.
5. Add both variants to `agents/README.md`, including models and intentional platform differences.
6. Install and exercise each variant on its own platform.

Keep the files complete. Do not make one variant include or point to the other, and do not introduce a generated-agent build step.

### Minimal examples

Claude Code:

```yaml
---
name: my-agent
description: Explores a bounded target and returns a structured briefing.
model: sonnet
tools: Read, Grep, Glob
effort: high
---
```

Cursor CLI:

```yaml
---
name: my-agent
description: Explores a bounded target and returns a structured briefing.
model: inherit
readonly: true
is_background: true
---
```

Model values are examples. Use values supported by the target client and document deliberate differences in `agents/README.md`.

## Parity expectations

Matching variants must:

- use the same filename and frontmatter `name`;
- describe the same worker role and output contract;
- preserve the same safety intent with platform-native controls;
- differ only where client capabilities or model semantics require it.

Review both files whenever either changes. Semantic parity does not require identical frontmatter.

## Install agents

Run the interactive agent-only wizard:

```bash
./scripts/install.sh
```

Or call the installer directly:

```bash
./scripts/install-agents.sh --platform claude --agents all
./scripts/install-agents.sh --platform cursor --agents pathfinder,researcher
./scripts/install-agents.sh --platform both --agents my-agent
```

The supported selections are:

```text
--platform claude|cursor|both
--agents all|none|name[,name...]
--copy
```

The default mode creates symlinks. `--copy` copies files instead. Existing non-repository targets are backed up with a `.bak.<timestamp>` suffix, and unselected agents are left alone.

Default targets:

| Platform | Source | Target | Override |
|----------|--------|--------|----------|
| Claude Code | `agents/claude/` | `~/.claude/agents/` | `CLAUDE_AGENTS_DIR` |
| Cursor CLI | `agents/cursor/` | `~/.cursor/agents/` | `CURSOR_AGENTS_DIR` |

Example overrides:

```bash
CLAUDE_AGENTS_DIR=/custom/claude/agents \
  ./scripts/install-agents.sh --platform claude --agents my-agent

CURSOR_AGENTS_DIR=/custom/cursor/agents \
  ./scripts/install-agents.sh --platform cursor --agents my-agent
```

For `--platform both`, the installer checks that every selected name has both variants before changing either target.

## Verify an agent

Check both source sets and frontmatter names, then install into temporary targets:

```bash
comm -3 \
  <(printf '%s\n' agents/claude/*.md | xargs -n1 basename | sort) \
  <(printf '%s\n' agents/cursor/*.md | xargs -n1 basename | sort)

tmp_dir="$(mktemp -d)"
CLAUDE_AGENTS_DIR="$tmp_dir/claude" \
CURSOR_AGENTS_DIR="$tmp_dir/cursor" \
  ./scripts/install-agents.sh --platform both --agents my-agent

ls -la "$tmp_dir/claude/my-agent.md" "$tmp_dir/cursor/my-agent.md"
```

The `comm` command should print nothing. Also inspect each file's `name:` field and run the worker in both clients. A successful parse alone does not prove equivalent permissions or behavior.

Symlink installs reflect source edits immediately. Rerun the installer after changes when using copy mode.

## Agents and skills

| Aspect | Marketplace skill | Custom agent |
|--------|-------------------|--------------|
| Source | `skills/<group>/<name>/` | `agents/claude/<name>.md` and `agents/cursor/<name>.md` |
| Distribution | One of three Git-backed domain plugins | Repository installer |
| Package contents | A group's skills and their local supporting files | One platform-specific agent definition |
| Invocation | `/<group>:<skill-name>` | Dispatched by name |
| Updates | Explicit through `/plugin` | Live for symlinks; reinstall copies |

If a skill dispatches an agent, its group's marketplace description and the root README must name that separate prerequisite. The plugin must not package the repository's agent definitions.

### Preloading a skill into an agent

Claude Code namespaces plugin skills, so a `skills:` preload names the plugin as well:

```yaml
skills:
  - craft:structure-review
```

Two rules follow, and both are easy to get wrong because neither fails loudly:

- **Verify a preload by running the agent, not by launching it.** An unresolvable preload is skipped with a debug-log warning; the agent starts normally and produces output, just without the skill. A clean launch proves nothing.
- **A skill's group is part of the identifier.** Regrouping a skill breaks every agent that preloads it, silently. Treat it as a breaking change with its own tracked change, and update the preloads in the same commit.

Cursor CLI has no `skills` frontmatter field, so its variants name the skill in prose instead and try both forms — the namespaced one for a marketplace install, the bare one for a skill installed by `scripts/install-cursor-skills.sh`, which writes a flat, unprefixed target.

Current preloads: `implementer` → `craft:python-engineering-standards`, `code-auditor` → `craft:code-audit`, `structure-reviewer` → `craft:structure-review`.
