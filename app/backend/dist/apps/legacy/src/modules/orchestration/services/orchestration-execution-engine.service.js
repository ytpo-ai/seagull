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
var OrchestrationExecutionEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationExecutionEngineService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_run_task_schema_1 = require("../../../shared/schemas/orchestration-run-task.schema");
const orchestration_run_schema_1 = require("../../../shared/schemas/orchestration-run.schema");
const ei_project_schema_1 = require("../../../shared/schemas/ei-project.schema");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
const plan_stats_service_1 = require("./plan-stats.service");
const orchestration_message_center_event_service_1 = require("./orchestration-message-center-event.service");
let OrchestrationExecutionEngineService = OrchestrationExecutionEngineService_1 = class OrchestrationExecutionEngineService {
    constructor(orchestrationPlanModel, orchestrationTaskModel, orchestrationRunTaskModel, orchestrationRunModel, rdProjectModel, agentClientService, planEventStreamService, contextService, planStatsService, orchestrationMessageCenterEventService) {
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.orchestrationRunTaskModel = orchestrationRunTaskModel;
        this.orchestrationRunModel = orchestrationRunModel;
        this.rdProjectModel = rdProjectModel;
        this.agentClientService = agentClientService;
        this.planEventStreamService = planEventStreamService;
        this.contextService = contextService;
        this.planStatsService = planStatsService;
        this.orchestrationMessageCenterEventService = orchestrationMessageCenterEventService;
        this.logger = new common_1.Logger(OrchestrationExecutionEngineService_1.name);
        this.asyncAgentTaskWaitTimeoutMs = Math.max(10000, Number(process.env.ORCHESTRATION_AGENT_TASK_WAIT_TIMEOUT_MS || 1800000));
        this.asyncAgentTaskPollIntervalMs = Math.max(300, Number(process.env.ORCHESTRATION_AGENT_TASK_POLL_INTERVAL_MS || 1500));
        this.asyncAgentTaskSseEnabled = String(process.env.ORCHESTRATION_AGENT_TASK_USE_SSE || 'true').trim().toLowerCase() !== 'false';
        this.projectBindingCache = new Map();
    }
    async executeTaskNode(planId, task, options) {
        const taskId = this.getEntityId(task);
        const assignment = task.assignment || { executorType: 'unassigned' };
        const runtimeTaskTypeOverride = this.contextService.normalizeRuntimeTaskTypeOverride(options?.runtimeTaskTypeOverride);
        const persistedRuntimeTaskType = this.contextService.normalizeRuntimeTaskTypeOverride(task.runtimeTaskType);
        const runtimeTaskType = runtimeTaskTypeOverride || persistedRuntimeTaskType || 'general';
        const dependencyContext = await this.contextService.buildDependencyContext(planId, task.dependencyTaskIds || []);
        const retryHint = this.contextService.getRetryFailureHint(task);
        const stepOrder = typeof task.order === 'number' ? Number(task.order) : undefined;
        const skillActivation = await this.loadPlanSkillActivation(planId);
        const taskProjectId = String(task.projectId || '').trim() || undefined;
        const planProjectId = taskProjectId || (await this.resolvePlanProjectId(planId));
        const projectBinding = await this.resolveProjectBinding(planProjectId, planId);
        const collaborationContext = this.contextService.buildOrchestrationCollaborationContext(task, {
            dependencyContext,
            executorAgentId: assignment.executorType === 'agent' ? assignment.executorId : undefined,
            ...(skillActivation ? { skillActivation } : {}),
            ...(planProjectId ? { projectId: planProjectId } : {}),
            ...(projectBinding ? { projectBinding } : {}),
        });
        const planTaskContext = await this.loadPlanTaskContext(planId);
        const executePrompt = await this.loadPlanStepExecutePrompt(planId, stepOrder);
        await this.orchestrationTaskModel
            .updateOne({ _id: taskId }, {
            $set: {
                status: 'in_progress',
                startedAt: new Date(),
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task execution started',
                    metadata: assignment,
                },
            },
        })
            .exec();
        await this.planStatsService.updatePlanSessionTask(planId, taskId, {
            status: 'in_progress',
            input: task.description,
            executorType: assignment.executorType,
            executorId: assignment.executorId,
        });
        this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
            planId,
            status: 'in_progress',
            taskTitle: task.title,
            previousStatus: task.status,
            assignment,
        });
        if (assignment.executorType === 'employee') {
            await this.orchestrationTaskModel
                .updateOne({ _id: taskId }, {
                $set: {
                    status: 'waiting_human',
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Waiting for human assignee',
                    },
                },
            })
                .exec();
            await this.planStatsService.updatePlanSessionTask(planId, taskId, {
                status: 'waiting_human',
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
                planId,
                status: 'waiting_human',
                taskTitle: task.title,
                previousStatus: 'in_progress',
                reason: 'waiting_human_assignee',
            });
            return { status: 'waiting_human' };
        }
        if (assignment.executorType !== 'agent' || !assignment.executorId) {
            await this.markTaskFailed(taskId, 'No agent assigned for execution');
            await this.planStatsService.updatePlanSessionTask(planId, taskId, {
                status: 'failed',
                error: 'No agent assigned for execution',
            });
            await this.orchestrationMessageCenterEventService.publishTaskCompletedEvent({
                planId,
                taskId,
                taskTitle: task.title,
                status: 'failed',
                error: 'No agent assigned for execution',
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.failed', {
                planId,
                status: 'failed',
                taskTitle: task.title,
                reason: 'no_agent_assigned',
            });
            return { status: 'failed', error: 'No agent assigned for execution' };
        }
        let requestedSessionId = `plan-${planId}-${assignment.executorId || 'unassigned'}`;
        let planSessionSnapshot = null;
        const runtimeChannelHint = this.resolveRuntimeChannelHint(runtimeTaskType, task.description);
        const taskPrompt = await this.contextService.buildTaskDescription(task.description, {
            dependencyContext,
            retryHint,
            stepIndex: typeof task.order === 'number' ? task.order : undefined,
            currentTaskTitle: task.title,
            runtimeTaskType,
            planTaskContext,
            executePrompt,
        });
        const agentTaskIdempotencyKey = `orch:${planId}:${taskId}:${new Date().getTime()}`;
        try {
            if (assignment.executorType === 'agent' && assignment.executorId) {
                planSessionSnapshot = await this.agentClientService.getOrCreatePlanSession(planId, assignment.executorId, task.title, {
                    currentTaskId: taskId,
                    orchestrationRunId: options?.orchestrationRunId,
                    collaborationContext,
                });
                if (planSessionSnapshot?.id) {
                    requestedSessionId = String(planSessionSnapshot.id);
                }
            }
            const accepted = await this.agentClientService.createAsyncAgentTask({
                agentId: assignment.executorId,
                prompt: taskPrompt,
                idempotencyKey: agentTaskIdempotencyKey,
                sessionContext: {
                    source: 'orchestration',
                    planId,
                    runId: options?.orchestrationRunId,
                    orchestrationTaskId: taskId,
                    taskTitle: task.title,
                    sessionId: requestedSessionId,
                    collaborationContext,
                    runSummaries: Array.isArray(planSessionSnapshot?.runSummaries) ? planSessionSnapshot.runSummaries : [],
                    dependencies: task.dependencyTaskIds,
                    dependencyContext,
                    runtimeTaskType,
                    runtimeChannelHint,
                    researchTaskKind: runtimeTaskType === 'research' ? 'generic_research' : null,
                    reviewValidationRequired: runtimeTaskType === 'development.review',
                    ...(planProjectId ? { projectId: planProjectId } : {}),
                    ...(projectBinding ? { projectBinding } : {}),
                    preactivatedToolIds: this.resolvePreactivatedToolIds(task),
                },
            });
            const acceptedTaskId = String(accepted?.taskId || '').trim();
            if (!acceptedTaskId) {
                this.logger.error(`[async_agent_task_accept_invalid] planId=${planId} taskId=${taskId} executorId=${assignment.executorId} acceptedStatus=${String(accepted?.status || 'unknown')}`);
                throw new Error('Async agent task accepted response missing taskId');
            }
            await this.orchestrationTaskModel
                .updateOne({ _id: taskId }, {
                $set: {
                    sessionId: requestedSessionId,
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Async agent task submitted',
                        metadata: {
                            asyncAgentTaskId: acceptedTaskId,
                            acceptedStatus: accepted.status,
                        },
                    },
                },
            })
                .exec();
            const execution = await this.waitForAsyncAgentTaskResult(acceptedTaskId);
            const output = String(execution.output || '').trim();
            if (!output && execution.status === 'succeeded') {
                throw new Error('Async agent task succeeded but returned empty output');
            }
            await this.orchestrationTaskModel
                .updateOne({ _id: taskId }, {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    sessionId: execution.sessionId || requestedSessionId,
                    result: {
                        summary: 'Task executed by agent',
                        output,
                    },
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Task execution completed',
                    },
                },
            })
                .exec();
            await this.planStatsService.updatePlanSessionTask(planId, taskId, {
                status: 'completed',
                output,
                error: undefined,
                agentSessionId: execution.sessionId || requestedSessionId,
                agentRunId: execution.runId,
            });
            await this.orchestrationMessageCenterEventService.publishTaskCompletedEvent({
                planId,
                taskId,
                taskTitle: task.title,
                status: 'completed',
                summary: output.slice(0, 300),
            });
            await this.appendSubtaskOutputToParentTask({
                planId,
                subtaskId: taskId,
                subtaskTitle: task.title,
                parentTaskId: String(task.parentTaskId || '').trim() || undefined,
                output,
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
                planId,
                status: 'completed',
                taskTitle: task.title,
                senderAgentId: assignment.executorId,
                previousStatus: 'in_progress',
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.completed', {
                planId,
                status: 'completed',
                taskTitle: task.title,
                senderAgentId: assignment.executorId,
                output,
                agentSessionId: execution.sessionId || requestedSessionId,
                agentRunId: execution.runId,
                asyncAgentTaskId: execution.agentTaskId,
            });
            return { status: 'completed', result: output };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown execution error';
            await this.markTaskFailed(taskId, message);
            await this.planStatsService.updatePlanSessionTask(planId, taskId, {
                status: 'failed',
                error: message,
            });
            await this.orchestrationMessageCenterEventService.publishTaskCompletedEvent({
                planId,
                taskId,
                taskTitle: task.title,
                status: 'failed',
                error: message,
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
                planId,
                status: 'failed',
                taskTitle: task.title,
                senderAgentId: assignment.executorId,
                previousStatus: 'in_progress',
                error: message,
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.exception', {
                planId,
                status: 'failed',
                taskTitle: task.title,
                senderAgentId: assignment.executorId,
                error: message,
            });
            this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.failed', {
                planId,
                status: 'failed',
                taskTitle: task.title,
                senderAgentId: assignment.executorId,
                error: message,
            });
            return { status: 'failed', error: message };
        }
    }
    async executeRunTaskNode(runId, runTask) {
        const runTaskId = this.getEntityId(runTask);
        if (await this.isRunCancelled(runId)) {
            await this.markRunTaskCancelled(runTaskId, 'Run cancelled by user');
            return { status: 'cancelled', error: 'Run cancelled by user' };
        }
        const assignment = runTask.assignment || { executorType: 'unassigned' };
        const persistedRuntimeTaskType = this.contextService.normalizeRuntimeTaskTypeOverride(runTask.runtimeTaskType);
        const runtimeTaskType = persistedRuntimeTaskType || 'general';
        const dependencyContext = await this.contextService.buildRunDependencyContext(runId, runTask.dependencyTaskIds || []);
        const retryHint = this.contextService.getRetryFailureHint(runTask);
        const stepOrder = typeof runTask.order === 'number' ? Number(runTask.order) : undefined;
        const skillActivation = await this.loadPlanSkillActivation(runTask.planId);
        const runTaskProjectId = String(runTask.projectId || '').trim() || undefined;
        const runPlanProjectId = runTaskProjectId || (await this.resolvePlanProjectId(runTask.planId));
        const runProjectBinding = await this.resolveProjectBinding(runPlanProjectId, runTask.planId);
        const collaborationContext = this.contextService.buildOrchestrationCollaborationContext(runTask, {
            dependencyContext,
            executorAgentId: assignment.executorType === 'agent' ? assignment.executorId : undefined,
            ...(skillActivation ? { skillActivation } : {}),
            ...(runPlanProjectId ? { projectId: runPlanProjectId } : {}),
            ...(runProjectBinding ? { projectBinding: runProjectBinding } : {}),
        });
        const planTaskContext = await this.loadRunTaskContext(runId, runTask.planId);
        const executePrompt = await this.loadPlanStepExecutePrompt(runTask.planId, stepOrder);
        await this.orchestrationRunTaskModel
            .updateOne({ _id: runTaskId }, {
            $set: {
                status: 'in_progress',
                startedAt: new Date(),
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Run task execution started',
                    metadata: assignment,
                },
            },
        })
            .exec();
        this.planEventStreamService.emitPlanStreamEvent(runTask.planId, 'run.task.started', {
            runId,
            runTaskId,
            sourceTaskId: runTask.sourceTaskId,
        });
        if (assignment.executorType === 'employee') {
            await this.markRunTaskWaitingHuman(runTaskId, 'Waiting for human assignee');
            this.planEventStreamService.emitPlanStreamEvent(runTask.planId, 'run.task.updated', {
                runId,
                runTaskId,
                status: 'waiting_human',
            });
            return { status: 'waiting_human' };
        }
        if (assignment.executorType !== 'agent' || !assignment.executorId) {
            await this.markRunTaskFailed(runTaskId, 'No agent assigned for execution');
            this.planEventStreamService.emitPlanStreamEvent(runTask.planId, 'run.task.failed', {
                runId,
                runTaskId,
                error: 'No agent assigned for execution',
            });
            return { status: 'failed', error: 'No agent assigned for execution' };
        }
        let requestedSessionId = `run-${runId}-${assignment.executorId || 'unassigned'}`;
        let planSessionSnapshot = null;
        const runtimeChannelHint = this.resolveRuntimeChannelHint(runtimeTaskType, runTask.description);
        const taskPrompt = await this.contextService.buildTaskDescription(runTask.description, {
            dependencyContext,
            retryHint,
            stepIndex: typeof runTask.order === 'number' ? runTask.order : undefined,
            currentTaskTitle: runTask.title,
            runtimeTaskType,
            planTaskContext,
            executePrompt,
        });
        const agentTaskIdempotencyKey = `orch-run:${runId}:${runTaskId}:${new Date().getTime()}`;
        try {
            if (assignment.executorType === 'agent' && assignment.executorId) {
                planSessionSnapshot = await this.agentClientService.getOrCreatePlanSession(runTask.planId, assignment.executorId, runTask.title, {
                    currentTaskId: runTaskId,
                    orchestrationRunId: runId,
                    collaborationContext,
                });
                if (planSessionSnapshot?.id) {
                    requestedSessionId = String(planSessionSnapshot.id);
                }
            }
            const accepted = await this.agentClientService.createAsyncAgentTask({
                agentId: assignment.executorId,
                prompt: taskPrompt,
                idempotencyKey: agentTaskIdempotencyKey,
                sessionContext: {
                    source: 'orchestration',
                    planId: runTask.planId,
                    runId,
                    orchestrationRunTaskId: runTaskId,
                    sourceTaskId: runTask.sourceTaskId,
                    taskTitle: runTask.title,
                    sessionId: requestedSessionId,
                    collaborationContext,
                    runSummaries: Array.isArray(planSessionSnapshot?.runSummaries) ? planSessionSnapshot.runSummaries : [],
                    dependencies: runTask.dependencyTaskIds,
                    dependencyContext,
                    runtimeTaskType,
                    runtimeChannelHint,
                    researchTaskKind: runtimeTaskType === 'research' ? 'generic_research' : null,
                    reviewValidationRequired: runtimeTaskType === 'development.review',
                    preactivatedToolIds: this.resolvePreactivatedToolIds(runTask),
                    ...(runPlanProjectId ? { projectId: runPlanProjectId } : {}),
                    ...(runProjectBinding ? { projectBinding: runProjectBinding } : {}),
                },
            });
            const acceptedTaskId = String(accepted?.taskId || '').trim();
            if (!acceptedTaskId) {
                this.logger.error(`[async_agent_task_accept_invalid] planId=${runTask.planId} runId=${runId} runTaskId=${runTaskId} executorId=${assignment.executorId} acceptedStatus=${String(accepted?.status || 'unknown')}`);
                throw new Error('Async agent task accepted response missing taskId');
            }
            await this.orchestrationRunTaskModel
                .updateOne({ _id: runTaskId }, {
                $set: {
                    sessionId: requestedSessionId,
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Async agent task submitted',
                        metadata: {
                            asyncAgentTaskId: acceptedTaskId,
                            acceptedStatus: accepted.status,
                        },
                    },
                },
            })
                .exec();
            const execution = await this.waitForAsyncAgentTaskResult(acceptedTaskId, runId);
            const output = String(execution.output || '').trim();
            if (!output && execution.status === 'succeeded') {
                throw new Error('Async agent task succeeded but returned empty output');
            }
            await this.orchestrationRunTaskModel
                .updateOne({ _id: runTaskId }, {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    sessionId: execution.sessionId || requestedSessionId,
                    result: {
                        summary: output.slice(0, 500),
                        output,
                    },
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Run task execution completed',
                    },
                },
            })
                .exec();
            this.planEventStreamService.emitPlanStreamEvent(runTask.planId, 'run.task.completed', {
                runId,
                runTaskId,
                sourceTaskId: runTask.sourceTaskId,
            });
            return { status: 'completed', result: output };
        }
        catch (error) {
            if (this.isRunCancelledError(error) || await this.isRunCancelled(runId)) {
                await this.markRunTaskCancelled(runTaskId, 'Run cancelled by user');
                this.planEventStreamService.emitPlanStreamEvent(runTask.planId, 'run.task.updated', {
                    runId,
                    runTaskId,
                    sourceTaskId: runTask.sourceTaskId,
                    status: 'cancelled',
                });
                return { status: 'cancelled', error: 'Run cancelled by user' };
            }
            const message = error instanceof Error ? error.message : 'Unknown execution failure';
            await this.markRunTaskFailed(runTaskId, message);
            this.planEventStreamService.emitPlanStreamEvent(runTask.planId, 'run.task.failed', {
                runId,
                runTaskId,
                sourceTaskId: runTask.sourceTaskId,
                error: message,
            });
            return { status: 'failed', error: message };
        }
    }
    async markRunTaskFailed(runTaskId, errorMessage) {
        await this.orchestrationRunTaskModel
            .updateOne({ _id: runTaskId }, {
            $set: {
                status: 'failed',
                completedAt: new Date(),
                result: {
                    error: errorMessage,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'error',
                    message: errorMessage,
                },
            },
        })
            .exec();
    }
    async markRunTaskCancelled(runTaskId, reason) {
        await this.orchestrationRunTaskModel
            .updateOne({ _id: runTaskId }, {
            $set: {
                status: 'cancelled',
                completedAt: new Date(),
                result: {
                    error: reason,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'warn',
                    message: reason,
                },
            },
        })
            .exec();
    }
    async markTaskFailed(taskId, errorMessage) {
        await this.orchestrationTaskModel
            .updateOne({ _id: taskId }, {
            $set: {
                status: 'failed',
                completedAt: new Date(),
                result: {
                    error: errorMessage,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'error',
                    message: errorMessage,
                },
            },
        })
            .exec();
    }
    async markRunTaskWaitingHuman(runTaskId, reason, output) {
        await this.orchestrationRunTaskModel
            .updateOne({ _id: runTaskId }, {
            $set: {
                status: 'waiting_human',
                result: {
                    summary: 'Waiting for human confirmation',
                    output,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'warn',
                    message: reason,
                },
            },
        })
            .exec();
    }
    async markTaskWaitingHuman(taskId, reason, output) {
        await this.orchestrationTaskModel
            .updateOne({ _id: taskId }, {
            $set: {
                status: 'waiting_human',
                result: {
                    summary: 'Waiting for human confirmation',
                    output,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'warn',
                    message: reason,
                },
            },
        })
            .exec();
    }
    async appendSubtaskOutputToParentTask(params) {
        const { planId, subtaskId, subtaskTitle, parentTaskId, output } = params;
        if (!parentTaskId || !output.trim()) {
            return;
        }
        const parentTask = await this.orchestrationTaskModel.findOne({ _id: parentTaskId, planId }).exec();
        if (!parentTask) {
            return;
        }
        const markerStart = `<!--subtask:${subtaskId}:start-->`;
        const markerEnd = `<!--subtask:${subtaskId}:end-->`;
        const escapedStart = markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedEnd = markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingOutput = String(parentTask.result?.output || '').trim();
        const cleanedOutput = existingOutput
            ? existingOutput.replace(new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'g'), '').trim()
            : '';
        const normalizedSubtaskTitle = String(subtaskTitle || '').trim() || subtaskId;
        const appendedBlock = `${markerStart}\n[Subtask ${normalizedSubtaskTitle}]\n${output.trim()}\n${markerEnd}`;
        const nextOutput = cleanedOutput ? `${cleanedOutput}\n\n${appendedBlock}` : appendedBlock;
        await this.orchestrationTaskModel
            .updateOne({ _id: parentTaskId }, {
            $set: {
                result: {
                    ...(parentTask.result || {}),
                    output: nextOutput,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Subtask output aggregated to parent task',
                    metadata: {
                        subtaskId,
                    },
                },
            },
        })
            .exec();
        await this.planStatsService.updatePlanSessionTask(planId, parentTaskId, {
            output: nextOutput,
        });
        this.planEventStreamService.emitTaskLifecycleEvent(parentTaskId, 'task.updated', {
            planId,
            taskId: parentTaskId,
            reason: 'subtask_output_aggregated',
            subtaskId,
        });
    }
    async waitForAsyncAgentTaskResult(agentTaskId, runId) {
        if (this.asyncAgentTaskSseEnabled && !runId) {
            try {
                const terminal = await this.agentClientService.waitForAsyncAgentTaskCompletionBySse(agentTaskId, {
                    timeoutMs: this.asyncAgentTaskWaitTimeoutMs,
                });
                if (terminal.status === 'succeeded') {
                    return {
                        status: 'succeeded',
                        output: String(terminal.output || '').trim(),
                        runId: terminal.runId,
                        sessionId: terminal.sessionId,
                        agentTaskId: String(agentTaskId || '').trim(),
                    };
                }
                throw new Error(String(terminal.error || `Async agent task ${terminal.status}`));
            }
            catch {
            }
        }
        const startedAt = Date.now();
        const normalizedTaskId = String(agentTaskId || '').trim();
        if (!normalizedTaskId) {
            throw new Error('Invalid async agent task id');
        }
        while (Date.now() - startedAt <= this.asyncAgentTaskWaitTimeoutMs) {
            if (runId && await this.isRunCancelled(runId)) {
                throw new Error(OrchestrationExecutionEngineService_1.RUN_CANCELLED_ERROR);
            }
            const snapshot = await this.agentClientService.getAsyncAgentTask(normalizedTaskId);
            const status = String(snapshot?.status || '').toLowerCase();
            if (status === 'succeeded') {
                return {
                    status: 'succeeded',
                    output: this.resolveAsyncTaskOutput(snapshot),
                    runId: snapshot?.runId,
                    sessionId: snapshot?.sessionId,
                    agentTaskId: normalizedTaskId,
                };
            }
            if (status === 'failed') {
                throw new Error(String(snapshot?.error || 'Async agent task failed'));
            }
            if (status === 'cancelled') {
                throw new Error(String(snapshot?.error || 'Async agent task cancelled'));
            }
            await this.sleep(this.asyncAgentTaskPollIntervalMs);
        }
        throw new Error(`Async agent task wait timeout: ${normalizedTaskId}`);
    }
    resolveAsyncTaskOutput(snapshot) {
        const summary = snapshot?.resultSummary || {};
        const directResponse = summary.response;
        if (typeof directResponse === 'string' && directResponse.trim()) {
            return directResponse;
        }
        const nested = summary.result;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            const nestedResponse = nested.response;
            if (typeof nestedResponse === 'string' && nestedResponse.trim()) {
                return nestedResponse;
            }
        }
        return '';
    }
    resolveRuntimeChannelHint(runtimeTaskType, description) {
        const OPENCODE_ELIGIBLE_TASK_TYPES = new Set([
            'development.plan',
            'development.exec',
            'development.review',
        ]);
        if (!OPENCODE_ELIGIBLE_TASK_TYPES.has(runtimeTaskType)) {
            return 'native';
        }
        if (runtimeTaskType === 'development.review') {
            return 'opencode';
        }
        const normalizedDescription = String(description || '').toLowerCase();
        const requiresInternalTools = normalizedDescription.includes('builtin.sys-mg.')
            || normalizedDescription.includes('repo-writer')
            || normalizedDescription.includes('repo-read')
            || normalizedDescription.includes('save-template')
            || normalizedDescription.includes('save-prompt-template');
        return requiresInternalTools ? 'native' : 'opencode';
    }
    resolvePreactivatedToolIds(task) {
        const requiredTools = Array.isArray(task?.requiredTools)
            ? task.requiredTools.map((toolId) => String(toolId || '').trim()).filter(Boolean)
            : [];
        const normalized = Array.from(new Set(requiredTools));
        return normalized.length > 0 ? normalized : undefined;
    }
    async sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    async isRunCancelled(runId) {
        const run = await this.orchestrationRunModel.findOne({ _id: runId }).select({ status: 1 }).lean().exec();
        return Boolean(run && run.status === 'cancelled');
    }
    async loadRunTaskContext(runId, planId) {
        const run = await this.orchestrationRunModel
            .findOne({ _id: runId })
            .select({ metadata: 1 })
            .lean()
            .exec();
        const runTaskContext = this.contextService.resolvePlanTaskContextFromMetadata(run?.metadata);
        if (Object.keys(runTaskContext).length > 0) {
            return runTaskContext;
        }
        return this.loadPlanTaskContext(planId);
    }
    async loadPlanSkillActivation(planId) {
        const plan = await this.orchestrationPlanModel
            .findOne({ _id: planId })
            .select({ 'strategy.skillActivation': 1 })
            .lean()
            .exec();
        const sa = plan?.strategy?.skillActivation;
        if (!sa || (sa.mode !== 'standard' && sa.mode !== 'precise')) {
            return undefined;
        }
        return { mode: sa.mode, skillIds: sa.skillIds };
    }
    async loadPlanTaskContext(planId) {
        const plan = await this.orchestrationPlanModel
            .findOne({ _id: planId })
            .select({ metadata: 1 })
            .lean()
            .exec();
        return this.contextService.resolvePlanTaskContextFromMetadata(plan?.metadata);
    }
    async loadPlanStepExecutePrompt(planId, stepOrder) {
        if (!Number.isInteger(stepOrder) || Number(stepOrder) < 0) {
            return undefined;
        }
        const plan = await this.orchestrationPlanModel
            .findOne({ _id: planId })
            .select({ metadata: 1 })
            .lean()
            .exec();
        const metadata = (plan?.metadata || {});
        const outline = Array.isArray(metadata.outline) ? metadata.outline : [];
        const orderAsIs = Number(stepOrder);
        const orderPlusOne = orderAsIs + 1;
        const outlineStep = outline.find((item) => Number(item.step) === orderAsIs)
            || outline.find((item) => Number(item.step) === orderPlusOne);
        const phasePrompts = outlineStep?.phasePrompts;
        if (!phasePrompts || typeof phasePrompts !== 'object' || Array.isArray(phasePrompts)) {
            return undefined;
        }
        const executePrompt = String(phasePrompts.execute || '').trim();
        return executePrompt || undefined;
    }
    isRunCancelledError(error) {
        if (!(error instanceof Error)) {
            return false;
        }
        return error.message === OrchestrationExecutionEngineService_1.RUN_CANCELLED_ERROR;
    }
    async resolveProjectBinding(projectId, planId) {
        if (!projectId) {
            return null;
        }
        const cacheKey = planId || projectId;
        if (this.projectBindingCache.has(cacheKey)) {
            return this.projectBindingCache.get(cacheKey) ?? null;
        }
        try {
            let project = await this.rdProjectModel
                .findOne({ _id: projectId })
                .select({ _id: 1, localPath: 1, opencodeProjectPath: 1, opencodeBindingIds: 1, sourceType: 1 })
                .lean()
                .exec();
            if (!project) {
                project = await this.rdProjectModel
                    .findOne({ incubationProjectId: new mongoose_2.Types.ObjectId(projectId), sourceType: 'local' })
                    .select({ _id: 1, localPath: 1, opencodeProjectPath: 1, opencodeBindingIds: 1, sourceType: 1 })
                    .lean()
                    .exec();
                if (project) {
                    this.logger.log(`[resolveProjectBinding] resolved via incubationProjectId fallback: projectId=${projectId}`);
                }
            }
            if (!project) {
                this.logger.warn(`[resolveProjectBinding] ei_project not found: projectId=${projectId}`);
                this.projectBindingCache.set(cacheKey, null);
                return null;
            }
            const binding = {
                localPath: project.localPath || undefined,
                opencodeProjectPath: project.opencodeProjectPath || undefined,
                localProjectId: project.sourceType === 'local' && project._id ? String(project._id) : undefined,
            };
            if (project.sourceType === 'local' && !binding.opencodeProjectPath && Array.isArray(project.opencodeBindingIds) && project.opencodeBindingIds.length > 0) {
                const opencodeProject = await this.rdProjectModel
                    .findOne({ _id: project.opencodeBindingIds[0] })
                    .select({ opencodeProjectPath: 1 })
                    .lean()
                    .exec();
                if (opencodeProject) {
                    binding.opencodeProjectPath = binding.opencodeProjectPath || opencodeProject.opencodeProjectPath || undefined;
                }
            }
            if (!binding.localPath && !binding.opencodeProjectPath) {
                this.projectBindingCache.set(cacheKey, null);
                return null;
            }
            this.logger.log(`[resolveProjectBinding] projectId=${projectId} localProjectId=${binding.localProjectId || '-'} localPath=${binding.localPath || '-'} opencodePath=${binding.opencodeProjectPath || '-'}`);
            this.projectBindingCache.set(cacheKey, binding);
            return binding;
        }
        catch (err) {
            this.logger.warn(`[resolveProjectBinding] failed to resolve projectId=${projectId}: ${err.message}`);
            this.projectBindingCache.set(cacheKey, null);
            return null;
        }
    }
    async resolvePlanProjectId(planId) {
        const plan = await this.orchestrationPlanModel
            .findOne({ _id: planId })
            .select({ projectId: 1 })
            .lean()
            .exec();
        return String(plan?.projectId || '').trim() || undefined;
    }
    getEntityId(entity) {
        if (entity.id) {
            return String(entity.id);
        }
        if (entity._id) {
            return entity._id.toString();
        }
        return '';
    }
};
exports.OrchestrationExecutionEngineService = OrchestrationExecutionEngineService;
OrchestrationExecutionEngineService.RUN_CANCELLED_ERROR = '__RUN_CANCELLED_BY_USER__';
exports.OrchestrationExecutionEngineService = OrchestrationExecutionEngineService = OrchestrationExecutionEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_run_task_schema_1.OrchestrationRunTask.name)),
    __param(3, (0, mongoose_1.InjectModel)(orchestration_run_schema_1.OrchestrationRun.name)),
    __param(4, (0, mongoose_1.InjectModel)(ei_project_schema_1.RdProject.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        plan_event_stream_service_1.PlanEventStreamService,
        orchestration_context_service_1.OrchestrationContextService,
        plan_stats_service_1.PlanStatsService,
        orchestration_message_center_event_service_1.OrchestrationMessageCenterEventService])
], OrchestrationExecutionEngineService);
//# sourceMappingURL=orchestration-execution-engine.service.js.map