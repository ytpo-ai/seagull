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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutorRuntimeService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../libs/contracts/src/index");
const runtime_orchestrator_service_1 = require("../runtime/runtime-orchestrator.service");
let AgentExecutorRuntimeService = class AgentExecutorRuntimeService {
    constructor(runtimeOrchestrator) {
        this.runtimeOrchestrator = runtimeOrchestrator;
    }
    resolveRuntimeAgentId(agent, fallbackAgentId) {
        return agent.id || agent._id?.toString?.() || fallbackAgentId;
    }
    buildModelConfig(model) {
        return {
            id: model.id,
            name: model.name,
            provider: model.provider,
            model: model.model,
            maxTokens: model.maxTokens || 4096,
            temperature: model.temperature ?? 0.7,
            topP: model.topP,
            reasoning: model.reasoning,
        };
    }
    async appendSystemMessagesToSession(runtimeContext, messages, agentId) {
        if (!runtimeContext.sessionId) {
            return;
        }
        const systemMessages = messages
            .filter((msg) => msg.role === 'system')
            .map((msg) => ({
            role: 'system',
            content: (0, contracts_1.extractTextContent)(msg.content),
            metadata: { source: 'buildMessages', agentId },
        }));
        if (systemMessages.length > 0) {
            await this.runtimeOrchestrator.appendSystemMessagesToSession(runtimeContext.sessionId, systemMessages);
        }
    }
    async startRuntimeExecution(options) {
        const { runtimeAgentId, agentName, task, messages, mode, roleCode, executionChannel, executionData, collaborationContext, } = options;
        const { sessionContext } = options;
        const mergedCollaborationContext = {
            ...(collaborationContext || {}),
        };
        const meetingId = String(mergedCollaborationContext.meetingId || '').trim();
        const sessionId = String(sessionContext?.sessionId || '').trim() ||
            String(mergedCollaborationContext.sessionId || '').trim() ||
            undefined;
        const planId = String(mergedCollaborationContext.planId || '').trim() || undefined;
        const domainContext = mergedCollaborationContext.domainContext && typeof mergedCollaborationContext.domainContext === 'object'
            ? mergedCollaborationContext.domainContext
            : undefined;
        const metadata = {
            taskType: task.type,
            taskPriority: task.priority,
            roleCode,
            executionChannel,
            executionData,
            sync: {
                state: 'pending',
                retryCount: 0,
            },
        };
        if (mode === 'streaming') {
            metadata.mode = 'streaming';
        }
        if (meetingId) {
            metadata.meetingContext = {
                meetingId,
                agendaId: String(mergedCollaborationContext.agendaId || '').trim() || undefined,
                meetingType: String(mergedCollaborationContext.meetingType || '').trim() || undefined,
                latestSummary: String(mergedCollaborationContext.latestSummary || '').trim() || undefined,
            };
        }
        if (planId) {
            metadata.planId = planId;
        }
        if (domainContext) {
            metadata.domainContext = domainContext;
        }
        if (Object.keys(mergedCollaborationContext).length > 0) {
            metadata.collaborationContext = mergedCollaborationContext;
        }
        return this.runtimeOrchestrator.startRun({
            agentId: runtimeAgentId,
            agentName,
            taskId: task.id,
            sessionId,
            taskTitle: task.title,
            taskDescription: task.description,
            userContent: this.resolveLatestUserContent(task, messages),
            metadata,
        });
    }
    async completeRuntimeExecution(runtimeContext, runtimeAgentId, taskId, assistantContent) {
        await this.runtimeOrchestrator.completeRun({
            runId: runtimeContext.runId,
            agentId: runtimeAgentId,
            sessionId: runtimeContext.sessionId,
            taskId,
            assistantContent,
            traceId: runtimeContext.traceId,
        });
    }
    async failRuntimeExecution(runtimeContext, runtimeAgentId, taskId, error) {
        await this.runtimeOrchestrator.failRun({
            runId: runtimeContext.runId,
            agentId: runtimeAgentId,
            sessionId: runtimeContext.sessionId,
            taskId,
            error,
            traceId: runtimeContext.traceId,
        });
    }
    async releaseRuntimeExecution(runtimeContext) {
        await this.runtimeOrchestrator.releaseRun(runtimeContext);
    }
    resolveLatestUserContent(task, messages) {
        const latestTaskMessage = [...(task.messages || [])].reverse().find((msg) => msg.role === 'user')?.content;
        if (latestTaskMessage) {
            return (0, contracts_1.extractTextContent)(latestTaskMessage);
        }
        const latestCompiledMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content;
        if (latestCompiledMessage) {
            return (0, contracts_1.extractTextContent)(latestCompiledMessage);
        }
        return task.description || task.title || '';
    }
};
exports.AgentExecutorRuntimeService = AgentExecutorRuntimeService;
exports.AgentExecutorRuntimeService = AgentExecutorRuntimeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [runtime_orchestrator_service_1.RuntimeOrchestratorService])
], AgentExecutorRuntimeService);
//# sourceMappingURL=agent-executor-runtime.service.js.map