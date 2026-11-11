"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferProviderFromToolId = inferProviderFromToolId;
exports.parseToolIdentity = parseToolIdentity;
exports.inferExecutionChannel = inferExecutionChannel;
exports.inferNamespaceFromToolId = inferNamespaceFromToolId;
exports.inferToolkitFromToolId = inferToolkitFromToolId;
exports.inferToolkitIdFromToolId = inferToolkitIdFromToolId;
exports.inferResourceAndAction = inferResourceAndAction;
exports.getToolkitDisplayName = getToolkitDisplayName;
exports.buildBuiltinToolMetadata = buildBuiltinToolMetadata;
exports.inferToolkitAuthStrategy = inferToolkitAuthStrategy;
exports.isSystemManagementTool = isSystemManagementTool;
exports.normalizeStringArray = normalizeStringArray;
function inferProviderFromToolId(toolId) {
    return parseToolIdentity(toolId).provider;
}
function parseToolIdentity(toolId) {
    const parts = String(toolId || '').split('.').filter(Boolean);
    if (!parts.length) {
        return {
            provider: 'builtin',
            executionChannel: 'internal',
            namespace: 'other',
            toolkit: 'generic',
            toolkitId: 'builtin.other.internal.generic',
            resource: 'generic',
            action: 'execute',
        };
    }
    if ((parts[0] === 'builtin' || parts[0] === 'composio') && parts.length >= 5 && ['mcp', 'internal'].includes(parts[2])) {
        const provider = parts[0];
        const namespace = parts[1] || 'other';
        const executionChannel = parts[2] || 'internal';
        const toolkit = parts[3] || 'generic';
        const action = parts.slice(4).join('.') || 'execute';
        return {
            provider,
            executionChannel,
            namespace,
            toolkit,
            toolkitId: `${provider}.${namespace}.${executionChannel}.${toolkit}`,
            resource: toolkit,
            action,
        };
    }
    if (parts[0] === 'builtin' || parts[0] === 'composio') {
        const provider = parts[0];
        const executionChannel = parts[1] || (provider === 'composio' ? 'mcp' : 'internal');
        const namespace = parts[2] || 'other';
        const toolkit = parts[2] || 'generic';
        const resource = parts[2] || 'generic';
        const action = parts.slice(3).join('.') || 'execute';
        return {
            provider,
            executionChannel,
            namespace,
            toolkit,
            toolkitId: `${provider}.${namespace}.${executionChannel}.${toolkit}`,
            resource,
            action,
        };
    }
    const provider = parts[0] === 'composio' ? 'composio' : 'builtin';
    const executionChannel = parts[0] === 'internal' ? 'internal' : parts[1] || 'internal';
    const namespace = parts[2] || parts[1] || parts[0] || 'other';
    const toolkit = parts[3] || namespace;
    const action = parts.slice(4).join('.') || parts.slice(3).join('.') || 'execute';
    return {
        provider,
        executionChannel,
        namespace,
        toolkit,
        toolkitId: `${provider}.${namespace}.${executionChannel}.${toolkit}`,
        resource: toolkit,
        action,
    };
}
function inferExecutionChannel(toolId) {
    return parseToolIdentity(toolId).executionChannel;
}
function inferNamespaceFromToolId(toolId) {
    return parseToolIdentity(toolId).namespace;
}
function inferToolkitFromToolId(toolId) {
    return parseToolIdentity(toolId).toolkit;
}
function inferToolkitIdFromToolId(toolId) {
    return parseToolIdentity(toolId).toolkitId;
}
function inferResourceAndAction(toolId) {
    const parsed = parseToolIdentity(toolId);
    return { resource: parsed.resource, action: parsed.action };
}
function getToolkitDisplayName(toolkit) {
    return toolkit
        .split('-')
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}
function buildBuiltinToolMetadata(toolData) {
    const canonicalId = toolData.id;
    const identity = parseToolIdentity(canonicalId);
    const provider = identity.provider;
    const executionChannel = identity.executionChannel;
    const namespace = identity.namespace;
    const { resource, action } = inferResourceAndAction(canonicalId);
    return {
        canonicalId,
        provider,
        executionChannel,
        toolkitId: identity.toolkitId,
        namespace,
        resource,
        action,
        capabilitySet: [toolData.category.toLowerCase().replace(/\s+/g, '_')],
        tags: [namespace, provider, executionChannel, identity.toolkit],
        status: 'active',
        deprecated: false,
        aliases: canonicalId === toolData.id ? [] : [toolData.id],
        inputSchema: toolData.implementation?.parameters || {},
        outputSchema: {},
    };
}
function inferToolkitAuthStrategy(provider, namespace, toolkit) {
    if (provider === 'composio' && ['gmail', 'slack', 'github'].includes(toolkit || namespace))
        return 'oauth2';
    if (provider === 'builtin')
        return 'none';
    return 'apiKey';
}
function isSystemManagementTool(toolId) {
    const normalized = String(toolId || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return (normalized.startsWith('builtin.engineering.mcp.') ||
        normalized.startsWith('builtin.sys-mg.mcp.orchestration.') ||
        normalized.startsWith('builtin.sys-mg.mcp.agent-model.') ||
        normalized.startsWith('builtin.sys-mg.mcp.agent-skill.') ||
        normalized.startsWith('builtin.sys-mg.mcp.prompt-registry.') ||
        normalized.startsWith('builtin.sys-mg.mcp.audit.') ||
        normalized.startsWith('builtin.sys-mg.mcp.agent.') ||
        normalized.startsWith('builtin.sys-mg.mcp.agent-role.') ||
        normalized.startsWith('builtin.sys-mg.mcp.agent-memory.') ||
        normalized.startsWith('builtin.sys-mg.mcp.tool-schema.'));
}
function normalizeStringArray(items) {
    return Array.from(new Set((Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)));
}
//# sourceMappingURL=tool-identity.util.js.map