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
const GLYPH_COLORS = { running: 'warning', succeeded: 'success', failed: 'error' } as const
const SEPARATOR = ' · '
const ARROW_WIDTH = 2
const GAP_WIDTH = 1

export type StatusStyle = { color?: 'success' | 'error' | 'warning'; dimColor?: true; bold?: true }
export type StatusPiece = { text: string; style: StatusStyle }

export function statusPieces(row: QueryRow): StatusPiece[] {
  const glyph: StatusPiece = {
    text: GLYPHS[row.status],
    style: row.status === 'failed' ? { color: GLYPH_COLORS.failed, bold: true } : { color: GLYPH_COLORS[row.status] },
  }
  const detail = outcomeParts(row).join(SEPARATOR)

  return detail === '' ? [glyph] : [glyph, { text: ` ${detail}`, style: { dimColor: true } }]
}

export const statusWidth = (pieces: StatusPiece[]): number =>
  pieces.reduce((total, piece) => total + piece.text.length, 0)

export function sqlLabel(sql: string, room: number, isOpen = false): string {
  if (room < 1) {
    return ''
  }

  return truncate(`${isOpen ? '▾' : '▸'} ${oneLine(sql)}`, room)
}

export function rowParts(row: QueryRow, width: number, isOpen = false): { label: string; status: StatusPiece[] } {
  const full = statusPieces(row)
  const fits = width - statusWidth(full) - GAP_WIDTH - ARROW_WIDTH >= MIN_SQL_CHARS
  const status = fits ? full : full.slice(0, 1)

  return { label: sqlLabel(row.sql, width - statusWidth(status) - GAP_WIDTH, isOpen), status }
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
