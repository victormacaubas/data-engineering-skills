## 1. Mod scaffold

- [x] 1.1 Create `mods/snowflake-query-panel/` with `.claude-plugin/plugin.json` (name, version `0.1.0`, description, `"types": "./types/index.d.ts"`) and `hooks/hooks.json` naming `./register.tsx`. Verify both files parse as JSON and the plugin `name` matches the directory.
- [x] 1.2 Write `types/index.d.ts` declaring `rows`, `agentLabels`, `expanded`, and `toastShown` under `snowflake-query-panel` in `PluginState`. Verify by running `claude plugin validate mods/snowflake-query-panel` once the module exists (2.1).

## 2. Capture and state

- [x] 2.1 Implement the `tool.call` hook on `mcp__snowflake-raw__sql_exec_tool`. It adds a running row keyed by `tool_use_id` (functional update, cap of ten applied on add), awaits `next(e)`, updates the row in `finally`, and always returns `next`'s result unchanged. Verify `claude plugin validate` reports no errors.
- [x] 2.2 Parse the outcome from the tool result (query id, `numRows`, duration from `$.clock`, error first line), degrading to "succeeded" without a count when parsing fails. Verify with a test covering a success, an error result, and an unparseable result.
- [x] 2.3 Resolve agent labels once per `agentId` through `$.agent.list()` (`main` when absent, `agent <id6>` when unlisted) and cache them in state. Verify with a test where three `pathfinder` loops with different descriptions get three distinct labels.
- [x] 2.4 Add a concurrency test: three agents with overlapping calls that finish out of order, plus an eleventh query evicting the first and the evicted row's late completion being ignored. Verify `claude plugin test mods/snowflake-query-panel` passes.

## 3. Pane and command

- [x] 3.1 Open the `snowflake` pane on the first captured query of the session, and show one toast per session when `isPlaced` is false. Verify with a test that answers `ui.open` with `isPlaced: false` and asserts exactly one toast across two queries.
- [x] 3.2 Register the slash command in `session.start` and open the pane from its `command.run` handler, returning no `text` or `context` so nothing reaches the model. Record the public command name the engine actually registers, and use it in the toast text. Verify with a test that runs the command and asserts the pane opens.
- [x] 3.3 Implement the `ui.render` hook for `{ component: "Pane", requestId: "snowflake" }`: a summary line above grouped rows, kept when idle so past queries stay expandable (agents ordered by most recent query, rows newest first, SQL truncated to one line). Verify with a test that asserts each view's output as a query starts and finishes.
- [x] 3.4 Make each query row a Button that toggles its `tool_use_id` in `expanded` and shows the full SQL when expanded. Verify with a test that presses a row twice and asserts expand then collapse.
- [x] 3.5 Type-check with `tsc -p mods/snowflake-query-panel` after the engine has laid the types, and verify no errors.

## 4. Catalog and docs

- [x] 4.1 Add a `snowflake-query-panel` entry to `.claude-plugin/marketplace.json` with `source: "./mods/snowflake-query-panel"`, and leave `.cursor-plugin/marketplace.json` unchanged. Verify both catalogs are valid JSON, skill-group parity still holds, every `mods/*` directory has exactly one entry, and no plugin name repeats.
- [x] 4.2 Write `docs/mods.md`: layout, required files, state contract, `claude plugin validate`/`test`/`tsc -p`, the catalog entry, `/plugin install <mod>@data-engineering-skills`, and re-checking after Claude Code updates. Verify it covers every item in the "Mod authoring documentation" requirement.
- [x] 4.3 Update `README.md`: the directory structure shows `mods/`, and the Claude Code install subsection has a mods table and install command noting that mods are Claude Code only. Verify against the "New user installs a mod" scenario.
- [x] 4.4 Update `AGENTS.md`: add `mods/<name>/` to the directory layout and a short "Mod authoring" section (one plugin per mod, Claude catalog only, parity covers skills only, link to `docs/mods.md`). Verify against the "Coding agent opens the repository" scenario.

## 5. End-to-end check

- [x] 5.1 Load the mod in a live session (hot reload or `claude --plugin-dir mods/snowflake-query-panel`). Run one main-session query and dispatch two `pathfinder` subagents that each run two queries. Confirm the pane opens (or the toast appears at about 110 columns, then `/sql-panel` opens it), rows group by agent with the right statuses, a row expands, and finished queries stay listed and expandable under the summary line.
- [x] 5.2 Run `openspec validate add-mods-group-snowflake-panel --strict` and verify it passes.
