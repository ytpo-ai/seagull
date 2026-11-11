"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeFailRunInputSchema = exports.RuntimeCompleteRunInputSchema = exports.RuntimeToolEventInputSchema = exports.RuntimeStartRunInputSchema = void 0;
const zod_1 = require("zod");
exports.RuntimeStartRunInputSchema = zod_1.z.object({
    agentId: zod_1.z.string().min(1),
    agentName: zod_1.z.string().min(1),
    taskId: zod_1.z.string().min(1).optional(),
    sessionId: zod_1.z.string().min(1).optional(),
    taskTitle: zod_1.z.string().min(1),
    taskDescription: zod_1.z.string().default(''),
    userContent: zod_1.z.string().default(''),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.RuntimeToolEventInputSchema = zod_1.z.object({
    runId: zod_1.z.string().min(1),
    agentId: zod_1.z.string().min(1),
    sessionId: zod_1.z.string().min(1).optional(),
    taskId: zod_1.z.string().min(1).optional(),
    toolId: zod_1.z.string().min(1),
    toolName: zod_1.z.string().min(1).optional(),
    toolCallId: zod_1.z.string().min(1),
    input: zod_1.z.unknown().optional(),
    output: zod_1.z.unknown().optional(),
    error: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.RuntimeCompleteRunInputSchema = zod_1.z.object({
    runId: zod_1.z.string().min(1),
    agentId: zod_1.z.string().min(1),
    sessionId: zod_1.z.string().min(1).optional(),
    taskId: zod_1.z.string().min(1).optional(),
    assistantContent: zod_1.z.string().default(''),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.RuntimeFailRunInputSchema = zod_1.z.object({
    runId: zod_1.z.string().min(1),
    agentId: zod_1.z.string().min(1),
    sessionId: zod_1.z.string().min(1).optional(),
    taskId: zod_1.z.string().min(1).optional(),
    error: zod_1.z.string().min(1),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
//# sourceMappingURL=runtime-run.contract.js.map