"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_TASK_RUNTIME_STATUS_TTL_SECONDS = exports.AGENT_TASK_RUNTIME_STATUS_INDEX_KEY = void 0;
exports.buildAgentRuntimeStatusKey = buildAgentRuntimeStatusKey;
exports.buildIdleAgentRuntimeStatus = buildIdleAgentRuntimeStatus;
exports.parseAgentRuntimeStatus = parseAgentRuntimeStatus;
const AGENT_TASK_RUNTIME_STATUS_KEY_PREFIX = 'agent:runtime-status:';
exports.AGENT_TASK_RUNTIME_STATUS_INDEX_KEY = 'agent:runtime-status:index';
exports.AGENT_TASK_RUNTIME_STATUS_TTL_SECONDS = Math.max(60, Number(process.env.AGENT_TASK_RUNTIME_STATUS_TTL_SECONDS || 6 * 60 * 60));
function buildAgentRuntimeStatusKey(agentId) {
    return `${AGENT_TASK_RUNTIME_STATUS_KEY_PREFIX}${String(agentId || '').trim()}`;
}
function buildIdleAgentRuntimeStatus(agentId, taskId) {
    return {
        agentId: String(agentId || '').trim(),
        ...(taskId ? { taskId: String(taskId || '').trim() } : {}),
        status: 'idle',
        updatedAt: new Date().toISOString(),
        source: 'agent_task_tool',
    };
}
function parseAgentRuntimeStatus(raw) {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        const agentId = String(parsed?.agentId || '').trim();
        const status = String(parsed?.status || '').trim();
        if (!agentId || !status) {
            return null;
        }
        return {
            agentId,
            taskId: parsed?.taskId ? String(parsed.taskId).trim() : undefined,
            toolId: parsed?.toolId ? String(parsed.toolId).trim() : undefined,
            toolName: parsed?.toolName ? String(parsed.toolName).trim() : undefined,
            status,
            updatedAt: parsed?.updatedAt ? String(parsed.updatedAt).trim() : new Date().toISOString(),
            source: 'agent_task_tool',
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=agent-task-runtime-status.util.js.map