"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeEventSchema = exports.RuntimeEventTypeSchema = void 0;
const zod_1 = require("zod");
exports.RuntimeEventTypeSchema = zod_1.z.enum([
    'run.started',
    'run.step.started',
    'llm.delta',
    'tool.pending',
    'tool.running',
    'tool.completed',
    'tool.failed',
    'run.compacted',
    'run.paused',
    'run.resumed',
    'run.completed',
    'run.failed',
    'run.cancelled',
    'permission.asked',
    'permission.replied',
    'permission.denied',
]);
exports.RuntimeEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().min(1),
    eventType: exports.RuntimeEventTypeSchema,
    agentId: zod_1.z.string().min(1),
    sessionId: zod_1.z.string().min(1).optional(),
    runId: zod_1.z.string().min(1),
    taskId: zod_1.z.string().min(1).optional(),
    messageId: zod_1.z.string().min(1).optional(),
    partId: zod_1.z.string().min(1).optional(),
    toolCallId: zod_1.z.string().min(1).optional(),
    sequence: zod_1.z.number().int().nonnegative(),
    timestamp: zod_1.z.number().int().positive(),
    traceId: zod_1.z.string().min(1),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
});
//# sourceMappingURL=runtime-event.contract.js.map