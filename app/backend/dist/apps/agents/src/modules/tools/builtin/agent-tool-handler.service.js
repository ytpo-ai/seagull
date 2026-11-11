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
var AgentMasterToolHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMasterToolHandler = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../../schemas/agent.schema");
const agent_role_schema_1 = require("../../../schemas/agent-role.schema");
const api_key_schema_1 = require("../../../../../../src/shared/schemas/api-key.schema");
const agent_skill_schema_1 = require("../../../schemas/agent-skill.schema");
const tool_schema_1 = require("../../../schemas/tool.schema");
const infra_1 = require("../../../../../../libs/infra/src/index");
const internal_api_client_service_1 = require("../internal-api-client.service");
const model_management_service_1 = require("../../models/model-management.service");
const memo_service_1 = require("../../memos/memo.service");
const agent_task_runtime_status_util_1 = require("../../agent-tasks/agent-task-runtime-status.util");
const tool_identity_util_1 = require("../tool-identity.util");
const DEFAULT_PROFILE = {
    role: 'general-assistant',
    tools: [],
    permissions: [],
    capabilities: [],
    exposed: false,
};
let AgentMasterToolHandler = AgentMasterToolHandler_1 = class AgentMasterToolHandler {
    constructor(toolModel, agentModel, agentRoleModel, apiKeyModel, skillModel, redisService, internalApiClient, modelManagementService, memoService) {
        this.toolModel = toolModel;
        this.agentModel = agentModel;
        this.agentRoleModel = agentRoleModel;
        this.apiKeyModel = apiKeyModel;
        this.skillModel = skillModel;
        this.redisService = redisService;
        this.internalApiClient = internalApiClient;
        this.modelManagementService = modelManagementService;
        this.memoService = memoService;
        this.logger = new common_1.Logger(AgentMasterToolHandler_1.name);
    }
    normalizeProvider(provider) {
        const value = String(provider || '').trim().toLowerCase();
        if (value === 'kimi' || value === 'moonshot' || value === 'moonshotai')
            return 'moonshotai';
        if (value === 'claude')
            return 'anthropic';
        return value;
    }
    async resolveDefaultApiKeyId(provider) {
        const normalizedProvider = this.normalizeProvider(provider);
        if (!normalizedProvider) {
            return undefined;
        }
        const apiKey = await this.apiKeyModel
            .findOne({
            provider: normalizedProvider,
            isDefault: true,
            isActive: true,
            isDeprecated: { $ne: true },
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean()
            .exec();
        return apiKey?.id ? String(apiKey.id).trim() : undefined;
    }
    async resolveRoleIdForCreate(roleInput) {
        const normalized = String(roleInput || '').trim();
        if (!normalized) {
            throw new Error('agent_master_create_agent requires roleId');
        }
        const roleById = await this.agentRoleModel.findOne({ id: normalized }).select({ id: 1 }).lean().exec();
        if (roleById?.id) {
            return { roleId: String(roleById.id).trim(), matchedBy: 'id' };
        }
        const roles = await this.agentRoleModel
            .find({ status: 'active' })
            .select({ id: 1, code: 1, name: 1 })
            .sort({ updatedAt: -1 })
            .lean()
            .exec();
        const roleByCode = roles.find((item) => String(item?.code || '').trim() === normalized);
        if (roleByCode?.id) {
            return { roleId: String(roleByCode.id).trim(), matchedBy: 'code' };
        }
        const examples = roles
            .slice(0, 8)
            .map((item) => `${String(item?.code || '').trim()}=>${String(item?.id || '').trim()}`)
            .filter(Boolean)
            .join(', ');
        throw new Error(`agent_master_create_agent invalid roleId or roleCode: ${normalized}${examples ? `; examples=${examples}` : ''}`);
    }
    async createAgentByMcp(params) {
        const name = String(params?.name || '').trim();
        const requestedRole = String(params?.roleId || '').trim();
        if (!name) {
            throw new Error('agent_master_create_agent requires name');
        }
        if (!requestedRole) {
            throw new Error('agent_master_create_agent requires roleId');
        }
        const resolvedRole = await this.resolveRoleIdForCreate(requestedRole);
        const roleId = resolvedRole.roleId;
        const modelId = String(params?.model?.id || params?.modelId || '').trim();
        if (!modelId) {
            throw new Error('agent_master_create_agent requires model.id or modelId');
        }
        const modelFromRegistry = await this.modelManagementService.getModelById(modelId);
        const modelProvider = this.normalizeProvider(params?.model?.provider) || this.normalizeProvider(modelFromRegistry?.provider);
        if (!modelProvider) {
            throw new Error(`agent_master_create_agent could not resolve provider for model: ${modelId}`);
        }
        const selectedApiKeyId = String(params?.apiKeyId || '').trim();
        const providerHint = this.normalizeProvider(params?.provider || 'default');
        const apiKeyProvider = providerHint && providerHint !== 'default' ? providerHint : modelProvider;
        const fallbackApiKeyId = selectedApiKeyId ? undefined : await this.resolveDefaultApiKeyId(apiKeyProvider);
        const payload = {
            name,
            roleId,
            ...(params?.description?.trim() ? { description: params.description.trim() } : {}),
            ...(params?.systemPrompt?.trim() ? { systemPrompt: params.systemPrompt.trim() } : {}),
            model: {
                id: modelId,
                name: String(params?.model?.name || modelFromRegistry?.name || modelId).trim(),
                provider: modelProvider,
                model: String(params?.model?.model || modelFromRegistry?.model || modelId).trim(),
                maxTokens: Number(params?.model?.maxTokens || modelFromRegistry?.maxTokens || 4096),
                temperature: params?.model?.temperature ?? modelFromRegistry?.temperature ?? 0.7,
                ...(params?.model?.topP !== undefined || modelFromRegistry?.topP !== undefined
                    ? { topP: params?.model?.topP ?? modelFromRegistry?.topP }
                    : {}),
                ...(params?.model?.reasoning || modelFromRegistry?.reasoning
                    ? {
                        reasoning: {
                            ...(modelFromRegistry?.reasoning || {}),
                            ...(params?.model?.reasoning || {}),
                        },
                    }
                    : {}),
            },
            capabilities: (0, tool_identity_util_1.normalizeStringArray)(params?.capabilities),
            tools: (0, tool_identity_util_1.normalizeStringArray)(params?.tools),
            permissions: (0, tool_identity_util_1.normalizeStringArray)(params?.permissions),
            ...(params?.learningAbility !== undefined ? { learningAbility: Number(params.learningAbility) } : {}),
            ...(params?.isActive !== undefined ? { isActive: Boolean(params.isActive) } : {}),
            ...(selectedApiKeyId || fallbackApiKeyId ? { apiKeyId: selectedApiKeyId || fallbackApiKeyId } : {}),
        };
        const agent = (await this.internalApiClient.callAgentsApi('POST', '/agents', payload)) || {};
        return {
            action: 'create_agent',
            created: true,
            provider: modelProvider,
            apiKeyProvider,
            apiKeySource: selectedApiKeyId ? 'explicit' : fallbackApiKeyId ? 'provider-default' : 'system-default',
            usedApiKeyId: selectedApiKeyId || fallbackApiKeyId || '',
            agent: {
                id: String(agent.id || agent._id || '').trim(),
                name: String(agent.name || name).trim(),
                roleId: String(agent.roleId || roleId).trim(),
                isActive: Boolean(agent.isActive ?? payload.isActive ?? true),
                model: agent.model || payload.model,
            },
            roleResolvedBy: resolvedRole.matchedBy,
            createdAt: new Date().toISOString(),
        };
    }
    async getAgentsMcpList(params, executionContext) {
        const includeHidden = params?.includeHidden === true;
        const limit = Math.max(1, Math.min(Number(params?.limit || 20), 100));
        const targetAgentId = String(params?.agentId || '').trim();
        const contextProjectId = String(executionContext?.collaborationContext?.projectId
            || executionContext?.projectId
            || '').trim() || undefined;
        const agentQuery = contextProjectId
            ? {
                $or: [
                    { projectId: contextProjectId },
                    { projectId: { $in: [null, ''] } },
                    { projectId: { $exists: false } },
                ],
            }
            : {};
        const agents = await this.agentModel.find(agentQuery).exec();
        const roleIds = Array.from(new Set(agents.map((agent) => String(agent.roleId || '').trim()).filter(Boolean)));
        const roleMap = await this.getRoleMapByIds(roleIds);
        const roleCodes = Array.from(new Set(Array.from(roleMap.values()).map((role) => role.code).filter(Boolean)));
        const rolesByCode = await this.agentRoleModel.find({ code: { $in: roleCodes } }).lean().exec();
        const profileMap = new Map();
        for (const role of rolesByCode) {
            const code = String(role.code || '').trim();
            if (code) {
                profileMap.set(code, {
                    role: code,
                    tools: role.tools || [],
                    permissions: role.permissions || [],
                    permissionsManual: role.permissionsManual || [],
                    permissionsDerived: role.permissionsDerived || [],
                    capabilities: role.capabilities || [],
                    exposed: role.exposed === true,
                    description: role.description || '',
                });
            }
        }
        const toolIds = Array.from(new Set(agents
            .flatMap((agent) => {
            const plain = agent?.toObject ? agent.toObject() : agent;
            const role = roleMap.get(String(plain.roleId || '').trim());
            const profile = role?.code ? profileMap.get(role.code) || DEFAULT_PROFILE : DEFAULT_PROFILE;
            return [...(plain.tools || []), ...(profile?.tools || [])];
        })
            .map((item) => String(item || '').trim())
            .filter(Boolean)));
        const tools = toolIds.length
            ? await this.toolModel
                .find({
                $or: [{ id: { $in: toolIds } }, { canonicalId: { $in: toolIds } }],
            })
                .select({ id: 1, canonicalId: 1, name: 1, description: 1, requiredPermissions: 1 })
                .lean()
                .exec()
            : [];
        const toolMap = new Map();
        for (const tool of tools) {
            const canonicalId = String(tool.canonicalId || tool.id || '').trim();
            const id = String(tool.id || '').trim();
            if (canonicalId) {
                toolMap.set(canonicalId, tool);
            }
            if (id) {
                toolMap.set(id, tool);
            }
            for (const alias of Array.isArray(tool.aliases) ? tool.aliases : []) {
                const normalizedAlias = String(alias || '').trim();
                if (normalizedAlias) {
                    toolMap.set(normalizedAlias, tool);
                }
            }
        }
        const mapped = agents.map((agent) => {
            const plain = agent?.toObject ? agent.toObject() : agent;
            const roleId = String(plain.roleId || '').trim();
            const role = roleMap.get(roleId);
            const profile = role?.code ? profileMap.get(role.code) || DEFAULT_PROFILE : DEFAULT_PROFILE;
            const grantedPermissions = new Set([
                ...(plain.permissions || []),
                ...(role?.permissions || []),
                ...(profile?.permissions || []),
                ...(profile?.permissionsManual || []),
                ...(profile?.permissionsDerived || []),
                ...(profile?.capabilities || []),
            ]
                .map((item) => String(item || '').trim())
                .filter(Boolean));
            const effectiveToolIds = Array.from(new Set([...(plain.tools || []), ...(profile?.tools || [])]
                .map((item) => String(item || '').trim())
                .filter(Boolean)));
            const enrichedTools = effectiveToolIds.map((toolId) => {
                const tool = toolMap.get(toolId);
                const resolvedToolId = String(tool?.canonicalId || tool?.id || toolId).trim();
                const permissionSlugs = Array.from(new Set((Array.isArray(tool?.requiredPermissions) ? tool.requiredPermissions : [])
                    .map((item) => String(item?.id || '').trim())
                    .filter(Boolean)));
                return {
                    id: resolvedToolId,
                    name: String(tool?.name || resolvedToolId).trim(),
                    description: String(tool?.description || '').trim(),
                    permissionSlugs,
                    hasPermission: permissionSlugs.every((slug) => grantedPermissions.has(slug)),
                };
            });
            const agentProjectId = String(plain.projectId || '').trim();
            return {
                id: plain.id || plain._id?.toString?.() || plain._id,
                name: plain.name,
                role: role?.name || profile.role,
                capabilitySet: Array.from(new Set([...(plain.capabilities || []), ...(profile.permissions || profile.capabilities || [])])).slice(0, 12),
                tools: enrichedTools,
                _skillIds: Array.from(new Set((plain.skills || []).map((item) => String(item || '').trim()).filter(Boolean))),
                exposed: profile.exposed === true,
                isActive: plain.isActive === true,
                ...(contextProjectId ? { scope: agentProjectId === contextProjectId ? 'project' : 'global' } : {}),
            };
        });
        const filtered = targetAgentId
            ? mapped.filter((item) => String(item.id || '').trim() === targetAgentId)
            : mapped.filter((item) => includeHidden || item.exposed);
        const visibleAgents = filtered.slice(0, limit);
        const skillIds = Array.from(new Set(visibleAgents.flatMap((item) => item._skillIds || [])));
        const skills = skillIds.length
            ? await this.skillModel.find({ id: { $in: skillIds } }).select({ id: 1, name: 1, description: 1 }).lean().exec()
            : [];
        const skillMap = new Map();
        for (const skill of skills) {
            const skillId = String(skill?.id || '').trim();
            if (!skillId) {
                continue;
            }
            skillMap.set(skillId, {
                id: skillId,
                name: String(skill?.name || '').trim(),
                description: String(skill?.description || '').trim(),
            });
        }
        const identifyMap = await this.memoService.getFirstMemoContentMapByKind(visibleAgents.map((item) => String(item.id || '').trim()), 'identity');
        const runtimeStatusMap = await this.getAgentRuntimeStatusMap(visibleAgents.map((item) => String(item.id || '').trim()));
        const agentsWithIdentify = visibleAgents.map((item) => {
            const skillsWithMetadata = (item._skillIds || []).map((skillId) => {
                const matched = skillMap.get(skillId);
                if (matched) {
                    return matched;
                }
                return {
                    id: skillId,
                    name: skillId,
                    description: '',
                };
            });
            return {
                id: item.id,
                name: item.name,
                role: item.role,
                capabilitySet: item.capabilitySet,
                tools: item.tools,
                skills: skillsWithMetadata,
                exposed: item.exposed,
                isActive: item.isActive,
                ...(item.scope ? { scope: item.scope } : {}),
                identify: identifyMap.get(String(item.id || '').trim()) || '',
                runtimeStatus: runtimeStatusMap.get(String(item.id || '').trim()) || (0, agent_task_runtime_status_util_1.buildIdleAgentRuntimeStatus)(String(item.id || '').trim()),
            };
        });
        return {
            total: mapped.length,
            visible: agentsWithIdentify.length,
            includeHidden,
            ...(contextProjectId ? { projectId: contextProjectId } : {}),
            ...(targetAgentId ? { agentId: targetAgentId } : {}),
            agents: agentsWithIdentify,
            fetchedAt: new Date().toISOString(),
        };
    }
    async getAgentRuntimeStatusMap(agentIds) {
        const normalizedIds = Array.from(new Set((agentIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
        const map = new Map();
        for (const agentId of normalizedIds) {
            map.set(agentId, (0, agent_task_runtime_status_util_1.buildIdleAgentRuntimeStatus)(agentId));
        }
        if (!normalizedIds.length || !this.redisService?.isReady?.()) {
            return map;
        }
        try {
            await this.redisService.sadd(agent_task_runtime_status_util_1.AGENT_TASK_RUNTIME_STATUS_INDEX_KEY, normalizedIds);
            await Promise.all(normalizedIds.map(async (agentId) => {
                const raw = await this.redisService.get((0, agent_task_runtime_status_util_1.buildAgentRuntimeStatusKey)(agentId));
                const parsed = (0, agent_task_runtime_status_util_1.parseAgentRuntimeStatus)(raw);
                if (parsed) {
                    map.set(agentId, parsed);
                }
            }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[agent_runtime_status] failed to read runtime status for list-agents: ${message}`);
        }
        return map;
    }
    async getRoleMapByIds(roleIds) {
        const uniqueRoleIds = Array.from(new Set((roleIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
        const map = new Map();
        if (!uniqueRoleIds.length) {
            return map;
        }
        const rows = await this.agentRoleModel
            .find({ id: { $in: uniqueRoleIds } })
            .select({ id: 1, code: 1, name: 1, capabilities: 1, permissions: 1, permissionsManual: 1, permissionsDerived: 1 })
            .lean()
            .exec();
        for (const role of rows) {
            const roleId = String(role.id || '').trim();
            const code = String(role.code || '').trim();
            const name = String(role.name || role.code || '').trim();
            const permissions = (0, tool_identity_util_1.normalizeStringArray)([
                ...(role.capabilities || []),
                ...(role.permissions || []),
                ...(role.permissionsManual || []),
                ...(role.permissionsDerived || []),
            ]);
            if (roleId && code) {
                map.set(roleId, { name, code, permissions });
            }
        }
        for (const roleId of uniqueRoleIds) {
            if (!map.has(roleId)) {
                this.logger.warn(`Failed to resolve role ${roleId} in tools mcp list: role not found`);
            }
        }
        return map;
    }
};
exports.AgentMasterToolHandler = AgentMasterToolHandler;
exports.AgentMasterToolHandler = AgentMasterToolHandler = AgentMasterToolHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(tool_schema_1.Tool.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_role_schema_1.AgentRole.name)),
    __param(3, (0, mongoose_1.InjectModel)(api_key_schema_1.ApiKey.name)),
    __param(4, (0, mongoose_1.InjectModel)(agent_skill_schema_1.Skill.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        infra_1.RedisService,
        internal_api_client_service_1.InternalApiClient,
        model_management_service_1.ModelManagementService,
        memo_service_1.MemoService])
], AgentMasterToolHandler);
//# sourceMappingURL=agent-tool-handler.service.js.map