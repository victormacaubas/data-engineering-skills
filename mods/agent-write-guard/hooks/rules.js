"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTestTree = exports.TEST_AUTHOR_REASON = exports.IMPLEMENTER_REASON = exports.GUARDED_TOOLS = exports.TEST_AUTHOR = exports.IMPLEMENTER = void 0;
exports.globToRegex = globToRegex;
exports.relativeTo = relativeTo;
exports.denyReason = denyReason;
exports.IMPLEMENTER = 'implementer';
exports.TEST_AUTHOR = 'test-author';
exports.GUARDED_TOOLS = ['Edit', 'Write', 'NotebookEdit'];
exports.IMPLEMENTER_REASON = 'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.';
exports.TEST_AUTHOR_REASON = 'Production code belongs to the implementer. Report the change under Needed production changes instead.';
var TEST_TREE = [
    '**/tests/**',
    '**/__tests__/**',
    '**/conftest.py',
    '**/test_*.py',
    '**/*_test.py',
    '**/*.test.ts',
    '**/*.spec.ts',
];
// Paths test-author may write besides the test tree: its report directory and test-runner config.
var TEST_AUTHOR_EXTRAS = [
    '.orchestrate/**',
    '**/pytest.ini',
    '**/pyproject.toml',
    '**/setup.cfg',
    '**/tox.ini',
    '**/jest.config.*',
    '**/vitest.config.*',
    '**/playwright.config.*',
];
var escapeRegex = function (text) { return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); };
// Covers only what the lists above use: `**` as a whole segment, `*` inside a segment, literals.
function globToRegex(glob) {
    var segments = glob.split('/');
    var parts = segments.map(function (segment, index) {
        if (segment === '**') {
            return index === segments.length - 1 ? '.*' : '(?:[^/]+/)*';
        }
        var body = segment.split('*').map(escapeRegex).join('[^/]*');
        return index === segments.length - 1 ? body : "".concat(body, "/");
    });
    return new RegExp("^".concat(parts.join(''), "$"));
}
var TEST_TREE_REGEXES = TEST_TREE.map(globToRegex);
var TEST_AUTHOR_EXTRA_REGEXES = TEST_AUTHOR_EXTRAS.map(globToRegex);
var matchesAny = function (regexes, path) { return regexes.some(function (regex) { return regex.test(path); }); };
var isTestTree = function (relativePath) { return matchesAny(TEST_TREE_REGEXES, relativePath); };
exports.isTestTree = isTestTree;
function normalize(path) {
    var out = [];
    for (var _i = 0, _a = path.split('/'); _i < _a.length; _i++) {
        var segment = _a[_i];
        if (segment === '' || segment === '.') {
            continue;
        }
        if (segment === '..') {
            out.pop();
        }
        else {
            out.push(segment);
        }
    }
    return out;
}
/** The path relative to `cwd`, or undefined when it resolves outside it. */
function relativeTo(cwd, path) {
    var base = normalize(cwd);
    var target = normalize(path.startsWith('/') ? path : "".concat(cwd, "/").concat(path));
    if (target.length <= base.length || base.some(function (segment, index) { return target[index] !== segment; })) {
        return undefined;
    }
    return target.slice(base.length).join('/');
}
/** The reason to deny `agentType` writing `relativePath`, or undefined to let the call through. */
function denyReason(agentType, relativePath) {
    var inTestTree = (0, exports.isTestTree)(relativePath);
    if (agentType === exports.IMPLEMENTER && inTestTree) {
        return exports.IMPLEMENTER_REASON;
    }
    if (agentType === exports.TEST_AUTHOR && !inTestTree && !matchesAny(TEST_AUTHOR_EXTRA_REGEXES, relativePath)) {
        return exports.TEST_AUTHOR_REASON;
    }
    return undefined;
}
