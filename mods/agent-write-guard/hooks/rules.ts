export const IMPLEMENTER = 'implementer'
export const TEST_AUTHOR = 'test-author'

export const GUARDED_TOOLS = /^(Edit|Write|NotebookEdit)$/

export const IMPLEMENTER_REASON =
  'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.'
export const TEST_AUTHOR_REASON =
  'Production code belongs to the implementer. Report the change under Needed production changes instead.'
export const GATE_CONFIGURATION_REASON =
  'Gate configuration belongs to the main session. Report the configuration change you need instead of making it.'

export const GATE_CONFIGURATION_RULE = 'gate-configuration'
export const GATE_MODES = ['off', 'observe', 'enforce'] as const
export type GateMode = (typeof GATE_MODES)[number]

export type RuleResult = { rule: string; action: 'deny' | 'observe'; reason: string }

const TEST_TREE = [
  '**/tests/**',
  '**/__tests__/**',
  '**/conftest.py',
  '**/test_*.py',
  '**/*_test.py',
  '**/*.test.ts',
  '**/*.spec.ts',
]

// Paths test-author may write besides the test tree: its report directory and test-runner config.
const TEST_AUTHOR_EXTRAS = [
  '.orchestrate/**',
  '**/pytest.ini',
  '**/pyproject.toml',
  '**/setup.cfg',
  '**/tox.ini',
  '**/jest.config.*',
  '**/vitest.config.*',
  '**/playwright.config.*',
]

// Files that hold only gate configuration. pyproject.toml, Makefiles and CI workflows are left out:
// an implementer legitimately adds dependencies, targets and jobs there, and a path rule cannot tell those edits apart.
const GATE_CONFIGURATION = [
  '**/ruff.toml',
  '**/.ruff.toml',
  '**/mypy.ini',
  '**/.mypy.ini',
  '**/.importlinter',
  '**/.pre-commit-config.yaml',
]

const escapeRegex = (text: string): string => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

// Covers only what the lists above use: `**` as a whole segment, `*` inside a segment, literals.
function globToRegex(glob: string): RegExp {
  const segments = glob.split('/')
  const parts = segments.map((segment, index) => {
    if (segment === '**') {
      return index === segments.length - 1 ? '.*' : '(?:[^/]+/)*'
    }
    const body = segment.split('*').map(escapeRegex).join('[^/]*')

    return index === segments.length - 1 ? body : `${body}/`
  })

  return new RegExp(`^${parts.join('')}$`)
}

const TEST_TREE_REGEXES = TEST_TREE.map(globToRegex)
const TEST_AUTHOR_EXTRA_REGEXES = TEST_AUTHOR_EXTRAS.map(globToRegex)
const GATE_CONFIGURATION_REGEXES = GATE_CONFIGURATION.map(globToRegex)

const matchesAny = (regexes: RegExp[], path: string): boolean => regexes.some(regex => regex.test(path))

const isTestTree = (relativePath: string): boolean => matchesAny(TEST_TREE_REGEXES, relativePath)

function normalize(path: string): string[] {
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }
    if (segment === '..') {
      out.pop()
    } else {
      out.push(segment)
    }
  }

  return out
}

/** The path relative to `cwd`, or undefined when it resolves outside it. */
export function relativeTo(cwd: string, path: string): string | undefined {
  const base = normalize(cwd)
  const target = normalize(path.startsWith('/') ? path : `${cwd}/${path}`)
  if (target.length <= base.length || base.some((segment, index) => target[index] !== segment)) {
    return undefined
  }

  return target.slice(base.length).join('/')
}

/**
 * The rule that `agentType` writing `relativePath` runs into, or undefined to let the call through.
 * The two test-boundary rules always deny; only the gate-configuration rule follows `gateMode`.
 */
export function evaluate(agentType: string, relativePath: string, gateMode: GateMode): RuleResult | undefined {
  const inTestTree = isTestTree(relativePath)
  if (agentType === IMPLEMENTER && inTestTree) {
    return { rule: 'test-tree', action: 'deny', reason: IMPLEMENTER_REASON }
  }
  if (agentType === TEST_AUTHOR && !inTestTree && !matchesAny(TEST_AUTHOR_EXTRA_REGEXES, relativePath)) {
    return { rule: 'production-code', action: 'deny', reason: TEST_AUTHOR_REASON }
  }
  if (agentType === IMPLEMENTER && gateMode !== 'off' && matchesAny(GATE_CONFIGURATION_REGEXES, relativePath)) {
    return {
      rule: GATE_CONFIGURATION_RULE,
      action: gateMode === 'enforce' ? 'deny' : 'observe',
      reason: GATE_CONFIGURATION_REASON,
    }
  }

  return undefined
}
