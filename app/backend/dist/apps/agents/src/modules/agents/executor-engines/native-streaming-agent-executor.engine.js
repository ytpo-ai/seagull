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
var NativeStreamingAgentExecutorEngine_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeStreamingAgentExecutorEngine = void 0;
const common_1 = require("@nestjs/common");
const model_service_1 = require("../../models/model.service");
const runtime_orchestrator_service_1 = require("../../runtime/runtime-orchestrator.service");
const agent_executor_helpers_1 = require("../agent-executor.helpers");
let NativeStreamingAgentExecutorEngine = NativeStreamingAgentExecutorEngine_1 = class NativeStreamingAgentExecutorEngine {
    constructor(modelService, runtimeOrchestrator) {
        this.modelService = modelService;
        this.runtimeOrchestrator = runtimeOrchestrator;
        this.logger = new common_1.Logger(NativeStreamingAgentExecutorEngine_1.name);
        this.mode = 'streaming';
        this.channel = 'native';
    }
    async execute(input) {
        const onToken = input.onToken;
        if (!onToken) {
            throw new Error('Missing onToken callback for native streaming execution');
        }
        const customApiKey = await input.resolveCustomApiKey('stream_task');
        this.modelService.ensureProviderWithKey(input.modelConfig, customApiKey);
        const firstRound = await this.streamOnce(input, onToken);
        const toolCall = (0, agent_executor_helpers_1.extractToolCall)(firstRound.response);
        if (toolCall && input.executeWithToolCalling) {
            this.logger.log(`[native_stream_tool_detected] taskId=${input.taskId} tool=${toolCall.tool} — falling back to executeWithToolCalling`);
            const response = await input.executeWithToolCalling(input.agent, input.task, input.messages, input.modelConfig, input.runtimeContext, {
                collaborationContext: input.context?.collaborationContext,
                actor: input.context?.actor,
                taskType: input.task.type,
                teamId: input.task.teamId,
                preactivatedToolIds: Array.isArray(input.context?.sessionContext?.preactivatedToolIds)
                    ? (input.context?.sessionContext).preactivatedToolIds
                    : undefined,
            });
            return { response, tokenChunks: firstRound.tokenChunks };
        }
        return {
            response: firstRound.response,
            tokenChunks: firstRound.tokenChunks,
        };
    }
    async streamOnce(input, onToken) {
        const responseFormat = (0, agent_executor_helpers_1.resolveResponseFormatFromCollaborationContext)(input.context?.collaborationContext, input.modelConfig);
        let fullResponse = '';
        let tokenChunks = 0;
        let streamSequence = 1;
        let runtimeInterrupted = false;
        await this.modelService.streamingChat(input.agent.model.id, input.messages, (token) => {
            if (runtimeInterrupted) {
                throw new Error('Runtime run interrupted');
            }
            fullResponse += token;
            tokenChunks += 1;
            onToken(token);
            if (tokenChunks % 20 === 0) {
                void this.runtimeOrchestrator.assertRunnable(input.runtimeContext.runId).catch(() => {
                    runtimeInterrupted = true;
                });
            }
            void this.runtimeOrchestrator
                .recordLlmDelta({
                runId: input.runtimeContext.runId,
                agentId: input.runtimeAgentId,
                messageId: input.runtimeContext.userMessageId,
                traceId: input.runtimeContext.traceId,
                sequence: streamSequence++,
                delta: token,
                sessionId: input.runtimeContext.sessionId,
                taskId: input.taskId,
            })
                .catch((eventError) => {
                const eventMessage = eventError instanceof Error ? eventError.message : String(eventError || 'unknown');
                this.logger.warn(`[stream_llm_delta_event_failed] taskId=${input.taskId} error=${eventMessage}`);
            });
        }, {
            temperature: input.agent.model.temperature,
            maxTokens: input.agent.model.maxTokens,
            ...(responseFormat ? { responseFormat } : {}),
        });
        return { response: fullResponse, tokenChunks };
    }
};
exports.NativeStreamingAgentExecutorEngine = NativeStreamingAgentExecutorEngine;
exports.NativeStreamingAgentExecutorEngine = NativeStreamingAgentExecutorEngine = NativeStreamingAgentExecutorEngine_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_service_1.ModelService,
        runtime_orchestrator_service_1.RuntimeOrchestratorService])
], NativeStreamingAgentExecutorEngine);
//# sourceMappingURL=native-streaming-agent-executor.engine.js.map