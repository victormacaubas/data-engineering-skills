export type QueryStatus = 'running' | 'succeeded' | 'failed'

export type QueryRow = {
  /** The tool_use_id of the call; the key every update finds its row by. */
  id: string
  /** The calling loop's agent id, or `main` for the main session. */
  agentKey: string
  sql: string
  status: QueryStatus
  durationMs?: number
  queryId?: string
  rowCount?: number
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'snowflake-query-panel': {
      rows: QueryRow[]
      agentLabels: Record<string, string>
      expanded: string[]
      toastShown: boolean
    }
  }
}
