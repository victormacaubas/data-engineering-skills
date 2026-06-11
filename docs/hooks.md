# Authoring a hook plugin

This guide walks through creating a new hook plugin for Claude Code and distributing it through this repo's marketplace.

Hooks in Claude Code fire on lifecycle events (tool calls, notifications, session start, etc.) and execute shell commands in response. Unlike skills and agents, hooks must be registered in `settings.json` to take effect — Claude Code provides a sanctioned alternative: distributing hooks as **plugins** through a **marketplace**, so users install them with `/plugin install` and never hand-edit `settings.json`.

---

## 1. Distribution model

This repo uses two parallel distribution channels:

| Artifact | Channel | Install command |
|----------|---------|-----------------|
| Skills | Symlink/copy via `scripts/install.sh` | `./scripts/install.sh --skills all` |
| Agents | Symlink/copy via `scripts/install-agents.sh` | `./scripts/install.sh --platform agents` |
| **Hooks** | **Claude Code marketplace** | `/plugin marketplace add victormacaubas/data-engineering-skills` |

Hooks ship as **plugins** — self-contained directories under `plugins/`. The repo-root `.claude-plugin/marketplace.json` catalogs them. When a user adds the marketplace and installs a plugin, Claude Code registers its hooks automatically. No script in this repo ever reads or writes `settings.json`.

The install scripts (`scripts/install*.sh`) are **not modified** to handle plugins. The two distribution channels are intentionally separate.

---

## 2. Plugin directory layout

Each plugin lives under `plugins/<name>/`:

```
plugins/
└── <plugin-name>/
    ├── .claude-plugin/
    │   └── plugin.json      # Required — plugin manifest
    └── hooks/
        └── hooks.json       # Hook configuration (if the plugin ships hooks)
```

A hooks-only plugin needs only these two files. Future plugins may also include `skills/`, `agents/`, or `mcp/` subdirectories — Claude Code resolves each component type from its conventional location inside the plugin directory.

### `plugin.json` — the manifest

Minimum required fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Plugin identifier (kebab-case, matches the directory name) |
| `version` | No | Semver string, e.g. `"1.0.0"` |
| `description` | No | One-sentence description of what the plugin does |
| `author` | No | Object with a `name` field, e.g. `{ "name": "victormacaubas" }` |

Example:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does and when it fires.",
  "author": { "name": "victormacaubas" }
}
```

### `hooks/hooks.json` — hook configuration

The `hooks` object has the same shape as the `hooks` block in `settings.json`. Each key is a hook event name; each value is an array of matchers, each with a `hooks` array of actions.

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "<shell command>" }
        ]
      }
    ]
  }
}
```

The `matcher` field filters which tool calls trigger the hook (for `PreToolUse`/`PostToolUse`); use `""` to match everything. For event-only hooks like `Notification`, the matcher is ignored.

---

## 3. Valid hook event names

Claude Code supports the following hook events:

| Event | Fires when |
|-------|-----------|
| `PreToolUse` | Before Claude calls a tool |
| `PostToolUse` | After a tool call completes |
| `Notification` | Claude Code emits a notification (needs your attention) |
| `Stop` | The main Claude process ends |
| `SubagentStop` | A subagent process ends |
| `SessionStart` | A new Claude Code session begins |
| `UserPromptSubmit` | The user submits a prompt |

Use the exact casing above — hook event names are case-sensitive.

---

## 4. Using `${CLAUDE_PLUGIN_ROOT}` in hook commands

When a hook needs to run a companion script that ships with the plugin, reference the script relative to the plugin root using the `${CLAUDE_PLUGIN_ROOT}` variable. Claude Code substitutes the absolute path to the plugin's installed directory at runtime.

Example — a hook that runs a bundled Python script:

```json
{
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/notify.py"
}
```

The `notifications` plugin does not need this — its `osascript` command is fully inline and has no companion file. Use `${CLAUDE_PLUGIN_ROOT}` only when the command references a file inside the plugin directory.

---

## 5. macOS-only caveat (osascript)

The `notifications` plugin uses `osascript` to display desktop notifications. **`osascript` is macOS-only.** On Linux or Windows the command will fail silently or produce an error. The hook is intentionally scoped to macOS for v1; cross-platform variants (e.g. `notify-send` on Linux) are a future concern.

If you are not on macOS, skip installing the `notifications` plugin or wrap the command in a platform guard:

```bash
[[ "$(uname)" == "Darwin" ]] && osascript -e '...'
```

---

## 6. Adding a new plugin to the marketplace

### Step 1: Create the plugin directory

```
plugins/
└── my-plugin/
    ├── .claude-plugin/
    │   └── plugin.json
    └── hooks/
        └── hooks.json
```

### Step 2: Write `plugin.json`

Set at minimum `name` (must match the directory name). Add `version`, `description`, and `author` for discoverability.

### Step 3: Write `hooks/hooks.json`

Add the events and commands. Validate with:

```bash
python3 -m json.tool plugins/my-plugin/hooks/hooks.json
```

### Step 4: Register the plugin in `.claude-plugin/marketplace.json`

Add an entry to the `plugins` array:

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin",
  "description": "What this plugin does."
}
```

The `source` **must start with `./`** and is resolved relative to the marketplace root (the directory containing `.claude-plugin/`), so `"./plugins/my-plugin"` points to `plugins/my-plugin/`. A bare string without the leading `./` is not recognized as a relative-path source and will fail to install.

### Step 5: Validate

```bash
claude plugin validate ./plugins/my-plugin
```

### Step 6: Verify JSON integrity

```bash
python3 -m json.tool plugins/my-plugin/.claude-plugin/plugin.json
python3 -m json.tool plugins/my-plugin/hooks/hooks.json
python3 -m json.tool .claude-plugin/marketplace.json
```

---

## 7. User install flow

After a plugin is published to the repo, users install it as follows:

**Add the marketplace once:**

```
/plugin marketplace add victormacaubas/data-engineering-skills
```

**Install a specific plugin:**

```
/plugin install notifications@data-engineering-skills
```

**Refresh all installed plugins after a `git pull`:**

```
/plugin marketplace update
```

There is no equivalent to the skills `./scripts/install.sh` for plugins — the `/plugin` commands in Claude Code are the install path.

---

## 8. Hooks vs skills vs agents

| Aspect | Skill | Agent | Hook plugin |
|--------|-------|-------|-------------|
| Invocation | User types `/skill-name` | Spawned by orchestrator | Fires automatically on lifecycle event |
| Format | Directory with `SKILL.md` | Single `.md` file | `plugins/<name>/` with manifest + hooks.json |
| Install | `scripts/install.sh` (symlink) | `scripts/install-agents.sh` (symlink) | `/plugin install` via marketplace |
| Settings | No `settings.json` needed | No `settings.json` needed | Registered via `/plugin`, never hand-edited |
| Platform | Claude Code + Codex | Claude Code | Claude Code only |
