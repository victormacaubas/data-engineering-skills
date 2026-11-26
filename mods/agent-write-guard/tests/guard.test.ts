import { expect, test } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import {
  GATE_CONFIGURATION_REASON,
  GATE_MODES,
  IMPLEMENTER_REASON,
  TEST_AUTHOR_REASON,
} from '../hooks/rules'

const CWD = '/repo'
const RAN = { result: 'ran' }
const GATE_PATHS = [
  'ruff.toml',
  '.ruff.toml',
  'mypy.ini',
  '.mypy.ini',
  '.importlinter',
  '.pre-commit-config.yaml',
  'tools/lint/ruff.toml',
  'tools/lint/.ruff.toml',
  'services/api/mypy.ini',
  'services/api/.mypy.ini',
  'services/api/.importlinter',
  'services/api/.pre-commit-config.yaml',
]
const MODE =(gateConfigMode: string) => ({ options: { gateConfigMode } })

function agentInfo(id: string, type: string, description: string): AgentInfo {
  return {
    id,
    type,
    description,
    status: 'running',
    kind: 'local_agent',
    taskStatus: 'running',
    label: description,
    startTime: 0,
    cwd: CWD,
    tokenCount: 0,
    tokenSamples: [],
    hasRow: true,
  }
}

const AGENTS: AgentInfo[] = [
  agentInfo('a-impl', 'implementer', 'slice'),
  agentInfo('a-test', 'test-author', 'tests'),
  agentInfo('a-review', 'structure-reviewer', 'review'),
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

test('test-author writes its report in a repository below the working directory', async ($, on) => {
  const h = harness($, on)

  expect(await h.write(`${CWD}/some-repo/.orchestrate/my-change/test-author.md`, 'a-test')).toEqual(RAN)
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

const transcriptLines = (logs: string[]): string[] => logs.filter(line => line.startsWith('transcript:'))

// Exactly one observed line, which must name every part given.
function expectOneObservation(logs: string[], parts: string[]) {
  const lines = transcriptLines(logs)
  expect(lines).toHaveLength(1)
  for (const part of parts) {
    expect(lines[0]).toContain(part)
  }
}

test(
  'implementer Edit on a gate configuration file is matched at the root and at any depth',
  MODE('enforce'),
  async ($, on) => {
    const h = harness($, on)
    const outcomes: unknown[] = []
    for (const path of GATE_PATHS) {
      outcomes.push([path, await h.edit(`${CWD}/${path}`, 'a-impl')])
    }

    expect(outcomes).toEqual(GATE_PATHS.map(path => [path, { deny: GATE_CONFIGURATION_REASON }]))
  },
)

test(
  'implementer Edit on pyproject.toml is not matched by the gate rule',
  MODE('enforce'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.edit(`${CWD}/pyproject.toml`, 'a-impl')).toEqual(RAN)
  },
)

test(
  'Makefile and CI workflow files are not matched by the gate rule',
  MODE('enforce'),
  async ($, on) => {
    const h = harness($, on)
    const outcomes: unknown[] = []
    for (const path of ['Makefile', 'services/api/Makefile', '.github/workflows/ci.yml']) {
      outcomes.push([path, await h.edit(`${CWD}/${path}`, 'a-impl')])
    }

    expect(outcomes).toEqual([
      ['Makefile', RAN],
      ['services/api/Makefile', RAN],
      ['.github/workflows/ci.yml', RAN],
    ])
  },
)

test(
  'test-author Edit on a gate configuration file is denied only by the production-code rule',
  MODE('enforce'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.edit(`${CWD}/ruff.toml`, 'a-test')).toEqual({ deny: TEST_AUTHOR_REASON })
  },
)

test(
  'main session Edit on a gate configuration file proceeds unchanged',
  MODE('enforce'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.edit(`${CWD}/ruff.toml`)).toEqual(RAN)
  },
)

test('with no mode set, the gate rule observes: the edit proceeds and one transcript line names it', async ($, on) => {
  const h = harness($, on)

  expect(await h.edit(`${CWD}/ruff.toml`, 'a-impl')).toEqual(RAN)
  expectOneObservation(h.logs, ['implementer', 'Edit', 'ruff.toml', 'gate-configuration', 'enforce'])
})

test(
  'mode off lets the implementer Edit on a gate configuration file proceed with nothing recorded',
  MODE('off'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.edit(`${CWD}/ruff.toml`, 'a-impl')).toEqual(RAN)
    expect(transcriptLines(h.logs)).toHaveLength(0)
  },
)

for (const mode of GATE_MODES) {
  test(
    `mode ${mode} leaves the test-tree and production-code denials unchanged`,
    MODE(mode),
    async ($, on) => {
      const h = harness($, on)

      expect(await h.write(`${CWD}/tests/test_x.py`, 'a-impl')).toEqual({ deny: IMPLEMENTER_REASON })
      expect(await h.edit(`${CWD}/src/service.py`, 'a-test')).toEqual({ deny: TEST_AUTHOR_REASON })
    },
  )
}

test(
  'mode observe lets the implementer Write on .pre-commit-config.yaml proceed and records one line',
  MODE('observe'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.write(`${CWD}/.pre-commit-config.yaml`, 'a-impl')).toEqual(RAN)
    expectOneObservation(h.logs, ['implementer', 'Write', '.pre-commit-config.yaml', 'gate-configuration', 'enforce'])
  },
)

test(
  'mode observe records nothing for an implementer Write that the gate rule does not match',
  MODE('observe'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.write(`${CWD}/src/foo.py`, 'a-impl')).toEqual(RAN)
    expect(transcriptLines(h.logs)).toHaveLength(0)
  },
)

// The engine replaces an unknown mode with the default before the hooks module reads it.
// Its note about the value does not reach ui.log, so this test asserts only the observe behavior.
test(
  'an unknown mode value behaves as observe: the edit proceeds and one transcript line names it',
  MODE('block'),
  async ($, on) => {
    const h = harness($, on)

    expect(await h.edit(`${CWD}/ruff.toml`, 'a-impl')).toEqual(RAN)
    expectOneObservation(h.logs, ['implementer', 'Edit', 'ruff.toml', 'gate-configuration', 'enforce'])
  },
)
