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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolController = void 0;
const common_1 = require("@nestjs/common");
const tool_service_1 = require("./tool.service");
const agent_tool_auth_service_1 = require("./agent-tool-auth.service");
const agent_tool_auth_guard_1 = require("./agent-tool-auth.guard");
const agent_action_log_service_1 = require("../action-logs/agent-action-log.service");
let ToolController = class ToolController {
    constructor(toolService, agentToolAuthService, agentActionLogService) {
        this.toolService = toolService;
        this.agentToolAuthService = agentToolAuthService;
        this.agentActionLogService = agentActionLogService;
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
    resolveContextId(context, fallbackTaskId) {
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
        if (fallbackTaskId)
            return fallbackTaskId;
        return undefined;
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
    shouldRecordChatToolAction(executionContext) {
        const source = String(executionContext?.source || '').trim().toLowerCase();
        const executionMode = String(executionContext?.executionMode || '').trim().toLowerCase();
        return source === 'chat_query' || executionMode === 'chat';
    }
    getAllTools() {
        return this.toolService.getAllToolsView();
    }
    getToolRegistry(provider, executionChannel, toolkitId, namespace, resource, action, category, capability, enabled) {
        return this.toolService.getToolRegistry({
            provider,
            executionChannel,
            toolkitId,
            namespace,
            resource,
            action,
            category,
            capability,
            enabled,
        });
    }
    getToolkits(provider, namespace, status) {
        return this.toolService.getToolkits({ provider, namespace, status });
    }
    getToolkit(id) {
        return this.toolService.getToolkit(id);
    }
    getTopKRoutes(provider, domain, namespace, resource, action, capability, limit) {
        return this.toolService.getTopKToolRoutes({
            provider,
            domain,
            namespace,
            resource,
            action,
            capability,
            limit: limit ? Number(limit) : undefined,
        });
    }
    createTool(toolData) {
        return this.toolService.createTool(toolData);
    }
    updateTool(id, updates) {
        return this.toolService.updateTool(id, updates);
    }
    deleteTool(id) {
        return this.toolService.deleteTool(id);
    }
    async executeTool(req, id, body) {
        const startedAt = Date.now();
        const authContext = req.agentToolAuth;
        const resolvedAgentId = String(authContext?.agentId || body.agentId || '').trim();
        if (!resolvedAgentId) {
            throw new common_1.UnauthorizedException('Missing agentId for tool execution');
        }
        const executionContext = {
            ...(body.executionContext || {}),
            auth: {
                ...(body.executionContext?.auth || {}),
                mode: authContext?.mode || body.executionContext?.auth?.mode,
                scopes: authContext?.scopes || body.executionContext?.auth?.scopes || [],
                permissions: authContext?.permissions || body.executionContext?.auth?.permissions || [],
                jti: authContext?.jti || body.executionContext?.auth?.jti,
            },
            originSessionId: authContext?.originSessionId || body.executionContext?.originSessionId,
            actor: {
                ...(body.executionContext?.actor || {}),
                employeeId: body.executionContext?.actor?.employeeId || authContext?.agentId,
                role: body.executionContext?.actor?.role || (authContext?.mode === 'jwt' ? 'agent-token' : 'system'),
            },
        };
        const shouldRecordAction = this.shouldRecordChatToolAction(executionContext);
        const actionContextType = this.resolveContextType(executionContext);
        const actionContextId = this.resolveContextId(executionContext, body.taskId);
        const actionSessionId = this.resolveAgentSessionId(executionContext);
        const chatTitle = this.resolveChatTitle(executionContext);
        const source = String(executionContext?.source || 'chat_query');
        if (shouldRecordAction) {
            await this.agentActionLogService.record({
                agentId: resolvedAgentId,
                contextType: actionContextType,
                contextId: actionContextId,
                action: 'chat_tool_call',
                status: 'started',
                details: {
                    toolId: id,
                    source,
                    executionMode: 'chat',
                    agentSessionId: actionSessionId,
                    meetingTitle: chatTitle,
                },
            });
        }
        try {
            const execution = await this.toolService.executeTool(id, resolvedAgentId, body.parameters, body.taskId, executionContext);
            const executionPayload = execution?.toObject ? execution.toObject() : execution;
            const resolvedToolId = executionPayload.resolvedToolId || executionPayload.toolId || id;
            if (shouldRecordAction) {
                await this.agentActionLogService.record({
                    agentId: resolvedAgentId,
                    contextType: actionContextType,
                    contextId: actionContextId,
                    action: 'chat_tool_call',
                    status: 'completed',
                    durationMs: Date.now() - startedAt,
                    details: {
                        toolId: resolvedToolId,
                        source,
                        executionMode: 'chat',
                        agentSessionId: actionSessionId,
                        meetingTitle: chatTitle,
                    },
                });
            }
            return {
                ...executionPayload,
                requestedToolId: id,
                resolvedToolId,
            };
        }
        catch (error) {
            if (shouldRecordAction) {
                const message = error instanceof Error ? error.message : String(error || 'Unknown error');
                await this.agentActionLogService.record({
                    agentId: resolvedAgentId,
                    contextType: actionContextType,
                    contextId: actionContextId,
                    action: 'chat_tool_call',
                    status: 'failed',
                    durationMs: Date.now() - startedAt,
                    details: {
                        toolId: id,
                        source,
                        executionMode: 'chat',
                        agentSessionId: actionSessionId,
                        meetingTitle: chatTitle,
                        error: message,
                    },
                });
            }
            throw error;
        }
    }
    async createAgentCredential(req, body) {
        const createdBy = String(req?.userContext?.employeeId || '').trim() || undefined;
        return this.agentToolAuthService.createCredential({
            agentId: body.agentId,
            label: body.label,
            scopeTemplate: body.scopeTemplate,
            expiresAt: body.expiresAt,
            createdBy,
        });
    }
    async revokeAgentCredential(body) {
        return this.agentToolAuthService.revokeCredential(body);
    }
    async rotateAgentCredential(body) {
        return this.agentToolAuthService.rotateCredential(body);
    }
    async issueAgentToken(body) {
        return this.agentToolAuthService.issueToken(body);
    }
    async revokeToken(body) {
        return this.agentToolAuthService.revokeToken(body);
    }
    getToolExecutions(agentId, toolId) {
        return this.toolService.getToolExecutions(agentId, toolId);
    }
    getToolExecutionStats() {
        return this.toolService.getToolExecutionStats();
    }
    getTool(id) {
        return this.toolService.getToolView(id);
    }
};
exports.ToolController = ToolController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getAllTools", null);
__decorate([
    (0, common_1.Get)('registry'),
    __param(0, (0, common_1.Query)('provider')),
    __param(1, (0, common_1.Query)('executionChannel')),
    __param(2, (0, common_1.Query)('toolkitId')),
    __param(3, (0, common_1.Query)('namespace')),
    __param(4, (0, common_1.Query)('resource')),
    __param(5, (0, common_1.Query)('action')),
    __param(6, (0, common_1.Query)('category')),
    __param(7, (0, common_1.Query)('capability')),
    __param(8, (0, common_1.Query)('enabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getToolRegistry", null);
__decorate([
    (0, common_1.Get)('toolkits'),
    __param(0, (0, common_1.Query)('provider')),
    __param(1, (0, common_1.Query)('namespace')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getToolkits", null);
__decorate([
    (0, common_1.Get)('toolkits/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getToolkit", null);
__decorate([
    (0, common_1.Get)('router/topk'),
    __param(0, (0, common_1.Query)('provider')),
    __param(1, (0, common_1.Query)('domain')),
    __param(2, (0, common_1.Query)('namespace')),
    __param(3, (0, common_1.Query)('resource')),
    __param(4, (0, common_1.Query)('action')),
    __param(5, (0, common_1.Query)('capability')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getTopKRoutes", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "createTool", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "updateTool", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "deleteTool", null);
__decorate([
    (0, common_1.Post)(':id/execute'),
    (0, common_1.UseGuards)(agent_tool_auth_guard_1.AgentToolAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ToolController.prototype, "executeTool", null);
__decorate([
    (0, common_1.Post)('auth/credentials'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ToolController.prototype, "createAgentCredential", null);
__decorate([
    (0, common_1.Post)('auth/credentials/revoke'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ToolController.prototype, "revokeAgentCredential", null);
__decorate([
    (0, common_1.Post)('auth/credentials/rotate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ToolController.prototype, "rotateAgentCredential", null);
__decorate([
    (0, common_1.Post)('auth/agent-token'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ToolController.prototype, "issueAgentToken", null);
__decorate([
    (0, common_1.Post)('auth/tokens/revoke'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ToolController.prototype, "revokeToken", null);
__decorate([
    (0, common_1.Get)('executions/history'),
    __param(0, (0, common_1.Query)('agentId')),
    __param(1, (0, common_1.Query)('toolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getToolExecutions", null);
__decorate([
    (0, common_1.Get)('executions/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getToolExecutionStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ToolController.prototype, "getTool", null);
exports.ToolController = ToolController = __decorate([
    (0, common_1.Controller)('tools'),
    __metadata("design:paramtypes", [tool_service_1.ToolService,
        agent_tool_auth_service_1.AgentToolAuthService,
        agent_action_log_service_1.AgentActionLogService])
], ToolController);
//# sourceMappingURL=tool.controller.js.map