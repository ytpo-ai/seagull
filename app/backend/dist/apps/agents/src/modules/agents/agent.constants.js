"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_CONTEXT_FINGERPRINT_TTL_SECONDS = exports.AGENT_ENABLED_SKILL_CACHE_TTL_SECONDS = exports.SKILL_CONTENT_MAX_INJECT_LENGTH = exports.DEFAULT_MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS = exports.DEFAULT_MAX_TOOL_ROUNDS = exports.LEGACY_TOOL_ID_ALIASES = exports.REQUIREMENT_TOOL_IDS = exports.ORCHESTRATION_TOOL_IDS = exports.SEND_INTERNAL_MESSAGE_TOOL_ID = exports.GET_TOOL_SCHEMA_TOOL_ID = exports.MEMO_MCP_APPEND_TOOL_ID = exports.MEMO_MCP_SEARCH_TOOL_ID = exports.REPO_READ_TOOL_ID = exports.CODE_UPDATES_READER_TOOL_ID = exports.CODE_DOCS_READER_TOOL_ID = void 0;
exports.normalizeToolId = normalizeToolId;
exports.normalizeToolIds = normalizeToolIds;
exports.uniqueStrings = uniqueStrings;
exports.compactLogText = compactLogText;
exports.splitTextByMaxLength = splitTextByMaxLength;
exports.toLogError = toLogError;
const builtin_tool_definitions_1 = require("../tools/builtin-tool-definitions");
exports.CODE_DOCS_READER_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__ENGINEERING_DOCS_READ;
exports.CODE_UPDATES_READER_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__ENGINEERING_COMMIT_READ;
exports.REPO_READ_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__ENGINEERING_REPO_READ;
exports.MEMO_MCP_SEARCH_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__AGENT_MEMORY_SEARCH_MEMO;
exports.MEMO_MCP_APPEND_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__AGENT_MEMORY_APPEND_MEMO;
exports.GET_TOOL_SCHEMA_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__GET_TOOL_SCHEMA;
exports.SEND_INTERNAL_MESSAGE_TOOL_ID = builtin_tool_definitions_1.TOOL_ID__SEND_INTERNAL_MESSAGE;
exports.ORCHESTRATION_TOOL_IDS = {
    createPlan: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_CREATE_PLAN,
    updatePlan: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_UPDATE_PLAN,
    runPlan: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_RUN_PLAN,
    getPlan: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_GET_PLAN,
    listPlans: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_LIST_PLANS,
    submitTask: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_SUBMIT_TASK,
    reportTaskRunResult: builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_SUBMIT_TASK_RUN_RESULT,
};
exports.REQUIREMENT_TOOL_IDS = {
    list: builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_LIST,
    get: builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_GET,
    create: builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_CREATE,
    updateStatus: builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_UPDATE_STATUS,
    update: builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_UPDATE,
    syncGithub: builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_SYNC_GITHUB,
};
exports.LEGACY_TOOL_ID_ALIASES = {
    websearch: builtin_tool_definitions_1.TOOL_ID__WEB_SEARCH_EXA,
    webfetch: builtin_tool_definitions_1.TOOL_ID__WEB_FETCH,
    content_extract: builtin_tool_definitions_1.TOOL_ID__CONTENT_EXTRACT,
    'mcp.orchestration.createPlan': exports.ORCHESTRATION_TOOL_IDS.createPlan,
    'mcp.orchestration.updatePlan': exports.ORCHESTRATION_TOOL_IDS.updatePlan,
    'mcp.orchestration.runPlan': exports.ORCHESTRATION_TOOL_IDS.runPlan,
    'mcp.orchestration.getPlan': exports.ORCHESTRATION_TOOL_IDS.getPlan,
    'mcp.orchestration.listPlans': exports.ORCHESTRATION_TOOL_IDS.listPlans,
    'mcp.orchestration.submitTask': exports.ORCHESTRATION_TOOL_IDS.submitTask,
    'mcp.orchestration.reportTaskRunResult': exports.ORCHESTRATION_TOOL_IDS.reportTaskRunResult,
    'mcp.model.list': builtin_tool_definitions_1.TOOL_ID__AGENT_MODEL_LIST,
    'mcp.model.add': builtin_tool_definitions_1.TOOL_ID__AGENT_MODEL_ADD,
    'mcp.humanOperationLog.list': builtin_tool_definitions_1.TOOL_ID__EMPLYEE_LOGS,
    'builtin.sys-mg.mcp.humanOperationLog.list': builtin_tool_definitions_1.TOOL_ID__EMPLYEE_LOGS,
    'internal.agents.list': builtin_tool_definitions_1.TOOL_ID__AGENT_LIST,
    'internal.content.extract': builtin_tool_definitions_1.TOOL_ID__CONTENT_EXTRACT,
    'internal.web.search': builtin_tool_definitions_1.TOOL_ID__WEB_SEARCH_EXA,
    'internal.web.fetch': builtin_tool_definitions_1.TOOL_ID__WEB_FETCH,
};
exports.DEFAULT_MAX_TOOL_ROUNDS = 30;
exports.DEFAULT_MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS = Math.max(2, Number(process.env.MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS || 3));
exports.SKILL_CONTENT_MAX_INJECT_LENGTH = Math.max(500, Number(process.env.SKILL_CONTENT_MAX_INJECT_LENGTH || 4000));
exports.AGENT_ENABLED_SKILL_CACHE_TTL_SECONDS = Math.max(60, Number(process.env.AGENT_ENABLED_SKILL_CACHE_TTL_SECONDS || 300));
exports.SYSTEM_CONTEXT_FINGERPRINT_TTL_SECONDS = Math.max(300, Number(process.env.AGENT_SYSTEM_CONTEXT_FINGERPRINT_TTL_SECONDS || 7200));
function normalizeToolId(toolId) {
    const normalized = String(toolId || '').trim();
    if (!normalized) {
        return '';
    }
    return exports.LEGACY_TOOL_ID_ALIASES[normalized] || normalized;
}
function normalizeToolIds(toolIds) {
    return uniqueStrings(toolIds || []).map((id) => normalizeToolId(id));
}
function uniqueStrings(...groups) {
    const merged = groups.flat().map((item) => String(item || '').trim()).filter(Boolean);
    return Array.from(new Set(merged));
}
function compactLogText(input, maxLength = 120) {
    const normalized = String(input || '')
        .replace(/\s+/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .trim();
    if (!normalized) {
        return 'N/A';
    }
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
function splitTextByMaxLength(input, maxLength) {
    const normalized = String(input || '');
    if (!normalized) {
        return [];
    }
    const safeMaxLength = Math.max(1, Math.floor(Number(maxLength) || 1));
    if (normalized.length <= safeMaxLength) {
        return [normalized];
    }
    const chunks = [];
    for (let index = 0; index < normalized.length; index += safeMaxLength) {
        chunks.push(normalized.slice(index, index + safeMaxLength));
    }
    return chunks;
}
function toLogError(error) {
    if (error instanceof Error) {
        return {
            message: compactLogText(error.message, 500),
            stack: error.stack,
        };
    }
    return {
        message: compactLogText(String(error || 'Unknown error'), 500),
    };
}
//# sourceMappingURL=agent.constants.js.map