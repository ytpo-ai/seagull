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
var IncrementalPlanningService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalPlanningService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../../../apps/agents/src/schemas/agent.schema");
const tool_schema_1 = require("../../../../apps/agents/src/schemas/tool.schema");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const orchestration_run_schema_1 = require("../../../shared/schemas/orchestration-run.schema");
const orchestration_run_task_schema_1 = require("../../../shared/schemas/orchestration-run-task.schema");
const planner_service_1 = require("../planner.service");
const orchestration_execution_engine_service_1 = require("./orchestration-execution-engine.service");
const plan_stats_service_1 = require("./plan-stats.service");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
const executor_selection_service_1 = require("./executor-selection.service");
const DEFAULT_GENERATION_CONFIG = {
    maxRetries: 3,
    maxTotalFailures: 6,
    maxCostTokens: 500000,
    maxTasks: 15,
};
let IncrementalPlanningService = IncrementalPlanningService_1 = class IncrementalPlanningService {
    constructor(planModel, taskModel, runModel, runTaskModel, agentModel, toolModel, plannerService, executionEngine, planStatsService, eventStream, contextService, executorSelectionService) {
        this.planModel = planModel;
        this.taskModel = taskModel;
        this.runModel = runModel;
        this.runTaskModel = runTaskModel;
        this.agentModel = agentModel;
        this.toolModel = toolModel;
        this.plannerService = plannerService;
        this.executionEngine = executionEngine;
        this.planStatsService = planStatsService;
        this.eventStream = eventStream;
        this.contextService = contextService;
        this.executorSelectionService = executorSelectionService;
        this.logger = new common_1.Logger(IncrementalPlanningService_1.name);
        this.activePlannings = new Set();
    }
    async executeIncrementalPlanning(planId) {
        const normalizedPlanId = String(planId || '').trim();
        if (!normalizedPlanId) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (this.activePlannings.has(normalizedPlanId)) {
            throw new common_1.ConflictException('Incremental planning already running');
        }
        this.activePlannings.add(normalizedPlanId);
        try {
            const plan = await this.planModel.findById(normalizedPlanId).exec();
            if (!plan) {
                throw new common_1.NotFoundException('Plan not found');
            }
            await this.prepareDraftingState(normalizedPlanId, this.resolveGenerationState(plan.generationState));
            await this.executePlanningUntilDone(normalizedPlanId, plan.sourcePrompt || '');
        }
        finally {
            this.activePlannings.delete(normalizedPlanId);
        }
    }
    async executePlanningUntilDone(planId, sourcePrompt) {
        const stepResult = await this.executePlanningStep(planId, sourcePrompt);
        if (stepResult.done) {
            return;
        }
        await new Promise((resolve, reject) => {
            setImmediate(() => {
                this.executePlanningUntilDone(planId, sourcePrompt)
                    .then(resolve)
                    .catch(reject);
            });
        });
    }
    async executeSinglePlanningStep(planId) {
        const normalizedPlanId = String(planId || '').trim();
        if (!normalizedPlanId) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (this.activePlannings.has(normalizedPlanId)) {
            throw new common_1.ConflictException('Incremental planning already running');
        }
        this.activePlannings.add(normalizedPlanId);
        try {
            const plan = await this.planModel.findById(normalizedPlanId).exec();
            if (!plan) {
                throw new common_1.NotFoundException('Plan not found');
            }
            await this.prepareDraftingState(normalizedPlanId, this.resolveGenerationState(plan.generationState));
            await this.executePlanningStep(normalizedPlanId, plan.sourcePrompt || '');
        }
        finally {
            this.activePlannings.delete(normalizedPlanId);
        }
    }
    async prepareDraftingState(planId, existingState) {
        await this.planStatsService.setPlanStatus(planId, 'drafting');
        await this.updateGenerationState(planId, {
            ...existingState,
            isComplete: false,
            lastError: undefined,
            currentPhase: existingState.currentPhase || 'idle',
        });
        this.eventStream.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: 'drafting',
            phase: 'incremental_planning',
        });
    }
    async executePlanningStep(planId, sourcePrompt) {
        const plan = await this.planModel.findById(planId).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const config = this.resolveGenerationConfig(plan.generationConfig);
        const state = this.resolveGenerationState(plan.generationState);
        let { currentStep, totalGenerated, totalRetries, consecutiveFailures, totalFailures, totalCost, } = state;
        if (state.isComplete) {
            return { done: true };
        }
        if (totalGenerated >= config.maxTasks) {
            await this.failPlanning(planId, `Exceeded max tasks limit (${config.maxTasks})`);
            return { done: true };
        }
        if (totalCost > config.maxCostTokens) {
            await this.failPlanning(planId, `Exceeded cost limit (${config.maxCostTokens} tokens)`);
            return { done: true };
        }
        let plannerContext;
        try {
            plannerContext = await this.buildPlannerContext(planId, sourcePrompt);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to build planner context';
            this.logger.error(`[planning_step_error] planId=${planId} step=${currentStep} phase=buildContext error=${message}`);
            totalRetries += 1;
            consecutiveFailures += 1;
            totalFailures += 1;
            await this.updateGenerationState(planId, {
                currentStep,
                totalGenerated,
                totalRetries,
                consecutiveFailures,
                totalFailures,
                totalCost,
                isComplete: false,
                lastError: `Build planner context failed: ${message}`,
            });
            if (consecutiveFailures >= config.maxRetries || totalFailures >= config.maxTotalFailures) {
                await this.failPlanning(planId, `Build planner context failed: ${message}`);
                return { done: true };
            }
            return { done: false };
        }
        this.eventStream.emitPlanStreamEvent(planId, 'planning.step.started', {
            planId,
            step: currentStep + 1,
        });
        let nextTaskResult;
        try {
            nextTaskResult = await this.plannerService.generateNextTask(planId, plannerContext);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Planner generateNextTask failed';
            this.logger.error(`[planning_step_error] planId=${planId} step=${currentStep} phase=generateNextTask error=${message}`);
            totalRetries += 1;
            consecutiveFailures += 1;
            totalFailures += 1;
            await this.updateGenerationState(planId, {
                currentStep,
                totalGenerated,
                totalRetries,
                consecutiveFailures,
                totalFailures,
                totalCost,
                isComplete: false,
                lastError: `Planner call failed: ${message}`,
            });
            if (consecutiveFailures >= config.maxRetries || totalFailures >= config.maxTotalFailures) {
                await this.failPlanning(planId, `Planner call failed: ${message}`);
                return { done: true };
            }
            return { done: false };
        }
        totalCost += nextTaskResult.costTokens || 0;
        if (nextTaskResult.isGoalReached) {
            await this.completePlanning(planId, {
                currentStep,
                totalGenerated,
                totalRetries,
                consecutiveFailures,
                totalFailures,
                totalCost,
                isComplete: true,
            });
            return { done: true };
        }
        const isRedesign = nextTaskResult.action === 'redesign' && Boolean(nextTaskResult.redesignTaskId);
        if (!nextTaskResult.task?.title || !nextTaskResult.task?.description) {
            totalRetries += 1;
            consecutiveFailures += 1;
            totalFailures += 1;
            const lastError = this.buildEmptyTaskReason(nextTaskResult.reasoning);
            await this.updateGenerationState(planId, {
                currentStep,
                totalGenerated,
                totalRetries,
                consecutiveFailures,
                totalFailures,
                totalCost,
                isComplete: false,
                lastError,
            });
            if (consecutiveFailures >= config.maxRetries || totalFailures >= config.maxTotalFailures) {
                await this.failPlanning(planId, lastError);
                return { done: true };
            }
            return { done: false };
        }
        let createdTask;
        try {
            createdTask = isRedesign
                ? await this.redesignFailedTask(planId, String(nextTaskResult.redesignTaskId), nextTaskResult.task)
                : await this.createTaskFromPlannerOutput(planId, nextTaskResult.task, currentStep);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create/redesign task';
            this.logger.error(`[planning_step_error] planId=${planId} step=${currentStep} phase=createTask error=${message}`);
            totalRetries += 1;
            consecutiveFailures += 1;
            totalFailures += 1;
            await this.updateGenerationState(planId, {
                currentStep,
                totalGenerated,
                totalRetries,
                consecutiveFailures,
                totalFailures,
                totalCost,
                isComplete: false,
                lastError: `Task creation failed: ${message}`,
            });
            if (consecutiveFailures >= config.maxRetries || totalFailures >= config.maxTotalFailures) {
                await this.failPlanning(planId, `Task creation failed: ${message}`);
                return { done: true };
            }
            return { done: false };
        }
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.generated', {
            planId,
            step: currentStep + 1,
            taskId: createdTask._id.toString(),
            title: createdTask.title,
            agentId: createdTask.assignment?.executorId,
            mode: isRedesign ? 'redesign' : 'new',
        });
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.executing', {
            planId,
            step: currentStep + 1,
            taskId: createdTask._id.toString(),
        });
        const executionResult = await this.executeIncrementalTaskWithRunRecord(planId, createdTask, currentStep + 1, isRedesign);
        if (executionResult.status === 'completed') {
            const merged = await this.tryMergeWithPreviousTask(planId, createdTask);
            if (!isRedesign) {
                currentStep += 1;
                totalGenerated += 1;
            }
            consecutiveFailures = 0;
            await this.updateGenerationState(planId, {
                currentStep,
                totalGenerated,
                totalRetries,
                consecutiveFailures,
                totalFailures,
                totalCost,
                isComplete: false,
                lastError: undefined,
            });
            this.eventStream.emitPlanStreamEvent(planId, 'planning.task.completed', {
                planId,
                step: currentStep,
                taskId: createdTask._id.toString(),
                merged,
            });
            return { done: false };
        }
        totalRetries += 1;
        consecutiveFailures += 1;
        totalFailures += 1;
        if (!isRedesign) {
            totalGenerated += 1;
            currentStep += 1;
        }
        const error = executionResult.error || `Task execution ended with status=${executionResult.status}`;
        await this.updateGenerationState(planId, {
            currentStep,
            totalGenerated,
            totalRetries,
            consecutiveFailures,
            totalFailures,
            totalCost,
            isComplete: false,
            lastError: error,
        });
        this.eventStream.emitPlanStreamEvent(planId, 'planning.task.failed', {
            planId,
            step: currentStep,
            taskId: createdTask._id.toString(),
            error,
            retriesLeft: Math.max(config.maxRetries - consecutiveFailures, 0),
        });
        if (consecutiveFailures >= config.maxRetries || totalFailures >= config.maxTotalFailures) {
            await this.failPlanning(planId, `Task "${createdTask.title}" failed: consecutive=${consecutiveFailures}/${config.maxRetries}, total=${totalFailures}/${config.maxTotalFailures}, error=${error}`);
            return { done: true };
        }
        return { done: false };
    }
    async executeIncrementalTaskWithRunRecord(planId, task, step, isRedesign) {
        const planSnapshot = await this.planModel
            .findById(planId)
            .select({ domainType: 1, sourcePrompt: 1 })
            .lean()
            .exec();
        const inferredRuntimeTaskType = this.contextService.inferRuntimeTaskTypeFromPlanContext({
            planDomainType: String(planSnapshot?.domainType || 'general'),
            planGoal: String(planSnapshot?.sourcePrompt || ''),
            step: Number.isFinite(step) ? Math.max(step - 1, 0) : undefined,
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
                        message: 'Runtime task type inferred in incremental execution path',
                        metadata: {
                            inferredRuntimeTaskType,
                            previousRuntimeTaskType: task.runtimeTaskType,
                            source: 'incremental_planning.executeIncrementalTaskWithRunRecord',
                        },
                    },
                },
            })
                .exec();
            task.runtimeTaskType = inferredRuntimeTaskType;
        }
        const startedAt = new Date();
        const runTaskContext = this.contextService.resolvePlanTaskContextFromMetadata(((await this.planModel.findById(planId).select({ metadata: 1 }).lean().exec())?.metadata));
        const planForProjectId = await this.planModel.findById(planId).select({ projectId: 1 }).lean().exec();
        const runProjectId = String(planForProjectId?.projectId || '').trim() || undefined;
        const run = await new this.runModel({
            planId,
            triggerType: 'autorun',
            status: 'running',
            startedAt,
            stats: {
                totalTasks: 1,
                completedTasks: 0,
                failedTasks: 0,
                waitingHumanTasks: 0,
            },
            metadata: {
                source: 'incremental_generation',
                step,
                isRedesign,
                taskContext: runTaskContext,
            },
            ...(runProjectId ? { projectId: runProjectId } : {}),
        }).save();
        const runId = String(run.id || run._id);
        const taskId = String(task.id || task._id);
        await new this.runTaskModel({
            runId,
            planId,
            sourceTaskId: taskId,
            order: task.order,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            assignment: task.assignment,
            dependencyTaskIds: task.dependencyTaskIds || [],
            taskType: task.taskType || 'general',
            runtimeTaskType: task.runtimeTaskType,
            runLogs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Incremental task execution run created',
                    metadata: {
                        source: 'incremental_generation',
                        step,
                        isRedesign,
                    },
                },
            ],
        }).save();
        let executionResult;
        try {
            executionResult = await this.executionEngine.executeTaskNode(planId, task, {
                orchestrationRunId: runId,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Incremental task execution failed';
            executionResult = { status: 'failed', error: message };
        }
        const latestTask = await this.taskModel.findById(task._id).lean().exec();
        const finalTaskStatus = String(latestTask?.status || executionResult.status || 'failed');
        const completedAt = new Date();
        const runStatus = finalTaskStatus === 'completed'
            ? 'completed'
            : finalTaskStatus === 'cancelled'
                ? 'cancelled'
                : 'failed';
        const stats = {
            totalTasks: 1,
            completedTasks: runStatus === 'completed' ? 1 : 0,
            failedTasks: runStatus === 'failed' ? 1 : 0,
            waitingHumanTasks: finalTaskStatus === 'waiting_human' ? 1 : 0,
        };
        await this.runTaskModel
            .updateOne({ runId, sourceTaskId: taskId }, {
            $set: {
                status: finalTaskStatus,
                runtimeTaskType: latestTask?.runtimeTaskType,
                result: {
                    summary: latestTask?.result?.summary,
                    output: latestTask?.result?.output,
                    error: latestTask?.result?.error || executionResult.error,
                },
                sessionId: latestTask?.sessionId,
                startedAt: latestTask?.startedAt || startedAt,
                completedAt: latestTask?.completedAt || completedAt,
            },
            $push: {
                runLogs: {
                    timestamp: completedAt,
                    level: runStatus === 'completed' ? 'info' : 'error',
                    message: runStatus === 'completed'
                        ? 'Incremental task execution completed'
                        : `Incremental task execution ended with status=${finalTaskStatus}`,
                    metadata: {
                        executionStatus: executionResult.status,
                        executionError: executionResult.error,
                    },
                },
            },
        })
            .exec();
        await this.runModel
            .updateOne({ _id: runId }, {
            $set: {
                status: runStatus,
                completedAt,
                durationMs: completedAt.getTime() - startedAt.getTime(),
                stats,
                error: runStatus === 'failed' ? executionResult.error || latestTask?.result?.error : undefined,
            },
        })
            .exec();
        await this.planModel
            .updateOne({ _id: planId }, {
            $set: {
                lastRunId: runId,
            },
        })
            .exec();
        return executionResult;
    }
    async buildPlannerContext(planId, sourcePrompt) {
        const [tasks, plan] = await Promise.all([
            this.taskModel
                .find({ planId, status: { $ne: 'cancelled' } })
                .sort({ order: 1 })
                .exec(),
            this.planModel.findById(planId).exec(),
        ]);
        const completedTasks = tasks
            .filter((item) => item.status === 'completed')
            .map((item) => ({
            title: item.title,
            agentId: String(item.assignment?.executorId || '').trim() || undefined,
            outputSummary: String(item.result?.output || '').slice(0, 2000),
        }));
        const failedAgentIds = Array.from(new Set(tasks
            .filter((item) => item.status === 'failed')
            .map((item) => String(item.assignment?.executorId || '').trim())
            .filter(Boolean)));
        const failedAgentToolMap = await this.loadAgentToolMap(failedAgentIds);
        const failedTasks = tasks
            .filter((item) => item.status === 'failed')
            .map((item) => ({
            taskId: String(item.id || item._id?.toString() || '').trim(),
            title: item.title,
            agentId: String(item.assignment?.executorId || '').trim() || undefined,
            agentTools: failedAgentToolMap.get(String(item.assignment?.executorId || '').trim()) || [],
            error: String(item.result?.error || 'Unknown error'),
        }));
        const requirementId = this.contextService.resolveRequirementIdFromPlan(plan);
        const taskContext = this.contextService.resolvePlanTaskContextFromMetadata((plan?.metadata || {}));
        return {
            planGoal: sourcePrompt,
            completedTasks,
            failedTasks,
            totalSteps: tasks.length,
            lastError: plan?.generationState?.lastError,
            requirementId,
            requirementTitle: String(taskContext.requirementTitle || '').trim() || undefined,
            requirementDescription: String(taskContext.requirementDescription || '').trim() || undefined,
        };
    }
    async submitPlannerTaskFromTool(input) {
        const planId = String(input?.planId || '').trim();
        if (!planId) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (!mongoose_2.Types.ObjectId.isValid(planId)) {
            throw new common_1.NotFoundException(`Plan not found: invalid planId format "${planId}"`);
        }
        if (input?.isGoalReached === true) {
            return {
                goalReached: true,
                message: '计划目标已达成',
            };
        }
        const plan = await this.planModel
            .findById(planId)
            .select({ generationState: 1, projectId: 1 })
            .lean()
            .exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const planProjectId = String(plan.projectId || '').trim() || undefined;
        const action = String(input?.action || 'new').trim().toLowerCase() === 'redesign' ? 'redesign' : 'new';
        const title = String(input?.title || '').trim().slice(0, 200);
        const description = String(input?.description || '').trim().slice(0, 4000);
        if (!title || !description) {
            throw new common_1.ConflictException('submit-task requires non-empty title and description');
        }
        const taskTypeRaw = String(input?.taskType || '').trim().toLowerCase();
        const taskType = taskTypeRaw === 'research'
            || taskTypeRaw === 'development.plan'
            || taskTypeRaw === 'development.exec'
            || taskTypeRaw === 'development.review'
            || taskTypeRaw === 'general'
            ? taskTypeRaw
            : 'general';
        const priorityRaw = String(input?.priority || '').trim().toLowerCase();
        const priority = priorityRaw === 'low' || priorityRaw === 'medium' || priorityRaw === 'high' || priorityRaw === 'urgent'
            ? priorityRaw
            : 'medium';
        const taskPayload = {
            title,
            description,
            priority,
            agentId: String(input?.agentId || input?.executorId || '').trim() || undefined,
            taskType,
            requiredTools: Array.isArray(input?.requiredTools)
                ? input.requiredTools.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
        };
        const redesignedTaskId = String(input?.redesignTaskId || '').trim();
        if (action === 'redesign' && !redesignedTaskId) {
            throw new common_1.ConflictException('redesignTaskId is required when action=redesign');
        }
        if (action === 'new') {
            const recentCutoff = new Date(Date.now() - 60000);
            const existingTask = await this.taskModel
                .findOne({
                planId,
                title,
                status: { $in: ['assigned', 'pending'] },
                createdAt: { $gte: recentCutoff },
            })
                .exec();
            if (existingTask) {
                this.logger.warn(`[submit_task_idempotent] planId=${planId} title="${title}" existingTaskId=${String(existingTask._id)} — returning existing task instead of creating duplicate`);
                return {
                    plannerAction: action,
                    taskId: String(existingTask._id),
                    title: existingTask.title,
                    description: existingTask.description,
                    status: existingTask.status,
                    priority: existingTask.priority,
                    taskType: existingTask.taskType || 'general',
                    order: Number(existingTask.order || 0),
                    assignment: {
                        executorType: existingTask.assignment?.executorType,
                        executorId: existingTask.assignment?.executorId,
                    },
                    reasoning: String(input?.reasoning || '').trim() || undefined,
                    idempotent: true,
                };
            }
        }
        const maxOrderDoc = await this.taskModel
            .findOne({ planId, status: { $ne: 'cancelled' } })
            .sort({ order: -1 })
            .select({ order: 1 })
            .lean()
            .exec();
        const nextOrder = typeof maxOrderDoc?.order === 'number' ? maxOrderDoc.order + 1 : 0;
        const createdTask = action === 'redesign'
            ? await this.redesignFailedTask(planId, redesignedTaskId, taskPayload, planProjectId)
            : await this.createTaskFromPlannerOutput(planId, taskPayload, nextOrder, planProjectId);
        return {
            plannerAction: action,
            taskId: String(createdTask._id),
            title: createdTask.title,
            description: createdTask.description,
            status: createdTask.status,
            priority: createdTask.priority,
            taskType: createdTask.taskType || 'general',
            order: Number(createdTask.order || 0),
            assignment: {
                executorType: createdTask.assignment?.executorType,
                executorId: createdTask.assignment?.executorId,
            },
            reasoning: String(input?.reasoning || '').trim() || undefined,
            redesignTaskId: action === 'redesign' ? redesignedTaskId || undefined : undefined,
        };
    }
    async reportTaskRunResultFromTool(input) {
        const planId = String(input?.planId || '').trim();
        if (!planId) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (!mongoose_2.Types.ObjectId.isValid(planId)) {
            throw new common_1.NotFoundException(`Plan not found: invalid planId format "${planId}"`);
        }
        const planExists = await this.planModel.exists({ _id: planId });
        if (!planExists) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const action = String(input?.action || '').trim().toLowerCase();
        if (!['generate_next', 'stop', 'redesign', 'retry'].includes(action)) {
            throw new common_1.ConflictException('action must be generate_next|stop|redesign|retry');
        }
        const reason = String(input?.reason || '').trim();
        if (!reason) {
            throw new common_1.ConflictException('reason is required');
        }
        const redesignTaskId = String(input?.redesignTaskId || '').trim();
        if (action === 'redesign' && !redesignTaskId) {
            throw new common_1.ConflictException('redesignTaskId is required when action=redesign');
        }
        return {
            action,
            reason,
            accepted: true,
            redesignTaskId: redesignTaskId || undefined,
            nextTaskHints: Array.isArray(input?.nextTaskHints)
                ? input.nextTaskHints.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
        };
    }
    async createTaskFromPlannerOutput(planId, taskResult, order, inheritedProjectId) {
        const planProjectId = String(inheritedProjectId || '').trim() || undefined;
        const effectiveProjectId = planProjectId
            || String((await this.planModel.findById(planId).select({ projectId: 1 }).lean().exec())?.projectId || '').trim()
            || undefined;
        const normalizedAgentId = String(taskResult.agentId || '').trim();
        const assignment = await this.resolveAssignmentForPlannerTask(taskResult, normalizedAgentId, effectiveProjectId);
        const requirementId = await this.resolveRequirementId(planId);
        const completedPredecessors = await this.taskModel
            .find({ planId, status: 'completed' })
            .sort({ order: 1 })
            .select({ _id: 1 })
            .lean()
            .exec();
        const dependencyTaskIds = completedPredecessors.map((t) => String(t._id));
        const task = await new this.taskModel({
            planId,
            ...(requirementId ? { requirementId } : {}),
            title: taskResult.title,
            description: taskResult.description,
            priority: taskResult.priority,
            taskType: taskResult.taskType || 'general',
            status: assignment.executorType === 'unassigned' ? 'pending' : 'assigned',
            order,
            dependencyTaskIds,
            mergedFromTaskIds: [],
            assignment,
            runLogs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task generated by incremental planner',
                    metadata: {
                        plannerAssignedAgentId: normalizedAgentId || undefined,
                        fallbackUsed: assignment.reason !== 'Assigned by planner incremental output',
                        plannerRequiredTools: taskResult.requiredTools || undefined,
                    },
                },
            ],
            ...(effectiveProjectId ? { projectId: effectiveProjectId } : {}),
        }).save();
        await this.planModel
            .updateOne({ _id: planId }, {
            $push: { taskIds: task._id.toString() },
        })
            .exec();
        await this.validateTaskContextInjection(planId, task);
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        return task;
    }
    async redesignFailedTask(planId, redesignTaskId, taskResult, inheritedProjectId) {
        const normalizedTaskId = String(redesignTaskId || '').trim();
        if (!normalizedTaskId) {
            throw new common_1.NotFoundException('Failed task not found for redesign');
        }
        const taskFilters = [{ id: normalizedTaskId }];
        if (mongoose_2.Types.ObjectId.isValid(normalizedTaskId)) {
            taskFilters.push({ _id: new mongoose_2.Types.ObjectId(normalizedTaskId) });
        }
        const targetTask = await this.taskModel
            .findOne({ planId, status: 'failed', $or: taskFilters })
            .exec();
        if (!targetTask) {
            throw new common_1.NotFoundException(`Failed task ${normalizedTaskId} not found for redesign`);
        }
        const planProjectId = String(inheritedProjectId || '').trim() || undefined;
        const effectiveProjectId = planProjectId
            || String((await this.planModel.findById(planId).select({ projectId: 1 }).lean().exec())?.projectId || '').trim()
            || undefined;
        const normalizedAgentId = String(taskResult.agentId || '').trim();
        const assignment = await this.resolveAssignmentForPlannerTask(taskResult, normalizedAgentId, effectiveProjectId);
        const status = assignment.executorType === 'unassigned' ? 'pending' : 'assigned';
        await this.taskModel
            .updateOne({ _id: targetTask._id, planId, status: 'failed' }, {
            $set: {
                title: taskResult.title,
                description: taskResult.description,
                priority: taskResult.priority,
                taskType: taskResult.taskType || 'general',
                status,
                assignment,
                startedAt: null,
                completedAt: null,
            },
            $unset: {
                result: 1,
                runtimeTaskType: 1,
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task redesigned by incremental planner',
                    metadata: {
                        redesignTaskId: normalizedTaskId,
                        previousAgentId: targetTask.assignment?.executorId,
                        plannerAssignedAgentId: normalizedAgentId || undefined,
                        reassignedAgentId: assignment.executorId,
                        plannerAction: 'redesign',
                    },
                },
            },
        })
            .exec();
        const redesignedTask = await this.taskModel.findById(targetTask._id).exec();
        if (!redesignedTask) {
            throw new common_1.NotFoundException(`Redesigned task ${normalizedTaskId} not found`);
        }
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        return redesignedTask;
    }
    async tryMergeWithPreviousTask(_planId, _currentTask) {
        return false;
    }
    resolvePlannerAgentSelectionMode() {
        const value = String(process.env.PLANNER_AGENT_SELECTION_MODE || 'verify').trim().toLowerCase();
        if (value === 'trust' || value === 'verify' || value === 'override') {
            return value;
        }
        return 'verify';
    }
    async resolveFallbackAssignment(taskResult, reasonPrefix, projectId) {
        const fallback = await this.executorSelectionService.selectExecutor({
            title: taskResult.title,
            description: taskResult.description,
            taskType: taskResult.taskType || 'general',
            requiredTools: taskResult.requiredTools,
            projectId,
        });
        return {
            executorType: fallback.executorType || 'unassigned',
            executorId: fallback.executorId,
            reason: `${reasonPrefix}; fallback=${fallback.reason}`,
        };
    }
    async resolveAssignmentForPlannerTask(taskResult, taskAgentId, projectId) {
        const mode = this.resolvePlannerAgentSelectionMode();
        const validAgentId = await this.resolveValidAgentId(taskAgentId, projectId);
        if (mode === 'override') {
            this.logger.log(`[planner_override_mode] mode=override taskAgent=${taskAgentId || 'empty'} title="${taskResult.title.slice(0, 60)}"`);
            return this.resolveFallbackAssignment(taskResult, 'Planner assignment overridden by policy', projectId);
        }
        if (!validAgentId) {
            return this.resolveFallbackAssignment(taskResult, 'Planner did not provide valid agentId', projectId);
        }
        if (mode === 'trust') {
            return {
                executorType: 'agent',
                executorId: validAgentId,
                reason: 'Assigned by planner incremental output',
            };
        }
        const fitCheck = await this.executorSelectionService.validateAgentToolFit({
            agentId: validAgentId,
            taskTitle: taskResult.title,
            taskDescription: taskResult.description,
            taskType: taskResult.taskType || 'general',
            requiredTools: taskResult.requiredTools,
            projectId,
        });
        if (fitCheck.fit) {
            const scopedProjectId = String(projectId || '').trim();
            if (scopedProjectId) {
                const chosenAgent = await this.agentModel
                    .findOne(mongoose_2.Types.ObjectId.isValid(validAgentId) ? { _id: new mongoose_2.Types.ObjectId(validAgentId) } : { id: validAgentId })
                    .select({ projectId: 1 })
                    .lean()
                    .exec();
                const chosenAgentProjectId = String(chosenAgent?.projectId || '').trim();
                if (!chosenAgentProjectId || chosenAgentProjectId !== scopedProjectId) {
                    const projectAlternative = await this.executorSelectionService.selectExecutor({
                        title: taskResult.title,
                        description: taskResult.description,
                        projectId: scopedProjectId,
                        taskType: taskResult.taskType || 'general',
                    });
                    if (projectAlternative.executorType === 'agent'
                        && projectAlternative.executorId
                        && projectAlternative.executorId !== validAgentId) {
                        const altAgent = await this.agentModel
                            .findOne(mongoose_2.Types.ObjectId.isValid(projectAlternative.executorId) ? { _id: new mongoose_2.Types.ObjectId(projectAlternative.executorId) } : { id: projectAlternative.executorId })
                            .select({ projectId: 1 })
                            .lean()
                            .exec();
                        const altProjectId = String(altAgent?.projectId || '').trim();
                        if (altProjectId === scopedProjectId) {
                            this.logger.log(`[planner_project_affinity_override] plannerAgent=${validAgentId}(global) → override=${projectAlternative.executorId}(project) title="${taskResult.title.slice(0, 60)}"`);
                            return {
                                executorType: 'agent',
                                executorId: projectAlternative.executorId,
                                reason: `Project affinity override: planner chose global agent, replaced with project-scoped agent; ${projectAlternative.reason}`,
                            };
                        }
                    }
                }
            }
            return {
                executorType: 'agent',
                executorId: validAgentId,
                reason: 'Assigned by planner incremental output',
            };
        }
        this.logger.warn(`[planner_verify_fallback] plannerAgent=${validAgentId} rejectionReason=${fitCheck.rejectionReason || '-'} missingTools=${fitCheck.missingTools.join(',') || 'none'} title="${taskResult.title.slice(0, 60)}"`);
        const mismatchReason = fitCheck.rejectionReason === 'project_scope_mismatch'
            ? 'Planner assignment out of project scope'
            : fitCheck.rejectionReason === 'opencode_capability'
                ? 'Planner assignment lacks opencode capability'
                : `Planner assignment tool mismatch: ${fitCheck.missingTools.join(', ') || 'unknown'}`;
        if (fitCheck.suggestion) {
            return {
                executorType: fitCheck.suggestion.executorType,
                executorId: fitCheck.suggestion.executorId,
                reason: `${mismatchReason}; fallback=${fitCheck.suggestion.reason}`,
            };
        }
        return this.resolveFallbackAssignment(taskResult, mismatchReason, projectId);
    }
    async loadAgentToolMap(agentIds) {
        const normalizedIds = agentIds
            .map((item) => String(item || '').trim())
            .filter(Boolean);
        if (normalizedIds.length === 0) {
            return new Map();
        }
        const objectIds = normalizedIds.filter((item) => mongoose_2.Types.ObjectId.isValid(item)).map((item) => new mongoose_2.Types.ObjectId(item));
        const query = {
            $or: [
                { id: { $in: normalizedIds } },
                ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
            ],
        };
        const agents = await this.agentModel
            .find(query)
            .select({ id: 1, tools: 1 })
            .lean()
            .exec();
        const toolIds = Array.from(new Set(agents
            .flatMap((agent) => agent.tools || [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)));
        const tools = toolIds.length > 0
            ? await this.toolModel
                .find({ id: { $in: toolIds }, enabled: true })
                .select({ id: 1, name: 1 })
                .lean()
                .exec()
            : [];
        const toolNameMap = new Map(tools.map((tool) => [
            String(tool.id || '').trim(),
            String(tool.name || '').trim(),
        ]));
        const map = new Map();
        for (const agent of agents) {
            const keyCandidates = [String(agent.id || '').trim(), String(agent._id || '').trim()].filter(Boolean);
            const tools = (agent.tools || [])
                .map((toolId) => String(toolId || '').trim())
                .filter(Boolean)
                .map((toolId) => {
                const toolName = toolNameMap.get(toolId);
                return toolName ? `${toolName}(${toolId})` : toolId;
            });
            for (const key of keyCandidates) {
                map.set(key, tools);
            }
        }
        return map;
    }
    async completePlanning(planId, state, options) {
        const finalStatus = options?.finalStatus || 'planned';
        const statusPhase = options?.statusPhase || 'planning_completed';
        await this.planModel
            .updateOne({ _id: planId }, {
            $set: {
                status: finalStatus,
                generationState: {
                    ...state,
                    isComplete: true,
                    lastError: undefined,
                    currentPhase: 'idle',
                    currentTaskId: undefined,
                },
                'metadata.planningCompletedAt': new Date().toISOString(),
            },
            $unset: {
                'metadata.planningFailedAt': 1,
            },
        })
            .exec();
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        this.eventStream.emitPlanStreamEvent(planId, 'planning.completed', {
            planId,
            totalTasks: state.totalGenerated,
            totalSteps: state.currentStep,
        });
        this.eventStream.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: finalStatus,
            phase: statusPhase,
        });
    }
    async failPlanning(planId, error) {
        await this.planModel
            .updateOne({ _id: planId }, {
            $set: {
                status: 'draft',
                'generationState.lastError': error,
                'generationState.isComplete': false,
                'generationState.currentPhase': 'idle',
                'metadata.planningFailedAt': new Date().toISOString(),
            },
        })
            .exec();
        this.eventStream.emitPlanStreamEvent(planId, 'planning.failed', {
            planId,
            error,
        });
        this.eventStream.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: 'draft',
            phase: 'planning_failed',
            error,
        });
    }
    async updateGenerationState(planId, state) {
        await this.planModel
            .updateOne({ _id: planId }, {
            $set: {
                generationState: state,
            },
        })
            .exec();
    }
    buildEmptyTaskReason(reasoning) {
        const normalized = String(reasoning || '').trim();
        if (!normalized) {
            return 'Planner returned empty task definition';
        }
        return `Planner returned empty task definition: ${normalized.slice(0, 200)}`;
    }
    resolveGenerationConfig(config) {
        return {
            maxRetries: Number(config?.maxRetries || DEFAULT_GENERATION_CONFIG.maxRetries),
            maxTotalFailures: Number(config?.maxTotalFailures || DEFAULT_GENERATION_CONFIG.maxTotalFailures),
            maxCostTokens: Number(config?.maxCostTokens || DEFAULT_GENERATION_CONFIG.maxCostTokens),
            maxTasks: Number(config?.maxTasks || DEFAULT_GENERATION_CONFIG.maxTasks),
        };
    }
    resolveGenerationState(state) {
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
            currentTaskId: state?.currentTaskId,
        };
    }
    async resolveValidAgentId(agentId, projectId) {
        const normalized = String(agentId || '').trim();
        if (!normalized) {
            return null;
        }
        const query = { id: normalized, isActive: true };
        if (mongoose_2.Types.ObjectId.isValid(normalized)) {
            query.$or = [{ id: normalized }, { _id: new mongoose_2.Types.ObjectId(normalized) }];
            delete query.id;
        }
        const scopedProjectId = String(projectId || '').trim();
        if (scopedProjectId) {
            query.$and = [
                {
                    $or: [
                        { projectId: scopedProjectId },
                        { projectId: { $in: [null, ''] } },
                        { projectId: { $exists: false } },
                    ],
                },
            ];
        }
        const agent = await this.agentModel
            .findOne(query)
            .select({ _id: 1, id: 1 })
            .lean()
            .exec();
        if (!agent) {
            return null;
        }
        return String(agent.id || agent._id?.toString() || '').trim() || null;
    }
    async resolveRequirementId(planId) {
        const plan = await this.planModel.findById(planId).select({ metadata: 1 }).lean().exec();
        return this.contextService.resolveRequirementIdFromPlan(plan);
    }
    async validateTaskContextInjection(planId, task) {
        const plan = await this.planModel
            .findById(planId)
            .select({ metadata: 1 })
            .lean()
            .exec();
        const planTaskContext = this.contextService.resolvePlanTaskContextFromMetadata(plan?.metadata);
        const requirementId = String(planTaskContext.requirementId || '').trim();
        if (!requirementId) {
            return;
        }
        const taskRequirementId = String(task.requirementId || '').trim();
        if (!taskRequirementId) {
            this.logger.error(`[TaskContext Injection Validation] task ${String(task._id)} missing requirementId from plan.taskContext`);
            return;
        }
        if (taskRequirementId !== requirementId) {
            this.logger.error(`[TaskContext Injection Validation] task ${String(task._id)} requirementId mismatch: expected=${requirementId}, actual=${taskRequirementId}`);
        }
    }
};
exports.IncrementalPlanningService = IncrementalPlanningService;
exports.IncrementalPlanningService = IncrementalPlanningService = IncrementalPlanningService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_run_schema_1.OrchestrationRun.name)),
    __param(3, (0, mongoose_1.InjectModel)(orchestration_run_task_schema_1.OrchestrationRunTask.name)),
    __param(4, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(5, (0, mongoose_1.InjectModel)(tool_schema_1.Tool.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        planner_service_1.PlannerService,
        orchestration_execution_engine_service_1.OrchestrationExecutionEngineService,
        plan_stats_service_1.PlanStatsService,
        plan_event_stream_service_1.PlanEventStreamService,
        orchestration_context_service_1.OrchestrationContextService,
        executor_selection_service_1.ExecutorSelectionService])
], IncrementalPlanningService);
//# sourceMappingURL=incremental-planning.service.js.map