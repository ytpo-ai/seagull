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
exports.TaskLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const orchestration_run_schema_1 = require("../../../shared/schemas/orchestration-run.schema");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_run_task_schema_1 = require("../../../shared/schemas/orchestration-run-task.schema");
const agent_schema_1 = require("../../../../apps/agents/src/schemas/agent.schema");
const employee_schema_1 = require("../../../shared/schemas/employee.schema");
const role_tier_1 = require("../../../shared/role-tier");
const plan_execution_service_1 = require("./plan-execution.service");
const plan_stats_service_1 = require("./plan-stats.service");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const task_management_service_1 = require("./task-management.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
const orchestration_execution_engine_service_1 = require("./orchestration-execution-engine.service");
const orchestration_message_center_event_service_1 = require("./orchestration-message-center-event.service");
let TaskLifecycleService = class TaskLifecycleService {
    constructor(orchestrationTaskModel, orchestrationRunTaskModel, orchestrationRunModel, orchestrationPlanModel, agentModel, employeeModel, planExecutionService, planStatsService, planEventStreamService, taskManagementService, contextService, executionEngineService, orchestrationMessageCenterEventService) {
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.orchestrationRunTaskModel = orchestrationRunTaskModel;
        this.orchestrationRunModel = orchestrationRunModel;
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.agentModel = agentModel;
        this.employeeModel = employeeModel;
        this.planExecutionService = planExecutionService;
        this.planStatsService = planStatsService;
        this.planEventStreamService = planEventStreamService;
        this.taskManagementService = taskManagementService;
        this.contextService = contextService;
        this.executionEngineService = executionEngineService;
        this.orchestrationMessageCenterEventService = orchestrationMessageCenterEventService;
    }
    async reassignTask(taskId, dto) {
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        await this.assertTaskPlanEditable(task, 'reassign');
        const normalizedExecutorId = dto.executorId?.trim() || undefined;
        const requiresExplicitExecutor = dto.executorType !== 'unassigned';
        const hasExplicitExecutor = Boolean(normalizedExecutorId);
        if (dto.sourceAgentId && requiresExplicitExecutor && hasExplicitExecutor) {
            const sourceTier = await this.resolveAgentTierById(dto.sourceAgentId);
            if (!sourceTier) {
                throw this.buildTierGuardException('tier_resolution_required', 'Cannot resolve source agent tier', {
                    sourceAgentId: dto.sourceAgentId,
                });
            }
            const targetTier = await this.resolveAssignmentTargetTier(dto.executorType, normalizedExecutorId);
            if (!targetTier) {
                throw this.buildTierGuardException('tier_resolution_required', 'Cannot resolve assignment target tier', {
                    executorType: dto.executorType,
                    executorId: normalizedExecutorId,
                });
            }
            if (!(0, role_tier_1.canDelegateAcrossTier)(sourceTier, targetTier)) {
                throw this.buildTierGuardException('delegation_direction_forbidden', 'Delegation direction is not allowed by tier governance', {
                    sourceAgentId: dto.sourceAgentId,
                    sourceTier,
                    targetTier,
                    executorType: dto.executorType,
                    executorId: normalizedExecutorId,
                });
            }
        }
        const nextStatus = requiresExplicitExecutor && hasExplicitExecutor ? 'assigned' : 'pending';
        const nextExecutorId = dto.executorType === 'unassigned' ? undefined : normalizedExecutorId;
        const updated = await this.orchestrationTaskModel
            .findOneAndUpdate({ _id: taskId }, {
            $set: {
                assignment: {
                    executorType: dto.executorType,
                    executorId: nextExecutorId,
                    reason: dto.reason,
                },
                status: nextStatus,
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task reassigned',
                    metadata: {
                        executorType: dto.executorType,
                        executorId: nextExecutorId,
                        reason: dto.reason,
                        sourceAgentId: dto.sourceAgentId,
                    },
                },
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Task not found');
        }
        const planId = task.planId;
        if (planId) {
            await this.planStatsService.updatePlanSessionTask(planId, taskId, {
                status: updated.status,
                executorType: dto.executorType,
                executorId: nextExecutorId,
            });
        }
        this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
            planId,
            status: updated.status,
            taskTitle: updated.title,
            previousStatus: task.status,
            assignment: updated.assignment,
            reason: dto.reason,
        });
        return updated;
    }
    async completeHumanTask(taskId, dto) {
        const runTask = await this.orchestrationRunTaskModel.findOne({ _id: taskId }).exec();
        if (runTask) {
            if (runTask.assignment.executorType !== 'employee') {
                throw new common_1.BadRequestException('Only employee tasks can be completed manually');
            }
            const updatedRunTask = await this.orchestrationRunTaskModel
                .findOneAndUpdate({ _id: taskId }, {
                $set: {
                    status: 'completed',
                    completedAt: new Date(),
                    result: {
                        summary: dto.summary || 'Completed by human assignee',
                        output: dto.output,
                    },
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Human run task marked as completed',
                    },
                },
            }, { new: true })
                .exec();
            if (!updatedRunTask) {
                throw new common_1.NotFoundException('Task not found');
            }
            const runId = updatedRunTask.runId;
            const runTasks = await this.orchestrationRunTaskModel.find({ runId }).exec();
            const stats = this.computeRunStats(runTasks);
            const status = this.deriveRunStatus(runTasks);
            await this.orchestrationRunModel
                .updateOne({ _id: runId }, {
                $set: {
                    stats,
                    status,
                    ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {}),
                },
            })
                .exec();
            this.planEventStreamService.emitPlanStreamEvent(updatedRunTask.planId, 'run.task.completed', {
                runId,
                runTaskId: taskId,
            });
            return updatedRunTask;
        }
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        await this.assertTaskPlanEditable(task, 'complete-human');
        if (task.assignment.executorType !== 'employee') {
            throw new common_1.BadRequestException('Only employee tasks can be completed manually');
        }
        const updated = await this.orchestrationTaskModel
            .findOneAndUpdate({ _id: taskId }, {
            $set: {
                status: 'completed',
                completedAt: new Date(),
                result: {
                    summary: dto.summary || 'Completed by human assignee',
                    output: dto.output,
                },
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Human task marked as completed',
                },
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Task not found');
        }
        const planId = task.planId;
        if (planId) {
            await this.planStatsService.updatePlanSessionTask(planId, taskId, {
                status: 'completed',
                output: dto.output || dto.summary || 'Completed by human assignee',
                error: undefined,
            });
            await this.appendSubtaskOutputToParentTask({
                planId,
                subtaskId: taskId,
                subtaskTitle: updated.title,
                parentTaskId: String(updated.parentTaskId || '').trim() || undefined,
                output: String(dto.output || dto.summary || '').trim(),
            });
            await this.planStatsService.refreshPlanStats(planId);
        }
        this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
            planId,
            status: 'completed',
            taskTitle: updated.title,
            previousStatus: task.status,
        });
        this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.completed', {
            planId,
            status: 'completed',
            taskTitle: updated.title,
            completedBy: 'human',
        });
        if (planId) {
            await this.orchestrationMessageCenterEventService.publishTaskCompletedEvent({
                planId,
                taskId,
                taskTitle: updated.title,
                status: 'completed',
                summary: String(dto.summary || '').trim() || String(dto.output || '').trim(),
            });
        }
        return updated;
    }
    async retryTask(taskId) {
        const runTask = await this.orchestrationRunTaskModel.findOne({ _id: taskId }).exec();
        if (runTask) {
            if (runTask.status !== 'failed') {
                throw new common_1.BadRequestException('Only failed tasks can be retried');
            }
            const nextStatus = runTask.assignment?.executorType === 'unassigned' ? 'pending' : 'assigned';
            const updatedRunTask = await this.orchestrationRunTaskModel
                .findOneAndUpdate({ _id: taskId }, {
                $set: {
                    status: nextStatus,
                },
                $unset: {
                    startedAt: 1,
                    completedAt: 1,
                    result: 1,
                },
                $push: {
                    runLogs: {
                        timestamp: new Date(),
                        level: 'info',
                        message: 'Run task retried manually',
                    },
                },
            }, { new: true })
                .exec();
            if (!updatedRunTask) {
                throw new common_1.NotFoundException('Task not found');
            }
            await this.executionEngineService.executeRunTaskNode(updatedRunTask.runId, updatedRunTask);
            const runTasks = await this.orchestrationRunTaskModel
                .find({ runId: updatedRunTask.runId })
                .exec();
            const stats = this.computeRunStats(runTasks);
            const status = this.deriveRunStatus(runTasks);
            await this.orchestrationRunModel
                .updateOne({ _id: updatedRunTask.runId }, {
                $set: {
                    stats,
                    status,
                    ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {}),
                },
            })
                .exec();
            const refreshed = await this.orchestrationRunTaskModel.findOne({ _id: taskId }).exec();
            return {
                task: refreshed,
                run: {
                    accepted: true,
                    planId: updatedRunTask.planId,
                    status: 'accepted',
                },
            };
        }
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        await this.assertTaskPlanEditable(task, 'retry');
        if (task.status !== 'failed') {
            throw new common_1.BadRequestException('Only failed tasks can be retried');
        }
        const planId = this.requirePlanId(task);
        const nextStatus = task.assignment?.executorType === 'unassigned' ? 'pending' : 'assigned';
        const updatedTask = await this.orchestrationTaskModel
            .findOneAndUpdate({ _id: taskId }, {
            $set: {
                status: nextStatus,
            },
            $unset: {
                startedAt: 1,
                completedAt: 1,
                result: 1,
            },
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task retried manually',
                },
            },
        }, { new: true })
            .exec();
        if (!updatedTask) {
            throw new common_1.NotFoundException('Task not found');
        }
        await this.planStatsService.updatePlanSessionTask(planId, taskId, {
            status: nextStatus,
            output: undefined,
            error: undefined,
        });
        await this.planStatsService.refreshPlanStats(planId);
        this.planEventStreamService.emitTaskLifecycleEvent(taskId, 'task.status.changed', {
            planId,
            status: nextStatus,
            taskTitle: updatedTask.title,
            previousStatus: task.status,
            reason: 'manual_retry',
        });
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).select({ strategy: 1 }).lean().exec();
        const isOnceRunMode = String(plan?.strategy?.runMode || 'multi').trim().toLowerCase() === 'once';
        if (isOnceRunMode) {
            await this.executionEngineService.executeTaskNode(planId, updatedTask);
            const refreshedTask = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
            return {
                task: refreshedTask || updatedTask,
                run: {
                    accepted: true,
                    planId,
                    status: 'accepted',
                },
            };
        }
        const run = await this.planExecutionService.runPlanAsync(planId, { continueOnFailure: true });
        return {
            task: updatedTask,
            run,
        };
    }
    async debugTaskStep(taskId, dto) {
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        await this.assertTaskPlanEditable(task, 'debug');
        const planId = this.requirePlanId(task);
        if (task.status === 'in_progress') {
            throw new common_1.BadRequestException('Task is already running');
        }
        const dependencyTasks = await this.orchestrationTaskModel
            .find({ _id: { $in: task.dependencyTaskIds || [] }, planId })
            .select({ _id: 1, status: 1, title: 1 })
            .exec();
        const unmetDependencies = dependencyTasks.filter((dep) => dep.status !== 'completed');
        if (unmetDependencies.length) {
            const names = unmetDependencies.map((dep) => dep.title).join(', ');
            throw new common_1.BadRequestException(`Cannot debug step before dependencies are completed: ${names}`);
        }
        const shouldUpdateDraft = dto.title !== undefined || dto.description !== undefined;
        if (shouldUpdateDraft) {
            await this.taskManagementService.updateTaskDraft(taskId, dto);
        }
        const normalizedRuntimeTaskType = this.contextService.normalizeRuntimeTaskTypeOverride(dto.runtimeTaskTypeOverride);
        if (dto.runtimeTaskTypeOverride !== undefined) {
            await this.orchestrationTaskModel
                .updateOne({ _id: taskId }, normalizedRuntimeTaskType
                ? { $set: { runtimeTaskType: normalizedRuntimeTaskType } }
                : { $unset: { runtimeTaskType: 1 } })
                .exec();
        }
        const nextStatus = task.assignment?.executorType === 'unassigned' ? 'pending' : 'assigned';
        await this.orchestrationTaskModel
            .updateOne({ _id: taskId }, {
            $set: {
                status: nextStatus,
            },
            ...(dto.resetResult === false
                ? {}
                : {
                    $unset: {
                        startedAt: 1,
                        completedAt: 1,
                        result: 1,
                    },
                }),
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Step debug run requested',
                },
            },
        })
            .exec();
        const refreshedTask = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!refreshedTask) {
            throw new common_1.NotFoundException('Task not found');
        }
        const debugRunId = `debug-${Date.now()}`;
        const execution = await this.executionEngineService.executeTaskNode(planId, refreshedTask, {
            orchestrationRunId: debugRunId,
            runtimeTaskTypeOverride: dto.runtimeTaskTypeOverride,
        });
        await this.planStatsService.refreshPlanStats(planId);
        const allTasks = await this.orchestrationTaskModel.find({ planId }).exec();
        const nextPlanStatus = this.derivePlanStatus(allTasks);
        await this.planStatsService.setPlanStatus(planId, nextPlanStatus);
        await this.planStatsService.setPlanSessionStatus(planId, nextPlanStatus);
        const latestTask = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!latestTask) {
            throw new common_1.NotFoundException('Task not found');
        }
        return {
            task: latestTask,
            execution,
        };
    }
    async executeStandaloneTask(taskId) {
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        const scopeId = task.planId || '';
        return this.executionEngineService.executeTaskNode(scopeId, task);
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
    computeRunStats(tasks) {
        return {
            totalTasks: tasks.length,
            completedTasks: tasks.filter((task) => task.status === 'completed').length,
            failedTasks: tasks.filter((task) => task.status === 'failed').length,
            waitingHumanTasks: tasks.filter((task) => task.status === 'waiting_human').length,
        };
    }
    deriveRunStatus(tasks) {
        if (!tasks.length) {
            return 'failed';
        }
        if (tasks.every((task) => task.status === 'completed')) {
            return 'completed';
        }
        const hasFailed = tasks.some((task) => task.status === 'failed');
        if (hasFailed) {
            return 'failed';
        }
        if (tasks.some((task) => task.status === 'in_progress')) {
            return 'running';
        }
        if (tasks.some((task) => task.status === 'waiting_human')) {
            return 'running';
        }
        if (tasks.some((task) => task.status === 'pending' || task.status === 'assigned' || task.status === 'blocked')) {
            return 'running';
        }
        return 'failed';
    }
    derivePlanStatus(tasks) {
        if (!tasks.length) {
            return 'draft';
        }
        return 'planned';
    }
    requirePlanId(task) {
        if (!task.planId) {
            throw new common_1.BadRequestException('Task is not associated with orchestration plan');
        }
        return task.planId;
    }
    async assertTaskPlanEditable(task, action) {
        const planId = String(task.planId || '').trim();
        if (!planId) {
            return;
        }
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).lean().exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const normalizedStatus = this.planStatsService.normalizePlanStatus(plan.status, plan.taskIds?.length);
        if (normalizedStatus === 'draft' || normalizedStatus === 'planned' || normalizedStatus === 'drafting') {
            return;
        }
        throw new common_1.BadRequestException(`Plan in "${normalizedStatus}" status cannot ${action}`);
    }
    buildTierGuardException(code, message, detail) {
        return new common_1.BadRequestException({
            code,
            message,
            detail,
        });
    }
    async resolveAgentTierById(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId) {
            return undefined;
        }
        const lookup = { id: normalizedAgentId };
        if (mongoose_2.Types.ObjectId.isValid(normalizedAgentId)) {
            lookup.$or = [{ id: normalizedAgentId }, { _id: new mongoose_2.Types.ObjectId(normalizedAgentId) }];
            delete lookup.id;
        }
        const agent = await this.agentModel.findOne(lookup).select({ tier: 1 }).lean().exec();
        return (0, role_tier_1.normalizeAgentRoleTier)(agent?.tier);
    }
    async resolveEmployeeTierById(employeeId) {
        const normalizedEmployeeId = String(employeeId || '').trim();
        if (!normalizedEmployeeId) {
            return undefined;
        }
        const employee = await this.employeeModel.findOne({ id: normalizedEmployeeId }).select({ tier: 1 }).lean().exec();
        return (0, role_tier_1.normalizeAgentRoleTier)(employee?.tier);
    }
    async resolveAssignmentTargetTier(executorType, executorId) {
        if (executorType === 'agent') {
            return this.resolveAgentTierById(executorId);
        }
        if (executorType === 'employee') {
            return this.resolveEmployeeTierById(executorId);
        }
        return undefined;
    }
};
exports.TaskLifecycleService = TaskLifecycleService;
exports.TaskLifecycleService = TaskLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_run_task_schema_1.OrchestrationRunTask.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_run_schema_1.OrchestrationRun.name)),
    __param(3, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(4, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(5, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        plan_execution_service_1.PlanExecutionService,
        plan_stats_service_1.PlanStatsService,
        plan_event_stream_service_1.PlanEventStreamService,
        task_management_service_1.TaskManagementService,
        orchestration_context_service_1.OrchestrationContextService,
        orchestration_execution_engine_service_1.OrchestrationExecutionEngineService,
        orchestration_message_center_event_service_1.OrchestrationMessageCenterEventService])
], TaskLifecycleService);
//# sourceMappingURL=task-lifecycle.service.js.map