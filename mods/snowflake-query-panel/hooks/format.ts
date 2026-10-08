import type { QueryRow } from '../types'

export type AgentGroup = { agentKey: string; rows: QueryRow[] }

const MIN_SQL_CHARS = 12

const SHORT_AGENT_ID_CHARS = 6

export const fallbackAgentLabel = (agentKey: string): string =>
  `agent ${agentKey.slice(0, SHORT_AGENT_ID_CHARS)}`

export const oneLine = (sql: string): string => sql.replace(/\s+/g, ' ').trim()

export const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text

export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`

export const formatCount = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`

export function outcomeParts(row: QueryRow): string[] {
  if (row.status === 'running') {
    return ['running']
  }

  return [
    row.durationMs === undefined ? '' : formatDuration(row.durationMs),
    row.rowCount === undefined ? '' : formatCount(row.rowCount, 'row'),
  ].filter(part => part !== '')
}

const GLYPHS = { running: '◌', succeeded: '✓', failed: '✗' } as const
const SEPARATOR = ' · '

// Snowflake query ids share a time-based prefix, so the row carries the whole
// id; the SQL hint after it is what tells rows apart at a glance.
export function rowLabel(row: QueryRow, width: number, isOpen = false): string {
  const head = [
    `${isOpen ? '▾' : '▸'} ${GLYPHS[row.status]} ${outcomeParts(row).join(SEPARATOR)}`.trimEnd(),
    ...(row.queryId === undefined ? [] : [row.queryId]),
  ].join(SEPARATOR)
  const room = width - head.length - SEPARATOR.length
  if (room < MIN_SQL_CHARS) {
    return truncate(head, width)
  }

  return `${head}${SEPARATOR}${truncate(oneLine(row.sql), room)}`
}

export function summaryLine(rows: QueryRow[]): string {
  const last = rows[rows.length - 1]
  if (last === undefined) {
    return 'Snowflake · no queries yet'
  }
  const total = `Snowflake · ${formatCount(rows.length, 'query', 'queries')}`
  const running = rows.filter(row => row.status === 'running').length
  if (running > 0) {
    return `${total} · ${running} running`
  }
  const outcome =
    last.status === 'failed' ? 'failed' : ['ok', ...outcomeParts(last)].join(' ')

  return `${total} · last: ${outcome}`
}

export function groupByAgent(rows: QueryRow[]): AgentGroup[] {
  const groups = new Map<string, QueryRow[]>()
  for (const row of [...rows].reverse()) {
    groups.set(row.agentKey, [...(groups.get(row.agentKey) ?? []), row])
  }

  return [...groups].map(([agentKey, grouped]) => ({ agentKey, rows: grouped }))
}
