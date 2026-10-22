export const IMPLEMENTER = 'implementer'
export const TEST_AUTHOR = 'test-author'

export const GUARDED_TOOLS = /^(Edit|Write|NotebookEdit)$/

export const IMPLEMENTER_REASON =
  'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.'
export const TEST_AUTHOR_REASON =
  'Production code belongs to the implementer. Report the change under Needed production changes instead.'

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

const escapeRegex = (text: string): string => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

// Covers only what the lists above use: `**` as a whole segment, `*` inside a segment, literals.
export function globToRegex(glob: string): RegExp {
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

const matchesAny = (regexes: RegExp[], path: string): boolean => regexes.some(regex => regex.test(path))

export const isTestTree = (relativePath: string): boolean => matchesAny(TEST_TREE_REGEXES, relativePath)

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

/** The reason to deny `agentType` writing `relativePath`, or undefined to let the call through. */
export function denyReason(agentType: string, relativePath: string): string | undefined {
  const inTestTree = isTestTree(relativePath)
  if (agentType === IMPLEMENTER && inTestTree) {
    return IMPLEMENTER_REASON
  }
  if (agentType === TEST_AUTHOR && !inTestTree && !matchesAny(TEST_AUTHOR_EXTRA_REGEXES, relativePath)) {
    return TEST_AUTHOR_REASON
  }

  return undefined
}
