import type { EngineInterface, Register } from 'claude-code'

import { GUARDED_TOOLS, IMPLEMENTER, TEST_AUTHOR, denyReason, relativeTo } from './rules'

const PLUGIN = 'agent-write-guard'

const targetPath = (e: Record<string, unknown>): string | undefined => {
  const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path

  return typeof path === 'string' ? path : undefined
}

async function agentTypeOf($: EngineInterface, agentId: string): Promise<string | undefined> {
  try {
    const listed = (await $.agent.list()).find(agent => agent.id === agentId)
    if (listed === undefined) {
      $.ui.log(`${PLUGIN}: agent ${agentId} is not in the session's agent list; letting the call through`, {
        to: 'debug',
      })
    }

    return listed?.type
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    $.ui.log(`${PLUGIN}: agent lookup failed: ${reason}; letting the call through`, { to: 'debug' })

    return undefined
  }
}

export const register: Register = on => {
  on('tool.call', { tool: GUARDED_TOOLS }, async ($, e, next) => {
    if (e.agentId === undefined) {
      return next(e)
    }
    const agentType = await agentTypeOf($, e.agentId)
    if (agentType !== IMPLEMENTER && agentType !== TEST_AUTHOR) {
      return next(e)
    }
    const path = targetPath(e as Record<string, unknown>)
    const relative = path === undefined ? undefined : relativeTo(await $.session.cwd(), path)
    const reason = relative === undefined ? undefined : denyReason(agentType, relative)

    return reason === undefined ? next(e) : { deny: reason }
  }).catch(($, e, next) => next(e))
}
