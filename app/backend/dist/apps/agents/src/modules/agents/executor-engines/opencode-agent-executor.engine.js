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
var OpencodeAgentExecutorEngine_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpencodeAgentExecutorEngine = void 0;
const common_1 = require("@nestjs/common");
const opencode_execution_service_1 = require("../../opencode/opencode-execution.service");
const agent_prompt_catalog_1 = require("../../prompt-registry/agent-prompt-catalog");
const runtime_orchestrator_service_1 = require("../../runtime/runtime-orchestrator.service");
const agent_executor_helpers_1 = require("../agent-executor.helpers");
let OpencodeAgentExecutorEngine = OpencodeAgentExecutorEngine_1 = class OpencodeAgentExecutorEngine {
    constructor(openCodeExecutionService, runtimeOrchestrator) {
        this.openCodeExecutionService = openCodeExecutionService;
        this.runtimeOrchestrator = runtimeOrchestrator;
        this.logger = new common_1.Logger(OpencodeAgentExecutorEngine_1.name);
        this.mode = 'detailed';
        this.channel = 'opencode';
    }
    async execute(input) {
        const openCodeExecutionConfig = input.openCodeExecutionConfig;
        if (!openCodeExecutionConfig) {
            throw new Error('OpenCode execution config is required for opencode detailed engine');
        }
        const sessionConfig = {
            metadata: {
                taskId: input.taskId,
                agentId: input.runtimeAgentId,
                source: 'agents-runtime',
            },
        };
        const resolvedProjectDirectory = input.context?.projectBinding?.opencodeProjectPath || undefined;
        if (resolvedProjectDirectory) {
            sessionConfig.directory = resolvedProjectDirectory;
            sessionConfig.projectPath = resolvedProjectDirectory;
        }
        const resolvedOpenCodeRuntime = (0, agent_executor_helpers_1.resolveOpenCodeRuntimeOptions)(openCodeExecutionConfig, input.context?.opencodeRuntime);
        input.logResolvedOpenCodeRuntime(input.taskId, 'detailed', resolvedOpenCodeRuntime);
        const executeOnce = async (taskPrompt) => this.openCodeExecutionService.executeWithRuntimeBridge({
            runtimeContext: input.runtimeContext,
            agentId: input.runtimeAgentId,
            taskId: input.taskId,
            taskPrompt,
            title: input.task.title,
            sessionConfig,
            model: {
                providerID: input.modelConfig.provider,
                modelID: input.modelConfig.model,
            },
            runtime: {
                baseUrl: resolvedOpenCodeRuntime.baseUrl,
                authEnable: resolvedOpenCodeRuntime.authEnable,
                requestTimeoutMs: openCodeExecutionConfig.requestTimeoutMs,
            },
        });
        let execResult = await executeOnce((0, agent_executor_helpers_1.resolveLatestUserContent)(input.task, input.messages));
        if ((0, agent_executor_helpers_1.isMeetingLikeTask)(input.task, input.context) && (0, agent_executor_helpers_1.isMeaninglessAssistantResponse)(execResult.response)) {
            this.logger.warn(`[task_empty_response_retry] taskId=${input.taskId} channel=opencode attempt=1`);
            await this.runtimeOrchestrator.assertRunnable(input.runtimeContext.runId);
            const retryPrompt = `${(0, agent_executor_helpers_1.resolveLatestUserContent)(input.task, input.messages)}\n\n` +
                `【系统补充】${agent_prompt_catalog_1.AGENT_PROMPTS.emptyResponseRetryInstruction.buildDefaultContent()}`;
            execResult = await executeOnce(retryPrompt);
        }
        const opencodeTokens = execResult.tokens;
        const usage = opencodeTokens
            ? {
                input: opencodeTokens.input ?? 0,
                output: opencodeTokens.output ?? 0,
                reasoning: opencodeTokens.reasoning ?? 0,
                cacheRead: opencodeTokens.cache?.read ?? 0,
                cacheWrite: opencodeTokens.cache?.write ?? 0,
                total: (opencodeTokens.input ?? 0) + (opencodeTokens.output ?? 0) + (opencodeTokens.reasoning ?? 0) + (opencodeTokens.cache?.read ?? 0) + (opencodeTokens.cache?.write ?? 0),
            }
            : undefined;
        return { response: execResult.response, usage, cost: execResult.cost };
    }
};
exports.OpencodeAgentExecutorEngine = OpencodeAgentExecutorEngine;
exports.OpencodeAgentExecutorEngine = OpencodeAgentExecutorEngine = OpencodeAgentExecutorEngine_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [opencode_execution_service_1.OpenCodeExecutionService,
        runtime_orchestrator_service_1.RuntimeOrchestratorService])
], OpencodeAgentExecutorEngine);
//# sourceMappingURL=opencode-agent-executor.engine.js.map