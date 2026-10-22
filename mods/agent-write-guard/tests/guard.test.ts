import { expect, test } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const CWD = '/repo'
const IMPLEMENTER_REASON =
  'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.'
const TEST_AUTHOR_REASON =
  'Production code belongs to the implementer. Report the change under Needed production changes instead.'
const RAN = { result: 'ran' }

const AGENTS: AgentInfo[] = [
  { id: 'a-impl', type: 'implementer', description: 'slice', status: 'running' },
  { id: 'a-test', type: 'test-author', description: 'tests', status: 'running' },
  { id: 'a-review', type: 'structure-reviewer', description: 'review', status: 'running' },
]

type Options = { listFails?: boolean }

function harness($: Engine, on: On, options: Options = {}) {
  const logs: string[] = []
  on('session.cwd', () => ({ value: CWD }))
  // Leaving agent.list unanswered makes the mod's lookup throw.
  if (!options.listFails) {
    on('agent.list', () => ({ value: AGENTS }))
  }
  on('ui.log', (_$, e) => {
    logs.push(`${e.to}: ${e.text}`)

    return { value: undefined }
  })
  on('tool.call', () => RAN)

  const call = (tool: string, args: Record<string, unknown>, agentId?: string) =>
    $.tool.call({ tool, ...args, ...(agentId && { agentId }) } as never)
  const write = (path: string, agentId?: string) => call('Write', { file_path: path, content: 'x' }, agentId)
  const edit = (path: string, agentId?: string) =>
    call('Edit', { file_path: path, old_string: 'a', new_string: 'b' }, agentId)

  return { logs, call, write, edit }
}

test('a nested test directory and a test file beside production code are in the test tree', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/pkg/sub/tests/data/fixture.json`, 'a-impl')).toEqual({ deny: IMPLEMENTER_REASON })
  expect(await h.write(`${CWD}/src/foo.test.ts`, 'a-impl')).toEqual({ deny: IMPLEMENTER_REASON })
})

test('paths outside the working directory are not guarded for either agent', async ($, on) => {
  const h = harness($, on)

  expect(await h.write('/tmp/tests/scratch.py', 'a-impl')).toEqual(RAN)
  expect(await h.write('/tmp/scratch.py', 'a-test')).toEqual(RAN)
})

test('implementer is denied Write, Edit, and NotebookEdit on the test tree', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/tests/test_x.py`, 'a-impl')).toEqual({ deny: IMPLEMENTER_REASON })
  expect(await h.edit(`${CWD}/conftest.py`, 'a-impl')).toEqual({ deny: IMPLEMENTER_REASON })
  expect(
    await h.call('NotebookEdit', { notebook_path: `${CWD}/tests/check.ipynb`, new_source: 'x' }, 'a-impl'),
  ).toEqual({ deny: IMPLEMENTER_REASON })
})

test('implementer writes production code unchanged', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/src/foo.ts`, 'a-impl')).toEqual(RAN)
})

test('test-author writes tests, its report, and runner config unchanged', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/tests/test_x.py`, 'a-test')).toEqual(RAN)
  expect(await h.write(`${CWD}/.orchestrate/my-change/test-author.md`, 'a-test')).toEqual(RAN)
  expect(await h.edit(`${CWD}/pyproject.toml`, 'a-test')).toEqual(RAN)
})

test('test-author is denied production code', async ($, on) => {
  const h = harness($, on)

  expect(await h.edit(`${CWD}/src/service.py`, 'a-test')).toEqual({ deny: TEST_AUTHOR_REASON })
})

test('the main session and other agents are not guarded', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/tests/test_x.py`)).toEqual(RAN)
  expect(await h.write(`${CWD}/src/foo.py`, 'a-review')).toEqual(RAN)
})

test('implementer Bash calls are not inspected', async ($, on) => {
  const h = harness($, on)

  expect(await h.call('Bash', { command: 'echo x > tests/test_x.py' }, 'a-impl')).toEqual(RAN)
})

test('an agent missing from the list is let through and logged', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/tests/test_x.py`, 'a-unknown')).toEqual(RAN)
  expect(h.logs.some(line => line.startsWith('debug:') && line.includes('a-unknown'))).toBe(true)
})

test('a failing agent lookup is let through and logged', async ($, on) => {
  const h = harness($, on, { listFails: true })

  expect(await h.write(`${CWD}/tests/test_x.py`, 'a-impl')).toEqual(RAN)
  expect(h.logs.some(line => line.startsWith('debug:') && line.includes('agent lookup failed'))).toBe(true)
})
