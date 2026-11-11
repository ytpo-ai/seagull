"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ToolExecutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const tool_schema_1 = require("../../schemas/tool.schema");
const tool_execution_schema_1 = require("../../schemas/tool-execution.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_role_schema_1 = require("../../schemas/agent-role.schema");
const role_tier_1 = require("../../../../../src/shared/role-tier");
const tool_governance_service_1 = require("./tool-governance.service");
const tool_registry_service_1 = require("./tool-registry.service");
const tool_execution_dispatcher_service_1 = require("./tool-execution-dispatcher.service");
const tool_identity_util_1 = require("./tool-identity.util");
let ToolExecutionService = ToolExecutionService_1 = class ToolExecutionService {
    constructor(toolModel, executionModel, agentModel, agentRoleModel, toolGovernanceService, dispatcher, registry) {
        this.toolModel = toolModel;
        this.executionModel = executionModel;
        this.agentModel = agentModel;
        this.agentRoleModel = agentRoleModel;
        this.toolGovernanceService = toolGovernanceService;
        this.dispatcher = dispatcher;
        this.registry = registry;
        this.logger = new common_1.Logger(ToolExecutionService_1.name);
        this.rolePermissionCacheTtlMs = Math.max(30000, Number(process.env.TOOL_ROLE_PERMISSION_CACHE_TTL_MS || 300000));
        this.rolePermissionCache = new Map();
    }
    normalizeErrorToCode(error) {
        return this.normalizeToolError(error).code;
    }
    isRetryableError(error) {
        const code = this.normalizeErrorToCode(error);
        return this.toolGovernanceService.isRetryableCode(code);
    }
    async executeTool(toolId, agentId, parameters, taskId, executionContext) {
        const tool = await this.registry.getTool(toolId);
        if (!tool) {
            throw new Error(`Tool not found: ${toolId}`);
        }
        if (!tool.enabled) {
            throw new Error(`Tool is disabled: ${toolId}`);
        }
        const resolvedCanonicalToolId = tool.canonicalId || tool.id;
        const traceId = (0, uuid_1.v4)();
        const governance = this.toolGovernanceService.getGovernancePolicy((tool.config || {}));
        const idempotencyKey = this.toolGovernanceService.getIdempotencyKey(parameters, executionContext);
        if (idempotencyKey) {
            const idempotentCutoff = new Date(Date.now() - governance.idempotencyTtlMs);
            const existing = await this.executionModel
                .findOne({
                agentId,
                toolId: resolvedCanonicalToolId,
                idempotencyKey,
                status: 'completed',
                timestamp: { $gte: idempotentCutoff },
            })
                .sort({ timestamp: -1 })
                .exec();
            if (existing) {
                return existing;
            }
        }
        this.toolGovernanceService.enforceRateLimit(resolvedCanonicalToolId, agentId, governance);
        this.toolGovernanceService.ensureCircuitClosed(resolvedCanonicalToolId);
        const executionChannel = (0, tool_identity_util_1.inferExecutionChannel)(resolvedCanonicalToolId);
        const execution = new this.executionModel({
            id: (0, uuid_1.v4)(),
            traceId,
            requestedToolId: toolId,
            resolvedToolId: resolvedCanonicalToolId,
            executionChannel,
            toolId: resolvedCanonicalToolId,
            agentId,
            taskId,
            idempotencyKey,
            authMode: executionContext?.auth?.mode,
            tokenJti: executionContext?.auth?.jti,
            originSessionId: executionContext?.originSessionId,
            parameters,
            status: 'executing',
            tokenCost: tool.tokenCost || 0,
            retryCount: 0,
        });
        await execution.save();
        try {
            await this.authorizeToolExecution(tool, agentId, executionContext);
            this.validateToolInput(parameters, (tool.inputSchema || tool.implementation?.parameters));
            let attempt = 0;
            let rawResult;
            const maxRetries = Math.min(governance.maxRetries, 5);
            while (attempt <= maxRetries) {
                try {
                    rawResult = await this.toolGovernanceService.executeWithTimeout(() => this.dispatcher.executeToolImplementation(tool, parameters, agentId, {
                        ...(executionContext || {}),
                        taskId: taskId || executionContext?.taskId,
                        idempotencyKey,
                    }), governance.timeoutMs);
                    execution.retryCount = attempt;
                    break;
                }
                catch (error) {
                    const shouldRetry = attempt < maxRetries && this.isRetryableError(error);
                    if (!shouldRetry) {
                        throw error;
                    }
                    attempt += 1;
                    execution.retryCount = attempt;
                    await this.toolGovernanceService.sleep(Math.min(1000 * attempt, 3000));
                }
            }
            execution.result = this.normalizeToolResult(rawResult, traceId);
            execution.status = 'completed';
            execution.executionTime = Date.now() - execution.timestamp.getTime();
            await execution.save();
            this.toolGovernanceService.recordCircuitSuccess(resolvedCanonicalToolId);
            return execution;
        }
        catch (error) {
            execution.status = 'failed';
            const normalizedError = this.normalizeToolError(error);
            execution.error = normalizedError.message;
            execution.errorCode = normalizedError.code;
            execution.result = {
                success: false,
                error: normalizedError,
                traceId,
            };
            execution.executionTime = Date.now() - execution.timestamp.getTime();
            await execution.save();
            this.toolGovernanceService.recordCircuitFailure(resolvedCanonicalToolId, governance);
            throw error;
        }
    }
    async authorizeToolExecution(tool, agentId, executionContext) {
        if (!tool.enabled) {
            throw new Error('Tool is disabled');
        }
        if (!agentId?.trim()) {
            throw new Error('Missing agentId in tool execution');
        }
        const authMode = String(executionContext?.auth?.mode || '').trim().toLowerCase();
        const normalizedAgentId = agentId.trim();
        const agentLookup = { id: normalizedAgentId };
        if (mongoose_2.Types.ObjectId.isValid(normalizedAgentId)) {
            agentLookup.$or = [{ id: normalizedAgentId }, { _id: new mongoose_2.Types.ObjectId(normalizedAgentId) }];
            delete agentLookup.id;
        }
        const agent = await this.agentModel
            .findOne(agentLookup)
            .select({ id: 1, roleId: 1, tier: 1, tools: 1, permissions: 1, isActive: 1 })
            .lean()
            .exec();
        if (!agent) {
            throw new Error(`Agent not found or inactive: ${agentId}`);
        }
        const requireActiveAgent = authMode === 'jwt';
        if (agent.isActive !== true && requireActiveAgent) {
            throw new Error(`Agent not found or inactive: ${agentId}`);
        }
        const resolvedToolId = String(tool.canonicalId || tool.id || '').trim() || String(tool.id || '').trim();
        const agentTier = (0, role_tier_1.normalizeAgentRoleTier)(agent?.tier);
        if (agentTier === 'temporary' && (0, tool_identity_util_1.isSystemManagementTool)(resolvedToolId)) {
            throw new Error(`temporary_worker_tool_violation: ${resolvedToolId}`);
        }
        const scopeSet = new Set((executionContext?.auth?.scopes || []).map((scope) => String(scope || '').trim()).filter(Boolean));
        if (scopeSet.size > 0 && !scopeSet.has('tool:execute:*') && !scopeSet.has(`tool:execute:${resolvedToolId}`)) {
            throw new Error(`Tool scope denied: ${resolvedToolId}`);
        }
        const strictPermissions = String(process.env.TOOLS_AUTH_STRICT_PERMISSIONS || 'false').trim().toLowerCase();
        const strict = strictPermissions === 'true' || strictPermissions === '1' || strictPermissions === 'yes' || strictPermissions === 'on';
        const assignedToolIds = new Set((agent.tools || []).map((item) => String(item || '').trim()).filter(Boolean));
        const authFree = tool.authFree === true;
        const enforceAssignment = strict || authMode === 'jwt' || assignedToolIds.size > 0;
        if (enforceAssignment
            && !authFree
            && !assignedToolIds.has(resolvedToolId)
            && !assignedToolIds.has(String(tool.id || '').trim())) {
            throw new Error(`Tool not assigned: ${resolvedToolId}`);
        }
        const requiredPermissions = Array.from(new Set((Array.isArray(tool.requiredPermissions) ? tool.requiredPermissions : [])
            .map((item) => String(item?.id || '').trim())
            .filter(Boolean)));
        if (requiredPermissions.length) {
            const roleBasedPermissions = await this.resolveRoleAndProfilePermissions(agent.roleId);
            const granted = new Set([
                ...(agent.permissions || []),
                ...roleBasedPermissions,
                ...(executionContext?.auth?.permissions || []),
            ]
                .map((item) => String(item || '').trim())
                .filter(Boolean));
            const missing = requiredPermissions.filter((permissionId) => !granted.has(permissionId));
            if (missing.length) {
                throw new Error(`Tool permission denied: missing=${missing.join(',')}`);
            }
        }
    }
    async resolveRoleAndProfilePermissions(roleId) {
        const normalizedRoleId = String(roleId || '').trim();
        if (!normalizedRoleId) {
            return [];
        }
        const now = Date.now();
        const cached = this.rolePermissionCache.get(normalizedRoleId);
        if (cached && cached.expiresAt > now) {
            return cached.permissions;
        }
        const result = {
            roleCode: undefined,
            permissions: [],
        };
        try {
            const role = await this.agentRoleModel
                .findOne({ id: normalizedRoleId })
                .select({ code: 1, capabilities: 1, permissions: 1, permissionsManual: 1, permissionsDerived: 1 })
                .lean()
                .exec();
            result.roleCode = String(role?.code || '').trim() || undefined;
            result.permissions = (0, tool_identity_util_1.normalizeStringArray)([
                ...(role?.capabilities || []),
                ...(role?.permissions || []),
                ...(role?.permissionsManual || []),
                ...(role?.permissionsDerived || []),
            ]);
        }
        catch {
            result.roleCode = undefined;
            result.permissions = [];
        }
        this.rolePermissionCache.set(normalizedRoleId, {
            roleCode: result.roleCode,
            permissions: result.permissions,
            expiresAt: now + this.rolePermissionCacheTtlMs,
        });
        return result.permissions;
    }
    validateToolInput(parameters, inputSchema) {
        if (parameters === undefined || parameters === null) {
            throw new Error('Missing tool parameters');
        }
        if (!inputSchema || typeof inputSchema !== 'object') {
            return;
        }
        const required = Array.isArray(inputSchema.required)
            ? inputSchema.required.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        if (required.length) {
            for (const key of required) {
                if (!(key in parameters) || parameters[key] === undefined || parameters[key] === null) {
                    throw new Error(`Invalid tool parameters: missing required field '${key}'`);
                }
            }
        }
        const properties = inputSchema.properties;
        if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
            const additionalProperties = inputSchema.additionalProperties;
            if (additionalProperties === false) {
                const allowed = new Set(Object.keys(properties));
                const extras = Object.keys(parameters || {}).filter((key) => !allowed.has(key));
                if (extras.length) {
                    throw new Error(`Invalid tool parameters: unknown fields ${extras.join(',')}`);
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
                if (expectedType === 'string' && typeof value !== 'string') {
                    throw new Error(`Invalid tool parameters: field '${key}' must be string`);
                }
                if (expectedType === 'number' && typeof value !== 'number') {
                    throw new Error(`Invalid tool parameters: field '${key}' must be number`);
                }
                if (expectedType === 'integer' && (!Number.isInteger(value) || typeof value !== 'number')) {
                    throw new Error(`Invalid tool parameters: field '${key}' must be integer`);
                }
                if (expectedType === 'boolean' && typeof value !== 'boolean') {
                    throw new Error(`Invalid tool parameters: field '${key}' must be boolean`);
                }
                if (expectedType === 'array' && !Array.isArray(value)) {
                    throw new Error(`Invalid tool parameters: field '${key}' must be array`);
                }
                if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
                    throw new Error(`Invalid tool parameters: field '${key}' must be object`);
                }
            }
        }
    }
    normalizeToolInputSchema(inputSchema, implementationParameters) {
        const explicit = this.toJsonSchemaObject(inputSchema);
        if (explicit)
            return explicit;
        const fallback = this.toJsonSchemaObject(implementationParameters);
        if (fallback)
            return fallback;
        return null;
    }
    toJsonSchemaObject(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return null;
        }
        const candidate = raw;
        const hasJsonSchemaShape = candidate.properties !== undefined ||
            candidate.required !== undefined ||
            candidate.additionalProperties !== undefined;
        if (hasJsonSchemaShape) {
            const properties = candidate.properties && typeof candidate.properties === 'object' && !Array.isArray(candidate.properties)
                ? candidate.properties
                : {};
            const required = Array.isArray(candidate.required)
                ? candidate.required.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
            const additionalProperties = typeof candidate.additionalProperties === 'boolean' ? candidate.additionalProperties : true;
            return {
                type: 'object',
                properties,
                required,
                additionalProperties,
            };
        }
        const properties = Object.entries(candidate).reduce((acc, [key, value]) => {
            const normalizedKey = String(key || '').trim();
            if (!normalizedKey)
                return acc;
            if (typeof value === 'string') {
                acc[normalizedKey] = { type: value.trim().toLowerCase() || 'string' };
                return acc;
            }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const item = value;
                const type = String(item.type || '').trim().toLowerCase();
                acc[normalizedKey] = type ? { ...item, type } : { ...item };
            }
            return acc;
        }, {});
        if (!Object.keys(properties).length) {
            return null;
        }
        return {
            type: 'object',
            properties,
            required: [],
            additionalProperties: true,
        };
    }
    normalizeToolResult(rawResult, traceId) {
        return {
            success: true,
            traceId,
            data: this.sanitizeToolOutput(rawResult),
        };
    }
    sanitizeToolOutput(rawResult, depth = 0) {
        const maxDepth = 8;
        const maxString = 12000;
        const maxArray = 200;
        const redactedPattern = /(token|secret|password|authorization|api[-_]?key)/i;
        if (depth > maxDepth) {
            return '[TRUNCATED_DEPTH]';
        }
        if (rawResult === null || rawResult === undefined) {
            return rawResult;
        }
        if (typeof rawResult === 'string') {
            return rawResult.length > maxString ? `${rawResult.slice(0, maxString)}...` : rawResult;
        }
        if (typeof rawResult === 'number' || typeof rawResult === 'boolean') {
            return rawResult;
        }
        if (Array.isArray(rawResult)) {
            return rawResult.slice(0, maxArray).map((item) => this.sanitizeToolOutput(item, depth + 1));
        }
        if (typeof rawResult === 'object') {
            const source = rawResult;
            const entries = Object.entries(source).slice(0, 300);
            const sanitized = {};
            for (const [key, value] of entries) {
                if (redactedPattern.test(key)) {
                    sanitized[key] = '[REDACTED]';
                    continue;
                }
                sanitized[key] = this.sanitizeToolOutput(value, depth + 1);
            }
            return sanitized;
        }
        return String(rawResult);
    }
    normalizeToolError(error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const code = this.inferExecutionErrorCode(error);
        return {
            code,
            message,
            retryable: code === 'TOOL_TIMEOUT' || code === 'TOOL_EXECUTION_FAILED',
        };
    }
    inferExecutionErrorCode(error) {
        const message = String(error?.message || '').toLowerCase();
        if (!message)
            return 'TOOL_EXECUTION_FAILED';
        if (message.includes('timeout'))
            return 'TOOL_TIMEOUT';
        if (message.includes('not found'))
            return 'TOOL_NOT_FOUND';
        if (message.includes('disabled'))
            return 'TOOL_DISABLED';
        if (message.includes('scope denied'))
            return 'TOOL_SCOPE_DENIED';
        if (message.includes('not assigned'))
            return 'TOOL_NOT_ASSIGNED';
        if (message.includes('permission denied'))
            return 'TOOL_PERMISSION_DENIED';
        if (message.includes('temporary_worker_tool_violation'))
            return 'TEMPORARY_WORKER_TOOL_VIOLATION';
        if (message.includes('invalid tool parameters'))
            return 'TOOL_INPUT_INVALID';
        if (message.includes('rate limit'))
            return 'TOOL_RATE_LIMITED';
        if (message.includes('circuit open'))
            return 'TOOL_CIRCUIT_OPEN';
        if (message.includes('requires confirm=true'))
            return 'TOOL_CONFIRM_REQUIRED';
        if (message.includes('missing organization context'))
            return 'TOOL_CONTEXT_MISSING';
        return 'TOOL_EXECUTION_FAILED';
    }
};
exports.ToolExecutionService = ToolExecutionService;
exports.ToolExecutionService = ToolExecutionService = ToolExecutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(tool_schema_1.Tool.name)),
    __param(1, (0, mongoose_1.InjectModel)(tool_execution_schema_1.ToolExecution.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(3, (0, mongoose_1.InjectModel)(agent_role_schema_1.AgentRole.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        tool_governance_service_1.ToolGovernanceService,
        tool_execution_dispatcher_service_1.ToolExecutionDispatcherService,
        tool_registry_service_1.ToolRegistryService])
], ToolExecutionService);
//# sourceMappingURL=tool-execution.service.js.map