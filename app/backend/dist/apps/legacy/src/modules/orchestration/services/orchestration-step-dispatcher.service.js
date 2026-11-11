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
var OrchestrationStepDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationStepDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const event_emitter_1 = require("@nestjs/event-emitter");
const mongoose_2 = require("mongoose");
const contracts_1 = require("../../../../libs/contracts/src/index");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const planner_service_1 = require("../planner.service");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const incremental_planning_service_1 = require("./incremental-planning.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
const scene_optimization_service_1 = require("./scene-optimization.service");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const orchestration_events_1 = require("../orchestration-events");
const AUTO_RETRY_DISABLED_TASK_TYPES = new Set([
    'development.plan',
    'development.exec',
    'development.review',
]);
let OrchestrationStepDispatcherService = OrchestrationStepDispatcherService_1 = class OrchestrationStepDispatcherService {
    constructor(planModel, taskModel, plannerService, incrementalPlanningService, eventStream, contextService, sceneOptimizationService, eventEmitter, agentClientService, configService) {
        this.planModel = planModel;
        this.taskModel = taskModel;
        this.plannerService = plannerService;
        this.incrementalPlanningService = incrementalPlanningService;
        this.eventStream = eventStream;
        this.contextService = contextService;
        this.sceneOptimizationService = sceneOptimizationService;
        this.eventEmitter = eventEmitter;
        this.agentClientService = agentClientService;
        this.configService = configService;
        this.logger = new common_1.Logger(OrchestrationStepDispatcherService_1.name);
        this.activePlannings = new Set();
    }
    async advanceOnce(planId, options) {
        const normalizedPlanId = String(planId || '').trim();
        if (!normalizedPlanId) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (this.activePlannings.has(normalizedPlanId)) {
            return { advanced: false };
        }
        this.activePlannings.add(normalizedPlanId);
        try {
            const plan = await this.planModel.findById(normalizedPlanId).exec();
            if (!plan) {
                throw new common_1.NotFoundException('Plan not found');
            }
            const state = this.resolveGenerationState(plan.generationState);
            const source = options?.source || 'internal';
            const phase = state.currentPhase || 'idle';
            if (options?.targetPhase && options.targetPhase !== phase) {
                return { advanced: false, phase };
            }
            if (state.isComplete) {
                await this.archivePlannerSessionIfNeeded(state);
                return { advanced: false, phase };
            }
            if (await this.checkTerminalConditions(normalizedPlanId, plan, state)) {
                return { advanced: false, phase };
            }
            if (phase === 'idle') {
                const executionMode = this.resolveExecutionMode(plan);
                const targetPhase = executionMode === 'easy'
                    ? 'easy_run'
                    : (this.shouldRunInitialize(plan, state) ? 'initialize' : 'generating');
                const plannerSessionId = await this.ensurePlannerSession(normalizedPlanId, plan, state, targetPhase);
                const stateWithSession = this.withPlannerSession(state, targetPhase, plannerSessionId);
                const claimedState = {
                    ...stateWithSession,
                    currentPhase: targetPhase,
                };
                const claimed = await this.updateGenerationStateIfExpected(normalizedPlanId, state, claimedState);
                if (!claimed) {
                    return { advanced: false, phase };
                }
                if (targetPhase === 'initialize') {
                    await this.phaseInitialize(normalizedPlanId, plan, claimedState, plannerSessionId, source);
                    return { advanced: true, phase: 'initialize' };
                }
                if (targetPhase === 'easy_run') {
                    await this.phaseEasyRun(normalizedPlanId, plan, claimedState, plannerSessionId, source);
                    return { advanced: true, phase: 'easy_run' };
                }
                await this.phaseGenerate(normalizedPlanId, plan.sourcePrompt || '', claimedState, plannerSessionId, source);
                return { advanced: true, phase: 'generating' };
            }
            if (phase === 'initialize') {
                const plannerSessionId = await this.ensurePlannerSession(normalizedPlanId, plan, state, 'initialize');
                const effectiveState = this.withPlannerSession(state, 'initialize', plannerSessionId);
                await this.phaseInitialize(normalizedPlanId, plan, effectiveState, plannerSessionId, source);
                return { advanced: true, phase };
            }
            if (phase === 'easy_run') {
                const plannerSessionId = await this.ensurePlannerSession(normalizedPlanId, plan, state, 'easy_run');
                const effectiveState = this.withPlannerSession(state, 'easy_run', plannerSessionId);
                await this.phaseEasyRun(normalizedPlanId, plan, effectiveState, plannerSessionId, source);
                return { advanced: true, phase };
            }
            if (phase === 'generating') {
                const plannerSessionId = await this.ensurePlannerSession(normalizedPlanId, plan, state, 'generating');
                const effectiveState = this.withPlannerSession(state, 'generating', plannerSessionId);
                await this.phaseGenerate(normalizedPlanId, plan.sourcePrompt || '', effectiveState, plannerSessionId, source);
                return { advanced: true, phase: 'generating' };
            }
            if (phase === 'pre_execute') {
                const plannerSessionId = await this.ensurePlannerSession(normalizedPlanId, plan, state, 'pre_execute');
                const effectiveState = this.withPlannerSession(state, 'pre_execute', plannerSessionId);
                await this.phasePreExecute(normalizedPlanId, effectiveState, plannerSessionId, source);
                return { advanced: true, phase };
            }
            if (phase === 'executing') {
                await this.phaseExecute(normalizedPlanId, state, source);
                return { advanced: true, phase };
            }
            if (phase === 'post_execute') {
                const plannerSessionId = await this.ensurePlannerSession(normalizedPlanId, plan, state, 'post_execute');
                const effectiveState = this.withPlannerSession(state, 'post_execute', plannerSessionId);
                const metadata = (plan.metadata || {});
                const outlineStepCount = Array.isArray(metadata.outline) ? metadata.outline.length : undefined;
                await this.phasePostExecute(normalizedPlanId, effectiveState, plannerSessionId, String(plan?.domainType || 'general'), outlineStepCount, source);
                return { advanced: true, phase };
            }
            throw new common_1.ConflictException(`Unsupported phase: ${phase}`);
        }
        finally {
            this.activePlannings.delete(normalizedPlanId);
        }
    }
    async retryCurrentTask(planId) {
        const plan = await this.planModel.findById(planId).lean().exec();
        const state = this.resolveGenerationState(plan?.generationState);
        if (!state.currentTaskId) {
            return { accepted: false };
        }
        const currentTask = await this.taskModel
            .findOne({ _id: state.currentTaskId, planId })
            .select({ runtimeTaskType: 1 })
            .lean()
            .exec();
        if (this.isAutoRetryDisabledTaskType(currentTask?.runtimeTaskType)) {
            return { accepted: false };
        }
        const config = this.incrementalPlanningService.resolveGenerationConfig(plan?.generationConfig);
        if (state.consecutiveFailures >= config.maxRetries || state.totalFailures >= config.maxTotalFailures) {
            return { accepted: false };
        }
        await this.updateGenerationState(planId, {
            ...state,
            currentPhase: 'pre_execute',
            lastDecision: 'retry',
        });
        setImmediate(() => {
            this.advanceOnce(planId, { source: 'internal' }).catch((error) => {
                this.logger.warn(`retryCurrentTask failed for plan ${planId}: ${error instanceof Error ? error.message : String(error)}`);
            });
        });
        return { accepted: true };
    }
    async stopGeneration(planId) {
        const normalizedPlanId = String(planId || '').trim();
        if (!normalizedPlanId) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const plan = await this.planModel.findById(normalizedPlanId).lean().exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const currentState = this.resolveGenerationState(plan.generationState);
        if (currentState.isComplete) {
            return { stopped: false, alreadyStopped: true };
        }
        const sessionIds = this.resolvePlannerSessionIds(currentState);
        await this.updateGenerationState(normalizedPlanId, {
            ...currentState,
            isComplete: true,
            currentPhase: 'idle',
            currentTaskId: undefined,
            plannerSessionId: undefined,
            plannerSessionIds: undefined,
            lastDecision: 'stop',
            lastError: undefined,
        });
        for (const sessionId of sessionIds) {
            try {
                await this.agentClientService.archiveSession(sessionId);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`archive planner session failed when stopping generation: plan=${normalizedPlanId}, session=${sessionId}, error=${message}`);
            }
        }
        return { stopped: true, alreadyStopped: false };
    }
    async phaseInitialize(planId, plan, state, plannerSessionId, source) {
        const metadata = (plan.metadata || {});
        const existingTaskContext = this.contextService.resolvePlanTaskContextFromMetadata(metadata);
        try {
            await this.plannerService.initializePlan(planId, {
                sourcePrompt: plan.sourcePrompt || '',
                domainType: String(plan.domainType || 'general'),
                existingTaskContext,
            }, { sessionId: plannerSessionId });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`[phaseInitialize] initializePlan failed for planId=${planId}: ${message}`);
            await this.agentClientService.archiveSession(plannerSessionId).catch(() => { });
            const nextState = this.bumpFailureCounters(state, `initializePlan failed: ${message}`);
            const recoveryState = this.isIsolatedSessionMode
                ? {
                    ...nextState,
                    currentPhase: 'idle',
                    plannerSessionIds: {
                        ...(nextState.plannerSessionIds || {}),
                        initialize: undefined,
                    },
                }
                : {
                    ...nextState,
                    currentPhase: 'idle',
                };
            await this.updateGenerationStateIfExpected(planId, state, recoveryState);
            await this.autoAdvance(planId, source);
            return;
        }
        const refreshedPlan = await this.planModel
            .findById(planId)
            .select({ metadata: 1 })
            .lean()
            .exec();
        const refreshedMetadata = (refreshedPlan?.metadata || {});
        const outline = Array.isArray(refreshedMetadata.outline)
            ? refreshedMetadata.outline
            : [];
        const isExplicitEmptyOutline = Array.isArray(refreshedMetadata.outline) && outline.length === 0;
        if (isExplicitEmptyOutline) {
            this.logger.log(`[phaseInitialize] planId=${planId} empty outline from skill, completing plan`);
            const mergedState = {
                ...this.withPlannerSession(state, 'initialize', plannerSessionId),
                lastDecision: 'stop',
            };
            this.eventStream.emitPlanStreamEvent(planId, 'planning.initialized', {
                planId,
                requirementId: this.contextService.resolvePlanTaskContextFromMetadata(refreshedMetadata).requirementId,
                outline,
            });
            await this.completeAndArchive(planId, mergedState, {
                finalStatus: 'completed',
                statusPhase: 'initialize_completed_no_outline',
            });
            return;
        }
        const hasValidOutline = this.hasValidOutlineWithPrompts(outline);
        if (!hasValidOutline) {
            await this.agentClientService.archiveSession(plannerSessionId).catch(() => { });
            const nextState = this.bumpFailureCounters(state, 'phaseInitialize missing valid metadata.outline');
            const stateWithClearedSession = this.isIsolatedSessionMode
                ? {
                    ...nextState,
                    currentPhase: 'idle',
                    plannerSessionIds: {
                        ...(nextState.plannerSessionIds || {}),
                        initialize: undefined,
                    },
                }
                : {
                    ...nextState,
                    currentPhase: 'idle',
                };
            const advanced = await this.updateGenerationStateIfExpected(planId, state, stateWithClearedSession);
            if (!advanced) {
                this.logger.warn(`[phaseInitialize] CAS failed on failure path for planId=${planId}, scheduling recovery autoAdvance`);
                await this.autoAdvance(planId, source);
                return;
            }
            await this.autoAdvance(planId, source);
            return;
        }
        const stateWithSession = this.withPlannerSession(state, 'initialize', plannerSessionId);
        const advanced = await this.updateGenerationStateIfExpected(planId, state, {
            ...stateWithSession,
            currentPhase: 'idle',
            lastError: undefined,
        });
        if (!advanced) {
            this.logger.warn(`[phaseInitialize] CAS failed on success path for planId=${planId}, scheduling recovery autoAdvance`);
            await this.autoAdvance(planId, source);
            return;
        }
        this.eventStream.emitPlanStreamEvent(planId, 'planning.initialized', {
            planId,
            requirementId: this.contextService.resolvePlanTaskContextFromMetadata(refreshedMetadata).requirementId,
            outline,
        });
        await this.autoAdvance(planId, source);
    }
    async phaseEasyRun(planId, plan, state, plannerSessionId, source) {
        await this.planModel.updateOne({ _id: planId }, { $set: { status: 'drafting' } }).exec();
        this.eventStream.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: 'drafting',
            phase: 'easy_run',
        });
        try {
            const easyRunPrompt = await this.contextService.buildEasyRunPrompt({
                planId,
                sourcePrompt: plan.sourcePrompt || '',
                domainType: String(plan.domainType || 'general'),
            });
            const easyRunResult = await this.plannerService.executeEasyRun(planId, easyRunPrompt, {
                sessionId: plannerSessionId,
            });
            const mergedState = {
                ...this.withPlannerSession(state, 'easy_run', plannerSessionId),
                totalCost: Number(state.totalCost || 0) + Number(easyRunResult.costTokens || 0),
                lastDecision: 'stop',
            };
            await this.planModel
                .updateOne({ _id: planId }, {
                $set: {
                    'metadata.easyRunResult': {
                        summary: String(easyRunResult.summary || '').trim() || 'Easy run completed',
                        completedAt: new Date().toISOString(),
                    },
                },
            })
                .exec();
            await this.completeAndArchive(planId, mergedState, {
                finalStatus: 'completed',
                statusPhase: 'easy_run_completed',
            });
        }
        catch (error) {
            const nextFailures = this.bumpFailureCounters(state, `phaseEasyRun failed: ${error instanceof Error ? error.message : String(error)}`);
            const advanced = await this.updateGenerationStateIfExpected(planId, state, {
                ...nextFailures,
                currentPhase: 'idle',
            });
            if (!advanced) {
                return;
            }
            await this.autoAdvance(planId, source);
        }
    }
    async phaseGenerate(planId, sourcePrompt, state, plannerSessionId, source) {
        await this.planModel.updateOne({ _id: planId }, { $set: { status: 'drafting' } }).exec();
        this.eventStream.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: 'drafting',
            phase: 'incremental_planning',
        });
        await this.emitStepStarted(planId, state.currentStep + 1);
        const preGenerateTaskIds = new Set((await this.taskModel
            .find({ planId })
            .select({ _id: 1 })
            .lean()
            .exec()).map((t) => String(t._id)));
        const plannerContext = await this.incrementalPlanningService.buildPlannerContext(planId, sourcePrompt);
        const nextTaskResult = await this.plannerService.generateNextTask(planId, plannerContext, {
            sessionId: plannerSessionId,
        });
        const stateWithSession = this.withPlannerSession(state, 'generating', plannerSessionId);
        const mergedState = {
            ...stateWithSession,
            totalCost: Number(state.totalCost || 0) + Number(nextTaskResult.costTokens || 0),
        };
        if (nextTaskResult.isGoalReached) {
            await this.completeAndArchive(planId, mergedState);
            return;
        }
        if (!nextTaskResult.createdTaskId
            && (!nextTaskResult.task?.title || !nextTaskResult.task?.description)) {
            const toolCreatedTask = await this.findToolCreatedTaskFallback(planId, preGenerateTaskIds);
            if (toolCreatedTask) {
                this.logger.warn(`[generate_parse_fail_fallback] planId=${planId} step=${mergedState.currentStep} fallbackTaskId=${String(toolCreatedTask._id)} title="${toolCreatedTask.title}" — planner response parse failed but submit-task tool already created a task, using fallback`);
                nextTaskResult.createdTaskId = String(toolCreatedTask._id);
                nextTaskResult.task = {
                    title: toolCreatedTask.title,
                    description: toolCreatedTask.description,
                    priority: (toolCreatedTask.priority || 'medium'),
                    agentId: toolCreatedTask.assignment?.executorId,
                    taskType: (toolCreatedTask.taskType || 'general'),
                };
            }
        }
        if (!nextTaskResult.task?.title || !nextTaskResult.task?.description) {
            const nextFailures = this.bumpFailureCounters(mergedState, this.buildEmptyTaskReason(nextTaskResult.reasoning));
            await this.updateGenerationStateIfExpected(planId, mergedState, {
                ...nextFailures,
                currentPhase: 'idle',
            });
            await this.autoAdvance(planId, source);
            return;
        }
        const isRedesign = nextTaskResult.action === 'redesign';
        let createdTask = nextTaskResult.createdTaskId
            ? await this.taskModel.findOne({ _id: nextTaskResult.createdTaskId, planId }).exec()
            : null;
        if (!createdTask && isRedesign && !nextTaskResult.redesignTaskId) {
            const nextFailures = this.bumpFailureCounters(mergedState, 'Planner redesign action missing redesignTaskId');
            await this.updateGenerationStateIfExpected(planId, mergedState, {
                ...nextFailures,
                currentPhase: 'idle',
            });
            await this.autoAdvance(planId, source);
            return;
        }
        if (!createdTask) {
            createdTask = isRedesign
                ? await this.incrementalPlanningService.redesignFailedTask(planId, String(nextTaskResult.redesignTaskId), nextTaskResult.task)
                : await this.incrementalPlanningService.createTaskFromPlannerOutput(planId, nextTaskResult.task, mergedState.currentStep);
        }
        if (!createdTask) {
            const nextFailures = this.bumpFailureCounters(mergedState, 'Planner created task is missing');
            await this.updateGenerationStateIfExpected(planId, mergedState, {
                ...nextFailures,
                currentPhase: 'idle',
            });
            await this.autoAdvance(planId, source);
            return;
        }
        await this.cancelOrphanTasksFromGenerating(planId, String(createdTask._id), preGenerateTaskIds);
        const nextState = {
            ...mergedState,
            currentStep: isRedesign ? mergedState.currentStep : mergedState.currentStep + 1,
            totalGenerated: isRedesign ? mergedState.totalGenerated : mergedState.totalGenerated + 1,
            currentPhase: 'pre_execute',
            currentTaskId: String(createdTask._id),
            lastError: undefined,
        };
        const advanced = await this.updateGenerationStateIfExpected(planId, mergedState, nextState);
        if (!advanced) {
            return;
        }
        const step = nextState.currentStep;
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.generated', {
            planId,
            step,
            taskId: String(createdTask._id),
            title: createdTask.title,
            agentId: createdTask.assignment?.executorId,
            mode: isRedesign ? 'redesign' : 'new',
        });
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.TASK_GENERATED, {
            planId,
            taskId: String(createdTask._id),
            step,
            phase: 'generating',
            result: {
                title: createdTask.title,
            },
        });
        await this.autoAdvance(planId, source);
    }
    async phasePreExecute(planId, state, plannerSessionId, source) {
        const task = await this.getCurrentTaskOrThrow(planId, state.currentTaskId);
        const planSnapshot = await this.planModel
            .findById(planId)
            .exec();
        const inferredRuntimeTaskType = this.contextService.inferRuntimeTaskTypeFromPlanContext({
            planDomainType: String(planSnapshot?.domainType || 'general'),
            planGoal: String(planSnapshot?.sourcePrompt || ''),
            step: state.currentStep,
            taskTitle: task.title,
            taskDescription: task.description,
            taskType: task.taskType,
            existingRuntimeTaskType: task.runtimeTaskType,
        });
        if (task.runtimeTaskType !== inferredRuntimeTaskType) {
            await this.taskModel
                .updateOne({ _id: task._id }, {
                $set: {
                    runtimeTaskType: inferredRuntimeTaskType,
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Runtime task type inferred at pre-execute phase',
                        metadata: {
                            inferredRuntimeTaskType,
                            previousRuntimeTaskType: task.runtimeTaskType,
                        },
                    },
                },
            })
                .exec();
            task.runtimeTaskType = inferredRuntimeTaskType;
        }
        const metadata = (planSnapshot?.metadata || {});
        const taskContext = this.contextService.resolvePlanTaskContextFromMetadata(metadata);
        const outline = Array.isArray(metadata.outline) ? metadata.outline : [];
        const outlineStep = outline.find((o) => Number(o.step) === state.currentStep);
        const preActions = outlineStep?.preExecuteActions;
        const hasPreActions = Array.isArray(preActions) && preActions.length > 0;
        if (!hasPreActions) {
            const advanced = await this.updateGenerationStateIfExpected(planId, state, {
                ...state,
                currentPhase: 'executing',
            });
            if (!advanced) {
                return;
            }
            await this.taskModel
                .updateOne({ _id: task._id }, {
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Pre-execute skipped: no preExecuteActions defined',
                        metadata: { step: state.currentStep },
                    },
                },
            })
                .exec();
            this.eventStream.emitPlanStreamEvent(planId, 'planning.task.pre_executed', {
                planId,
                step: state.currentStep,
                taskId: String(task._id),
                allowExecute: true,
                riskFlags: [],
            });
            this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.TASK_PRE_EXECUTED, {
                planId,
                taskId: String(task._id),
                step: state.currentStep,
                phase: 'pre_execute',
                result: { allowExecute: true, riskFlags: [] },
            });
            await this.autoAdvance(planId, source);
            return;
        }
        const prompt = await this.contextService.buildPreTaskContext({
            step: state.currentStep,
            taskId: String(task._id),
            taskTitle: task.title,
            taskDescription: task.description,
            runtimeTaskType: task.runtimeTaskType,
            planDomainType: String(planSnapshot?.domainType || 'general'),
            planGoal: String(planSnapshot?.sourcePrompt || ''),
            taskContext,
            preExecuteActions: preActions,
        });
        const decision = await this.plannerService.executePreTask(planId, prompt, plannerSessionId, state.currentStep, Array.isArray(preActions)
            ? preActions
                .map((action) => String(action?.tool || '').trim())
                .filter(Boolean)
            : undefined);
        const nextPhase = decision.allowExecute ? 'executing' : 'post_execute';
        if (!decision.allowExecute) {
            await this.taskModel
                .updateOne({ _id: task._id }, {
                $set: {
                    status: 'failed',
                    result: {
                        summary: 'Blocked by pre-execution planner decision',
                        error: decision.notes || 'Planner returned allowExecute=false',
                    },
                    completedAt: new Date(),
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'warn',
                        message: 'Task blocked by pre-execution planner decision',
                        metadata: { decision },
                    },
                },
            })
                .exec();
        }
        const advanced = await this.updateGenerationStateIfExpected(planId, state, {
            ...state,
            currentPhase: nextPhase,
        });
        if (!advanced) {
            return;
        }
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.pre_executed', {
            planId,
            step: state.currentStep,
            taskId: String(task._id),
            allowExecute: decision.allowExecute,
            riskFlags: decision.riskFlags,
        });
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.TASK_PRE_EXECUTED, {
            planId,
            taskId: String(task._id),
            step: state.currentStep,
            phase: 'pre_execute',
            result: { allowExecute: decision.allowExecute, riskFlags: decision.riskFlags },
        });
        await this.autoAdvance(planId, source);
    }
    async phaseExecute(planId, state, source) {
        const task = await this.getCurrentTaskOrThrow(planId, state.currentTaskId);
        const planSnapshot = await this.planModel
            .findById(planId)
            .select({ metadata: 1 })
            .lean()
            .exec();
        const metadata = (planSnapshot?.metadata || {});
        const outline = Array.isArray(metadata.outline) ? metadata.outline : [];
        const outlineStep = outline.find((o) => Number(o.step) === state.currentStep);
        const phasePrompts = outlineStep && typeof outlineStep.phasePrompts === 'object' && !Array.isArray(outlineStep.phasePrompts)
            ? outlineStep.phasePrompts
            : undefined;
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.executing', {
            planId,
            step: state.currentStep,
            taskId: String(task._id),
        });
        const executionResult = await this.incrementalPlanningService.executeIncrementalTaskWithRunRecord(planId, task, state.currentStep, false);
        const advanced = await this.updateGenerationStateIfExpected(planId, state, {
            ...state,
            currentPhase: 'post_execute',
        });
        if (!advanced) {
            return;
        }
        const eventType = executionResult.status === 'completed' ? 'planning.task.completed' : 'planning.task.failed';
        this.eventStream.emitPlanStreamEvent(planId, eventType, {
            planId,
            step: state.currentStep,
            taskId: String(task._id),
            error: executionResult.error,
        });
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.TASK_EXECUTED, {
            planId,
            taskId: String(task._id),
            step: state.currentStep,
            phase: 'executing',
            result: executionResult,
        });
        await this.autoAdvance(planId, source);
    }
    async phasePostExecute(planId, state, plannerSessionId, planDomainType = 'general', outlineStepCount, source = 'internal') {
        const task = await this.getCurrentTaskOrThrow(planId, state.currentTaskId);
        await this.sceneOptimizationService.applyPostExecuteOptimizations({
            planId,
            planDomainType,
            taskId: String(task._id),
            runtimeTaskType: task.runtimeTaskType,
            taskStatus: task.status,
            taskOutput: String(task.result?.output || task.result?.summary || ''),
        });
        const postPrompt = await this.contextService.buildPostTaskContext({
            step: state.currentStep,
            taskId: String(task._id),
            taskTitle: task.title,
            runtimeTaskType: task.runtimeTaskType,
            executionStatus: task.status,
            executionOutput: task.result?.output || task.result?.summary,
            executionError: task.result?.error,
            planDomainType,
            totalGeneratedSteps: state.totalGenerated,
            outlineStepCount,
        });
        let decision;
        try {
            decision = await this.plannerService.executePostTask(planId, postPrompt, plannerSessionId, state.currentStep, {
                totalGenerated: state.totalGenerated,
                outlineStepCount,
            });
        }
        catch (error) {
            decision = {
                action: 'stop',
                reason: error instanceof Error ? error.message : 'post-task planner failed',
            };
        }
        if (decision.action === 'retry' && this.isAutoRetryDisabledTaskType(task.runtimeTaskType)) {
            decision = {
                ...decision,
                action: 'redesign',
                reason: `${decision.reason} (auto retry disabled for ${task.runtimeTaskType})`,
            };
        }
        if (decision.action === 'stop'
            && outlineStepCount
            && state.totalGenerated < outlineStepCount) {
            this.logger.warn(`[post_execute_stop_override] planId=${planId} step=${state.currentStep} totalGenerated=${state.totalGenerated} outlineStepCount=${outlineStepCount} originalReason=${decision.reason} — overriding stop to generate_next`);
            decision = {
                ...decision,
                action: 'generate_next',
                reason: `${decision.reason} (system override: ${state.totalGenerated}/${outlineStepCount} steps completed, forced generate_next)`,
            };
        }
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.post_processed', {
            planId,
            step: state.currentStep,
            taskId: String(task._id),
            action: decision.action,
            reason: decision.reason,
        });
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.TASK_POST_PROCESSED, {
            planId,
            taskId: String(task._id),
            step: state.currentStep,
            phase: 'post_execute',
            result: decision,
        });
        if (decision.action === 'stop') {
            await this.completeAndArchive(planId, {
                ...state,
                currentPhase: 'idle',
                currentTaskId: undefined,
                lastDecision: 'stop',
            });
            return;
        }
        if (decision.action === 'retry') {
            await this.updateGenerationStateIfExpected(planId, state, {
                ...state,
                currentPhase: 'pre_execute',
                lastDecision: 'retry',
            });
            await this.autoAdvance(planId, source);
            return;
        }
        const nextState = {
            ...state,
            currentPhase: 'idle',
            currentTaskId: undefined,
            lastDecision: decision.action,
        };
        await this.updateGenerationStateIfExpected(planId, state, nextState);
        if (source === 'api') {
            return;
        }
        await this.autoAdvance(planId, source);
    }
    async ensurePlannerSession(planId, plan, state, phase) {
        const existingSessionId = this.isIsolatedSessionMode
            ? String(state.plannerSessionIds?.[phase] || '').trim()
            : String(state.plannerSessionId || '').trim();
        if (existingSessionId) {
            return existingSessionId;
        }
        const plannerAgentId = String(plan.strategy?.plannerAgentId || '').trim();
        if (!plannerAgentId) {
            throw new common_1.ConflictException('Plan has no planner agent configured');
        }
        const session = await this.agentClientService.getOrCreatePlanSession(planId, plannerAgentId, `Planner Session: ${plan.title}`, {
            orchestrationRunId: this.isIsolatedSessionMode ? `planner-${phase}` : 'planner',
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                ...(plan.strategy?.skillActivation ? { skillActivation: plan.strategy.skillActivation } : {}),
                roleInPlan: 'planner',
                domainType: String(plan.domainType || 'general').trim().toLowerCase(),
                phase,
                taskType: 'planning',
            }),
        });
        const sessionId = String(session?.id || session?.sessionId || '').trim();
        if (!sessionId) {
            throw new common_1.ConflictException('Failed to initialize planner session');
        }
        await this.updateGenerationState(planId, {
            ...state,
            ...(this.isIsolatedSessionMode
                ? {
                    plannerSessionIds: {
                        ...(state.plannerSessionIds || {}),
                        [phase]: sessionId,
                    },
                }
                : { plannerSessionId: sessionId }),
        });
        return sessionId;
    }
    shouldRunInitialize(plan, _state) {
        const metadata = (plan.metadata || {});
        if (Array.isArray(metadata.outline)) {
            return !this.hasValidOutlineWithPrompts(metadata.outline)
                && metadata.outline.length > 0;
        }
        return true;
    }
    resolveExecutionMode(plan) {
        const rawMode = String(plan.strategy?.executionMode || 'standard').trim().toLowerCase();
        return rawMode === 'easy' ? 'easy' : 'standard';
    }
    hasValidOutlineWithPrompts(outline) {
        if (!Array.isArray(outline) || outline.length === 0) {
            return false;
        }
        return outline.every((item) => {
            const prompts = item?.phasePrompts;
            if (!prompts || typeof prompts !== 'object' || Array.isArray(prompts)) {
                return false;
            }
            const generating = String(prompts.generating || '').trim();
            const postExecute = String(prompts.post_execute || '').trim();
            return Boolean(generating && postExecute);
        });
    }
    async checkTerminalConditions(planId, plan, state) {
        const config = this.incrementalPlanningService.resolveGenerationConfig(plan.generationConfig);
        if (state.totalGenerated >= config.maxTasks) {
            await this.failAndArchive(planId, `Exceeded max tasks limit (${config.maxTasks})`);
            return true;
        }
        if (state.totalCost > config.maxCostTokens) {
            await this.failAndArchive(planId, `Exceeded cost limit (${config.maxCostTokens} tokens)`);
            return true;
        }
        if (state.consecutiveFailures >= config.maxRetries || state.totalFailures >= config.maxTotalFailures) {
            await this.failAndArchive(planId, `Planning failed: consecutive=${state.consecutiveFailures}/${config.maxRetries}, total=${state.totalFailures}/${config.maxTotalFailures}`);
            return true;
        }
        return false;
    }
    bumpFailureCounters(state, error) {
        return {
            ...state,
            totalRetries: Number(state.totalRetries || 0) + 1,
            consecutiveFailures: Number(state.consecutiveFailures || 0) + 1,
            totalFailures: Number(state.totalFailures || 0) + 1,
            lastError: error,
        };
    }
    buildEmptyTaskReason(reasoning) {
        const normalized = String(reasoning || '').trim();
        if (!normalized) {
            return 'Planner returned empty task definition';
        }
        return `Planner returned empty task definition: ${normalized.slice(0, 200)}`;
    }
    async autoAdvance(planId, source = 'internal') {
        setImmediate(() => {
            this.advanceOnce(planId, { source }).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`autoAdvance failed for plan ${planId}: ${message}`);
            });
        });
    }
    async completeAndArchive(planId, state, options) {
        await this.incrementalPlanningService.completePlanning(planId, {
            ...state,
            isComplete: true,
            currentPhase: 'idle',
            currentTaskId: undefined,
        }, options);
        await this.archivePlannerSessionIfNeeded(state);
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.PLAN_COMPLETED, {
            planId,
            step: state.currentStep,
            totalGenerated: state.totalGenerated,
        });
    }
    async failAndArchive(planId, error) {
        await this.incrementalPlanningService.failPlanning(planId, error);
        const plan = await this.planModel.findById(planId).lean().exec();
        const state = this.resolveGenerationState(plan?.generationState);
        await this.archivePlannerSessionIfNeeded(state);
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.PLAN_FAILED, {
            planId,
            error,
        });
    }
    async archivePlannerSessionIfNeeded(state) {
        const sessionIds = this.resolvePlannerSessionIds(state);
        for (const sessionId of sessionIds) {
            await this.agentClientService.archiveSession(sessionId);
        }
    }
    async cancelOrphanTasksFromGenerating(planId, retainedTaskId, preGenerateTaskIds) {
        const currentTasks = await this.taskModel
            .find({ planId })
            .select({ _id: 1, status: 1 })
            .lean()
            .exec();
        const orphanIds = currentTasks
            .map((t) => String(t._id))
            .filter((id) => id !== retainedTaskId
            && !preGenerateTaskIds.has(id));
        if (orphanIds.length === 0) {
            return;
        }
        this.logger.warn(`[orphan_task_cleanup] planId=${planId} retainedTaskId=${retainedTaskId} cancelledOrphans=${orphanIds.join(',')}`);
        await this.taskModel
            .updateMany({
            _id: { $in: orphanIds },
            planId,
            status: { $in: ['assigned', 'pending'] },
        }, {
            $set: {
                status: 'cancelled',
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'warn',
                    message: 'Task cancelled: orphan from generating phase (duplicate submit-task)',
                    metadata: {
                        retainedTaskId,
                        reason: 'orphan_cleanup_on_generating',
                    },
                },
            },
        })
            .exec();
    }
    async findToolCreatedTaskFallback(planId, preGenerateTaskIds) {
        const currentTasks = await this.taskModel
            .find({
            planId,
            status: { $in: ['assigned', 'pending'] },
        })
            .sort({ createdAt: -1 })
            .exec();
        const newTask = currentTasks.find((t) => !preGenerateTaskIds.has(String(t._id)));
        return newTask || null;
    }
    async getCurrentTaskOrThrow(planId, taskId) {
        const normalizedTaskId = String(taskId || '').trim();
        if (!normalizedTaskId) {
            throw new common_1.NotFoundException('Current task not found');
        }
        const task = await this.taskModel.findOne({ _id: normalizedTaskId, planId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Current task not found');
        }
        return task;
    }
    async emitStepStarted(planId, step) {
        this.eventStream.emitPlanStreamEvent(planId, 'planning.step.started', {
            planId,
            step,
        });
    }
    async updateGenerationState(planId, state) {
        await this.planModel.updateOne({ _id: planId }, { $set: { generationState: state } }).exec();
    }
    async updateGenerationStateIfExpected(planId, expected, next) {
        const expectedPhase = expected.currentPhase || 'idle';
        const expectedTaskId = String(expected.currentTaskId || '').trim();
        const filter = {
            _id: planId,
            'generationState.currentPhase': expectedPhase,
            'generationState.isComplete': false,
        };
        if (expectedTaskId) {
            filter['generationState.currentTaskId'] = expectedTaskId;
        }
        const updated = await this.planModel
            .findOneAndUpdate(filter, { $set: { generationState: next } }, { new: false })
            .lean()
            .exec();
        return Boolean(updated);
    }
    resolveGenerationState(state) {
        const plannerSessionIds = Object.entries(state?.plannerSessionIds || {}).reduce((acc, [phase, sessionId]) => {
            const normalizedPhase = String(phase || '').trim();
            const normalizedSessionId = String(sessionId || '').trim();
            if (!normalizedPhase || !normalizedSessionId) {
                return acc;
            }
            acc[normalizedPhase] = normalizedSessionId;
            return acc;
        }, {});
        return {
            currentStep: Number(state?.currentStep || 0),
            totalGenerated: Number(state?.totalGenerated || 0),
            totalRetries: Number(state?.totalRetries || 0),
            consecutiveFailures: Number(state?.consecutiveFailures || 0),
            totalFailures: Number(state?.totalFailures || 0),
            totalCost: Number(state?.totalCost || 0),
            isComplete: Boolean(state?.isComplete),
            lastError: state?.lastError,
            currentPhase: state?.currentPhase || 'idle',
            lastDecision: state?.lastDecision,
            plannerSessionId: state?.plannerSessionId,
            plannerSessionIds: Object.keys(plannerSessionIds).length ? plannerSessionIds : undefined,
            currentTaskId: state?.currentTaskId,
        };
    }
    resolvePlannerSessionIds(state) {
        if (!this.isIsolatedSessionMode) {
            const sessionId = String(state.plannerSessionId || '').trim();
            return sessionId ? [sessionId] : [];
        }
        return Array.from(new Set(Object.values(state.plannerSessionIds || {})
            .map((id) => String(id || '').trim())
            .filter((id) => Boolean(id))));
    }
    withPlannerSession(state, phase, sessionId) {
        if (this.isIsolatedSessionMode) {
            return {
                ...state,
                plannerSessionIds: {
                    ...(state.plannerSessionIds || {}),
                    [phase]: sessionId,
                },
            };
        }
        return {
            ...state,
            plannerSessionId: sessionId,
        };
    }
    get isIsolatedSessionMode() {
        const rawMode = this.configService && typeof this.configService.get === 'function'
            ? this.configService.get('PLANNER_SESSION_ISOLATION_MODE')
            : undefined;
        return String(rawMode || 'shared').trim().toLowerCase() === 'isolated';
    }
    isAutoRetryDisabledTaskType(runtimeTaskType) {
        const normalized = String(runtimeTaskType || '').trim().toLowerCase();
        if (!normalized) {
            return false;
        }
        return AUTO_RETRY_DISABLED_TASK_TYPES.has(normalized);
    }
};
exports.OrchestrationStepDispatcherService = OrchestrationStepDispatcherService;
exports.OrchestrationStepDispatcherService = OrchestrationStepDispatcherService = OrchestrationStepDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        planner_service_1.PlannerService,
        incremental_planning_service_1.IncrementalPlanningService,
        plan_event_stream_service_1.PlanEventStreamService,
        orchestration_context_service_1.OrchestrationContextService,
        scene_optimization_service_1.SceneOptimizationService,
        event_emitter_1.EventEmitter2,
        agent_client_service_1.AgentClientService,
        config_1.ConfigService])
], OrchestrationStepDispatcherService);
//# sourceMappingURL=orchestration-step-dispatcher.service.js.map