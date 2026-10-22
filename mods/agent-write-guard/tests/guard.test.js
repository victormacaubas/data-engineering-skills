"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var CWD = '/repo';
var IMPLEMENTER_REASON = 'Test files belong to test-author. If this test looks wrong, list it under Disputed tests.';
var TEST_AUTHOR_REASON = 'Production code belongs to the implementer. Report the change under Needed production changes instead.';
var RAN = { result: 'ran' };
var AGENTS = [
    { id: 'a-impl', type: 'implementer', description: 'slice', status: 'running' },
    { id: 'a-test', type: 'test-author', description: 'tests', status: 'running' },
    { id: 'a-review', type: 'structure-reviewer', description: 'review', status: 'running' },
];
function harness($, on, options) {
    if (options === void 0) { options = {}; }
    var logs = [];
    on('session.cwd', function () { return ({ value: CWD }); });
    // Leaving agent.list unanswered makes the mod's lookup throw.
    if (!options.listFails) {
        on('agent.list', function () { return ({ value: AGENTS }); });
    }
    on('ui.log', function (_$, e) {
        logs.push("".concat(e.to, ": ").concat(e.text));
        return { value: undefined };
    });
    for (var _i = 0, _a = ['Edit', 'Write', 'NotebookEdit', 'Bash']; _i < _a.length; _i++) {
        var tool = _a[_i];
        on('tool.call', { tool: tool }, function () { return RAN; });
    }
    var call = function (tool, args, agentId) {
        return $.tool.call(__assign(__assign({ tool: tool }, args), (agentId && { agentId: agentId })));
    };
    var write = function (path, agentId) { return call('Write', { file_path: path, content: 'x' }, agentId); };
    var edit = function (path, agentId) {
        return call('Edit', { file_path: path, old_string: 'a', new_string: 'b' }, agentId);
    };
    return { logs: logs, call: call, write: write, edit: edit };
}
(0, testing_1.test)('a nested test directory and a test file beside production code are in the test tree', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/pkg/sub/tests/data/fixture.json"), 'a-impl')];
            case 1:
                _a.apply(void 0, [_c.sent()]).toEqual({ deny: IMPLEMENTER_REASON });
                _b = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/src/foo.test.ts"), 'a-impl')];
            case 2:
                _b.apply(void 0, [_c.sent()]).toEqual({ deny: IMPLEMENTER_REASON });
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('paths outside the working directory are not guarded for either agent', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write('/tmp/tests/scratch.py', 'a-impl')];
            case 1:
                _a.apply(void 0, [_c.sent()]).toEqual(RAN);
                _b = testing_1.expect;
                return [4 /*yield*/, h.write('/tmp/scratch.py', 'a-test')];
            case 2:
                _b.apply(void 0, [_c.sent()]).toEqual(RAN);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('implementer is denied Write, Edit, and NotebookEdit on the test tree', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/tests/test_x.py"), 'a-impl')];
            case 1:
                _a.apply(void 0, [_d.sent()]).toEqual({ deny: IMPLEMENTER_REASON });
                _b = testing_1.expect;
                return [4 /*yield*/, h.edit("".concat(CWD, "/conftest.py"), 'a-impl')];
            case 2:
                _b.apply(void 0, [_d.sent()]).toEqual({ deny: IMPLEMENTER_REASON });
                _c = testing_1.expect;
                return [4 /*yield*/, h.call('NotebookEdit', { notebook_path: "".concat(CWD, "/tests/check.ipynb"), new_source: 'x' }, 'a-impl')];
            case 3:
                _c.apply(void 0, [_d.sent()]).toEqual({ deny: IMPLEMENTER_REASON });
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('implementer writes production code unchanged', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/src/foo.ts"), 'a-impl')];
            case 1:
                _a.apply(void 0, [_b.sent()]).toEqual(RAN);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('test-author writes tests, its report, and runner config unchanged', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/tests/test_x.py"), 'a-test')];
            case 1:
                _a.apply(void 0, [_d.sent()]).toEqual(RAN);
                _b = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/.orchestrate/my-change/test-author.md"), 'a-test')];
            case 2:
                _b.apply(void 0, [_d.sent()]).toEqual(RAN);
                _c = testing_1.expect;
                return [4 /*yield*/, h.edit("".concat(CWD, "/pyproject.toml"), 'a-test')];
            case 3:
                _c.apply(void 0, [_d.sent()]).toEqual(RAN);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('test-author is denied production code', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.edit("".concat(CWD, "/src/service.py"), 'a-test')];
            case 1:
                _a.apply(void 0, [_b.sent()]).toEqual({ deny: TEST_AUTHOR_REASON });
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('the main session and other agents are not guarded', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/tests/test_x.py"))];
            case 1:
                _a.apply(void 0, [_c.sent()]).toEqual(RAN);
                _b = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/src/foo.py"), 'a-review')];
            case 2:
                _b.apply(void 0, [_c.sent()]).toEqual(RAN);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('implementer Bash calls are not inspected', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.call('Bash', { command: 'echo x > tests/test_x.py' }, 'a-impl')];
            case 1:
                _a.apply(void 0, [_b.sent()]).toEqual(RAN);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('an agent missing from the list is let through and logged', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness($, on);
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/tests/test_x.py"), 'a-unknown')];
            case 1:
                _a.apply(void 0, [_b.sent()]).toEqual(RAN);
                (0, testing_1.expect)(h.logs.some(function (line) { return line.startsWith('debug:') && line.includes('a-unknown'); })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('a failing agent lookup is let through and logged', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness($, on, { listFails: true });
                _a = testing_1.expect;
                return [4 /*yield*/, h.write("".concat(CWD, "/tests/test_x.py"), 'a-impl')];
            case 1:
                _a.apply(void 0, [_b.sent()]).toEqual(RAN);
                (0, testing_1.expect)(h.logs.some(function (line) { return line.startsWith('debug:') && line.includes('agent lookup failed'); })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
