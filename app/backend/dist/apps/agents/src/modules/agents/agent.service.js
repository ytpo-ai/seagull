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
var AgentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const model_service_1 = require("../models/model.service");
const memo_event_bus_service_1 = require("../memos/memo-event-bus.service");
const agent_role_service_1 = require("./agent-role.service");
const agent_executor_service_1 = require("./agent-executor.service");
const agent_prompt_catalog_1 = require("../prompt-registry/agent-prompt-catalog");
const agent_constants_1 = require("./agent.constants");
const role_tier_1 = require("../../../../../src/shared/role-tier");
let AgentService = AgentService_1 = class AgentService {
    constructor(agentModel, skillModel, modelService, memoEventBus, agentRoleService, agentExecutorService) {
        this.agentModel = agentModel;
        this.skillModel = skillModel;
        this.modelService = modelService;
        this.memoEventBus = memoEventBus;
        this.agentRoleService = agentRoleService;
        this.agentExecutorService = agentExecutorService;
        this.logger = new common_1.Logger(AgentService_1.name);
    }
    async createAgent(agentData) {
        if (!agentData.name?.trim()) {
            throw new common_1.BadRequestException('Agent name is required');
        }
        if (!agentData.roleId?.trim()) {
            throw new common_1.BadRequestException('roleId is required');
        }
        if (!agentData.model?.id || !agentData.model?.name || !agentData.model?.provider || !agentData.model?.model) {
            throw new common_1.BadRequestException('Valid model configuration is required');
        }
        const role = await this.agentRoleService.assertRoleExists(agentData.roleId);
        const tier = this.resolveAgentTierOrThrow(agentData.tier, role?.code, role?.tier);
        const createAgentDefaultSystemPrompt = this.renderAgentPrompt(agent_prompt_catalog_1.AGENT_PROMPTS.createAgentDefaultSystemPrompt, {
            agentName: agentData.name,
        });
        const normalizedPromptTemplateRef = this.normalizePromptTemplateRef(agentData.promptTemplateRef);
        const { promptTemplateRef: _ignoredPromptTemplateRef, ...agentDataWithoutPromptTemplateRef } = agentData;
        const normalizedData = {
            ...agentDataWithoutPromptTemplateRef,
            roleId: agentData.roleId.trim(),
            tier,
            description: agentData.description?.trim() || `${agentData.name} Agent`,
            systemPrompt: agentData.systemPrompt?.trim() || createAgentDefaultSystemPrompt,
            model: {
                ...agentData.model,
                maxTokens: agentData.model.maxTokens || 4096,
                temperature: agentData.model.temperature ?? 0.7,
            },
            capabilities: agentData.capabilities || [],
            config: this.normalizeAgentConfig(agentData.config),
            tools: agentData.tools || [],
            skills: this.normalizeSkillIds(agentData.skills || []),
            permissions: agentData.permissions || [],
            personality: agentData.personality || {
                workEthic: 80,
                creativity: 75,
                leadership: 70,
                teamwork: 80,
            },
            learningAbility: agentData.learningAbility ?? 80,
            isActive: agentData.isActive ?? true,
        };
        if (normalizedPromptTemplateRef) {
            normalizedData.promptTemplateRef = normalizedPromptTemplateRef;
        }
        normalizedData.tools = await this.agentRoleService.ensureToolsWithinRolePermissionWhitelist(normalizedData.roleId, normalizedData.tools || [], 'create');
        await this.ensureSkillsExist(normalizedData.skills || []);
        normalizedData.permissions = await this.agentRoleService.inheritRoleProfilePermissions(normalizedData.roleId, normalizedData.permissions || []);
        try {
            const modelConfig = {
                id: normalizedData.model.id,
                name: normalizedData.model.name,
                provider: normalizedData.model.provider,
                model: normalizedData.model.model,
                maxTokens: normalizedData.model.maxTokens || 4096,
                temperature: normalizedData.model.temperature ?? 0.7,
                topP: normalizedData.model.topP,
                reasoning: normalizedData.model.reasoning,
            };
            this.modelService.ensureProvider(modelConfig);
            this.logger.log(`Agent ${normalizedData.name} using model: ${modelConfig.name} (${modelConfig.id})`);
            const newAgent = new this.agentModel(normalizedData);
            return await newAgent.save();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create agent';
            this.logger.error(`Create agent failed: ${message}`);
            throw new common_1.BadRequestException(message);
        }
    }
    async getAgent(agentId) {
        return this.agentModel.findOne(this.buildAgentLookupQuery(agentId)).exec();
    }
    async getAgentByName(name) {
        return this.agentModel.findOne({ name }).exec();
    }
    async getAllAgents(filters) {
        const query = {};
        if (filters?.projectId !== undefined) {
            query.projectId = filters.projectId || { $in: [null, '', undefined] };
        }
        return this.agentModel.find(query).exec();
    }
    async getActiveAgents(filters) {
        const query = { isActive: true };
        if (filters?.projectId !== undefined) {
            query.projectId = filters.projectId || { $in: [null, '', undefined] };
        }
        return this.agentModel.find(query).exec();
    }
    async updateAgent(agentId, updates) {
        const existingAgent = await this.getAgent(agentId);
        if (!existingAgent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        const normalizedUpdates = {
            ...updates,
            updatedAt: new Date(),
        };
        const hasConfigField = Object.prototype.hasOwnProperty.call(updates, 'config');
        if (hasConfigField) {
            normalizedUpdates.config = this.normalizeAgentConfig(updates.config);
        }
        const hasRoleIdField = Object.prototype.hasOwnProperty.call(updates, 'roleId');
        if (hasRoleIdField) {
            const normalizedRoleId = typeof updates.roleId === 'string' ? updates.roleId.trim() : '';
            if (!normalizedRoleId) {
                throw new common_1.BadRequestException('roleId is required');
            }
            normalizedUpdates.roleId = normalizedRoleId;
        }
        else if (!(existingAgent.roleId || '').trim()) {
            throw new common_1.BadRequestException('roleId is required');
        }
        const targetRoleId = hasRoleIdField ? normalizedUpdates.roleId : String(existingAgent.roleId || '').trim();
        const hasTierField = Object.prototype.hasOwnProperty.call(updates, 'tier');
        const targetRole = hasRoleIdField
            ? await this.agentRoleService.assertRoleExists(targetRoleId)
            : await this.agentRoleService.getRoleById(targetRoleId);
        if (!targetRole) {
            throw new common_1.BadRequestException(`Invalid roleId: ${targetRoleId}`);
        }
        if (hasRoleIdField || hasTierField) {
            const shouldBypassRoleTierConstraint = hasTierField && !hasRoleIdField;
            normalizedUpdates.tier = this.resolveAgentTierOrThrow(hasTierField ? updates.tier : existingAgent.tier, targetRole.code, targetRole.tier, true, !shouldBypassRoleTierConstraint);
        }
        const hasToolsField = Object.prototype.hasOwnProperty.call(updates, 'tools');
        if (hasToolsField || hasRoleIdField) {
            const candidateTools = hasToolsField
                ? Array.isArray(updates.tools)
                    ? updates.tools
                    : []
                : Array.isArray(existingAgent.tools)
                    ? existingAgent.tools
                    : [];
            normalizedUpdates.tools = await this.agentRoleService.ensureToolsWithinRolePermissionWhitelist(targetRoleId, candidateTools, 'update');
        }
        const hasApiKeyIdField = Object.prototype.hasOwnProperty.call(updates, 'apiKeyId');
        if (hasApiKeyIdField) {
            const normalizedApiKeyId = typeof updates.apiKeyId === 'string' ? updates.apiKeyId.trim() : '';
            if (normalizedApiKeyId) {
                normalizedUpdates.apiKeyId = normalizedApiKeyId;
            }
            else {
                delete normalizedUpdates.apiKeyId;
                normalizedUpdates.$unset = {
                    ...(normalizedUpdates.$unset || {}),
                    apiKeyId: 1,
                };
            }
        }
        const hasPromptTemplateRefField = Object.prototype.hasOwnProperty.call(updates, 'promptTemplateRef');
        if (hasPromptTemplateRefField) {
            const normalizedPromptTemplateRef = this.normalizePromptTemplateRef(updates.promptTemplateRef);
            if (normalizedPromptTemplateRef) {
                normalizedUpdates.promptTemplateRef = normalizedPromptTemplateRef;
            }
            else {
                delete normalizedUpdates.promptTemplateRef;
                normalizedUpdates.$unset = {
                    ...(normalizedUpdates.$unset || {}),
                    promptTemplateRef: 1,
                };
            }
        }
        if (hasRoleIdField || hasToolsField || Object.prototype.hasOwnProperty.call(updates, 'permissions')) {
            const basePermissions = Object.prototype.hasOwnProperty.call(updates, 'permissions')
                ? Array.isArray(updates.permissions)
                    ? updates.permissions
                    : []
                : Array.isArray(existingAgent.permissions)
                    ? existingAgent.permissions
                    : [];
            normalizedUpdates.permissions = await this.agentRoleService.inheritRoleProfilePermissions(targetRoleId, basePermissions);
        }
        const hasSkillsField = Object.prototype.hasOwnProperty.call(updates, 'skills');
        if (hasSkillsField) {
            const normalizedSkills = this.normalizeSkillIds(Array.isArray(updates.skills) ? updates.skills : []);
            await this.ensureSkillsExist(normalizedSkills);
            normalizedUpdates.skills = normalizedSkills;
        }
        const updated = await this.agentModel.findByIdAndUpdate(existingAgent._id, normalizedUpdates, { new: true }).exec();
        if (updated) {
            const runtimeAgentId = updated.id || updated._id?.toString?.() || agentId;
            this.memoEventBus.emit({
                name: 'agent.updated',
                agentId: runtimeAgentId,
                memoKinds: ['identity'],
            });
        }
        return updated;
    }
    async deleteAgent(agentId) {
        const existingAgent = await this.getAgent(agentId);
        if (!existingAgent) {
            return false;
        }
        const result = await this.agentModel.deleteOne({ _id: existingAgent._id }).exec();
        return Boolean(result.deletedCount && result.deletedCount > 0);
    }
    async getAgentCapabilities(agentId) {
        const agent = await this.getAgent(agentId);
        return agent?.capabilities || [];
    }
    async isAgentAvailable(agentId) {
        const agent = await this.getAgent(agentId);
        return agent?.isActive || false;
    }
    async migrateAllToolIdsToCanonical() {
        const agents = await this.agentModel.find().select({ _id: 1, tools: 1 }).lean().exec();
        let agentsUpdated = 0;
        for (const agent of agents) {
            const originalTools = Array.isArray(agent.tools) ? agent.tools : [];
            const normalized = (0, agent_constants_1.normalizeToolIds)(originalTools);
            if (JSON.stringify(originalTools) === JSON.stringify(normalized)) {
                continue;
            }
            await this.agentModel.updateOne({ _id: agent._id }, { $set: { tools: normalized } }).exec();
            agentsUpdated += 1;
        }
        return {
            agentsScanned: agents.length,
            agentsUpdated,
        };
    }
    async executeTask(agentId, task, context) {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        return this.agentExecutorService.executeTask(agent, agentId, task, context);
    }
    async executeTaskDetailed(agentId, task, context) {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        return this.agentExecutorService.executeTaskDetailed(agent, agentId, task, context);
    }
    async executeTaskWithStreaming(agentId, task, onToken, context) {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        return this.agentExecutorService.executeTaskWithStreaming(agent, agentId, task, onToken, context);
    }
    async testAgentConnection(agentId, options) {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            return {
                success: false,
                error: 'Agent not found',
                timestamp: new Date().toISOString(),
            };
        }
        return this.agentExecutorService.testAgentConnection(agent, options);
    }
    async cancelRuntimeRun(runId, reason) {
        return this.agentExecutorService.cancelRuntimeRun(runId, reason);
    }
    async cancelOpenCodeSession(sessionId, runtime) {
        return this.agentExecutorService.cancelOpenCodeSession(sessionId, runtime);
    }
    async getAvailableRoles(options) {
        return this.agentRoleService.getAvailableRoles(options);
    }
    async getRoleById(roleId) {
        return this.agentRoleService.getRoleById(roleId);
    }
    async createRole(input) {
        return this.agentRoleService.createRole(input);
    }
    async updateRole(roleId, updates) {
        return this.agentRoleService.updateRole(roleId, updates);
    }
    async deleteRole(roleId) {
        return this.agentRoleService.deleteRole(roleId);
    }
    async getAgentsMcpMap() {
        return this.agentRoleService.getAgentsMcpMap();
    }
    async getMcpAgents(options) {
        const agents = await this.getAllAgents();
        return this.agentRoleService.getMcpAgents(agents, options);
    }
    async getMcpAgent(agentId, options) {
        const agent = await this.getAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        return this.agentRoleService.getMcpAgent(agent, options);
    }
    async getToolPermissionSets() {
        return this.agentRoleService.getToolPermissionSets();
    }
    async upsertToolPermissionSet(roleCode, updates) {
        return this.agentRoleService.upsertToolPermissionSet(roleCode, updates);
    }
    async getMcpProfiles() {
        return this.agentRoleService.getMcpProfiles();
    }
    async getMcpProfile(roleCode) {
        return this.agentRoleService.getMcpProfile(roleCode);
    }
    async upsertMcpProfile(roleCode, updates) {
        return this.agentRoleService.upsertMcpProfile(roleCode, updates);
    }
    buildAgentLookupQuery(agentIdentifier) {
        const normalizedIdentifier = String(agentIdentifier || '').trim();
        if (!normalizedIdentifier) {
            return { id: '__missing_agent_identifier__' };
        }
        if ((0, mongoose_2.isValidObjectId)(normalizedIdentifier)) {
            return {
                $or: [{ _id: normalizedIdentifier }, { id: normalizedIdentifier }],
            };
        }
        return { id: normalizedIdentifier };
    }
    normalizeAgentConfig(config) {
        if (config === undefined || config === null) {
            return {};
        }
        if (typeof config !== 'object' || Array.isArray(config)) {
            throw new common_1.BadRequestException('config must be a JSON object');
        }
        return { ...config };
    }
    normalizePromptTemplateRef(input) {
        if (input === undefined || input === null) {
            return undefined;
        }
        if (typeof input !== 'object' || Array.isArray(input)) {
            throw new common_1.BadRequestException('promptTemplateRef must be an object with scene and role');
        }
        const scene = String(input.scene || '').trim();
        const role = String(input.role || '').trim();
        if (!scene || !role) {
            throw new common_1.BadRequestException('promptTemplateRef requires non-empty scene and role');
        }
        return { scene, role };
    }
    normalizeSkillIds(skillIds) {
        return (0, agent_constants_1.uniqueStrings)(skillIds || []);
    }
    resolveAgentTierOrThrow(requestedTier, roleCode, roleTier, allowTierCoercion = false, enforceRoleTierConstraint = true) {
        const normalizedRequestedTier = (0, role_tier_1.normalizeAgentRoleTier)(requestedTier);
        if (requestedTier !== undefined && !normalizedRequestedTier) {
            throw new common_1.BadRequestException('tier must be one of leadership, operations, temporary');
        }
        const mappedTier = (0, role_tier_1.normalizeAgentRoleTier)(roleTier) || (0, role_tier_1.getTierByAgentRoleCode)(roleCode);
        const resolvedTier = normalizedRequestedTier || mappedTier;
        if (enforceRoleTierConstraint && normalizedRequestedTier && normalizedRequestedTier !== mappedTier) {
            if (allowTierCoercion) {
                this.logger.warn(`coerce tier for role ${String(roleCode || '').trim() || 'unknown'}: requested ${normalizedRequestedTier}, applied ${mappedTier}`);
                return mappedTier;
            }
            throw new common_1.BadRequestException(`tier mismatch for role ${String(roleCode || '').trim() || 'unknown'}: expected ${mappedTier}, got ${normalizedRequestedTier}`);
        }
        return resolvedTier;
    }
    async ensureSkillsExist(skillIds) {
        const normalizedSkillIds = this.normalizeSkillIds(skillIds);
        if (!normalizedSkillIds.length)
            return;
        const skills = await this.skillModel.find({ id: { $in: normalizedSkillIds } }).select({ id: 1 }).lean().exec();
        const existingIds = new Set((skills || []).map((item) => String(item.id || '').trim()).filter(Boolean));
        const missing = normalizedSkillIds.filter((skillId) => !existingIds.has(skillId));
        if (missing.length) {
            throw new common_1.BadRequestException(`Invalid skills: ${missing.join(', ')}`);
        }
    }
    renderAgentPrompt(template, payload) {
        const buildDefaultContent = template.buildDefaultContent;
        return buildDefaultContent(payload);
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = AgentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_skill_schema_1.Skill.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        model_service_1.ModelService,
        memo_event_bus_service_1.MemoEventBusService,
        agent_role_service_1.AgentRoleService,
        agent_executor_service_1.AgentExecutorService])
], AgentService);
//# sourceMappingURL=agent.service.js.map