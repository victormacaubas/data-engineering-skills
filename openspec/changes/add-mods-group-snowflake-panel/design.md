## Context

See proposal.md for why. Constraints that shape the approach:

- A mod is a Claude Code plugin whose `hooks/hooks.json` names one hooks module. That module exports `register(on, options)` and runs in a sandbox with no DOM and no Node. Everything outside the sandbox goes through `$`.
- A `tool.call` hook for `mcp__snowflake-raw__sql_exec_tool` receives `e.input.sql`, `e.tool_use_id`, and `e.agentId`. `agentId` is absent on the main loop and set to the subagent's loop id otherwise. Awaiting `next(e)` gives the tool's result.
- The snowflake-raw tool answers with JSON that carries `query_id`, `statementHandle`, and `result_set.resultSetMetaData.numRows` (checked against the live server during scouting).
- Pane placement depends on the terminal. A pane the mod opens on its own is drawn only at 144+ columns. After the person has opened it once themselves, that drops to 110. A pane opened from the person's command is drawn at any width. Without the fullscreen transcript, a pane sits inline above the prompt, not docked beside the transcript. The user runs a non-fullscreen terminal at about 110 columns, so the inline placement is the one to design for.
- The Claude catalog today has three entries, all sourced from `skills/<group>`. No validation script exists. Parity checks are run by hand during OpenSpec work.

## Goals / Non-Goals

**Goals:**
- Show the panel without the mod ever changing, failing, or slowing a Snowflake call beyond the time it takes to record it.
- Keep the inline pane short enough that it does not crowd the conversation at about 110 columns.

**Non-Goals:**
- Blocking or rewriting statements that write (DML/DDL).
- History across sessions, or showing queries from other sessions.
- Capturing SQL sent any way other than the snowflake-raw tool (`snow sql`, `snowsql`, other MCP servers).
- A script that validates the catalogs. Checks stay manual, as for skills today.
- Docking beside the transcript. If the person turns on fullscreen it happens anyway, with no work from the mod.

## Decisions

**One plugin per mod, under `mods/<name>/`.** Each mod gets its own catalog entry. The alternative was one `mods` plugin holding every mod. Rejected because a plugin's `hooks.json` names a single module, and because separate entries let a person install the query panel without taking a later, unrelated mod. Cost: one catalog entry per mod.

**Mods appear in the Claude catalog only.** Cursor and Codex have no hooks-module engine, so a Cursor entry would install nothing that works. The parity rule is narrowed to skill groups rather than worked around with an empty Cursor entry.

**Recording wraps the call; it never stands in for it.** The hook adds a running row, awaits `next(e)`, then updates the row in a `finally` block, and always returns `next`'s result unchanged. Recording errors are caught inside the hook and logged with `$.ui.log(..., { to: "debug" })`. Otherwise a bug in drawing code could become a failed query for the agent. A deny or an engine error from `next` marks the row failed and is re-thrown or returned exactly as received.

**Rows keyed by `tool_use_id`, written by functional update.** State is one atom holding an ordered list of rows. Every write is `update($, rows, fn)` against the current value, never a read followed by a write, so two calls finishing in the same tick cannot overwrite each other. The completion update looks its row up by id. A row already evicted by the cap is skipped silently, which covers a long query that outlives ten newer ones. Rejected: keying by position or by "the latest running row", because queries finish out of order.

**Cap of ten counted by start order.** The cap is applied when a row is added, so the list never holds more than ten. Grouping is a view over the capped list: agents appear in the order of their most recent query, and rows inside a group appear newest first.

**Agent label resolved once per agent id at call start.** On the first call from an unseen `agentId`, the hook reads `$.agent.list()`, finds the row by `id`, and caches `type · name-or-description` in state. An id that is not listed (workflow agents, engine forks) is labelled `agent <first 6 of id>`. A missing `agentId` is labelled `main`. The label is resolved at call start, so a subagent that has finished by the time the row is drawn still has its name.

**Outcome parsed defensively from the tool result.** The hook reads the MCP text content as JSON and takes `query_id`, then `numRows`. If parsing fails or a field is missing, the row is still marked succeeded, without the count or id. An error result (`isError`) records the first line of its text, up to about 200 characters. Rejected: issuing `last_query_id()` or a `QUERY_HISTORY` lookup. That would put the mod's own queries on the warehouse, and the spec forbids it.

**Duration measured by the mod.** Start time is taken from `$.clock` before `next(e)` and end time after it. It includes MCP transport time, which is the wait the agent actually saw. That is the useful number here; the Snowflake execution time is not.

**Pane lifecycle.** On the first captured query of the session, the hook calls `$.ui.open({ id: "snowflake", title: "Snowflake" })`. When the result is `isPlaced: false`, it shows one toast for the session ("Snowflake panel waiting: widen the terminal or run /<command>"), not one per query. A `session.start` hook registers the slash command, and its `command.run` handler opens the same id. That counts as the person's own request, so the pane is drawn at any width, and later automatic opens get the 110 threshold.

**One view with a summary line on top.** The `ui.render` hook always draws a dim summary line (`Snowflake · 7 queries · 2 running`, or `· last: ok 0.8s 12 rows` / `· last: failed` once idle) above the grouped rows. The first build collapsed to the summary line alone when idle; the live test showed that hid every finished query, which made past SQL impossible to inspect, so finished rows stay listed and expandable. Agent headers are not interactive. Each query row is a Button reading `▸ ✓ 9.1s · 1 row · <full query id> · <SQL hint>`: an open/closed arrow, status glyph, duration, row count, the whole query id, then the SQL collapsed to one line and cut to the width left. The id is shown whole because Snowflake ids share a time-based prefix, so a shortened id does not tell queries apart (the first build's 8-character id showed the same value on four of five rows in the live test). Pressing the row toggles its `tool_use_id` in an `expanded` set held in state, and an expanded row shows only the full SQL wrapped below it, since the line above already carries the rest. Rejected: making agent groups collapsible as well. With ten rows at most, a second level of toggles adds keystrokes and little else.

**State contract.** `types/index.d.ts` declares `rows`, `agentLabels`, `expanded`, and `toastShown` under the mod's name in `PluginState`, as `claude plugin validate` requires.

**Tests with `claude plugin test`.** One `*.test.ts` drives the hook through simulated `tool.call` events. It covers: three agents with overlapping calls finishing out of order; an error result; an unparseable result; an eleventh query evicting the first, and the evicted row's late completion being ignored; the summary-line and grouped views switching; and expand/collapse.

## Risks / Trade-offs

- [The mod API is new and may change between Claude Code builds] → Pin behaviour with `claude plugin validate`, `tsc -p`, and `claude plugin test` in the tasks, and document re-running them after a Claude Code update in the mod guide.
- [The inline pane takes rows from the conversation at about 110 columns] → Request a small `rows` height, cap the list at ten, and truncate SQL to one line until expanded.
- [SQL literals can contain sensitive values, and the pane shows them] → They are already in the transcript of the same local session. The mod stores nothing past the session and sends nothing anywhere.
- [The snowflake-raw response shape changes] → Parsing is defensive, and a row degrades to "succeeded" without a count rather than failing.
- [A plugin slash command may be namespaced by the engine] → The toast text and the README use the name the engine actually registers, confirmed while implementing (see Open Questions).

## Migration Plan

Purely additive. Users get the mod with `/plugin install snowflake-query-panel@data-engineering-skills` after updating the marketplace. Rollback is `/plugin uninstall` or reverting the catalog entry. Skill groups, agents, and the Cursor and Codex installs are untouched.

## Open Questions

- ~~What the engine registers as the slash command's public name.~~ Resolved during implementation: the engine registers it unprefixed. Named `/sql-panel` (renamed from `/sql`, which read as too broad).
- Whether the docked placement (fullscreen) sits to the right of the transcript. It does not affect this change, because the user's setup draws the pane inline.
