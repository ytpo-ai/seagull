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
var AgentController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./agent.service");
const agent_action_log_service_1 = require("../action-logs/agent-action-log.service");
let AgentController = AgentController_1 = class AgentController {
    constructor(agentService, agentActionLogService) {
        this.agentService = agentService;
        this.agentActionLogService = agentActionLogService;
        this.logger = new common_1.Logger(AgentController_1.name);
    }
    toBooleanFlag(value) {
        if (!value)
            return false;
        return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    }
    normalizeAgent(agent) {
        const plain = agent?.toObject ? agent.toObject() : agent;
        const normalizedId = plain?.id || plain?._id?.toString?.() || plain?._id;
        const rawConfig = plain?.config;
        const normalizedConfig = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
            ? rawConfig
            : {};
        return {
            ...plain,
            id: normalizedId,
            config: normalizedConfig,
        };
    }
    resolveContextType(context) {
        const collaborationContext = context?.collaborationContext;
        if (!collaborationContext)
            return 'chat';
        if (collaborationContext.planId)
            return 'orchestration';
        if (collaborationContext.taskId || collaborationContext.orchestrationTaskId || collaborationContext.taskKey)
            return 'orchestration';
        return 'chat';
    }
    resolveContextId(context, task) {
        const collaborationContext = context?.collaborationContext;
        if (collaborationContext?.meetingId)
            return collaborationContext.meetingId;
        if (collaborationContext?.planId)
            return collaborationContext.planId;
        if (collaborationContext?.taskId)
            return collaborationContext.taskId;
        if (collaborationContext?.orchestrationTaskId)
            return collaborationContext.orchestrationTaskId;
        if (collaborationContext?.taskKey)
            return collaborationContext.taskKey;
        if (task?.id)
            return task.id;
        const rawTask = task;
        return rawTask?._id?.toString ? rawTask._id.toString() : undefined;
    }
    resolveExecutionMode(context) {
        const mode = String(context?.executionMode || '').toLowerCase();
        return mode === 'chat' ? 'chat' : 'task';
    }
    resolveAgentSessionId(context) {
        const candidates = [
            context?.agentSessionId,
            context?.sessionId,
            context?.collaborationContext?.agentSessionId,
            context?.collaborationContext?.sessionId,
        ];
        for (const value of candidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    }
    resolveChatTitle(context) {
        const candidates = [
            context?.collaborationContext?.meetingTitle,
            context?.collaborationContext?.title,
        ];
        for (const value of candidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    }
    buildActionLabel(task, contextType, mode) {
        const taskType = task?.type ? task.type : 'task';
        const action = mode === 'chat' ? 'chat_execution' : 'task_execution';
        return `${action}:${contextType}:${taskType}`;
    }
    async createAgent(agentData) {
        const agent = await this.agentService.createAgent(agentData);
        return this.normalizeAgent(agent);
    }
    async getAllAgents(projectId) {
        const filters = projectId !== undefined ? { projectId } : undefined;
        const agents = await this.agentService.getAllAgents(filters);
        return agents.map((agent) => this.normalizeAgent(agent));
    }
    async getActiveAgents(projectId) {
        const filters = projectId !== undefined ? { projectId } : undefined;
        const agents = await this.agentService.getActiveAgents(filters);
        return agents.map((agent) => this.normalizeAgent(agent));
    }
    async getDebugStatus() {
        const agents = await this.agentService.getAllAgents();
        return {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.isActive).length,
            agents: agents.map(a => ({
                id: a.id,
                name: a.name,
                roleId: a.roleId,
                isActive: a.isActive,
                model: a.model?.name,
                modelProvider: a.model?.provider
            })),
            timestamp: new Date().toISOString()
        };
    }
    async getAgentsMcpMap() {
        return this.agentService.getAgentsMcpMap();
    }
    async getMcpProfiles() {
        return this.agentService.getMcpProfiles();
    }
    async getMcpProfile(roleCode) {
        return this.agentService.getMcpProfile(roleCode);
    }
    async upsertMcpProfile(roleCode, body) {
        return this.agentService.upsertMcpProfile(roleCode, body);
    }
    async getToolPermissionSets() {
        return this.agentService.getToolPermissionSets();
    }
    async upsertToolPermissionSet(roleCode, body) {
        return this.agentService.upsertToolPermissionSet(roleCode, body);
    }
    async migrateMcpToolIdsToCanonical() {
        return this.agentService.migrateAllToolIdsToCanonical();
    }
    async getMcpAgents(includeHidden) {
        return this.agentService.getMcpAgents({ includeHidden: this.toBooleanFlag(includeHidden) });
    }
    async getMcpAgent(id, includeHidden) {
        return this.agentService.getMcpAgent(id, { includeHidden: this.toBooleanFlag(includeHidden) });
    }
    async getAvailableRoles(status) {
        return this.agentService.getAvailableRoles({ status });
    }
    async getRoleById(id) {
        return this.agentService.getRoleById(id);
    }
    async createRole(body) {
        return this.agentService.createRole(body);
    }
    async updateRole(id, body) {
        return this.agentService.updateRole(id, body);
    }
    async deleteRole(id) {
        return this.agentService.deleteRole(id);
    }
    async getAgent(id) {
        const agent = await this.agentService.getAgent(id);
        return agent ? this.normalizeAgent(agent) : null;
    }
    async updateAgent(id, updates) {
        const agent = await this.agentService.updateAgent(id, updates);
        return agent ? this.normalizeAgent(agent) : null;
    }
    deleteAgent(id) {
        return this.agentService.deleteAgent(id);
    }
    async executeTask(id, body, req) {
        const startedAt = Date.now();
        const requestIdHeader = req.headers['x-request-id'];
        const requestId = Array.isArray(requestIdHeader)
            ? String(requestIdHeader[0] || '').trim()
            : String(requestIdHeader || '').trim();
        const actor = {
            employeeId: req.userContext?.employeeId,
            role: req.userContext?.role,
        };
        const requestMeta = {
            requestId: requestId || body?.context?.requestMeta?.requestId,
            source: body?.context?.requestMeta?.source || 'unknown',
        };
        const context = {
            ...(body.context || {}),
            actor,
            requestMeta,
        };
        const contextType = this.resolveContextType(context);
        const contextId = this.resolveContextId(context, body.task);
        const executionMode = this.resolveExecutionMode(context);
        const contextSessionId = this.resolveAgentSessionId(context);
        const chatTitle = this.resolveChatTitle(context);
        const actionLabel = this.buildActionLabel(body.task, contextType, executionMode);
        this.logger.log(`[agent_execute_ingress] requestId=${requestMeta.requestId || 'none'} agentId=${id} taskId=${body?.task?.id || 'unknown'} type=${body?.task?.type || 'unknown'} hasCollaborationContext=${Boolean(context?.collaborationContext)}`);
        await this.agentActionLogService.record({
            agentId: id,
            contextType,
            contextId,
            action: actionLabel,
            status: 'started',
            details: {
                taskId: body?.task?.id,
                taskTitle: body?.task?.title,
                taskType: body?.task?.type,
                executionMode,
                agentSessionId: contextSessionId,
                meetingTitle: chatTitle,
            },
        });
        try {
            const result = await this.agentService.executeTaskDetailed(id, body.task, context);
            await this.agentActionLogService.record({
                agentId: id,
                contextType,
                contextId,
                action: actionLabel,
                status: 'completed',
                durationMs: Date.now() - startedAt,
                details: {
                    taskId: body?.task?.id,
                    taskTitle: body?.task?.title,
                    taskType: body?.task?.type,
                    executionMode,
                    agentSessionId: result.sessionId || contextSessionId,
                    meetingTitle: chatTitle,
                    runId: result.runId,
                    sessionId: result.sessionId,
                },
            });
            this.logger.log(`[agent_execute_egress] requestId=${requestMeta.requestId || 'none'} agentId=${id} taskId=${body?.task?.id || 'unknown'} status=success runId=${result.runId || 'none'} sessionId=${result.sessionId || 'none'} responseLength=${(result.response || '').length}`);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'Unknown error');
            await this.agentActionLogService.record({
                agentId: id,
                contextType,
                contextId,
                action: actionLabel,
                status: 'failed',
                durationMs: Date.now() - startedAt,
                details: {
                    taskId: body?.task?.id,
                    taskTitle: body?.task?.title,
                    taskType: body?.task?.type,
                    executionMode,
                    agentSessionId: contextSessionId,
                    meetingTitle: chatTitle,
                    error: message,
                },
            });
            this.logger.error(`[agent_execute_error] requestId=${requestMeta.requestId || 'none'} agentId=${id} taskId=${body?.task?.id || 'unknown'} error=${message}`);
            throw error;
        }
    }
    async testAgent(id, body) {
        return this.agentService.testAgentConnection(id, body);
    }
    getCapabilities(id) {
        return this.agentService.getAgentCapabilities(id);
    }
    isAvailable(id) {
        return this.agentService.isAgentAvailable(id);
    }
};
exports.AgentController = AgentController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "createAgent", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAllAgents", null);
__decorate([
    (0, common_1.Get)('active'),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getActiveAgents", null);
__decorate([
    (0, common_1.Get)('debug/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getDebugStatus", null);
__decorate([
    (0, common_1.Get)('mcp/map'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAgentsMcpMap", null);
__decorate([
    (0, common_1.Get)('mcp/profiles'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getMcpProfiles", null);
__decorate([
    (0, common_1.Get)('mcp/profiles/:roleCode'),
    __param(0, (0, common_1.Param)('roleCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getMcpProfile", null);
__decorate([
    (0, common_1.Put)('mcp/profiles/:roleCode'),
    __param(0, (0, common_1.Param)('roleCode')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "upsertMcpProfile", null);
__decorate([
    (0, common_1.Get)('tool-permission-sets'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getToolPermissionSets", null);
__decorate([
    (0, common_1.Put)('tool-permission-sets/:roleCode'),
    __param(0, (0, common_1.Param)('roleCode')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "upsertToolPermissionSet", null);
__decorate([
    (0, common_1.Post)('mcp/migrate-tool-ids'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "migrateMcpToolIdsToCanonical", null);
__decorate([
    (0, common_1.Get)('mcp'),
    __param(0, (0, common_1.Query)('includeHidden')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getMcpAgents", null);
__decorate([
    (0, common_1.Get)('mcp/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('includeHidden')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getMcpAgent", null);
__decorate([
    (0, common_1.Get)('roles'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAvailableRoles", null);
__decorate([
    (0, common_1.Get)('roles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getRoleById", null);
__decorate([
    (0, common_1.Post)('roles'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "createRole", null);
__decorate([
    (0, common_1.Put)('roles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)('roles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "deleteRole", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAgent", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "updateAgent", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AgentController.prototype, "deleteAgent", null);
__decorate([
    (0, common_1.Post)(':id/execute'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "executeTask", null);
__decorate([
    (0, common_1.Post)(':id/test'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "testAgent", null);
__decorate([
    (0, common_1.Get)(':id/capabilities'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AgentController.prototype, "getCapabilities", null);
__decorate([
    (0, common_1.Get)(':id/available'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AgentController.prototype, "isAvailable", null);
exports.AgentController = AgentController = AgentController_1 = __decorate([
    (0, common_1.Controller)('agents'),
    __metadata("design:paramtypes", [agent_service_1.AgentService,
        agent_action_log_service_1.AgentActionLogService])
], AgentController);
//# sourceMappingURL=agent.controller.js.map