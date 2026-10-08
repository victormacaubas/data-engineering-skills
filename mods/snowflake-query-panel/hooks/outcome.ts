import type { ToolCallResult } from 'claude-code'

export type Outcome =
  | { status: 'succeeded'; queryId?: string; rowCount?: number }
  | { status: 'failed'; error: string }

const ERROR_MAX_CHARS = 200

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function firstLine(text: string, max = ERROR_MAX_CHARS): string {
  const line = text.trim().split('\n')[0] ?? ''

  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (isRecord(value) && Array.isArray(value.content)) {
    const texts = value.content.flatMap((block: unknown) =>
      isRecord(block) && block.type === 'text' && typeof block.text === 'string'
        ? [block.text]
        : [],
    )

    return texts.length > 0 ? texts.join('\n') : undefined
  }

  return undefined
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function payloadOf(ran: ToolCallResult): unknown {
  const text = ran.text ?? textOf(ran.result)

  return text === undefined ? ran.result : parseJson(text)
}

function succeeded(payload: unknown): Outcome {
  if (!isRecord(payload)) {
    return { status: 'succeeded' }
  }
  const meta = isRecord(payload.result_set) ? payload.result_set.resultSetMetaData : undefined
  const numRows = isRecord(meta) ? meta.numRows : undefined

  return {
    status: 'succeeded',
    ...(typeof payload.query_id === 'string' && { queryId: payload.query_id }),
    ...(typeof numRows === 'number' && { rowCount: numRows }),
  }
}

export function outcomeOf(ran: ToolCallResult): Outcome {
  if (ran.deny !== undefined) {
    return { status: 'failed', error: firstLine(ran.deny) }
  }
  const isError = ran.isError === true || (isRecord(ran.result) && ran.result.isError === true)
  if (isError) {
    const text = ran.text ?? textOf(ran.result) ?? ''

    return { status: 'failed', error: firstLine(text) || 'Query failed' }
  }

  return succeeded(payloadOf(ran))
}
