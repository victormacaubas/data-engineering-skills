import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { QueryRow } from '../types'
import { fallbackAgentLabel, formatCount, groupByAgent, oneLine, rowLabel, summaryLine, truncate } from './format'
import { firstLine, outcomeOf } from './outcome'
import type { Outcome } from './outcome'

const PLUGIN = 'snowflake-query-panel'
const SQL_TOOL = 'mcp__snowflake-raw__sql_exec_tool'
const PANE_ID = 'snowflake'
const PANE_TITLE = 'Snowflake'
const PANE_ROWS = 6
const COMMAND = 'sql-panel'
const MAIN = 'main'
const MAX_ROWS = 10
const DEFAULT_COLUMNS = 100
const ROW_INDENT = 2

const rows = atom({ plugin: 'snowflake-query-panel', key: 'rows' } as const, [])
const agentLabels = atom({ plugin: 'snowflake-query-panel', key: 'agentLabels' } as const, {})
const expanded = atom({ plugin: 'snowflake-query-panel', key: 'expanded' } as const, [])
const toastShown = atom({ plugin: 'snowflake-query-panel', key: 'toastShown' } as const, false)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const sqlOf = (e: Record<string, unknown>): string => {
  if (typeof e.sql === 'string') {
    return e.sql
  }

  return isRecord(e.input) && typeof e.input.sql === 'string' ? e.input.sql : ''
}

async function quietly<T>($: EngineInterface, work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    $.ui.log(`${PLUGIN}: recording failed: ${reason}`, { to: 'debug' })

    return undefined
  }
}

async function cacheAgentLabel($: EngineInterface, agentKey: string): Promise<void> {
  if ((await read($, agentLabels))[agentKey] !== undefined) {
    return
  }
  const listed = agentKey === MAIN ? undefined : (await $.agent.list()).find(a => a.id === agentKey)
  const label =
    agentKey === MAIN
      ? MAIN
      : listed === undefined
        ? fallbackAgentLabel(agentKey)
        : `${listed.type} · ${listed.name || listed.description}`
  await update($, agentLabels, labels => ({ ...labels, [agentKey]: label }))
}

const openPane = ($: EngineInterface) =>
  $.ui.open({ id: PANE_ID, title: PANE_TITLE, rows: PANE_ROWS })

async function openOnFirstQuery($: EngineInterface): Promise<void> {
  const opened = await openPane($)
  if (opened.isPlaced || (await read($, toastShown))) {
    return
  }
  await update($, toastShown, () => true)
  $.ui.toast(`Snowflake panel waiting: widen the terminal or run /${COMMAND}`)
}

async function addRunningRow($: EngineInterface, row: QueryRow): Promise<void> {
  await quietly($, () => cacheAgentLabel($, row.agentKey))
  const held = await update($, rows, list => [...list, row].slice(-MAX_ROWS))
  if (held.length === 1) {
    await openOnFirstQuery($)
  }
}

const finishRow = ($: EngineInterface, id: string, outcome: Outcome, durationMs?: number) =>
  update($, rows, list =>
    list.map((row): QueryRow => {
      if (row.id !== id) {
        return row
      }

      return outcome.status === 'failed'
        ? { ...row, status: 'failed', durationMs, error: outcome.error }
        : { ...row, status: 'succeeded', durationMs, queryId: outcome.queryId, rowCount: outcome.rowCount }
    }),
  )

const toggle = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id]

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await quietly($, () =>
      $.command.register({
        name: COMMAND,
        description: 'Open the Snowflake query panel',
      }),
    )

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await openPane($)

    return {}
  })

  on('tool.call', { tool: SQL_TOOL }, async ($, e, next) => {
    const id = e.tool_use_id
    const row: QueryRow = { id, agentKey: e.agentId ?? MAIN, sql: sqlOf(e), status: 'running' }
    await quietly($, () => addRunningRow($, row))

    const startedAt = await quietly($, () => $.clock.now())
    let outcome: Outcome = { status: 'failed', error: 'Query did not complete' }
    try {
      const ran = await next(e)
      outcome = outcomeOf(ran)

      return ran
    } catch (error) {
      outcome = { status: 'failed', error: firstLine(error instanceof Error ? error.message : String(error)) }
      throw error
    } finally {
      await quietly($, async () => {
        const endedAt = await $.clock.now()
        const durationMs = startedAt === undefined ? undefined : endedAt - startedAt
        await finishRow($, id, outcome, durationMs)
      })
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const labels = await read($, agentLabels)
    const openIds = await read($, expanded)
    const width = (e.props.bodyColumns || e.viewport?.columns) ?? DEFAULT_COLUMNS

    return (
      <Box flexDirection="column">
        <Text dimColor>{truncate(summaryLine(list), width)}</Text>
        {groupByAgent(list).map(group => (
          <Box flexDirection="column">
            <Text bold>
              {labels[group.agentKey] ?? fallbackAgentLabel(group.agentKey)} · {formatCount(group.rows.length, 'query', 'queries')}
            </Text>
            {group.rows.map(row => (
              <Box flexDirection="column" paddingLeft={ROW_INDENT}>
                <Button
                  key={`row:${row.id}`}
                  plain
                  label={rowLabel(row, width - ROW_INDENT, openIds.includes(row.id))}
                  onPress={() => update($, expanded, ids => toggle(ids, row.id))}
                />
                {row.status === 'failed' && (
                  <Text color="error" wrap="wrap">
                    {openIds.includes(row.id) ? row.error : truncate(oneLine(row.error ?? ''), width - ROW_INDENT)}
                  </Text>
                )}
                {openIds.includes(row.id) && <Text wrap="wrap">{row.sql}</Text>}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
