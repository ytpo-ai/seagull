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
var AgentExecutorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutorService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const infra_1 = require("../../../../../libs/infra/src/index");
const common_2 = require("../../../../../libs/common/src/index");
const contracts_1 = require("../../../../../libs/contracts/src/index");
const api_key_service_1 = require("../../../../../src/modules/api-keys/api-key.service");
const memo_event_bus_service_1 = require("../memos/memo-event-bus.service");
const memo_service_1 = require("../memos/memo.service");
const memo_write_queue_service_1 = require("../memos/memo-write-queue.service");
const model_service_1 = require("../models/model.service");
const opencode_execution_service_1 = require("../opencode/opencode-execution.service");
const agent_prompt_catalog_1 = require("../prompt-registry/agent-prompt-catalog");
const prompt_resolver_service_1 = require("../prompt-registry/prompt-resolver.service");
const runtime_ei_sync_service_1 = require("../runtime/runtime-ei-sync.service");
const runtime_orchestrator_service_1 = require("../runtime/runtime-orchestrator.service");
const runtime_persistence_service_1 = require("../runtime/runtime-persistence.service");
const agent_run_score_service_1 = require("../runtime/agent-run-score.service");
const hook_pipeline_service_1 = require("../runtime/hooks/hook-pipeline.service");
const task_execution_scorer_1 = require("../runtime/task-execution-scorer");
const tool_service_1 = require("../tools/tool.service");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const context_assembler_service_1 = require("./context/context-assembler.service");
const context_fingerprint_service_1 = require("./context/context-fingerprint.service");
const context_strategy_service_1 = require("./context/context-strategy.service");
const agent_constants_1 = require("./agent.constants");
const builtin_tool_catalog_1 = require("../tools/builtin-tool-catalog");
const agent_executor_runtime_service_1 = require("./agent-executor-runtime.service");
const agent_after_step_evaluation_hook_1 = require("./hooks/agent-after-step-evaluation.hook");
const agent_before_step_optimization_hook_1 = require("./hooks/agent-before-step-optimization.hook");
const agent_executor_engine_router_1 = require("./executor-engines/agent-executor-engine.router");
const agent_opencode_policy_service_1 = require("./agent-opencode-policy.service");
const agent_role_service_1 = require("./agent-role.service");
const agent_executor_helpers_1 = require("./agent-executor.helpers");
const DEFAULT_OPENCODE_TASK_TYPES = new Set([
    'code',
    'coding',
    'development.plan',
    'development.exec',
    'development.review',
    'engineering',
    'engineering_development',
    'implement',
    'implementation',
    'devops',
    'bugfix',
    'fix',
    'refactor',
    'frontend_dev',
    'backend_dev',
]);
let AgentExecutorService = AgentExecutorService_1 = class AgentExecutorService {
    debugTiming(taskId, stage, startedAt, extras) {
        this.debugTimingProvider.log({
            traceId: taskId,
            stage,
            startedAt,
            extras,
            traceFieldName: 'taskId',
        });
    }
    constructor(skillModel, modelService, apiKeyService, toolService, memoService, memoWriteQueue, memoEventBus, runtimeOrchestrator, runtimePersistence, agentRunScoreService, runtimeEiSyncService, openCodeExecutionService, redisService, agentExecutorRuntimeService, beforeStepOptimizationHook, afterStepEvaluationHook, agentExecutorEngineRouter, agentOpenCodePolicyService, agentRoleService, promptResolverService, hookPipeline, contextAssembler, contextFingerprintService, contextStrategyService, debugTimingProvider) {
        this.skillModel = skillModel;
        this.modelService = modelService;
        this.apiKeyService = apiKeyService;
        this.toolService = toolService;
        this.memoService = memoService;
        this.memoWriteQueue = memoWriteQueue;
        this.memoEventBus = memoEventBus;
        this.runtimeOrchestrator = runtimeOrchestrator;
        this.runtimePersistence = runtimePersistence;
        this.agentRunScoreService = agentRunScoreService;
        this.runtimeEiSyncService = runtimeEiSyncService;
        this.openCodeExecutionService = openCodeExecutionService;
        this.redisService = redisService;
        this.agentExecutorRuntimeService = agentExecutorRuntimeService;
        this.beforeStepOptimizationHook = beforeStepOptimizationHook;
        this.afterStepEvaluationHook = afterStepEvaluationHook;
        this.agentExecutorEngineRouter = agentExecutorEngineRouter;
        this.agentOpenCodePolicyService = agentOpenCodePolicyService;
        this.agentRoleService = agentRoleService;
        this.promptResolverService = promptResolverService;
        this.hookPipeline = hookPipeline;
        this.contextAssembler = contextAssembler;
        this.contextFingerprintService = contextFingerprintService;
        this.contextStrategyService = contextStrategyService;
        this.debugTimingProvider = debugTimingProvider;
        this.logger = new common_1.Logger(AgentExecutorService_1.name);
    }
    async runBeforeStepHooks(context, runtimeContext) {
        const pipelineContext = {
            phase: 'step.before',
            runId: runtimeContext?.runId || '',
            agentId: context.agent?.id || context.agent?._id?.toString?.() || '',
            taskId: context.task?.id,
            sessionId: runtimeContext?.sessionId,
            traceId: runtimeContext?.traceId || '',
            timestamp: Date.now(),
            payload: {
                agent: context.agent,
                task: context.task,
                messages: context.messages,
                modelConfig: context.modelConfig,
                round: context.round,
                maxRounds: context.maxRounds,
                assignedToolIds: context.assignedToolIds,
                executedToolIds: context.executedToolIds,
            },
        };
        const result = await this.hookPipeline.run(pipelineContext);
        return {
            appendSystemMessages: result.appendMessages,
            forcedToolCall: result.finalPayload.forcedToolCall,
            decision: result.finalPayload.decision || 'none',
            messageFilters: result.messageFilters.length > 0 ? result.messageFilters : undefined,
            pauseRequested: result.pauseRequested || undefined,
            pauseReason: result.pauseReason,
            cancelRequested: result.cancelRequested || undefined,
            cancelReason: result.cancelReason,
        };
    }
    async runAfterStepHooks(context, response, runtimeContext) {
        const pipelineContext = {
            phase: 'step.after',
            runId: runtimeContext?.runId || '',
            agentId: context.agent?.id || context.agent?._id?.toString?.() || '',
            taskId: context.task?.id,
            sessionId: runtimeContext?.sessionId,
            traceId: runtimeContext?.traceId || '',
            timestamp: Date.now(),
            payload: {
                agent: context.agent,
                task: context.task,
                messages: context.messages,
                modelConfig: context.modelConfig,
                round: context.round,
                maxRounds: context.maxRounds,
                assignedToolIds: context.assignedToolIds,
                executedToolIds: context.executedToolIds,
                response,
            },
        };
        const result = await this.hookPipeline.run(pipelineContext);
        return {
            appendSystemMessages: result.appendMessages,
            decision: result.finalPayload.decision === 'inject_instruction' ? 'inject_instruction' : 'accept',
            pauseRequested: result.pauseRequested || undefined,
            pauseReason: result.pauseReason,
            cancelRequested: result.cancelRequested || undefined,
            cancelReason: result.cancelReason,
            retryRequested: result.retryRequested || undefined,
        };
    }
    async executeTask(agent, agentId, task, context) {
        const detailed = await this.executeTaskDetailed(agent, agentId, task, context);
        return detailed.response;
    }
    async executeTaskDetailed(agent, agentId, task, context) {
        const taskStartAt = Date.now();
        const taskId = this.ensureTaskRuntime(task);
        const runtimeAgentId = this.agentExecutorRuntimeService.resolveRuntimeAgentId(agent, agentId);
        this.logger.log(`[task_start] agent=${agent.name} agentId=${runtimeAgentId} taskId=${taskId} title="${(0, agent_constants_1.compactLogText)(task.title)}" type=${task.type} priority=${task.priority} modelId=${agent.model?.id || 'unknown'} provider=${agent.model?.provider || 'unknown'} hasCustomApiKey=${Boolean(agent.apiKeyId)}`);
        void this.runMemoOperation('task_start_upsert_todo', taskId, async () => {
            await this.memoWriteQueue.queueUpsertTaskTodo(agent.id || agentId, {
                id: taskId,
                title: task.title,
                description: task.description,
                status: 'running',
                sourceType: 'orchestration_task',
            });
        });
        this.logger.log(`[task_context] taskId=${taskId} previousMessages=${task.messages?.length || 0} hasCollaborationContext=${Boolean(context?.collaborationContext)}`);
        const agentContext = {
            task,
            previousMessages: task.messages || [],
            workingMemory: new Map(),
            collaborationContext: context?.collaborationContext,
            ...context,
        };
        const prepared = await this.prepareExecution({
            mode: 'detailed',
            stagePrefix: 'prepare',
            emitTaskPreparationLogs: true,
        }, {
            agent,
            agentId,
            runtimeAgentId,
            task,
            taskId,
            context,
            agentContext,
        });
        const { enabledSkills, messages, openCodeExecutionConfig, executionChannel, runtimeContext } = prepared;
        try {
            if (executionChannel === 'opencode' && openCodeExecutionConfig) {
                await this.agentOpenCodePolicyService.applyAgentBudgetGate(agent, runtimeAgentId, task, runtimeContext, context);
            }
            const modelConfig = this.agentExecutorRuntimeService.buildModelConfig(agent.model);
            const engine = this.agentExecutorEngineRouter.resolve('detailed', executionChannel);
            const { response: engineResponse } = await engine.execute({
                mode: 'detailed',
                channel: executionChannel,
                agent,
                runtimeAgentId,
                task,
                taskId,
                messages,
                runtimeContext,
                modelConfig,
                context,
                openCodeExecutionConfig: openCodeExecutionConfig || undefined,
                resolveCustomApiKey: this.createResolveCustomApiKeyHandler(agent, taskId, 'prepare.resolve_custom_api_key'),
                executeWithToolCalling: this.executeWithToolCalling.bind(this),
                logResolvedOpenCodeRuntime: this.logResolvedOpenCodeRuntime.bind(this),
            });
            let response = engineResponse;
            if ((0, agent_executor_helpers_1.isMeetingLikeTask)(task, context) && (0, agent_executor_helpers_1.isMeaninglessAssistantResponse)(response)) {
                response = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.emptyMeetingResponseFallback);
            }
            this.logger.log(`[task_success] agent=${agent.name} taskId=${taskId} responseLength=${response.length} durationMs=${Date.now() - taskStartAt}`);
            void this.runMemoOperation('task_complete_todo', taskId, async () => {
                await this.memoWriteQueue.queueCompleteTaskTodo(agent.id || agentId, taskId, 'Task finished by agent runtime', 'success');
            });
            this.memoEventBus.emit({
                name: 'task.completed',
                agentId: agent.id || agentId,
                memoKinds: ['history', 'todo', 'draft'],
                taskId,
                summary: (0, agent_constants_1.compactLogText)(response, 240),
            });
            this.appendAssistantMessage(task, response, agent, enabledSkills);
            await this.agentExecutorRuntimeService.completeRuntimeExecution(runtimeContext, runtimeAgentId, taskId, response);
            await this.runtimeEiSyncService.scheduleRunSync(runtimeContext.runId);
            return {
                response,
                runId: runtimeContext.runId,
                sessionId: runtimeContext.sessionId,
            };
        }
        catch (error) {
            const logError = (0, agent_constants_1.toLogError)(error);
            this.logger.error(`[task_failed] agent=${agent.name} taskId=${taskId} durationMs=${Date.now() - taskStartAt} error=${logError.message}`, logError.stack);
            const controlInterrupted = this.isControlInterruptedError(logError.message);
            void this.runMemoOperation('task_failed_todo', taskId, async () => {
                await this.memoWriteQueue.queueCompleteTaskTodo(agent.id || agentId, taskId, controlInterrupted ? 'Task interrupted before completion' : logError.message, controlInterrupted ? 'cancelled' : 'failed');
            });
            if (!controlInterrupted) {
                await this.agentExecutorRuntimeService.failRuntimeExecution(runtimeContext, runtimeAgentId, taskId, logError.message);
                await this.runtimeEiSyncService.scheduleRunSync(runtimeContext.runId);
            }
            throw error;
        }
        finally {
            await this.agentExecutorRuntimeService.releaseRuntimeExecution(runtimeContext);
        }
    }
    async executeTaskWithStreaming(agent, agentId, task, onToken, context) {
        const taskStartAt = Date.now();
        const taskId = this.ensureTaskRuntime(task);
        const runtimeAgentId = this.agentExecutorRuntimeService.resolveRuntimeAgentId(agent, agentId);
        this.logger.log(`[stream_task_start] agent=${agent.name} agentId=${runtimeAgentId} taskId=${taskId} title="${(0, agent_constants_1.compactLogText)(task.title)}" modelId=${agent.model?.id || 'unknown'} provider=${agent.model?.provider || 'unknown'}`);
        const agentContext = {
            task,
            previousMessages: task.messages || [],
            workingMemory: new Map(),
            collaborationContext: context?.collaborationContext,
            ...context,
        };
        const prepared = await this.prepareExecution({
            mode: 'streaming',
            stagePrefix: 'stream_prepare',
            emitTaskPreparationLogs: false,
        }, {
            agent,
            agentId,
            runtimeAgentId,
            task,
            taskId,
            context,
            agentContext,
        });
        const { enabledSkills, messages, openCodeExecutionConfig, executionChannel, runtimeContext } = prepared;
        let fullResponse = '';
        let tokenChunks = 0;
        try {
            if (executionChannel === 'opencode' && openCodeExecutionConfig) {
                await this.agentOpenCodePolicyService.applyAgentBudgetGate(agent, runtimeAgentId, task, runtimeContext, context);
            }
            await this.runtimeOrchestrator.assertRunnable(runtimeContext.runId);
            const modelConfig = this.agentExecutorRuntimeService.buildModelConfig(agent.model);
            const engine = this.agentExecutorEngineRouter.resolve('streaming', executionChannel);
            const engineResult = await engine.execute({
                mode: 'streaming',
                channel: executionChannel,
                agent,
                runtimeAgentId,
                task,
                taskId,
                messages,
                runtimeContext,
                modelConfig,
                context,
                openCodeExecutionConfig: openCodeExecutionConfig || undefined,
                onToken,
                resolveCustomApiKey: this.createResolveCustomApiKeyHandler(agent, taskId, 'stream_prepare.resolve_custom_api_key'),
                executeWithToolCalling: this.executeWithToolCalling.bind(this),
                logResolvedOpenCodeRuntime: this.logResolvedOpenCodeRuntime.bind(this),
            });
            fullResponse = engineResult.response;
            tokenChunks = engineResult.tokenChunks ?? tokenChunks;
            if ((0, agent_executor_helpers_1.isMeetingLikeTask)(task, context) && (0, agent_executor_helpers_1.isMeaninglessAssistantResponse)(fullResponse)) {
                const emptyMeetingResponseFallback = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.emptyMeetingResponseFallback);
                fullResponse = emptyMeetingResponseFallback;
                tokenChunks += 1;
                onToken(emptyMeetingResponseFallback);
            }
            await this.agentExecutorRuntimeService.completeRuntimeExecution(runtimeContext, runtimeAgentId, taskId, fullResponse);
            await this.runtimeEiSyncService.scheduleRunSync(runtimeContext.runId);
        }
        catch (error) {
            const logError = (0, agent_constants_1.toLogError)(error);
            this.logger.error(`[stream_task_failed] agent=${agent.name} taskId=${taskId} durationMs=${Date.now() - taskStartAt} tokenChunks=${tokenChunks} error=${logError.message}`, logError.stack);
            const controlInterrupted = this.isControlInterruptedError(logError.message);
            if (!controlInterrupted) {
                await this.agentExecutorRuntimeService.failRuntimeExecution(runtimeContext, runtimeAgentId, taskId, logError.message);
                await this.runtimeEiSyncService.scheduleRunSync(runtimeContext.runId);
            }
            throw error;
        }
        finally {
            await this.agentExecutorRuntimeService.releaseRuntimeExecution(runtimeContext);
        }
        this.logger.log(`[stream_task_success] agent=${agent.name} taskId=${taskId} durationMs=${Date.now() - taskStartAt} tokenChunks=${tokenChunks} responseLength=${fullResponse.length}`);
        this.appendAssistantMessage(task, fullResponse, agent, enabledSkills);
        return {
            response: fullResponse,
            runId: runtimeContext.runId,
            sessionId: runtimeContext.sessionId,
        };
    }
    async testAgentConnection(agent, options) {
        const modelConfig = {
            id: options?.model?.id || agent.model.id,
            name: options?.model?.name || agent.model.name,
            provider: (options?.model?.provider || agent.model.provider),
            model: options?.model?.model || agent.model.model,
            maxTokens: options?.model?.maxTokens || agent.model.maxTokens || 4096,
            temperature: options?.model?.temperature ?? agent.model.temperature ?? 0.7,
            topP: options?.model?.topP ?? agent.model.topP,
            reasoning: options?.model?.reasoning ?? agent.model.reasoning,
        };
        const messages = [
            {
                role: 'system',
                content: agent.systemPrompt || (await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.testConnectionDefaultSystemPrompt)),
                timestamp: new Date(),
            },
            {
                role: 'user',
                content: await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.testConnectionUserMessage),
                timestamp: new Date(),
            },
        ];
        const resolveTestTimeoutMs = () => {
            const provider = (modelConfig.provider || '').trim().toLowerCase();
            if (provider === 'deepseek') {
                const deepseekTimeoutMs = Number(process.env.DEEPSEEK_MODEL_TEST_TIMEOUT_MS || 60000);
                if (Number.isFinite(deepseekTimeoutMs) && deepseekTimeoutMs > 0) {
                    return deepseekTimeoutMs;
                }
                return 60000;
            }
            return 20000;
        };
        const runModelTest = async (customApiKey) => {
            this.modelService.registerProvider(modelConfig, customApiKey);
            const startTime = Date.now();
            const timeoutMs = resolveTestTimeoutMs();
            const response = await Promise.race([
                this.modelService.chat(modelConfig.id, messages, {
                    temperature: modelConfig.temperature ?? 0.7,
                    maxTokens: 128,
                }).then((result) => result.response),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`模型测试超时（${Math.floor(timeoutMs / 1000)}s）`)), timeoutMs)),
            ]);
            return {
                response,
                duration: `${Date.now() - startTime}ms`,
            };
        };
        const isModelNotFoundError = (message) => {
            const lower = (message || '').toLowerCase();
            return ((lower.includes('not_found_error') && lower.includes('model')) ||
                lower.includes('not found the model') ||
                lower.includes('model not found') ||
                lower === 'not found' ||
                lower.includes('not found (alibaba endpoint='));
        };
        const isAuthError = (message) => {
            const lower = (message || '').toLowerCase();
            return lower.includes('401') || lower.includes('invalid authentication') || lower.includes('unauthorized');
        };
        const isTimeoutError = (message) => {
            const lower = (message || '').toLowerCase();
            return lower.includes('模型测试超时') || lower.includes('timeout');
        };
        const normalizeProvider = (provider) => {
            const value = (provider || '').trim().toLowerCase();
            if (value === 'kimi' || value === 'moonshot' || value === 'moonshotai')
                return 'moonshotai';
            if (value === 'claude')
                return 'anthropic';
            return value;
        };
        const keyId = options?.apiKeyId?.trim() || undefined;
        const buildBaseResult = (keySource) => ({
            agent: agent.name,
            model: modelConfig.name,
            keySource,
            timestamp: new Date().toISOString(),
        });
        const buildFailureResult = (keySource, error) => ({
            success: false,
            ...buildBaseResult(keySource),
            error,
        });
        const buildSuccessResult = (keySource, result, note) => ({
            success: true,
            ...buildBaseResult(keySource),
            response: result.response,
            responseLength: result.response.length,
            duration: result.duration,
            ...(note ? { note } : {}),
        });
        try {
            if (keyId) {
                const selectedApiKey = await this.apiKeyService.getApiKey(keyId);
                if (!selectedApiKey) {
                    return buildFailureResult('custom', '所选API Key不存在，请重新选择');
                }
                if (normalizeProvider(selectedApiKey.provider) !== normalizeProvider(modelConfig.provider)) {
                    return buildFailureResult('custom', `所选API Key提供商(${selectedApiKey.provider})与模型提供商(${modelConfig.provider})不匹配`);
                }
                const customApiKey = await this.apiKeyService.getDecryptedKey(keyId);
                if (!customApiKey) {
                    return buildFailureResult('custom', 'Agent绑定的API Key无效或已失效，请重新选择API Key');
                }
                try {
                    const result = await runModelTest(customApiKey);
                    await this.apiKeyService.recordUsage(keyId);
                    return buildSuccessResult('custom', result);
                }
                catch (customError) {
                    const customMessage = customError instanceof Error ? customError.message : 'Unknown error';
                    this.logger.error(`Agent ${agent.name} model test failed with custom key: ${customMessage}`);
                    if (isModelNotFoundError(customMessage)) {
                        return buildFailureResult('custom', `当前模型在提供商侧不可用，请切换模型后重试。详细信息：${customMessage}`);
                    }
                    if (isAuthError(customMessage)) {
                        return buildFailureResult('custom', `自定义API Key鉴权失败，请检查该Key是否有效/可用。详细信息：${customMessage}`);
                    }
                    if (isTimeoutError(customMessage)) {
                        return buildFailureResult('custom', `自定义API Key请求超时，请检查网络可达性、代理设置或模型服务状态。详细信息：${customMessage}`);
                    }
                    try {
                        const fallbackResult = await runModelTest(undefined);
                        return buildSuccessResult('system', fallbackResult, `自定义API Key测试失败，已使用系统默认Key回退成功：${customMessage}`);
                    }
                    catch (fallbackError) {
                        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
                        this.logger.error(`Agent ${agent.name} model fallback test failed: ${fallbackMessage}`);
                        return buildFailureResult('custom', `自定义API Key失败: ${customMessage}; 系统默认Key失败: ${fallbackMessage}`);
                    }
                }
            }
            const result = await runModelTest(undefined);
            return buildSuccessResult('system', result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Agent ${agent.name} model test failed: ${message}`);
            return buildFailureResult(keyId ? 'custom' : 'system', message);
        }
    }
    async cancelRuntimeRun(runId, reason) {
        if (!String(runId || '').trim()) {
            return;
        }
        await this.runtimeOrchestrator.cancelRunWithActor(runId, {
            actorId: 'agent-task-worker',
            actorType: 'system',
            reason: reason || 'user_cancel',
        });
    }
    async cancelOpenCodeSession(sessionId, runtime) {
        if (!String(sessionId || '').trim()) {
            return false;
        }
        return this.openCodeExecutionService.cancelSession(sessionId, {
            baseUrl: runtime?.endpoint,
            authEnable: runtime?.authEnable,
        });
    }
    async prepareExecution(config, input) {
        const preExecutionStartAt = Date.now();
        const skillsStartAt = Date.now();
        const enabledSkills = await this.getEnabledSkillsForAgent(input.agent, input.agentId);
        this.debugTiming(input.taskId, `${config.stagePrefix}.enabled_skills`, skillsStartAt, { enabledSkills: enabledSkills.length });
        if (config.emitTaskPreparationLogs) {
            this.logger.log(`[task_skills] taskId=${input.taskId} enabledSkills=${enabledSkills.length} skillNames=${enabledSkills.map((item) => item.name).join('|') || 'none'}`);
        }
        const buildMessagesStartAt = Date.now();
        const messages = await this.buildMessages(input.agent, input.task, input.agentContext, enabledSkills);
        this.debugTiming(input.taskId, `${config.stagePrefix}.build_messages`, buildMessagesStartAt, { compiledMessages: messages.length });
        if (config.emitTaskPreparationLogs) {
            this.logger.log(`[task_messages] taskId=${input.taskId} compiledMessages=${messages.length}`);
        }
        const routeStartAt = Date.now();
        const routeDecision = await this.resolveExecutionRoute(input.agent, input.task, input.context);
        this.debugTiming(input.taskId, `${config.stagePrefix}.resolve_execution_route`, routeStartAt, {
            channel: routeDecision.channel,
            routeSource: routeDecision.source,
            taskType: routeDecision.taskType,
        });
        const openCodeExecutionConfig = routeDecision.openCodeExecutionConfig;
        const roleStartAt = Date.now();
        const role = await this.agentRoleService.getRoleById(input.agent.roleId);
        this.debugTiming(input.taskId, `${config.stagePrefix}.load_role`, roleStartAt, { hasRole: Boolean(role) });
        const roleCode = role?.code ? String(role.code).trim() : undefined;
        const executionChannel = routeDecision.channel;
        const executionData = this.buildExecutionData(input.agent, routeDecision, executionChannel, config.mode === 'streaming' ? 'streaming' : undefined);
        const startRuntimeExecutionAt = Date.now();
        const runtimeContext = await this.agentExecutorRuntimeService.startRuntimeExecution({
            runtimeAgentId: input.runtimeAgentId,
            agentName: input.agent.name,
            task: input.task,
            messages,
            mode: config.mode,
            roleCode,
            executionChannel,
            executionData,
            collaborationContext: input.context?.collaborationContext,
            sessionContext: input.context?.sessionContext,
        });
        this.debugTiming(input.taskId, `${config.stagePrefix}.start_runtime_execution`, startRuntimeExecutionAt, {
            runId: runtimeContext.runId,
            sessionId: runtimeContext.sessionId || 'none',
        });
        await input.context?.runtimeLifecycle?.onStarted?.({
            runId: runtimeContext.runId,
            sessionId: runtimeContext.sessionId,
            traceId: runtimeContext.traceId,
        });
        this.debugTiming(input.taskId, `${config.stagePrefix}.total_before_model`, preExecutionStartAt, {
            channel: executionChannel,
            routeSource: routeDecision.source,
        });
        const buildPhaseSessionId = String((input.context?.sessionContext || {}).sessionId || '').trim();
        if (!buildPhaseSessionId && runtimeContext.sessionId) {
            const runtimeAgentIdForPersist = input.agent.id || input.agent._id?.toString?.() || '';
            const systemMessages = messages
                .filter((msg) => msg.role === 'system')
                .map((msg) => {
                const content = String(msg.content || '').trim();
                if (!content)
                    return null;
                const metadata = msg.metadata && typeof msg.metadata === 'object'
                    ? { ...msg.metadata }
                    : undefined;
                return { id: `msg-${(0, uuid_1.v4)()}`, content, ...(metadata ? { metadata } : {}) };
            })
                .filter((msg) => Boolean(msg));
            const persisted = await this.runtimePersistence.setSessionInitialSystemMessages(runtimeContext.sessionId, systemMessages);
            if (persisted && systemMessages.length > 0) {
                const syntheticRunId = `system-init-${runtimeContext.sessionId}`;
                for (let i = 0; i < systemMessages.length; i++) {
                    await this.runtimePersistence.createMessage({
                        id: systemMessages[i].id,
                        runId: syntheticRunId,
                        agentId: runtimeAgentIdForPersist,
                        sessionId: runtimeContext.sessionId,
                        taskId: input.task.id,
                        role: 'system',
                        sequence: i + 1,
                        content: systemMessages[i].content,
                        status: 'completed',
                        metadata: {
                            ...(systemMessages[i].metadata || {}),
                            source: 'session.initialSystemMessages.deferred',
                        },
                    });
                }
            }
        }
        return {
            enabledSkills,
            messages,
            routeDecision,
            openCodeExecutionConfig,
            executionChannel,
            runtimeContext,
        };
    }
    async resolveExecutionRoute(agent, task, context) {
        const openCodeExecutionConfig = this.agentOpenCodePolicyService.parseOpenCodeExecutionConfig(agent.config) || null;
        const taskType = this.resolveExecutionTaskType(task, context);
        const preferredChannel = this.resolvePreferredExecutionChannel(context);
        if (!openCodeExecutionConfig) {
            this.logger.log(`[execution_route] agent=${agent.name} taskType=${taskType} channel=native source=opencode_disabled opencodeEnabled=false`);
            return {
                channel: 'native',
                taskType,
                source: 'opencode_disabled',
                openCodeExecutionConfig,
            };
        }
        if (preferredChannel) {
            return await this.finalizeExecutionRoute(agent, taskType, preferredChannel, `context_preferred_${preferredChannel}`, openCodeExecutionConfig);
        }
        const routing = openCodeExecutionConfig.taskRouting;
        if (routing) {
            if (routing.opencodeTaskTypes.includes(taskType)) {
                return await this.finalizeExecutionRoute(agent, taskType, 'opencode', 'config_task_routing_opencode', openCodeExecutionConfig);
            }
            if (routing.nativeTaskTypes.includes(taskType)) {
                return await this.finalizeExecutionRoute(agent, taskType, 'native', 'config_task_routing_native', openCodeExecutionConfig);
            }
            return await this.finalizeExecutionRoute(agent, taskType, routing.defaultChannel, `config_task_routing_default_${routing.defaultChannel}`, openCodeExecutionConfig);
        }
        const fallbackChannel = DEFAULT_OPENCODE_TASK_TYPES.has(taskType) ? 'opencode' : 'native';
        const fallbackSource = fallbackChannel === 'opencode' ? 'default_task_type_opencode' : 'default_task_type_native';
        return this.finalizeExecutionRoute(agent, taskType, fallbackChannel, fallbackSource, openCodeExecutionConfig);
    }
    async finalizeExecutionRoute(agent, taskType, channel, source, openCodeExecutionConfig) {
        if (channel === 'opencode') {
            const role = await this.agentRoleService.assertRoleExists(agent.roleId);
            this.agentOpenCodePolicyService.assertOpenCodeExecutionGate(agent, String(role.code || '').trim(), openCodeExecutionConfig);
        }
        this.logger.log(`[execution_route] agent=${agent.name} taskType=${taskType} channel=${channel} source=${source} opencodeEnabled=true`);
        return {
            channel,
            taskType,
            source,
            openCodeExecutionConfig,
        };
    }
    resolveExecutionTaskType(task, context) {
        const candidates = [
            context?.runtimeRouting?.taskType,
            this.asString(context?.sessionContext?.runtimeTaskType),
            this.asString(context?.sessionContext?.taskType),
            task.type,
        ];
        for (const candidate of candidates) {
            const normalized = String(candidate || '').trim().toLowerCase();
            if (normalized) {
                return normalized;
            }
        }
        return 'general';
    }
    resolvePreferredExecutionChannel(context) {
        const candidates = [
            context?.runtimeRouting?.preferredChannel,
            this.asString(context?.sessionContext?.runtimeChannelHint),
            this.asString(context?.sessionContext?.preferredRuntimeChannel),
        ];
        for (const candidate of candidates) {
            const normalized = String(candidate || '').trim().toLowerCase();
            if (normalized === 'native' || normalized === 'opencode') {
                return normalized;
            }
        }
        return null;
    }
    asString(value) {
        return typeof value === 'string' ? value : undefined;
    }
    async executeWithToolCalling(agent, task, initialMessages, modelConfig, runtimeContext, executionContext) {
        const maxToolRounds = this.getMaxToolRounds();
        const messages = [...initialMessages];
        const assignedToolIds = new Set(await this.agentRoleService.getAllowedToolIds(agent));
        const agentRuntimeId = agent.id || agent._id?.toString?.() || '';
        const executedToolIds = new Set();
        const meetingLike = (0, agent_executor_helpers_1.isMeetingLikeTask)(task, executionContext);
        let emptyResponseRetryUsed = false;
        let errorRetryUsed = false;
        let plannerTextOnlyRetryUsed = false;
        let lastToolCallFingerprint = '';
        let consecutiveIdenticalToolCalls = 0;
        const maxConsecutiveIdenticalToolCalls = agent_constants_1.DEFAULT_MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS;
        const emptyMeetingResponseFallback = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.emptyMeetingResponseFallback);
        const generationErrorRetryPrompt = meetingLike
            ? await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.generationErrorRetryInstruction)
            : '';
        const emptyResponseRetryPrompt = meetingLike
            ? await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.emptyResponseRetryInstruction)
            : '';
        const toolRoundLimitMessage = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.toolRoundLimitMessage);
        const initialSystemMessageCount = messages.filter((message) => message.role === 'system').length;
        const scorer = new task_execution_scorer_1.TaskExecutionScorer();
        const schemaInjectedToolIds = new Set();
        const persistIntermediateSystemMessage = async (round, offset, content, metadata) => {
            if (!runtimeContext?.sessionId) {
                return;
            }
            try {
                await this.runtimePersistence.createMessage({
                    runId: runtimeContext.runId,
                    agentId: agentRuntimeId,
                    sessionId: runtimeContext.sessionId,
                    taskId: task.id,
                    role: 'system',
                    sequence: this.computeIntermediateSystemSequence(initialSystemMessageCount, round, offset),
                    content,
                    status: 'completed',
                    metadata,
                });
            }
            catch (error) {
                const logError = (0, agent_constants_1.toLogError)(error);
                this.logger.warn(`[persist_intermediate_system_message_failed] agent=${agent.name} taskId=${task.id} round=${round + 1} error=${logError.message}`);
            }
        };
        const preactivatedToolIds = this.extractPreactivatedToolIds(executionContext);
        let preactivationOffset = 0;
        for (const toolId of preactivatedToolIds) {
            const inputContract = await this.toolService.getToolInputContract(toolId);
            if (inputContract?.schema && (0, agent_executor_helpers_1.hasEffectiveSchema)(inputContract.schema)) {
                const schemaHint = (0, agent_executor_helpers_1.buildToolSchemaHint)(toolId, inputContract.schema);
                if (schemaHint) {
                    messages.push({
                        role: 'system',
                        content: schemaHint,
                        timestamp: new Date(),
                    });
                    schemaInjectedToolIds.add(toolId);
                    await persistIntermediateSystemMessage(-1, preactivationOffset++, schemaHint, {
                        source: 'preactivation.tool-schema-injected',
                        toolId,
                    });
                }
            }
        }
        const persistStepMessage = async (input) => {
            if (!runtimeContext?.sessionId) {
                return;
            }
            const normalizedTokens = input.usage
                ? {
                    input: input.usage.inputTokens,
                    output: input.usage.outputTokens,
                    reasoning: input.usage.reasoningTokens,
                    cacheRead: input.usage.cacheRead,
                    cacheWrite: input.usage.cacheWrite,
                    total: input.usage.totalTokens,
                }
                : undefined;
            const stepParts = [
                {
                    sequence: 1,
                    type: 'step_start',
                    status: 'completed',
                    metadata: {
                        round: input.round,
                        taskId: task.id,
                        taskType: task.type,
                    },
                    startedAt: input.stepStartAt,
                    endedAt: input.stepStartAt,
                },
                ...input.parts.map((part, index) => ({
                    sequence: index + 2,
                    ...part,
                    startedAt: part.startedAt || input.stepStartAt,
                    endedAt: part.endedAt || input.stepEndAt,
                })),
                {
                    sequence: input.parts.length + 2,
                    type: 'step_finish',
                    status: input.finish === 'error' ? 'error' : 'completed',
                    metadata: {
                        finish: input.finish,
                        tokens: normalizedTokens,
                        cost: input.cost,
                    },
                    startedAt: input.stepEndAt,
                    endedAt: input.stepEndAt,
                },
            ];
            await this.runtimePersistence.bulkCreateMessageWithParts({
                runId: runtimeContext.runId,
                agentId: agentRuntimeId,
                sessionId: runtimeContext.sessionId,
                taskId: task.id,
                role: 'assistant',
                sequence: this.computeAssistantSequence(initialSystemMessageCount, input.round),
                content: input.response,
                status: input.finish === 'error' ? 'error' : 'completed',
                parentMessageId: runtimeContext.userMessageId,
                modelID: modelConfig.id,
                providerID: modelConfig.provider,
                finish: input.finish,
                tokens: normalizedTokens,
                cost: input.cost,
                stepIndex: input.round,
                metadata: {
                    source: 'agent.executeWithToolCalling',
                    round: input.round,
                    taskType: task.type,
                },
            }, stepParts);
        };
        try {
            for (let round = 0; round <= maxToolRounds; round++) {
                scorer.markRound(round);
                if (runtimeContext) {
                    await this.runtimeOrchestrator.assertRunnable(runtimeContext.runId);
                }
                let response = '';
                let usage;
                let cost;
                const stepParts = [];
                let intermediateSystemOffset = 1;
                const stepStartedAt = new Date();
                const roundStartAt = Date.now();
                this.logger.log(`[tool_round_start] agent=${agent.name} taskId=${task.id} round=${round + 1}/${maxToolRounds + 1} messageCount=${messages.length} modelId=${modelConfig.id}`);
                const stepContext = {
                    agent,
                    task,
                    messages,
                    modelConfig,
                    round,
                    maxRounds: maxToolRounds,
                    assignedToolIds: Array.from(assignedToolIds),
                    executedToolIds: Array.from(executedToolIds),
                };
                const beforeStepHookResult = await this.runBeforeStepHooks(stepContext, runtimeContext);
                if (beforeStepHookResult.cancelRequested && runtimeContext) {
                    this.logger.warn(`[step_hook_cancel] agent=${agent.name} taskId=${task.id} round=${round + 1} reason=${beforeStepHookResult.cancelReason}`);
                    await persistStepMessage({
                        round,
                        response: beforeStepHookResult.cancelReason || 'cancelled_by_before_step_hook',
                        finish: 'cancelled',
                        parts: [
                            {
                                type: 'system_event',
                                status: 'cancelled',
                                content: 'before_step_hook_cancel',
                                error: beforeStepHookResult.cancelReason,
                            },
                        ],
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                    await this.runtimeOrchestrator.cancelRunWithActor(runtimeContext.runId, {
                        actorId: 'lifecycle-hook',
                        actorType: 'system',
                        reason: beforeStepHookResult.cancelReason || 'cancelled_by_before_step_hook',
                    });
                    throw new Error(`Runtime run cancelled by hook: ${beforeStepHookResult.cancelReason || 'before_step_hook'}`);
                }
                if (beforeStepHookResult.pauseRequested && runtimeContext) {
                    this.logger.warn(`[step_hook_pause] agent=${agent.name} taskId=${task.id} round=${round + 1} reason=${beforeStepHookResult.pauseReason}`);
                    await persistStepMessage({
                        round,
                        response: beforeStepHookResult.pauseReason || 'paused_by_before_step_hook',
                        finish: 'paused',
                        parts: [
                            {
                                type: 'system_event',
                                status: 'cancelled',
                                content: 'before_step_hook_pause',
                                error: beforeStepHookResult.pauseReason,
                            },
                        ],
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                    await this.runtimeOrchestrator.pauseRunWithActor(runtimeContext.runId, {
                        actorId: 'lifecycle-hook',
                        actorType: 'system',
                        reason: beforeStepHookResult.pauseReason || 'paused_by_before_step_hook',
                    });
                    throw new Error(`Runtime run paused by hook: ${beforeStepHookResult.pauseReason || 'before_step_hook'}`);
                }
                if (beforeStepHookResult.messageFilters?.length) {
                    const filtered = hook_pipeline_service_1.HookPipelineService.applyMessageFilters(messages, beforeStepHookResult.messageFilters);
                    messages.length = 0;
                    messages.push(...filtered);
                }
                if (beforeStepHookResult.appendSystemMessages.length > 0) {
                    for (const instruction of beforeStepHookResult.appendSystemMessages) {
                        messages.push({
                            role: 'system',
                            content: instruction,
                            timestamp: new Date(),
                        });
                    }
                }
                if (beforeStepHookResult.forcedToolCall) {
                    const forcedToolCall = beforeStepHookResult.forcedToolCall;
                    messages.push({
                        role: 'system',
                        content: await this.buildForcedToolCallInstruction(agent, forcedToolCall),
                        timestamp: new Date(),
                    });
                }
                try {
                    const responseFormat = (0, agent_executor_helpers_1.resolveResponseFormatFromCollaborationContext)(executionContext?.collaborationContext, modelConfig);
                    const modelResult = await this.modelService.chat(modelConfig.id, messages, {
                        temperature: modelConfig.temperature,
                        maxTokens: modelConfig.maxTokens,
                        ...(responseFormat ? { responseFormat } : {}),
                    });
                    response = modelResult.response;
                    usage = modelResult.usage;
                    cost = modelResult.cost;
                    this.logger.log(`[tool_round_response] agent=${agent.name} taskId=${task.id} round=${round + 1} durationMs=${Date.now() - roundStartAt} responseLength=${response.length}`);
                }
                catch (error) {
                    if ((0, agent_executor_helpers_1.shouldRetryGenerationError)(error)) {
                        scorer.deduct('D12', round, {
                            detail: (0, agent_constants_1.toLogError)(error).message,
                        });
                    }
                    if ((0, agent_executor_helpers_1.isModelTimeoutError)(error)) {
                        this.logger.warn(`[tool_round_timeout] agent=${agent.name} taskId=${task.id} round=${round + 1} durationMs=${Date.now() - roundStartAt}`);
                        await persistStepMessage({
                            round,
                            response: '当前模型请求超时（上游响应过慢）。请稍后重试，或将问题拆小后再试。',
                            finish: 'error',
                            parts: [
                                {
                                    type: 'system_event',
                                    status: 'error',
                                    content: 'model_timeout',
                                    error: 'model_timeout',
                                },
                            ],
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        return '当前模型请求超时（上游响应过慢）。请稍后重试，或将问题拆小后再试。';
                    }
                    if (meetingLike && !errorRetryUsed && (0, agent_executor_helpers_1.shouldRetryGenerationError)(error)) {
                        errorRetryUsed = true;
                        this.logger.warn(`[tool_round_retry] agent=${agent.name} taskId=${task.id} round=${round + 1} reason=${(0, agent_constants_1.toLogError)(error).message}`);
                        messages.push({
                            role: 'system',
                            content: generationErrorRetryPrompt,
                            timestamp: new Date(),
                        });
                        await persistStepMessage({
                            round,
                            response: generationErrorRetryPrompt,
                            finish: 'tool-calls',
                            parts: [
                                {
                                    type: 'system_event',
                                    status: 'completed',
                                    content: 'generation_error_retry',
                                    error: (0, agent_constants_1.toLogError)(error).message,
                                },
                            ],
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        continue;
                    }
                    if (meetingLike && (0, agent_executor_helpers_1.shouldRetryGenerationError)(error)) {
                        await persistStepMessage({
                            round,
                            response: emptyMeetingResponseFallback,
                            finish: 'error',
                            parts: [
                                {
                                    type: 'system_event',
                                    status: 'error',
                                    content: 'generation_error_fallback',
                                    error: (0, agent_constants_1.toLogError)(error).message,
                                },
                            ],
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        return emptyMeetingResponseFallback;
                    }
                    throw error;
                }
                const toolCalls = (0, agent_executor_helpers_1.extractAllToolCalls)(response);
                if (toolCalls.length === 0 && /<tool_call>/i.test(response)) {
                    scorer.deduct('D7', round);
                    this.logger.warn(`[tool_call_parse_failed] agent=${agent.name} taskId=${task.id} round=${round + 1} responseLen=${response.length} preview=${JSON.stringify(response.slice(0, 500))}`);
                }
                const toolCall = toolCalls.length > 0 ? toolCalls[0] : null;
                const droppedToolCalls = toolCalls.length > 1 ? toolCalls.slice(1) : [];
                if (droppedToolCalls.length > 0) {
                    for (const droppedToolCall of droppedToolCalls) {
                        scorer.deduct('D2', round, {
                            toolId: (0, agent_constants_1.normalizeToolId)(droppedToolCall.tool),
                            detail: `executed=${toolCall?.tool} dropped=${droppedToolCall.tool}; 每轮只能输出一个 tool_call`,
                        });
                    }
                    this.logger.log(`[multi_tool_call_dropped] agent=${agent.name} taskId=${task.id} round=${round + 1} executed=${toolCall?.tool} dropped=${droppedToolCalls.map((t) => t.tool).join(',')}`);
                }
                if (!toolCall) {
                    const afterStepHookResult = await this.runAfterStepHooks({
                        ...stepContext,
                        executedToolIds: Array.from(executedToolIds),
                    }, response, runtimeContext);
                    if (afterStepHookResult.cancelRequested && runtimeContext) {
                        this.logger.warn(`[after_step_hook_cancel] agent=${agent.name} taskId=${task.id} round=${round + 1} reason=${afterStepHookResult.cancelReason}`);
                        await persistStepMessage({
                            round,
                            response,
                            finish: 'cancelled',
                            parts: [
                                {
                                    type: 'system_event',
                                    status: 'cancelled',
                                    content: 'after_step_hook_cancel',
                                    error: afterStepHookResult.cancelReason,
                                },
                            ],
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        await this.runtimeOrchestrator.cancelRunWithActor(runtimeContext.runId, {
                            actorId: 'lifecycle-hook',
                            actorType: 'system',
                            reason: afterStepHookResult.cancelReason || 'cancelled_by_after_step_hook',
                        });
                        throw new Error(`Runtime run cancelled by hook: ${afterStepHookResult.cancelReason || 'after_step_hook'}`);
                    }
                    if (afterStepHookResult.pauseRequested && runtimeContext) {
                        this.logger.warn(`[after_step_hook_pause] agent=${agent.name} taskId=${task.id} round=${round + 1} reason=${afterStepHookResult.pauseReason}`);
                        await persistStepMessage({
                            round,
                            response,
                            finish: 'paused',
                            parts: [
                                {
                                    type: 'system_event',
                                    status: 'cancelled',
                                    content: 'after_step_hook_pause',
                                    error: afterStepHookResult.pauseReason,
                                },
                            ],
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        await this.runtimeOrchestrator.pauseRunWithActor(runtimeContext.runId, {
                            actorId: 'lifecycle-hook',
                            actorType: 'system',
                            reason: afterStepHookResult.pauseReason || 'paused_by_after_step_hook',
                        });
                        throw new Error(`Runtime run paused by hook: ${afterStepHookResult.pauseReason || 'after_step_hook'}`);
                    }
                    if (afterStepHookResult.retryRequested) {
                        if (afterStepHookResult.decision === 'inject_instruction') {
                            scorer.deduct('D8', round);
                        }
                        this.logger.log(`[after_step_hook_retry] agent=${agent.name} taskId=${task.id} round=${round + 1}`);
                        if (afterStepHookResult.appendSystemMessages.length > 0) {
                            for (const instruction of afterStepHookResult.appendSystemMessages) {
                                messages.push({ role: 'system', content: instruction, timestamp: new Date() });
                            }
                        }
                        stepParts.push({
                            type: 'system_event',
                            status: 'completed',
                            content: 'after_step_hook_retry',
                        });
                        await persistStepMessage({
                            round,
                            response,
                            finish: 'tool-calls',
                            parts: stepParts,
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        continue;
                    }
                    if (afterStepHookResult.decision === 'inject_instruction' && afterStepHookResult.appendSystemMessages.length > 0) {
                        for (const instruction of afterStepHookResult.appendSystemMessages) {
                            messages.push({
                                role: 'system',
                                content: instruction,
                                timestamp: new Date(),
                            });
                        }
                        stepParts.push({
                            type: 'system_event',
                            status: 'completed',
                            content: 'after_step_hook_inject_instruction',
                            metadata: {
                                injectedCount: afterStepHookResult.appendSystemMessages.length,
                            },
                        });
                        await persistStepMessage({
                            round,
                            response,
                            finish: 'tool-calls',
                            parts: stepParts,
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        continue;
                    }
                    let cleaned = (0, agent_executor_helpers_1.stripToolCallMarkup)(response);
                    if (!cleaned && response.trim().length > 0) {
                        this.logger.warn(`[strip_markup_empty_fallback] agent=${agent.name} taskId=${task.id} round=${round + 1} originalLen=${response.length}`);
                        cleaned = response.replace(/<\/?tool_call>/gi, '').trim();
                    }
                    stepParts.push({
                        type: 'text',
                        status: 'completed',
                        content: cleaned,
                    });
                    if (!plannerTextOnlyRetryUsed && this.isPlannerTextOnlyRetryNeeded(cleaned, executionContext)) {
                        const retryRoleInPlan = String((executionContext?.collaborationContext || {}).roleInPlan || '').trim();
                        scorer.deduct('D9', round, {
                            detail: `roleInPlan=${retryRoleInPlan}; 输出纯文本而非 tool_call: "${cleaned.slice(0, 80)}"`,
                        });
                        plannerTextOnlyRetryUsed = true;
                        this.logger.warn(`[planner_text_only_retry] agent=${agent.name} taskId=${task.id} round=${round + 1} roleInPlan=${retryRoleInPlan} responsePreview=${JSON.stringify(cleaned.slice(0, 120))}`);
                        const retryInstruction = retryRoleInPlan === 'planner_initialize'
                            ? [
                                '【系统纠正 — phaseInitialize 阶段】你刚才输出了纯文本，但当前是 phaseInitialize 阶段，要求你输出 <tool_call> 工具调用。',
                                '请严格按照用户指令中的"工具调用序列"继续执行尚未完成的工具调用。',
                                '严禁调用 submit-task、get-plan，严禁输出确认性文本。',
                                '如果所有工具调用已完成（outline 和 taskContext 均已通过 plan-initialize 写入），直接回复"phaseInitialize completed"即可，不需要输出 JSON。',
                            ].join('\n')
                            : [
                                '【系统纠正】你刚才输出了纯文本，但本阶段要求你输出 <tool_call> 工具调用。',
                                '请立即输出 <tool_call> 标签调用工具，不要输出任何其他文本。',
                                '回顾上方的用户指令，按要求执行工具调用。',
                            ].join('\n');
                        messages.push({
                            role: 'system',
                            content: retryInstruction,
                            timestamp: new Date(),
                        });
                        await persistIntermediateSystemMessage(round, intermediateSystemOffset++, retryInstruction, { source: 'tool-calling-loop.planner-text-only-retry' });
                        stepParts.push({
                            type: 'system_event',
                            status: 'completed',
                            content: 'planner_text_only_retry',
                        });
                        await persistStepMessage({
                            round,
                            response: cleaned,
                            finish: 'tool-calls',
                            parts: stepParts,
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        continue;
                    }
                    if ((0, agent_executor_helpers_1.isMeaninglessAssistantResponse)(cleaned)) {
                        scorer.deduct('D10', round);
                    }
                    if (meetingLike && (0, agent_executor_helpers_1.isMeaninglessAssistantResponse)(cleaned)) {
                        if (!emptyResponseRetryUsed) {
                            emptyResponseRetryUsed = true;
                            messages.push({
                                role: 'system',
                                content: emptyResponseRetryPrompt,
                                timestamp: new Date(),
                            });
                            await persistIntermediateSystemMessage(round, intermediateSystemOffset++, emptyResponseRetryPrompt, { source: 'tool-calling-loop.empty-response-retry' });
                            stepParts.push({
                                type: 'system_event',
                                status: 'completed',
                                content: 'empty_response_retry',
                            });
                            await persistStepMessage({
                                round,
                                response: cleaned,
                                finish: 'tool-calls',
                                parts: stepParts,
                                usage,
                                cost,
                                stepStartAt: stepStartedAt,
                                stepEndAt: new Date(),
                            });
                            continue;
                        }
                        await persistStepMessage({
                            round,
                            response: emptyMeetingResponseFallback,
                            finish: 'stop',
                            parts: [
                                ...stepParts,
                                {
                                    type: 'system_event',
                                    status: 'completed',
                                    content: 'empty_response_fallback',
                                },
                            ],
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        return emptyMeetingResponseFallback;
                    }
                    await persistStepMessage({
                        round,
                        response: cleaned,
                        finish: 'stop',
                        parts: stepParts,
                        usage,
                        cost,
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                    return cleaned;
                }
                messages.push({
                    role: 'assistant',
                    content: response,
                    timestamp: new Date(),
                });
                const normalizedToolCallId = (0, agent_constants_1.normalizeToolId)(toolCall.tool);
                const isMetaTool = normalizedToolCallId === agent_constants_1.GET_TOOL_SCHEMA_TOOL_ID;
                if (scorer.lastToolId === normalizedToolCallId && !isMetaTool) {
                    scorer.deduct('D3', round, {
                        toolId: normalizedToolCallId,
                        detail: `round ${round} 与 round ${round - 1} 连续调用 ${normalizedToolCallId}`,
                    });
                }
                scorer.trackToolCall(normalizedToolCallId);
                const currentFingerprint = `${normalizedToolCallId}::${JSON.stringify(toolCall.parameters || {})}`;
                if (currentFingerprint === lastToolCallFingerprint) {
                    consecutiveIdenticalToolCalls++;
                }
                else {
                    consecutiveIdenticalToolCalls = 1;
                    lastToolCallFingerprint = currentFingerprint;
                }
                if (consecutiveIdenticalToolCalls > maxConsecutiveIdenticalToolCalls) {
                    scorer.deduct('D13', round, {
                        toolId: normalizedToolCallId,
                        detail: `连续 ${consecutiveIdenticalToolCalls} 次以相同参数调用 ${normalizedToolCallId}，强制中断`,
                    });
                    this.logger.warn(`[repeated_identical_tool_halt] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId} consecutiveCount=${consecutiveIdenticalToolCalls}`);
                    const haltInstruction = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.repeatedIdenticalToolCallHalt, { toolId: normalizedToolCallId, count: consecutiveIdenticalToolCalls });
                    messages.push({
                        role: 'system',
                        content: haltInstruction,
                        timestamp: new Date(),
                    });
                    await persistIntermediateSystemMessage(round, intermediateSystemOffset++, haltInstruction, {
                        source: 'tool-calling-loop.repeated-identical-tool-halt',
                        toolId: normalizedToolCallId,
                    });
                    stepParts.push({
                        type: 'tool_call',
                        status: 'error',
                        toolId: normalizedToolCallId,
                        input: toolCall.parameters,
                        error: `repeated_identical_call_${consecutiveIdenticalToolCalls}`,
                    });
                    stepParts.push({
                        type: 'system_event',
                        status: 'error',
                        content: 'repeated_identical_tool_halt',
                        error: `${normalizedToolCallId} called ${consecutiveIdenticalToolCalls} times with identical params`,
                    });
                    await persistStepMessage({
                        round,
                        response,
                        finish: 'tool-calls',
                        parts: stepParts,
                        usage,
                        cost,
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                    continue;
                }
                stepParts.push({
                    type: 'tool_call',
                    status: 'completed',
                    toolId: normalizedToolCallId,
                    input: toolCall.parameters,
                });
                if (!assignedToolIds.has(normalizedToolCallId)) {
                    scorer.deduct('D6', round, {
                        toolId: normalizedToolCallId,
                    });
                    this.logger.warn(`[tool_denied] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId}`);
                    const toolDeniedInstruction = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.toolDeniedInstruction, {
                        normalizedToolId: normalizedToolCallId,
                    });
                    messages.push({
                        role: 'system',
                        content: toolDeniedInstruction,
                        timestamp: new Date(),
                    });
                    await persistIntermediateSystemMessage(round, intermediateSystemOffset++, toolDeniedInstruction, {
                        source: 'tool-calling-loop.tool-denied',
                        toolId: normalizedToolCallId,
                    });
                    stepParts.push({
                        type: 'system_event',
                        status: 'error',
                        content: 'tool_denied',
                        error: normalizedToolCallId,
                    });
                    await persistStepMessage({
                        round,
                        response,
                        finish: 'tool-calls',
                        parts: stepParts,
                        usage,
                        cost,
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                    continue;
                }
                const inputContract = await this.toolService.getToolInputContract(normalizedToolCallId);
                const preflightInputError = (0, agent_executor_helpers_1.getToolInputPreflightError)(inputContract?.schema, toolCall.parameters);
                if (preflightInputError && inputContract?.schema) {
                    const schemaHint = (0, agent_executor_helpers_1.buildToolSchemaHint)(normalizedToolCallId, inputContract.schema);
                    const seenSchemaBefore = schemaInjectedToolIds.has(normalizedToolCallId);
                    if (seenSchemaBefore) {
                        scorer.deduct('D1', round, {
                            toolId: normalizedToolCallId,
                            detail: preflightInputError,
                        });
                    }
                    this.logger.warn(`[tool_input_preflight_failed] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId} error=${preflightInputError}`);
                    if (!seenSchemaBefore && schemaHint) {
                        messages.push({
                            role: 'system',
                            content: schemaHint,
                            timestamp: new Date(),
                        });
                        await persistIntermediateSystemMessage(round, intermediateSystemOffset++, schemaHint, {
                            source: 'tool-calling-loop.tool-schema-injected',
                            toolId: normalizedToolCallId,
                        });
                        schemaInjectedToolIds.add(normalizedToolCallId);
                    }
                    const toolInputRepairInstruction = (0, agent_executor_helpers_1.buildToolInputRepairInstruction)(normalizedToolCallId, inputContract.schema, toolCall.parameters || {}, preflightInputError);
                    messages.push({
                        role: 'system',
                        content: toolInputRepairInstruction,
                        timestamp: new Date(),
                    });
                    await persistIntermediateSystemMessage(round, intermediateSystemOffset++, toolInputRepairInstruction, {
                        source: seenSchemaBefore
                            ? 'tool-calling-loop.tool-input-preflight-failed'
                            : 'tool-calling-loop.tool-input-preflight-first-fail',
                        toolId: normalizedToolCallId,
                    });
                    stepParts.push({
                        type: 'system_event',
                        status: 'error',
                        content: 'tool_input_preflight_failed',
                        error: preflightInputError,
                    });
                    await persistStepMessage({
                        round,
                        response,
                        finish: 'tool-calls',
                        parts: stepParts,
                        usage,
                        cost,
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                    continue;
                }
                schemaInjectedToolIds.add(normalizedToolCallId);
                const toolCallId = `toolcall-${(0, uuid_1.v4)()}`;
                let runtimeToolPartId;
                const runtimeToolEventBase = runtimeContext
                    ? {
                        runId: runtimeContext.runId,
                        agentId: agentRuntimeId,
                        taskId: task.id,
                        toolId: normalizedToolCallId,
                        toolName: toolCall.tool,
                        toolCallId,
                        input: toolCall.parameters,
                        traceId: runtimeContext.traceId,
                        sequence: round + 1,
                        messageId: runtimeContext.userMessageId,
                    }
                    : null;
                try {
                    if (runtimeToolEventBase) {
                        runtimeToolPartId = await this.runtimeOrchestrator.recordToolPending(runtimeToolEventBase);
                        await this.runtimeOrchestrator.recordToolRunning({
                            ...runtimeToolEventBase,
                            partId: runtimeToolPartId,
                        });
                    }
                    this.logger.log(`[tool_execute_start] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId} parameters=${(0, agent_constants_1.compactLogText)(JSON.stringify(toolCall.parameters || {}), 240)}`);
                    const toolExecutionContext = normalizedToolCallId === agent_constants_1.GET_TOOL_SCHEMA_TOOL_ID
                        ? {
                            ...(executionContext || {}),
                            assignedToolIds: Array.from(assignedToolIds),
                        }
                        : executionContext;
                    const execution = await this.toolService.executeTool(normalizedToolCallId, agentRuntimeId, toolCall.parameters, task.id, toolExecutionContext);
                    scorer.trackToolSuccess();
                    if (normalizedToolCallId === agent_constants_1.GET_TOOL_SCHEMA_TOOL_ID) {
                        const queriedToolId = (0, agent_constants_1.normalizeToolId)(String(toolCall.parameters?.toolId || ''));
                        if (queriedToolId) {
                            schemaInjectedToolIds.add(queriedToolId);
                        }
                    }
                    executedToolIds.add(normalizedToolCallId);
                    const toolResultPayload = this.extractToolResultPayload(execution);
                    this.logger.log(`[tool_execute_success] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId} resultKeys=${Object.keys(toolResultPayload || {}).join('|') || 'none'}`);
                    if (runtimeToolEventBase) {
                        await this.runtimeOrchestrator.recordToolCompleted({
                            ...runtimeToolEventBase,
                            partId: runtimeToolPartId,
                            output: toolResultPayload,
                        });
                    }
                    stepParts.push({
                        type: 'tool_result',
                        status: 'completed',
                        toolId: normalizedToolCallId,
                        toolCallId,
                        output: toolResultPayload,
                    });
                    if (builtin_tool_catalog_1.TERMINAL_TOOL_IDS.has(normalizedToolCallId)) {
                        const earlyResult = JSON.stringify(toolResultPayload);
                        this.logger.log(`[terminal_tool_early_return] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId} result=${(0, agent_constants_1.compactLogText)(earlyResult, 200)}`);
                        await persistStepMessage({
                            round,
                            response: earlyResult,
                            finish: 'stop',
                            parts: stepParts,
                            usage,
                            cost,
                            stepStartAt: stepStartedAt,
                            stepEndAt: new Date(),
                        });
                        return earlyResult;
                    }
                    const toolResultContent = `工具 ${normalizedToolCallId} 调用结果: ${JSON.stringify(toolResultPayload || {})}`;
                    messages.push({
                        role: 'system',
                        content: toolResultContent,
                        timestamp: new Date(),
                    });
                    await persistIntermediateSystemMessage(round, intermediateSystemOffset++, toolResultContent, {
                        source: 'tool-calling-loop.tool-result',
                        toolId: normalizedToolCallId,
                    });
                    if (droppedToolCalls.length > 0) {
                        const droppedNames = droppedToolCalls.map((t) => (0, agent_constants_1.normalizeToolId)(t.tool)).join(', ');
                        const droppedNotice = `注意：你在同一条回复中输出了 ${toolCalls.length} 个 tool_call，系统只执行了第一个（${normalizedToolCallId}）。` +
                            `被跳过的工具：${droppedNames}。请根据上方工具返回结果，在下一条回复中逐个发起后续工具调用。`;
                        messages.push({
                            role: 'system',
                            content: droppedNotice,
                            timestamp: new Date(),
                        });
                        await persistIntermediateSystemMessage(round, intermediateSystemOffset++, droppedNotice, { source: 'tool-calling-loop.dropped-tool-calls' });
                    }
                    await persistStepMessage({
                        round,
                        response,
                        finish: 'tool-calls',
                        parts: stepParts,
                        usage,
                        cost,
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                }
                catch (error) {
                    const logError = (0, agent_constants_1.toLogError)(error);
                    scorer.trackToolFailure();
                    if ((0, agent_executor_helpers_1.isToolInputErrorMessage)(logError.message)) {
                        scorer.deduct('D5', round, {
                            toolId: normalizedToolCallId,
                            detail: logError.message,
                        });
                    }
                    else {
                        scorer.deduct('D4', round, {
                            toolId: normalizedToolCallId,
                            detail: logError.message,
                        });
                    }
                    this.logger.error(`[tool_execute_failed] agent=${agent.name} taskId=${task.id} round=${round + 1} tool=${normalizedToolCallId} error=${logError.message}`, logError.stack);
                    if (runtimeToolEventBase) {
                        await this.runtimeOrchestrator.recordToolFailed({
                            ...runtimeToolEventBase,
                            partId: runtimeToolPartId,
                            error: logError.message,
                        });
                    }
                    stepParts.push({
                        type: 'tool_result',
                        status: 'error',
                        toolId: normalizedToolCallId,
                        toolCallId,
                        error: logError.message,
                    });
                    const message = logError.message;
                    const toolFailedInstruction = await this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.toolFailedInstruction, {
                        normalizedToolId: normalizedToolCallId,
                        message,
                    });
                    messages.push({
                        role: 'system',
                        content: toolFailedInstruction,
                        timestamp: new Date(),
                    });
                    await persistIntermediateSystemMessage(round, intermediateSystemOffset++, toolFailedInstruction, {
                        source: 'tool-calling-loop.tool-failed',
                        toolId: normalizedToolCallId,
                    });
                    if ((0, agent_executor_helpers_1.isToolInputErrorMessage)(message)) {
                        const latestInputContract = inputContract || (await this.toolService.getToolInputContract(normalizedToolCallId));
                        if (latestInputContract?.schema) {
                            const toolRepairInstruction = (0, agent_executor_helpers_1.buildToolInputRepairInstruction)(normalizedToolCallId, latestInputContract.schema, toolCall.parameters || {});
                            messages.push({
                                role: 'system',
                                content: toolRepairInstruction,
                                timestamp: new Date(),
                            });
                            await persistIntermediateSystemMessage(round, intermediateSystemOffset++, toolRepairInstruction, {
                                source: 'tool-calling-loop.tool-input-repair',
                                toolId: normalizedToolCallId,
                            });
                        }
                    }
                    await persistStepMessage({
                        round,
                        response,
                        finish: 'tool-calls',
                        parts: stepParts,
                        usage,
                        cost,
                        stepStartAt: stepStartedAt,
                        stepEndAt: new Date(),
                    });
                }
            }
            scorer.deduct('D11', maxToolRounds, {
                detail: 'reached_max_tool_rounds',
            });
            await persistStepMessage({
                round: maxToolRounds,
                response: toolRoundLimitMessage,
                finish: 'max-rounds',
                parts: [
                    {
                        type: 'text',
                        status: 'completed',
                        content: toolRoundLimitMessage,
                    },
                ],
                stepStartAt: new Date(),
                stepEndAt: new Date(),
            });
            return toolRoundLimitMessage;
        }
        finally {
            if (runtimeContext?.runId) {
                await this.agentRunScoreService.saveScore({
                    runId: runtimeContext.runId,
                    agentId: agentRuntimeId,
                    taskId: task.id,
                    sessionId: runtimeContext.sessionId,
                    summary: scorer.summarize(),
                });
            }
            else {
                this.logger.debug(`[run_score_skip] agent=${agent.name} taskId=${task.id} reason=missing_runtime_context`);
            }
        }
    }
    async buildMessages(agent, task, context, enabledSkills) {
        const buildStartAt = Date.now();
        const taskId = String(task.id || 'unknown');
        const sessionId = String((context.sessionContext || {}).sessionId || '').trim() || undefined;
        const previousNonSystemMessages = (context.previousMessages || []).filter((message) => message?.role !== 'system');
        if (sessionId) {
            const cachedSystemMessages = await this.runtimePersistence.getSessionInitialSystemMessages(sessionId);
            if (cachedSystemMessages !== undefined) {
                const cachedMessages = cachedSystemMessages.map((message) => ({
                    role: 'system',
                    content: message.content,
                    metadata: message.metadata,
                    timestamp: new Date(),
                }));
                cachedMessages.push(...previousNonSystemMessages);
                this.debugTiming(taskId, 'build_messages.total', buildStartAt, {
                    totalMessages: cachedMessages.length,
                    systemBlockCount: cachedSystemMessages.length,
                    scenarioType: this.resolveScenarioType(context.collaborationContext, task),
                    cacheHit: true,
                });
                return cachedMessages;
            }
        }
        const loadIdentityStartAt = Date.now();
        const identityMemos = await this.memoService.getIdentityMemos(agent.id || '');
        this.debugTiming(taskId, 'build_messages.load_identity_memos', loadIdentityStartAt, {
            identityMemoCount: identityMemos.length,
        });
        const loadToolsStartAt = Date.now();
        const allowedToolIds = await this.agentRoleService.getAllowedToolIds(agent);
        const assignedTools = await this.toolService.getToolsByIds(allowedToolIds);
        this.debugTiming(taskId, 'build_messages.load_assigned_tools', loadToolsStartAt, {
            allowedToolCount: allowedToolIds.length,
            assignedToolCount: assignedTools.length,
        });
        const skillContents = new Map();
        for (const skill of enabledSkills) {
            if (!this.contextStrategyService.shouldActivateSkillContent(skill, task, context))
                continue;
            try {
                const skillDoc = await this.skillModel.findOne({ id: skill.id }, { content: 1, promptTemplateRef: 1 }).lean().exec();
                const rawContent = String(skillDoc?.content || '').trim();
                const promptTemplateRef = this.normalizePromptTemplateRef(skillDoc?.promptTemplateRef);
                let resolvedContent = rawContent;
                if (promptTemplateRef) {
                    try {
                        const resolved = await this.promptResolverService.resolve({
                            scene: promptTemplateRef.scene,
                            role: promptTemplateRef.role,
                            defaultContent: rawContent,
                        });
                        resolvedContent = String(resolved.content || '').trim();
                    }
                    catch {
                        resolvedContent = rawContent;
                    }
                }
                if (resolvedContent) {
                    skillContents.set(skill.id, resolvedContent);
                }
            }
            catch {
            }
        }
        const collaborationContext = (context.collaborationContext || {});
        const normalizedCollaborationContext = collaborationContext && typeof collaborationContext === 'object'
            ? contracts_1.CollaborationContextFactory.fromLegacy(collaborationContext)
            : undefined;
        const mergedContext = { ...collaborationContext };
        const sessionContext = (context.sessionContext || {});
        const scenarioType = this.resolveScenarioType(normalizedCollaborationContext, task);
        const skipDedup = !sessionId;
        const assembledContext = await this.contextAssembler.assemble({
            agent,
            task,
            context,
            enabledSkills,
            scenarioType,
            contextScope: this.contextFingerprintService.resolveSystemContextScope(agent, task, {
                collaborationContext: normalizedCollaborationContext || collaborationContext,
                sessionContext,
            }),
            identityMemos,
            shared: {
                allowedToolIds,
                assignedTools,
                skillContents,
            },
            persistedContext: {
                domainContext: sessionContext.domainContext || mergedContext.domainContext,
                collaborationContext: sessionContext.collaborationContext || normalizedCollaborationContext || context.collaborationContext,
                runSummaries: sessionContext.runSummaries,
            },
            skipDedup,
        });
        let messages = assembledContext.messages;
        if (sessionId) {
            const runtimeAgentId = agent.id || agent._id?.toString?.() || '';
            const systemMessages = messages
                .filter((message) => message.role === 'system')
                .map((message) => {
                const content = String(message.content || '').trim();
                if (!content) {
                    return null;
                }
                const metadata = message.metadata && typeof message.metadata === 'object'
                    ? { ...message.metadata }
                    : undefined;
                return {
                    id: `msg-${(0, uuid_1.v4)()}`,
                    content,
                    ...(metadata ? { metadata } : {}),
                };
            })
                .filter((message) => Boolean(message));
            const persisted = await this.runtimePersistence.setSessionInitialSystemMessages(sessionId, systemMessages);
            if (persisted && systemMessages.length > 0) {
                const runId = `system-init-${sessionId}`;
                for (let index = 0; index < systemMessages.length; index++) {
                    const systemMessage = systemMessages[index];
                    await this.runtimePersistence.createMessage({
                        id: systemMessage.id,
                        runId,
                        agentId: runtimeAgentId,
                        sessionId,
                        taskId: task.id,
                        role: 'system',
                        sequence: index + 1,
                        content: systemMessage.content,
                        status: 'completed',
                        metadata: {
                            ...(systemMessage.metadata || {}),
                            source: 'session.initialSystemMessages',
                        },
                    });
                }
            }
            if (persisted) {
                messages = [
                    ...systemMessages.map((message) => ({
                        role: 'system',
                        content: message.content,
                        ...(message.metadata ? { metadata: message.metadata } : {}),
                        timestamp: new Date(),
                    })),
                    ...previousNonSystemMessages,
                ];
            }
            else {
                const cachedAfterPersist = await this.runtimePersistence.getSessionInitialSystemMessages(sessionId);
                if (cachedAfterPersist !== undefined) {
                    messages = [
                        ...cachedAfterPersist.map((message) => ({
                            role: 'system',
                            content: message.content,
                            ...(message.metadata ? { metadata: message.metadata } : {}),
                            timestamp: new Date(),
                        })),
                        ...previousNonSystemMessages,
                    ];
                }
                else {
                    this.logger.warn(`[session_system_messages_cache_miss_after_persist] taskId=${task.id} sessionId=${sessionId} persisted=${persisted} fallback=assembled_messages`);
                }
            }
        }
        this.debugTiming(taskId, 'build_messages.total', buildStartAt, {
            totalMessages: messages.length,
            systemBlockCount: assembledContext.systemBlockCount,
            scenarioType,
            cacheHit: false,
        });
        return messages;
    }
    computeAssistantSequence(base, round) {
        return base + (round + 2) * 100 - 1;
    }
    computeIntermediateSystemSequence(base, round, offset) {
        return base + (round + 2) * 100 + offset;
    }
    resolveScenarioType(collaborationContext, task) {
        if (collaborationContext && typeof collaborationContext === 'object' && 'scenarioMode' in collaborationContext) {
            const scenarioMode = String(collaborationContext.scenarioMode || '').trim();
            if (scenarioMode === 'meeting' ||
                scenarioMode === 'orchestration' ||
                scenarioMode === 'discussion' ||
                scenarioMode === 'inner-message' ||
                scenarioMode === 'chat') {
                return scenarioMode;
            }
        }
        const legacyContext = collaborationContext;
        if (legacyContext?.meetingId) {
            return 'meeting';
        }
        if (legacyContext?.planId) {
            return 'orchestration';
        }
        if (legacyContext?.discussionSpaceId || legacyContext?.discussionThreadId || legacyContext?.collaborationMode === 'discussion') {
            return 'discussion';
        }
        if (task?.type === 'internal_message') {
            return 'inner-message';
        }
        return 'chat';
    }
    async getEnabledSkillsForAgent(agent, agentId) {
        const candidateAgentIds = (0, agent_constants_1.uniqueStrings)([agentId, agent.id || '']);
        if (!candidateAgentIds.length) {
            return [];
        }
        for (const candidateAgentId of candidateAgentIds) {
            const cached = await this.redisService.get(this.agentEnabledSkillCacheKey(candidateAgentId));
            if (!cached)
                continue;
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed?.items)) {
                    return parsed.items;
                }
            }
            catch {
            }
        }
        const agentSkillIds = (0, agent_constants_1.uniqueStrings)((agent.skills || []).filter(Boolean));
        if (!agentSkillIds.length) {
            return [];
        }
        const skills = await this.skillModel
            .find({ id: { $in: agentSkillIds }, status: { $in: ['active', 'experimental'] } })
            .exec();
        const contexts = skills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            tags: skill.tags || [],
            proficiencyLevel: 'beginner',
        }));
        const payload = JSON.stringify({
            agentIds: candidateAgentIds,
            items: contexts,
            updatedAt: new Date().toISOString(),
        });
        await Promise.all(candidateAgentIds.map((candidateAgentId) => this.redisService.set(this.agentEnabledSkillCacheKey(candidateAgentId), payload, agent_constants_1.AGENT_ENABLED_SKILL_CACHE_TTL_SECONDS)));
        return contexts;
    }
    agentEnabledSkillCacheKey(agentId) {
        return `agent:enabled-skills:${agentId}`;
    }
    normalizePromptTemplateRef(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return null;
        }
        const scene = String(input.scene || '').trim();
        const role = String(input.role || '').trim();
        if (!scene || !role) {
            return null;
        }
        return { scene, role };
    }
    async buildForcedToolCallInstruction(agent, forcedToolCall) {
        const renderedFromSkill = await this.renderForcedToolCallInstructionFromSkill(agent, forcedToolCall);
        if (renderedFromSkill) {
            return renderedFromSkill;
        }
        return this.resolveAgentPromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.forcedToolCallInstruction, {
            tool: forcedToolCall.tool,
            parametersJson: JSON.stringify(forcedToolCall.parameters || {}),
        });
    }
    async renderForcedToolCallInstructionFromSkill(agent, forcedToolCall) {
        const skillIds = (0, agent_constants_1.uniqueStrings)((agent.skills || []).filter(Boolean));
        if (!skillIds.length) {
            return null;
        }
        try {
            const skills = await this.skillModel
                .find({ id: { $in: skillIds }, status: { $in: ['active', 'experimental'] } }, { id: 1, name: 1, tags: 1, content: 1 })
                .lean()
                .exec();
            const target = (skills || []).find((skill) => {
                const name = String(skill?.name || '').toLowerCase();
                const tags = Array.isArray(skill?.tags) ? skill.tags.map((tag) => String(tag || '').toLowerCase()) : [];
                const signals = ['forced-action-template', 'forced-tool-call'];
                return signals.some((signal) => name.includes(signal) || tags.some((tag) => tag.includes(signal)));
            });
            const rawTemplate = String(target?.content || '').trim();
            if (!rawTemplate) {
                return null;
            }
            const templateChunks = (0, agent_constants_1.splitTextByMaxLength)(rawTemplate, agent_constants_1.SKILL_CONTENT_MAX_INJECT_LENGTH);
            const renderedTemplate = templateChunks.join('\n\n');
            const parametersJson = JSON.stringify(forcedToolCall.parameters || {});
            const rendered = renderedTemplate
                .replace(/\{\{tool\}\}/g, forcedToolCall.tool)
                .replace(/\{\{parameters\}\}/g, parametersJson)
                .trim();
            if (!rendered) {
                return null;
            }
            return rendered;
        }
        catch (error) {
            this.logger.warn(`[forced_tool_call_skill_template_load_failed] agent=${agent.id || 'unknown'} error=${(0, agent_constants_1.toLogError)(error).message}`);
            return null;
        }
    }
    logResolvedOpenCodeRuntime(taskId, mode, runtime) {
        this.logger.log(`[opencode_runtime_resolved] taskId=${taskId} mode=${mode} source=${runtime.source} baseUrl=${runtime.baseUrl || 'env'} authEnable=${runtime.authEnable}`);
    }
    renderAgentPrompt(template, payload) {
        const buildDefaultContent = template.buildDefaultContent;
        return buildDefaultContent(payload);
    }
    async resolveAgentPromptTemplate(template, payload) {
        const defaultContent = this.renderAgentPrompt(template, payload);
        try {
            const hasPublishedCache = await this.promptResolverService.hasPublishedCache(template.scene, template.role);
            if (!hasPublishedCache) {
                this.logger.debug(`[prompt_resolve_skip] scene=${template.scene} role=${template.role} reason=redis_miss fallback=code_default`);
                return {
                    content: defaultContent,
                    source: 'code_default',
                };
            }
            return await this.promptResolverService.resolve({
                scene: template.scene,
                role: template.role,
                defaultContent,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[prompt_resolve_failed] scene=${template.scene} role=${template.role} error=${message} fallback=code_default`);
            return {
                content: defaultContent,
                source: 'code_default',
            };
        }
    }
    async resolveAgentPromptContent(template, payload) {
        const resolved = await this.resolveAgentPromptTemplate(template, payload);
        return resolved.content;
    }
    ensureTaskRuntime(task) {
        const existingTaskId = typeof task?.id === 'string' ? task.id.trim() : '';
        if (existingTaskId) {
            if (!Array.isArray(task.messages)) {
                task.messages = [];
            }
            return existingTaskId;
        }
        const generatedTaskId = `task-${(0, uuid_1.v4)()}`;
        task.id = generatedTaskId;
        if (!Array.isArray(task.messages)) {
            task.messages = [];
        }
        this.logger.warn(`[task_id_missing] generatedTaskId=${generatedTaskId} title="${(0, agent_constants_1.compactLogText)(task.title)}"`);
        return generatedTaskId;
    }
    buildExecutionData(agent, routeDecision, executionChannel, mode) {
        const executionDataBase = {
            taskType: routeDecision.taskType,
            routeSource: routeDecision.source,
            modelProvider: agent.model?.provider,
            modelId: agent.model?.id,
            modelName: agent.model?.name,
            model: agent.model?.model,
            openCode: {
                enabled: Boolean(routeDecision.openCodeExecutionConfig),
                strictExecution: executionChannel === 'opencode',
                selected: executionChannel === 'opencode',
                endpoint: routeDecision.openCodeExecutionConfig?.endpoint,
                endpointRef: routeDecision.openCodeExecutionConfig?.endpointRef,
                authEnable: routeDecision.openCodeExecutionConfig?.authEnable,
                taskRouting: routeDecision.openCodeExecutionConfig?.taskRouting,
                modelPolicy: routeDecision.openCodeExecutionConfig?.modelPolicy,
            },
        };
        if (!mode) {
            return executionDataBase;
        }
        return {
            mode,
            ...executionDataBase,
        };
    }
    createResolveCustomApiKeyHandler(agent, taskId, timingStage) {
        return async (logPrefix) => {
            const resolveApiKeyStartAt = Date.now();
            const customApiKey = await this.resolveCustomApiKey(agent, taskId, logPrefix);
            this.debugTiming(taskId, timingStage, resolveApiKeyStartAt, {
                keySource: customApiKey ? 'custom' : 'system',
            });
            return customApiKey;
        };
    }
    appendAssistantMessage(task, content, agent, enabledSkills) {
        task.messages.push({
            role: 'assistant',
            content,
            timestamp: new Date(),
            metadata: {
                agentId: agent.id,
                agentName: agent.name,
                usedSkillIds: enabledSkills.map((item) => item.id),
                usedSkillNames: enabledSkills.map((item) => item.name),
                usedSkills: enabledSkills.map((item) => ({
                    id: item.id,
                    name: item.name,
                    proficiencyLevel: item.proficiencyLevel,
                })),
            },
        });
    }
    isControlInterruptedError(message) {
        const normalizedError = String(message || '').toLowerCase();
        return (normalizedError.includes('cancelled') ||
            normalizedError.includes('paused') ||
            normalizedError.includes('already completed'));
    }
    runMemoOperation(label, taskId, operation) {
        const startedAt = Date.now();
        void operation()
            .then(() => {
            this.logger.log(`[memo_op_success] taskId=${taskId} label=${label} durationMs=${Date.now() - startedAt}`);
        })
            .catch((error) => {
            const logError = (0, agent_constants_1.toLogError)(error);
            this.logger.warn(`[memo_op_failed] taskId=${taskId} label=${label} durationMs=${Date.now() - startedAt} error=${logError.message}`);
        });
    }
    async resolveCustomApiKey(agent, taskId, logPrefix) {
        if (!agent.apiKeyId) {
            return undefined;
        }
        const customApiKey = await this.apiKeyService.getDecryptedKey(agent.apiKeyId);
        if (customApiKey) {
            this.logger.log(`[${logPrefix}_api_key] taskId=${taskId} agent=${agent.name} source=custom`);
            await this.apiKeyService.recordUsage(agent.apiKeyId);
            return customApiKey;
        }
        this.logger.warn(`[${logPrefix}_api_key] taskId=${taskId} agent=${agent.name} customApiKeyNotAvailable fallback=system`);
        return undefined;
    }
    getMaxToolRounds() {
        const configuredRounds = Number(process.env.MAX_TOOL_ROUNDS);
        if (Number.isFinite(configuredRounds) && configuredRounds > 0) {
            return Math.floor(configuredRounds);
        }
        return agent_constants_1.DEFAULT_MAX_TOOL_ROUNDS;
    }
    extractPreactivatedToolIds(executionContext) {
        if (!Array.isArray(executionContext?.preactivatedToolIds)) {
            return [];
        }
        return Array.from(new Set(executionContext.preactivatedToolIds
            .map((toolId) => (0, agent_constants_1.normalizeToolId)(String(toolId || '').trim()))
            .filter(Boolean)));
    }
    isPlannerTextOnlyRetryNeeded(cleaned, executionContext) {
        const collaborationCtx = (executionContext?.collaborationContext || {});
        const roleInPlan = String(collaborationCtx.roleInPlan || '').trim();
        if (!roleInPlan.startsWith('planner')) {
            return false;
        }
        return cleaned.length === 0 || !/<tool_call>/i.test(cleaned);
    }
    extractToolResultPayload(execution) {
        const result = execution?.result;
        if (result && typeof result === 'object' && 'data' in result) {
            return result.data;
        }
        return result || {};
    }
};
exports.AgentExecutorService = AgentExecutorService;
exports.AgentExecutorService = AgentExecutorService = AgentExecutorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_skill_schema_1.Skill.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        model_service_1.ModelService,
        api_key_service_1.ApiKeyService,
        tool_service_1.ToolService,
        memo_service_1.MemoService,
        memo_write_queue_service_1.MemoWriteQueueService,
        memo_event_bus_service_1.MemoEventBusService,
        runtime_orchestrator_service_1.RuntimeOrchestratorService,
        runtime_persistence_service_1.RuntimePersistenceService,
        agent_run_score_service_1.AgentRunScoreService,
        runtime_ei_sync_service_1.RuntimeEiSyncService,
        opencode_execution_service_1.OpenCodeExecutionService,
        infra_1.RedisService,
        agent_executor_runtime_service_1.AgentExecutorRuntimeService,
        agent_before_step_optimization_hook_1.AgentBeforeStepOptimizationHook,
        agent_after_step_evaluation_hook_1.AgentAfterStepEvaluationHook,
        agent_executor_engine_router_1.AgentExecutorEngineRouter,
        agent_opencode_policy_service_1.AgentOpenCodePolicyService,
        agent_role_service_1.AgentRoleService,
        prompt_resolver_service_1.PromptResolverService,
        hook_pipeline_service_1.HookPipelineService,
        context_assembler_service_1.ContextAssemblerService,
        context_fingerprint_service_1.ContextFingerprintService,
        context_strategy_service_1.ContextStrategyService,
        common_2.DebugTimingProvider])
], AgentExecutorService);
//# sourceMappingURL=agent-executor.service.js.map