"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTaskStatusSchema = exports.CancelAgentTaskBodySchema = exports.CreateAgentTaskBodySchema = exports.AgentTaskEventSchema = exports.AgentTaskEventTypeSchema = exports.AGENT_TASK_EVENT_TYPES = void 0;
const zod_1 = require("zod");
exports.AGENT_TASK_EVENT_TYPES = [
    'status',
    'progress',
    'token',
    'tool',
    'result',
    'error',
    'heartbeat',
];
exports.AgentTaskEventTypeSchema = zod_1.z.enum(exports.AGENT_TASK_EVENT_TYPES);
exports.AgentTaskEventSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    type: exports.AgentTaskEventTypeSchema,
    taskId: zod_1.z.string().min(1),
    runId: zod_1.z.string().min(1).optional(),
    sequence: zod_1.z.number().int().nonnegative(),
    timestamp: zod_1.z.string().min(1),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
});
exports.CreateAgentTaskBodySchema = zod_1.z.object({
    agentId: zod_1.z.string().min(1),
    task: zod_1.z.string().min(1),
    sessionContext: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    idempotencyKey: zod_1.z.string().min(1).max(128).optional(),
});
exports.CancelAgentTaskBodySchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(500).optional(),
});
exports.AgentTaskStatusSchema = zod_1.z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
//# sourceMappingURL=agent-task.contract.js.map