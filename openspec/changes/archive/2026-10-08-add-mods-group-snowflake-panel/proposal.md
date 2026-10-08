## Why

The repo distributes skills and agents but has nowhere to keep Claude Code mods (plugins built from function hooks that draw panes, bands, status lines, and toasts). The first mod worth keeping is a live view of the SQL that the main session and its subagents send to Snowflake. Right now those queries are visible only by scrolling the transcript or reading each subagent's return, so it is hard to see what `pathfinder` ran against the warehouse while it was running.

## What Changes

- Add a top-level `mods/` directory. Each mod is its own plugin at `mods/<name>/`, with `.claude-plugin/plugin.json`, `hooks/hooks.json`, a hooks module, an optional `types/index.d.ts` state contract, and tests.
- Catalog each mod as its own plugin entry in `.claude-plugin/marketplace.json`, sourced from `mods/<name>`. Mods are Claude Code only, so the Cursor catalog does not list them and the catalog parity rule keeps covering skill groups only.
- Allow a Claude catalog entry's source to be `mods/<name>` as well as `skills/<group>`. The repository root and `agents/` stay forbidden as plugin sources.
- Add the first mod, `snowflake-query-panel`:
  - Hooks `tool.call` for `mcp__snowflake-raw__sql_exec_tool` only.
  - Records each call as a row keyed by `tool_use_id`: running when the call starts, then updated with query id, row count, duration, or error when it finishes.
  - Attributes each row to the main session or to the subagent that ran it, and labels subagents well enough to tell three `pathfinder`s apart.
  - Groups rows by agent, keeps the last 10 queries for the session, and expands a row to its full SQL on click.
  - Opens its pane automatically on the first query, offers a slash command to open it by hand, and shows a toast when the pane waits undrawn because the terminal is too narrow.
  - A summary line sits above the rows, and finished queries stay listed and expandable after everything is done.
- Update `README.md`, `AGENTS.md`, and `docs/` to describe the mods directory, how to install a mod, and how to author one.

## Capabilities

### New Capabilities
- `mod-distribution`: Where mods live in the repo, how they are cataloged and installed, and the checks that keep catalog and directories in agreement.
- `snowflake-query-panel`: The behaviour of the Snowflake query panel mod: what it captures, how it attributes and orders rows, how it is shown, and how it behaves when idle or on a narrow terminal.

### Modified Capabilities
- `skill-install`: "Skill plugins exclude custom agents" allows `mods/<name>` as a Claude catalog source as well as a group directory under `skills/`.
- `repo-scaffold`: README onboarding and repository guidance cover the mods directory and mod installation as well as the three skill groups.

## Impact

- New: `mods/snowflake-query-panel/` (TypeScript hooks module, state contract, tests).
- Modified: `.claude-plugin/marketplace.json` (one new plugin entry), `README.md`, `AGENTS.md`, `docs/` (new mod authoring guide).
- Unchanged: `.cursor-plugin/marketplace.json`, `scripts/`, `agents/`, Codex install. The mod currently installed on this machine is not moved into the repo.
- Runtime dependency: the Claude Code mod engine (`claude plugin validate` / `claude plugin test`) and the `snowflake-raw` MCP server. The mod reads tool results only and never issues its own Snowflake queries.
