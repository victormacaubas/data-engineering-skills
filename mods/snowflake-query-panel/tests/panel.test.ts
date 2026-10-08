import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, On, PaneOpenArgs, ToolCallResult } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { outcomeOf } from '../hooks/outcome'

const PLUGIN = 'snowflake-query-panel'
const SQL_TOOL = 'mcp__snowflake-raw__sql_exec_tool'
const PANE_PROPS = {
  title: 'Snowflake',
  isFocused: false,
  bodyColumns: 100,
  placement: 'inline',
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as const

type Answer = ToolCallResult
type Options = { isPlaced?: boolean; agents?: AgentInfo[]; listMissing?: boolean }

const mcpJson = (payload: unknown): Answer => ({
  result: { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false },
})

const rowsAnswer = (numRows: number, queryId = 'c0ffee00-aaaa-bbbb-cccc-000000000001'): Answer =>
  mcpJson({
    query_id: queryId,
    result_set: { data: [], resultSetMetaData: { numRows } },
    statementHandle: queryId,
  })

const agent = (id: string, type: string, description: string, name?: string): AgentInfo => ({
  id,
  type,
  description,
  name,
  status: 'running',
})

function harness($: Engine, on: On, options: Options = {}) {
  const clock = mock.clock(on)
  const opened: PaneOpenArgs[] = []
  const toasts: string[] = []
  const logs: string[] = []
  const registered: string[] = []
  const pending = new Map<string, (answer: Answer) => void>()
  let listCalls = 0

  on('ui.open', (_$, e) => {
    opened.push(e)

    return { value: options.isPlaced === false ? { isPlaced: false, reason: 'narrow' } : { isPlaced: true } }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    logs.push(`${e.to}: ${e.text}`)

    return { value: undefined }
  })
  on('command.register', (_$, e) => {
    registered.push(e.name)

    return { value: { command: e.name } }
  })
  if (!options.listMissing) {
    on('agent.list', () => {
      listCalls += 1

      return { value: options.agents ?? [] }
    })
  }
  on('session.start', () => ({ cwd: '/' }))
  on('tool.call', { tool: SQL_TOOL }, (_$, e) => new Promise<Answer>(resolve => pending.set(String(e.sql), resolve)))

  const begin = async (sql: string, agentId?: string) => {
    const call = $.tool.call({ tool: SQL_TOOL, sql, ...(agentId && { agentId }) } as never)
    await clock.settle()

    return { call }
  }
  const finish = async (sql: string, answer: Answer) => {
    pending.get(sql)?.(answer)
    await clock.settle()
  }
  const mount = (bodyColumns = 100) =>
    $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'Pane',
      requestId: 'snowflake',
      props: { ...PANE_PROPS, bodyColumns },
    })

  return { clock, opened, toasts, logs, registered, begin, finish, mount, listCalls: () => listCalls }
}

type Mounted = Awaited<ReturnType<ReturnType<typeof harness>['mount']>>

const labels = async (ui: Mounted) =>
  (await ui.findAll({ type: 'Button' })).map(button => String(button.props.label))
const texts = async (ui: Mounted) => (await ui.findAll({ type: 'Text' })).map(text => text.text)

describe('outcome parsing', () => {
  const payload = { query_id: 'q-1', result_set: { resultSetMetaData: { numRows: 7 } } }
  const json = JSON.stringify(payload)

  test('reads the query id and row count from content blocks, a string, parsed data, or core text', () => {
    const expected = { status: 'succeeded', queryId: 'q-1', rowCount: 7 }
    expect(outcomeOf({ result: { content: [{ type: 'text', text: json }] } })).toEqual(expected)
    expect(outcomeOf({ result: json })).toEqual(expected)
    expect(outcomeOf({ result: payload })).toEqual(expected)
    expect(outcomeOf({ result: undefined, text: json } as never)).toEqual(expected)
  })

  test('degrades to a bare success when the payload cannot be read', () => {
    expect(outcomeOf({ result: 'not json' })).toEqual({ status: 'succeeded' })
    expect(outcomeOf({ result: { content: [] } })).toEqual({ status: 'succeeded' })
    expect(outcomeOf({ result: { query_id: 'q-2' } })).toEqual({ status: 'succeeded', queryId: 'q-2' })
  })

  test('takes the first line of an error, cut to 200 characters', () => {
    const long = 'x'.repeat(300)
    const failed = outcomeOf({ isError: true, result: undefined, text: `${long}\nsecond line` })
    expect(failed.status).toBe('failed')
    expect(failed.status === 'failed' && failed.error.length).toBe(200)
    expect(outcomeOf({ isError: true, result: undefined, text: 'boom\nline 2' })).toEqual({
      status: 'failed',
      error: 'boom',
    })
    expect(outcomeOf({ deny: 'blocked by policy' })).toEqual({ status: 'failed', error: 'blocked by policy' })
  })
})

test('a success row shows duration, row count, full query id and a one-line SQL hint', async ($, on) => {
  const h = harness($, on)
  const { call } = await h.begin('select\n  *\nfrom orders')
  await h.begin('select pending')
  const ui = await h.mount()
  expect(await labels(ui)).toContain('▸ ◌ running · select pending')

  await h.clock.advance(250)
  await h.finish('select\n  *\nfrom orders', rowsAnswer(12))
  const answer = await call

  expect(answer).toEqual(rowsAnswer(12))
  expect(await labels(ui)).toContain('▸ ✓ 250ms · 12 rows · c0ffee00-aaaa-bbbb-cccc-000000000001 · select * from orders')
})

test('an error result marks its row failed with the first line of the error', async ($, on) => {
  const h = harness($, on)
  const { call } = await h.begin('select bad')
  await h.begin('select pending')
  await h.clock.settle()
  const ui = await h.mount()

  const errored: Answer = { isError: true, result: undefined, text: 'SQL compilation error: bad\nposition 7' }
  await h.finish('select bad', errored)

  expect(await call).toEqual(errored)
  expect(await labels(ui)).toContain('▸ ✗ 0ms · select bad')
  expect(await texts(ui)).toContain('SQL compilation error: bad')
  expect(await texts(ui)).not.toContain('position 7')
})

test('an unparseable result is still a success without count or id', async ($, on) => {
  const h = harness($, on)
  const { call } = await h.begin('select 1')
  await h.begin('select pending')
  await h.clock.settle()
  const ui = await h.mount()

  await h.finish('select 1', { result: 'garbled <<>>' })

  expect(await call).toEqual({ result: 'garbled <<>>' })
  expect(await labels(ui)).toContain('▸ ✓ 0ms · select 1')
})

test('a deny from below marks the row failed and is returned as received', async ($, on) => {
  const h = harness($, on)
  const { call } = await h.begin('drop table t')
  await h.begin('select pending')
  await h.clock.settle()
  const ui = await h.mount()

  await h.finish('drop table t', { deny: 'blocked by policy' })

  expect(await call).toEqual({ deny: 'blocked by policy' })
  expect(await labels(ui)).toContain('▸ ✗ 0ms · drop table t')
  expect(await texts(ui)).toContain('blocked by policy')
})

describe('agent labels', () => {
  const agents = [
    agent('aaaaaa111', 'pathfinder', 'map the staging models'),
    agent('bbbbbb222', 'pathfinder', 'trace the orders lineage'),
    agent('cccccc333', 'pathfinder', 'audit grants', 'grants-auditor'),
  ]

  test('three pathfinders with different descriptions get three distinct labels', async ($, on) => {
    const h = harness($, on, { agents })
    await h.begin('select 1', 'aaaaaa111')
    await h.begin('select 2', 'bbbbbb222')
    await h.begin('select 3', 'cccccc333')
    await h.begin('select 4')
    await h.begin('select 5', 'ddddddddd999')
    const ui = await h.mount()

    const headers = (await ui.findAll({ type: 'Text' })).filter(text => text.props.bold === true)
    const names = headers.map(text => text.text.replace(/ · \d+ quer(y|ies)$/, ''))
    expect(names).toEqual([
      'agent dddddd',
      'main',
      'pathfinder · grants-auditor',
      'pathfinder · trace the orders lineage',
      'pathfinder · map the staging models',
    ])
    expect(new Set(names).size).toBe(5)
  })

  test('each agent id is looked up once however many queries it runs', async ($, on) => {
    const h = harness($, on, { agents })
    await h.begin('select 1', 'aaaaaa111')
    await h.begin('select 2', 'aaaaaa111')
    await h.begin('select 3', 'aaaaaa111')
    await h.begin('select 4')

    expect(h.listCalls()).toBe(1)
  })
})

describe('concurrency', () => {
  test('overlapping calls from three agents finishing out of order keep their own outcomes', async ($, on) => {
    const agents = [agent('aaaaaa111', 'pathfinder', 'alpha'), agent('bbbbbb222', 'pathfinder', 'beta')]
    const h = harness($, on, { agents })
    const specs = [
      { sql: 'a1', agent: 'aaaaaa111', rows: 1 },
      { sql: 'b1', agent: 'bbbbbb222', rows: 2 },
      { sql: 'm1', agent: undefined, rows: 3 },
      { sql: 'a2', agent: 'aaaaaa111', rows: 4 },
      { sql: 'b2', agent: 'bbbbbb222', rows: 5 },
    ]
    const calls = []
    for (const spec of specs) {
      calls.push({ ...spec, run: await h.begin(spec.sql, spec.agent) })
    }
    await h.begin('still running', 'aaaaaa111')
    const ui = await h.mount()

    const order = ['b2', 'a1', 'm1', 'a2', 'b1']
    for (const sql of order) {
      const spec = calls.find(one => one.sql === sql)!
      await h.clock.advance(10)
      await h.finish(sql, rowsAnswer(spec.rows, `query-${sql}0000`))
    }
    for (const spec of calls) {
      expect(await spec.run.call).toEqual(rowsAnswer(spec.rows, `query-${spec.sql}0000`))
    }

    const shown = await labels(ui)
    expect(shown).toHaveLength(6)
    for (const spec of calls) {
      expect(shown.filter(label => label.includes(`${spec.rows} row`) && label.endsWith(` ${spec.sql}`))).toHaveLength(1)
    }
  })

  test('the eleventh query evicts the first and the evicted row ignores its late completion', async ($, on) => {
    const h = harness($, on)
    const first = await h.begin('q0')
    for (let n = 1; n <= 10; n += 1) {
      await h.begin(`q${n}`)
    }
    const ui = await h.mount()

    const before = await labels(ui)
    expect(before).toHaveLength(10)
    expect(before.some(label => label.endsWith(' q0'))).toBe(false)
    expect(before.some(label => label.endsWith(' q10'))).toBe(true)

    await h.finish('q0', rowsAnswer(999))

    expect(await first.call).toEqual(rowsAnswer(999))
    const after = await labels(ui)
    expect(after).toEqual(before)
    expect(after.some(label => label.includes('999'))).toBe(false)
  })
})

describe('pane lifecycle', () => {
  test('opens the pane on the first query only, and a placed pane raises no toast', async ($, on) => {
    const h = harness($, on)
    await h.begin('select 1')
    await h.begin('select 2')

    expect(h.opened).toHaveLength(1)
    expect(h.opened[0]).toMatchObject({ id: 'snowflake', title: 'Snowflake' })
    expect(h.opened[0]?.rows).toBeGreaterThan(0)
    expect(h.toasts).toEqual([])
  })

  test('an undrawn pane raises exactly one toast across two queries', async ($, on) => {
    const h = harness($, on, { isPlaced: false })
    await h.begin('select 1')
    await h.begin('select 2')

    expect(h.toasts).toHaveLength(1)
    expect(h.toasts[0]).toContain('widen the terminal')
    expect(h.toasts[0]).toContain('/sql-panel')
  })

  test('recording trouble never reaches the call and goes to the debug log', async ($, on) => {
    const h = harness($, on, { listMissing: true })
    const { call } = await h.begin('select 1', 'zzzzzzzzz')
    await h.begin('select pending')
    const ui = await h.mount()
    await h.finish('select 1', rowsAnswer(1))

    expect(await call).toEqual(rowsAnswer(1))
    expect(h.logs.some(line => line.startsWith('debug: snowflake-query-panel: recording failed'))).toBe(true)
    expect(await texts(ui)).toContain('agent zzzzzz · 1 query')
    expect(await labels(ui)).toContain('▸ ✓ 0ms · 1 row · c0ffee00-aaaa-bbbb-cccc-000000000001 · select 1')
  })

  test('the slash command opens the pane and sends nothing to the model', async ($, on) => {
    const h = harness($, on)
    await $.session.start({ cwd: '/' } as never)
    expect(h.registered).toEqual(['sql-panel'])

    const ran = await $.command.run({ command: 'sql-panel', args: '' } as never)

    expect(h.opened).toHaveLength(1)
    expect(h.opened[0]).toMatchObject({ id: 'snowflake' })
    expect(ran.text).toBeUndefined()
    expect(ran.context).toBeUndefined()
  })
})

describe('views', () => {
  test('an empty pane shows a placeholder line', async ($, on) => {
    const h = harness($, on)
    const ui = await h.mount()

    expect(await texts(ui)).toEqual(['Snowflake · no queries yet'])
  })

  test('keeps grouped rows under a summary line whether or not anything runs', async ($, on) => {
    const h = harness($, on, { agents: [agent('aaaaaa111', 'pathfinder', 'alpha')] })
    const ui = await h.mount()
    const one = await h.begin('select 1', 'aaaaaa111')
    const two = await h.begin('select 2')

    expect(await ui.find({ type: 'Button' })).toBeDefined()
    expect(await texts(ui)).toEqual(['Snowflake · 2 queries · 2 running', 'main · 1 query', 'pathfinder · alpha · 1 query'])

    await h.clock.advance(1500)
    await h.finish('select 2', rowsAnswer(3))
    expect((await texts(ui))[0]).toBe('Snowflake · 2 queries · 1 running')

    await h.finish('select 1', rowsAnswer(1))
    await one.call
    await two.call

    expect((await ui.findAll({ type: 'Button' })).length).toBe(2)
    expect(await texts(ui)).toEqual(['Snowflake · 2 queries · last: ok 1.5s 3 rows', 'main · 1 query', 'pathfinder · alpha · 1 query'])

    const three = await h.begin('select 3')
    await h.finish('select 3', { isError: true, result: undefined, text: 'nope' })
    await three.call
    expect((await texts(ui))[0]).toBe('Snowflake · 3 queries · last: failed')
  })

  test('agents are ordered by their latest query and rows inside a group newest first', async ($, on) => {
    const h = harness($, on, { agents: [agent('aaaaaa111', 'pathfinder', 'alpha')] })
    await h.begin('m-old')
    await h.begin('a-old', 'aaaaaa111')
    await h.begin('m-new')
    const ui = await h.mount()

    const headers = (await ui.findAll({ type: 'Text' })).map(text => text.text)
    expect(headers).toEqual(['Snowflake · 3 queries · 3 running', 'main · 2 queries', 'pathfinder · alpha · 1 query'])
    expect((await labels(ui)).map(label => label.split(' ').pop())).toEqual(['m-new', 'm-old', 'a-old'])
  })

  test('SQL is cut to the pane width on one line', async ($, on) => {
    const h = harness($, on)
    await h.begin(`select ${'column_name, '.repeat(20)} from t`)
    const ui = await h.mount(40)

    const [label] = await labels(ui)
    expect(label!.length).toBeLessThanOrEqual(38)
    expect(label).toEndWith('…')
    expect(label).not.toContain('\n')
  })
})

describe('expanding a row', () => {
  test('pressing a row shows the full SQL and pressing it again hides it', async ($, on) => {
    const h = harness($, on)
    const sql = `select order_id,\n       customer_id\nfrom analytics.orders\nwhere created_at > '2026-01-01'`
    const { call } = await h.begin(sql)
    await h.begin('select pending')
    const ui = await h.mount()
    const buttons = await ui.findAll({ type: 'Button' })
    const key = buttons.find(button => String(button.props.label).includes('order_id'))!.key!

    expect(await texts(ui)).not.toContain(sql)

    await ui.press({ key })
    expect(await texts(ui)).toContain(sql)

    await ui.press({ key })
    expect(await texts(ui)).not.toContain(sql)

    await h.finish(sql, rowsAnswer(2, 'c0ffee00-1111-2222-3333-444444444444'))
    await call
    const finished = (await labels(ui)).find(label => label.includes('order_id'))!
    expect(finished).toStartWith('▸ ✓')
    expect(finished).toContain('c0ffee00-1111-2222-3333-444444444444')

    await ui.press({ key })
    expect((await labels(ui)).find(label => label.includes('order_id'))).toStartWith('▾ ✓')
    expect(await texts(ui)).toContain(sql)
    expect((await texts(ui)).some(text => text.includes('query id'))).toBe(false)
  })

  test('a past query still expands once nothing is running', async ($, on) => {
    const h = harness($, on)
    const sql = 'select past_query from t'
    const { call } = await h.begin(sql)
    await h.finish(sql, rowsAnswer(1))
    await call
    const ui = await h.mount()
    const [button] = await ui.findAll({ type: 'Button' })

    await ui.press({ key: button!.key! })
    expect(await texts(ui)).toContain(sql)
  })
})
