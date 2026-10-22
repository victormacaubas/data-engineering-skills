"use strict";
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
exports.register = void 0;
var rules_1 = require("./rules");
var PLUGIN = 'agent-write-guard';
var targetPath = function (e) {
    var path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path;
    return typeof path === 'string' ? path : undefined;
};
function agentTypeOf($, agentId) {
    return __awaiter(this, void 0, void 0, function () {
        var listed, error_1, reason;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, $.agent.list()];
                case 1:
                    listed = (_a.sent()).find(function (agent) { return agent.id === agentId; });
                    if (listed === undefined) {
                        $.ui.log("".concat(PLUGIN, ": agent ").concat(agentId, " is not in the session's agent list; letting the call through"), {
                            to: 'debug',
                        });
                    }
                    return [2 /*return*/, listed === null || listed === void 0 ? void 0 : listed.type];
                case 2:
                    error_1 = _a.sent();
                    reason = error_1 instanceof Error ? error_1.message : String(error_1);
                    $.ui.log("".concat(PLUGIN, ": agent lookup failed: ").concat(reason, "; letting the call through"), { to: 'debug' });
                    return [2 /*return*/, undefined];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var register = function (on) {
    for (var _i = 0, GUARDED_TOOLS_1 = rules_1.GUARDED_TOOLS; _i < GUARDED_TOOLS_1.length; _i++) {
        var tool = GUARDED_TOOLS_1[_i];
        on('tool.call', { tool: tool }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
            var agentType, path, relative, _a, _b, reason;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (e.agentId === undefined) {
                            return [2 /*return*/, next(e)];
                        }
                        return [4 /*yield*/, agentTypeOf($, e.agentId)];
                    case 1:
                        agentType = _c.sent();
                        if (agentType !== rules_1.IMPLEMENTER && agentType !== rules_1.TEST_AUTHOR) {
                            return [2 /*return*/, next(e)];
                        }
                        path = targetPath(e);
                        if (!(path === undefined)) return [3 /*break*/, 2];
                        _a = undefined;
                        return [3 /*break*/, 4];
                    case 2:
                        _b = rules_1.relativeTo;
                        return [4 /*yield*/, $.session.cwd()];
                    case 3:
                        _a = _b.apply(void 0, [_c.sent(), path]);
                        _c.label = 4;
                    case 4:
                        relative = _a;
                        reason = relative === undefined ? undefined : (0, rules_1.denyReason)(agentType, relative);
                        return [2 /*return*/, reason === undefined ? next(e) : { deny: reason }];
                }
            });
        }); }).catch(function ($, e, next) { return next(e); });
    }
};
exports.register = register;
