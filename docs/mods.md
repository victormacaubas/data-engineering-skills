# Authoring a mod

A mod is a Claude Code plugin that hooks into a session's events and draws its own interface, instead of adding skills. Mods live under `mods/<name>/` and are released as their own plugins in the Claude Code catalog only.

The mod API is early access and may change between Claude Code releases. Re-run the checks below after every Claude Code update.

## One plugin per mod

Each mod is a separate plugin entry. A `hooks.json` names one hooks module, so a mod does one job, and users install, update, and remove mods independently of each other and of the `craft`, `flow`, and `data` skill groups.

A mod's plugin name must not collide with a skill group (`craft`, `flow`, `data`) or with another mod. The name equals the directory name and is kebab-case.

## Package layout

```text
mods/my-mod/
├── .claude-plugin/
│   └── plugin.json      # Required
├── hooks/
│   ├── hooks.json       # Required
│   └── register.tsx     # Required: the module hooks.json names
├── types/
│   └── index.d.ts       # Required when the mod keeps session state
└── *.test.ts            # Tests, run by `claude plugin test`
```

| File | Contents |
|------|----------|
| `.claude-plugin/plugin.json` | `name` (equal to the directory), `description`, and `"types": "./types/index.d.ts"` when the mod keeps state. Omit `version`: an explicit one pins the install cache, so `/plugin` reports "already at the latest version" and skips new commits. Without it the commit SHA is the version. |
| `hooks/hooks.json` | Names one hooks module: `{ "modules": ["./register.tsx"] }`. |
| `hooks/register.tsx` | Exports `register`, typed `Register` from `'claude-code'`. It registers the mod's hooks. |
| `types/index.d.ts` | Declares each `$.state` value the mod reads or writes under `interface PluginState`, keyed by the plugin name. This is the state contract. |
| `*.test.ts` | Tests for the hooks, run by `claude plugin test`. |

## State contract

Everything a mod stores in `$.state` is declared in `types/index.d.ts` under `interface PluginState`, keyed by the plugin name, and named in `plugin.json` as `"types"`. Hooks read and write only declared keys. State lasts for the session and is not persisted.

## Develop locally

Load the mod straight from the checkout:

```bash
claude --plugin-dir mods/my-mod
```

Unlike skill groups, a mod directory is a single plugin root, so `--plugin-dir` works on it directly.

## Validate and test

Run all three checks before release:

```bash
claude plugin validate mods/my-mod
claude plugin test mods/my-mod
tsc -p mods/my-mod
```

- `claude plugin validate` checks `plugin.json`, `hooks.json`, and that the named module exists. It must report no errors.
- `claude plugin test` runs the mod's `*.test.ts` files.
- `tsc -p` type-checks the mod, but only after the engine has loaded it once: loading lays the API types in `<mod>/.claude-plugin/types/` along with a tsconfig that the mod extends. Load the mod (for example with `claude --plugin-dir`) before the first `tsc` run.

Re-run all three after a Claude Code update. A release that changes the mod API shows up here first.

## Add the catalog entry

Add one entry per mod to `.claude-plugin/marketplace.json`:

```json
{
  "name": "my-mod",
  "source": "./mods/my-mod",
  "description": "Claude Code only. What the mod shows or does, and anything it requires.",
  "strict": false
}
```

- `source` is `./mods/<name>`, never the repository root.
- There is no `skills` array; a mod has no skills.
- Do not touch `.cursor-plugin/marketplace.json`. Mods are Claude Code only. Cursor CLI and Codex have no equivalent, and the Cursor fallback installer and the Codex installers do not list or install mods.
- Catalog parity between Claude Code and Cursor CLI covers skill groups only. A mod entry in the Claude catalog is not a parity failure.
- The description says the mod is Claude Code only and names anything it requires, such as an MCP server.

Check that the catalog and `mods/` agree:

- every `mods/<name>/` with a `.claude-plugin/plugin.json` has exactly one Claude catalog entry sourced from it;
- every Claude catalog entry sourced under `mods/` resolves to such a directory;
- no plugin name appears twice in the catalog.

## Install

A user registers the marketplace as for skills, then installs the mod by name:

```text
/plugin marketplace add https://github.com/victormacaubas/data-engineering-skills.git
/plugin install snowflake-query-panel@data-engineering-skills
```

Installing a mod installs only that mod. Marketplace installs are snapshots from Git, so use `/plugin` to refresh the marketplace and update an installed mod after a change.

## Available mods

### `snowflake-query-panel`

Shows the SQL that the main session and its subagents run through the `snowflake-raw` MCP server in a pane. It requires that MCP server.

- It hooks only `mcp__snowflake-raw__sql_exec_tool`.
- The pane opens on the first query of the session. Claude Code draws it automatically from 144 terminal columns, or from 110 once you have opened it yourself. Without fullscreen it sits inline above the prompt.
- `/sql-panel` opens the pane by hand, at any terminal width.
- It groups the last 10 queries by agent. A row expands to show the full SQL.
- A summary line sits above the rows. Finished queries stay listed, so you can expand past SQL after everything is done.
- State is session-only. The mod adds no tokens to the model's context and runs no Snowflake queries of its own.
