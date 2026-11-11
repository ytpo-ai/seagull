"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLatestUserContent = resolveLatestUserContent;
exports.isMeetingLikeTask = isMeetingLikeTask;
exports.resolveResponseFormatFromCollaborationContext = resolveResponseFormatFromCollaborationContext;
exports.isMeaninglessAssistantResponse = isMeaninglessAssistantResponse;
exports.shouldRetryGenerationError = shouldRetryGenerationError;
exports.isModelTimeoutError = isModelTimeoutError;
exports.resolveOpenCodeRuntimeOptions = resolveOpenCodeRuntimeOptions;
exports.extractToolCall = extractToolCall;
exports.extractAllToolCalls = extractAllToolCalls;
exports.isToolInputErrorMessage = isToolInputErrorMessage;
exports.buildToolInputRepairInstruction = buildToolInputRepairInstruction;
exports.buildToolSchemaHint = buildToolSchemaHint;
exports.hasEffectiveSchema = hasEffectiveSchema;
exports.getToolInputPreflightError = getToolInputPreflightError;
exports.stripToolCallMarkup = stripToolCallMarkup;
exports.buildTaskResultMemo = buildTaskResultMemo;
const contracts_1 = require("../../../../../libs/contracts/src/index");
const agent_constants_1 = require("./agent.constants");
function resolveLatestUserContent(task, messages) {
    const latestUserMessage = [...(task.messages || []), ...(messages || [])]
        .reverse()
        .find((item) => item?.role === 'user' && typeof item.content === 'string' && item.content.trim().length > 0)?.content;
    return latestUserMessage ? (0, contracts_1.extractTextContent)(latestUserMessage) : (task.description || task.title || '');
}
function isMeetingLikeTask(task, context) {
    if (task.type === 'meeting' || context?.taskType === 'meeting') {
        return true;
    }
    const collaborationContext = context?.collaborationContext;
    if (!collaborationContext || typeof collaborationContext !== 'object') {
        return false;
    }
    if (String(collaborationContext.scenarioMode || '').trim() === 'meeting') {
        return true;
    }
    return Boolean(collaborationContext.meetingId && collaborationContext.collaborationMode === 'meeting');
}
function resolveResponseFormatFromCollaborationContext(collaborationContext, modelConfig) {
    if (!collaborationContext || typeof collaborationContext !== 'object') {
        return undefined;
    }
    if (isReasoningModel(modelConfig)) {
        return undefined;
    }
    const responseDirective = String(collaborationContext.responseDirective || '').trim();
    if (responseDirective === 'json-only') {
        return { type: 'json_object' };
    }
    if (String(collaborationContext.format || '').trim() === 'json') {
        return { type: 'json_object' };
    }
    return undefined;
}
function isReasoningModel(modelConfig) {
    if (!modelConfig) {
        return false;
    }
    const provider = String(modelConfig.provider || '').trim().toLowerCase();
    if (provider !== 'openai') {
        return false;
    }
    if (modelConfig.reasoning?.enabled) {
        return true;
    }
    const modelName = String(modelConfig.model || '').trim().toLowerCase();
    return modelName.startsWith('o1') || modelName.startsWith('o3') || modelName.startsWith('o4') || modelName.startsWith('gpt-5');
}
function isMeaninglessAssistantResponse(response) {
    const normalized = String(response || '').trim();
    if (!normalized) {
        return true;
    }
    if (['-', '—', '–', '...', '…'].includes(normalized)) {
        return true;
    }
    return /^[\s\-—–_.…]+$/.test(normalized);
}
function shouldRetryGenerationError(error) {
    const message = (0, agent_constants_1.toLogError)(error).message.toLowerCase();
    return (message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('econnreset') ||
        message.includes('socket hang up') ||
        message.includes('temporar') ||
        message.includes('rate limit') ||
        message.includes('503') ||
        message.includes('502'));
}
function isModelTimeoutError(error) {
    const message = error instanceof Error ? error.message : String(error || '');
    const lower = message.toLowerCase();
    return (lower.includes('request timed out') ||
        lower.includes('timeout') ||
        lower.includes('etimedout') ||
        lower.includes('abort'));
}
function resolveOpenCodeRuntimeOptions(executionConfig, runtime) {
    const endpoint = String(executionConfig.endpoint || '').trim();
    if (endpoint) {
        return {
            baseUrl: endpoint,
            authEnable: executionConfig.authEnable,
            source: 'agent_config_endpoint',
        };
    }
    const endpointRef = String(executionConfig.endpointRef || '').trim();
    if (endpointRef) {
        return {
            baseUrl: endpointRef,
            authEnable: executionConfig.authEnable,
            source: 'agent_config_endpoint_ref',
        };
    }
    const runtimeEndpoint = String(runtime?.endpoint || '').trim();
    if (runtimeEndpoint) {
        return {
            baseUrl: runtimeEndpoint,
            authEnable: runtime?.authEnable ?? executionConfig.authEnable,
            source: 'runtime_endpoint',
        };
    }
    const runtimeEndpointRef = String(runtime?.endpointRef || '').trim();
    if (runtimeEndpointRef) {
        return {
            baseUrl: runtimeEndpointRef,
            authEnable: runtime?.authEnable ?? executionConfig.authEnable,
            source: 'runtime_endpoint_ref',
        };
    }
    return {
        baseUrl: undefined,
        authEnable: executionConfig.authEnable,
        source: 'env_default',
    };
}
function extractToolCall(response) {
    const all = extractAllToolCalls(response);
    return all.length > 0 ? all[0] : null;
}
function extractAllToolCalls(response) {
    const results = [];
    const closedTagRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
    let match;
    while ((match = closedTagRegex.exec(response)) !== null) {
        const parsed = parseToolCallPayload(match[1]);
        if (parsed) {
            results.push(parsed);
        }
    }
    if (results.length > 0) {
        return results;
    }
    const openTagOnlyMatch = response.match(/<tool_call>\s*([\s\S]*)$/i);
    if (openTagOnlyMatch) {
        const parsed = parseToolCallPayload(openTagOnlyMatch[1]);
        if (parsed) {
            return [parsed];
        }
    }
    if (response.includes('"tool"') && response.includes('"parameters"')) {
        const parsed = parseToolCallPayload(response);
        if (parsed) {
            return [parsed];
        }
    }
    return [];
}
function isToolInputErrorMessage(message) {
    const normalized = String(message || '').toLowerCase();
    if (!normalized)
        return false;
    if (normalized.includes('invalid tool parameters'))
        return true;
    if (normalized.includes('missing required field'))
        return true;
    if (normalized.includes('requires') && normalized.includes('parameter'))
        return true;
    if (normalized.includes('requires receiveragentid'))
        return true;
    if (normalized.includes('requires title and content'))
        return true;
    if (normalized.includes('title and content are required'))
        return true;
    return false;
}
function buildToolInputRepairInstruction(normalizedToolId, schema, previousParameters, errorReason) {
    const schemaText = (0, agent_constants_1.compactLogText)(JSON.stringify(schema || {}), 2400);
    const paramsText = (0, agent_constants_1.compactLogText)(JSON.stringify(previousParameters || {}), 1200);
    return [
        `参数修正要求：你刚刚调用工具 ${normalizedToolId} 时参数不符合契约。`,
        errorReason ? `错误原因：${errorReason}` : '',
        '仅基于以下工具定义修正参数并立即重试，不要补充其他解释文本。',
        `inputSchema=${schemaText}`,
        `lastParameters=${paramsText}`,
        `请只输出 <tool_call>{"tool":"${normalizedToolId}","parameters":{...}}</tool_call>`,
    ]
        .filter(Boolean)
        .join('\n');
}
function buildToolSchemaHint(toolId, schema) {
    const properties = schema?.properties;
    if (!properties || typeof properties !== 'object')
        return null;
    const required = new Set(Array.isArray(schema.required)
        ? schema.required.map((r) => String(r || ''))
        : []);
    const propEntries = Object.entries(properties);
    if (propEntries.length === 0)
        return null;
    const lines = [`工具参数契约 ${toolId}:`];
    if (required.size > 0) {
        lines.push(`required: [${[...required].join(', ')}]`);
    }
    const additionalProperties = schema?.additionalProperties;
    if (additionalProperties === false) {
        lines.push('additionalProperties: false（禁止传入未定义的字段）');
    }
    lines.push('properties:');
    for (const [key, spec] of propEntries) {
        const type = spec?.type || 'any';
        const enumValues = Array.isArray(spec?.enum) ? `, enum=${JSON.stringify(spec.enum)}` : '';
        const desc = spec?.description ? ` - ${spec.description}` : '';
        const req = required.has(key) ? ' (必填)' : '';
        lines.push(`  ${key}: ${type}${enumValues}${req}${desc}`);
    }
    return lines.join('\n');
}
function hasEffectiveSchema(schema) {
    const properties = schema?.properties;
    if (!properties || typeof properties !== 'object')
        return false;
    return Object.keys(properties).length > 0;
}
function getToolInputPreflightError(schema, parameters) {
    if (!schema || typeof schema !== 'object') {
        return null;
    }
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
        return 'parameters must be object';
    }
    const required = Array.isArray(schema.required)
        ? schema.required.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    for (const key of required) {
        if (!(key in parameters) || parameters[key] === undefined || parameters[key] === null) {
            return `missing required field '${key}'`;
        }
    }
    const properties = schema.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
        return null;
    }
    if (schema.additionalProperties === false) {
        const allowed = new Set(Object.keys(properties));
        const extras = Object.keys(parameters).filter((key) => !allowed.has(key));
        if (extras.length) {
            return `unknown fields ${extras.join(',')}`;
        }
    }
    for (const [key, spec] of Object.entries(properties)) {
        if (!(key in parameters))
            continue;
        const expectedType = String(spec?.type || '').trim();
        if (!expectedType)
            continue;
        const value = parameters[key];
        if (value === undefined || value === null)
            continue;
        if (expectedType === 'string' && typeof value !== 'string')
            return `field '${key}' must be string`;
        if (expectedType === 'number' && typeof value !== 'number')
            return `field '${key}' must be number`;
        if (expectedType === 'integer' && (!Number.isInteger(value) || typeof value !== 'number')) {
            return `field '${key}' must be integer`;
        }
        if (expectedType === 'boolean' && typeof value !== 'boolean')
            return `field '${key}' must be boolean`;
        if (expectedType === 'array' && !Array.isArray(value))
            return `field '${key}' must be array`;
        if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
            return `field '${key}' must be object`;
        }
    }
    return null;
}
function stripToolCallMarkup(content) {
    const withoutClosedBlocks = content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '');
    const withoutDanglingBlocks = withoutClosedBlocks.replace(/<tool_call>\s*[\s\S]*$/gi, '');
    return withoutDanglingBlocks.trim();
}
function buildTaskResultMemo(response) {
    const normalized = String(response || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= 800)
        return normalized;
    return `${normalized.slice(0, 797)}...`;
}
function sanitizeJsonString(raw) {
    let s = raw.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    let normalized = '';
    for (let i = 0; i < s.length; i += 1) {
        const char = s[i];
        if (char.charCodeAt(0) >= 32) {
            normalized += char;
        }
    }
    s = normalized;
    s = s.replace(/,\s*([}\]])/g, '$1');
    return s;
}
function tryParseToolJson(text) {
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && typeof parsed.tool === 'string') {
            return {
                tool: parsed.tool,
                parameters: parsed.parameters && typeof parsed.parameters === 'object' ? parsed.parameters : {},
            };
        }
    }
    catch {
    }
    return null;
}
function parseToolCallPayload(payload) {
    const cleaned = payload.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const candidates = [];
    candidates.push(cleaned);
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(cleaned.slice(firstBrace, lastBrace + 1).trim());
    }
    for (const candidate of candidates) {
        if (!candidate)
            continue;
        for (const text of [candidate, sanitizeJsonString(candidate)]) {
            const result = tryParseToolJson(text);
            if (result)
                return result;
            if (text.endsWith('}')) {
                let trimmed = text;
                for (let i = 0; i < 3; i++) {
                    trimmed = trimmed.slice(0, -1).trim();
                    if (!trimmed.endsWith('}'))
                        break;
                    const r = tryParseToolJson(trimmed);
                    if (r)
                        return r;
                }
            }
        }
    }
    return null;
}
//# sourceMappingURL=agent-executor.helpers.js.map