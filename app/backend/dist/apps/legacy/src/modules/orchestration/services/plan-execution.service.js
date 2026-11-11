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
var PlanExecutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanExecutionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const orchestration_run_schema_1 = require("../../../shared/schemas/orchestration-run.schema");
const orchestration_run_task_schema_1 = require("../../../shared/schemas/orchestration-run-task.schema");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const ei_project_schema_1 = require("../../../shared/schemas/ei-project.schema");
const plan_stats_service_1 = require("./plan-stats.service");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
const orchestration_execution_engine_service_1 = require("./orchestration-execution-engine.service");
let PlanExecutionService = PlanExecutionService_1 = class PlanExecutionService {
    constructor(orchestrationPlanModel, orchestrationRunModel, orchestrationRunTaskModel, orchestrationTaskModel, rdProjectModel, planStatsService, planEventStreamService, contextService, executionEngineService) {
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.orchestrationRunModel = orchestrationRunModel;
        this.orchestrationRunTaskModel = orchestrationRunTaskModel;
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.rdProjectModel = rdProjectModel;
        this.planStatsService = planStatsService;
        this.planEventStreamService = planEventStreamService;
        this.contextService = contextService;
        this.executionEngineService = executionEngineService;
        this.logger = new common_1.Logger(PlanExecutionService_1.name);
        this.runningPlans = new Set();
    }
    async runPlan(planId, dto) {
        return this.executePlanRun(planId, 'manual', {
            continueOnFailure: dto.continueOnFailure ?? false,
        });
    }
    async runPlanAsync(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        this.assertManualRunAllowed(plan);
        const runKey = planId;
        if (this.runningPlans.has(runKey)) {
            return {
                accepted: true,
                planId,
                status: 'running',
                alreadyRunning: true,
            };
        }
        this.runningPlans.add(runKey);
        setTimeout(() => {
            this.runPlan(planId, dto)
                .catch(async (error) => {
                const message = error instanceof Error ? error.message : 'Async plan run failed';
                const latestRunningRun = await this.orchestrationRunModel
                    .findOne({ planId, status: 'running' })
                    .sort({ startedAt: -1 })
                    .exec();
                if (latestRunningRun) {
                    await this.orchestrationRunModel
                        .updateOne({ _id: latestRunningRun._id }, {
                        $set: {
                            status: 'failed',
                            error: message,
                            completedAt: new Date(),
                        },
                    })
                        .exec();
                }
                await this.planStatsService.setPlanStatus(planId, 'planned');
                await this.planStatsService.setPlanSessionStatus(planId, 'planned');
                await this.orchestrationPlanModel
                    .updateOne({ _id: planId }, {
                    $set: {
                        metadata: {
                            ...(plan.metadata || {}),
                            asyncRunError: message,
                        },
                    },
                })
                    .exec();
            })
                .finally(() => {
                this.runningPlans.delete(runKey);
            });
        }, 0);
        return {
            accepted: true,
            planId,
            status: 'accepted',
            alreadyRunning: false,
        };
    }
    async executePlanRun(planId, triggerType, options) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (this.isOnceRunMode(plan) && triggerType !== 'autorun') {
            throw new common_1.BadRequestException('Plan strategy.runMode=once only allows execution during task generation');
        }
        const templateTasks = await this.orchestrationTaskModel.find({ planId }).sort({ order: 1 }).exec();
        if (!templateTasks.length) {
            throw new common_1.BadRequestException('Plan has no tasks to run');
        }
        await this.planStatsService.setPlanStatus(planId, 'planned');
        await this.planStatsService.setPlanSessionStatus(planId, 'planned');
        const startedAt = new Date();
        const taskContext = this.contextService.resolvePlanTaskContextFromMetadata((plan.metadata || {}));
        if (plan.projectId && !taskContext.projectId) {
            taskContext.projectId = String(plan.projectId);
            try {
                let project = await this.rdProjectModel
                    .findOne({ _id: plan.projectId })
                    .select({ localPath: 1, name: 1 })
                    .lean()
                    .exec();
                if (!project) {
                    project = await this.rdProjectModel
                        .findOne({ incubationProjectId: new mongoose_2.Types.ObjectId(plan.projectId), sourceType: 'local' })
                        .select({ localPath: 1, name: 1 })
                        .lean()
                        .exec();
                    if (project) {
                        this.logger.log(`[executePlanRun] resolved project via incubationProjectId fallback: ${plan.projectId}`);
                    }
                }
                if (project?.localPath) {
                    taskContext.localProjectPath = project.localPath;
                }
                if (project?.name) {
                    taskContext.projectName = project.name;
                }
            }
            catch (err) {
                this.logger.warn(`[executePlanRun] failed to resolve project for taskContext: ${err.message}`);
            }
        }
        const run = await new this.orchestrationRunModel({
            planId,
            triggerType,
            scheduleId: options?.scheduleId,
            status: 'running',
            startedAt,
            stats: {
                totalTasks: templateTasks.length,
                completedTasks: 0,
                failedTasks: 0,
                waitingHumanTasks: 0,
            },
            metadata: {
                taskContext,
            },
            ...(plan.projectId ? { projectId: plan.projectId } : {}),
        }).save();
        const runId = this.getEntityId(run);
        this.planEventStreamService.emitPlanStreamEvent(planId, 'run.started', {
            planId,
            runId,
            triggerType,
            scheduleId: options?.scheduleId,
            startedAt,
        });
        await this.orchestrationRunTaskModel.insertMany(templateTasks.map((task) => ({
            runId,
            planId,
            sourceTaskId: this.getEntityId(task),
            parentTaskId: task.parentTaskId,
            order: task.order,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.assignment?.executorType === 'unassigned' ? 'pending' : 'assigned',
            assignment: task.assignment,
            dependencyTaskIds: task.dependencyTaskIds || [],
            runtimeTaskType: task.runtimeTaskType,
            runLogs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Run task snapshot created from template task',
                },
            ],
        })));
        try {
            await this.executeRunTasks(plan, runId, {
                continueOnFailure: options?.continueOnFailure ?? false,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'run execution failed';
            await this.orchestrationRunModel
                .updateOne({ _id: runId }, {
                $set: {
                    status: 'failed',
                    error: message,
                },
            })
                .exec();
        }
        const finalRunTasks = await this.orchestrationRunTaskModel.find({ runId }).sort({ order: 1 }).exec();
        const completedAt = new Date();
        const stats = this.computeRunStats(finalRunTasks);
        const runStatus = this.deriveRunStatus(finalRunTasks);
        await this.orchestrationRunModel
            .updateOne({ _id: runId }, {
            $set: {
                status: runStatus,
                completedAt,
                durationMs: completedAt.getTime() - startedAt.getTime(),
                stats,
            },
        })
            .exec();
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                lastRunId: runId,
            },
        })
            .exec();
        await this.planStatsService.setPlanStatus(planId, 'planned');
        await this.planStatsService.setPlanSessionStatus(planId, 'planned');
        await this.planStatsService.refreshPlanStats(planId);
        this.planEventStreamService.emitPlanStreamEvent(planId, runStatus === 'completed' ? 'run.completed' : 'run.failed', {
            planId,
            runId,
            status: runStatus,
            stats,
            completedAt,
        });
        const latestRun = await this.orchestrationRunModel.findOne({ _id: runId }).exec();
        if (!latestRun) {
            throw new common_1.NotFoundException('Run not found');
        }
        return latestRun;
    }
    async cancelRun(runId, reason) {
        const run = await this.orchestrationRunModel.findOne({ _id: runId }).exec();
        if (!run) {
            throw new common_1.NotFoundException('Run not found');
        }
        if (run.status !== 'running') {
            throw new common_1.BadRequestException(`Run in "${run.status}" status cannot be cancelled`);
        }
        const cancelReason = String(reason || '').trim() || '用户手动取消';
        const completedAt = new Date();
        const cancellableStatuses = ['pending', 'assigned', 'blocked', 'in_progress'];
        const cancelUpdateResult = await this.orchestrationRunTaskModel
            .updateMany({
            runId,
            status: { $in: cancellableStatuses },
        }, {
            $set: {
                status: 'cancelled',
                completedAt,
                result: {
                    error: 'Run cancelled by user',
                },
            },
            $push: {
                runLogs: {
                    timestamp: completedAt,
                    level: 'warn',
                    message: cancelReason,
                },
            },
        })
            .exec();
        const runTasks = await this.orchestrationRunTaskModel.find({ runId }).sort({ order: 1 }).exec();
        const stats = this.computeRunStats(runTasks);
        await this.orchestrationRunModel
            .updateOne({ _id: runId }, {
            $set: {
                status: 'cancelled',
                completedAt,
                durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
                error: cancelReason,
                stats,
            },
        })
            .exec();
        await this.planStatsService.setPlanStatus(run.planId, 'planned');
        await this.planStatsService.setPlanSessionStatus(run.planId, 'planned');
        this.planEventStreamService.emitPlanStreamEvent(run.planId, 'run.cancelled', {
            planId: run.planId,
            runId,
            status: 'cancelled',
            reason: cancelReason,
            cancelledTasks: cancelUpdateResult.modifiedCount || 0,
            completedAt,
        });
        return {
            success: true,
            runId,
            status: 'cancelled',
            cancelledTasks: cancelUpdateResult.modifiedCount || 0,
        };
    }
    async listPlanRuns(planId, limit = 20) {
        await this.assertPlanExists(planId);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        return this.orchestrationRunModel
            .find({ planId })
            .sort({ startedAt: -1 })
            .limit(safeLimit)
            .exec();
    }
    async getLatestPlanRun(planId) {
        await this.assertPlanExists(planId);
        return this.orchestrationRunModel
            .findOne({ planId })
            .sort({ startedAt: -1 })
            .exec();
    }
    async getRunById(runId) {
        const run = await this.orchestrationRunModel.findOne({ _id: runId }).exec();
        if (!run) {
            throw new common_1.NotFoundException('Run not found');
        }
        return run;
    }
    async listRunTasks(runId) {
        await this.getRunById(runId);
        return this.orchestrationRunTaskModel
            .find({ runId })
            .sort({ order: 1 })
            .exec();
    }
    async assertPlanExists(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).select({ _id: 1 }).lean().exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
    }
    async executeRunTasks(plan, runId, options) {
        let keepRunning = true;
        while (keepRunning) {
            const runSnapshot = await this.orchestrationRunModel.findOne({ _id: runId }).select({ status: 1 }).lean().exec();
            if (!runSnapshot || runSnapshot.status === 'cancelled') {
                break;
            }
            const runTasks = await this.orchestrationRunTaskModel
                .find({ runId })
                .sort({ order: 1 })
                .exec();
            const completedSourceTaskIds = new Set(runTasks
                .filter((task) => task.status === 'completed')
                .map((task) => task.sourceTaskId)
                .filter(Boolean));
            const runnableTasks = runTasks.filter((task) => {
                if (task.parentTaskId) {
                    return false;
                }
                const statusAllowsRun = task.status === 'pending' || task.status === 'assigned';
                if (!statusAllowsRun) {
                    return false;
                }
                return (task.dependencyTaskIds || []).every((dependencySourceTaskId) => completedSourceTaskIds.has(dependencySourceTaskId));
            });
            if (!runnableTasks.length) {
                break;
            }
            if (plan.strategy.mode === 'parallel') {
                const results = await Promise.all(runnableTasks.map((task) => this.executionEngineService.executeRunTaskNode(runId, task)));
                if (!options.continueOnFailure && results.some((result) => result.status === 'failed')) {
                    keepRunning = false;
                }
            }
            else {
                for (const task of runnableTasks) {
                    const latestRun = await this.orchestrationRunModel.findOne({ _id: runId }).select({ status: 1 }).lean().exec();
                    if (!latestRun || latestRun.status === 'cancelled') {
                        keepRunning = false;
                        break;
                    }
                    const result = await this.executionEngineService.executeRunTaskNode(runId, task);
                    if (!options.continueOnFailure && result.status === 'failed') {
                        keepRunning = false;
                        break;
                    }
                }
            }
        }
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
        if (tasks.some((task) => task.status === 'failed')) {
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
        if (tasks.some((task) => task.status === 'cancelled')) {
            return 'cancelled';
        }
        return 'failed';
    }
    getEntityId(entity) {
        if (entity.id) {
            return String(entity.id);
        }
        if (entity._id) {
            if (typeof entity._id === 'string') {
                return entity._id;
            }
            if (typeof entity._id.toString === 'function') {
                return entity._id.toString();
            }
        }
        return '';
    }
    assertManualRunAllowed(plan) {
        if (this.isOnceRunMode(plan)) {
            throw new common_1.BadRequestException('Plan strategy.runMode=once does not support manual rerun');
        }
    }
    isOnceRunMode(plan) {
        return String(plan.strategy?.runMode || 'multi').trim().toLowerCase() === 'once';
    }
};
exports.PlanExecutionService = PlanExecutionService;
exports.PlanExecutionService = PlanExecutionService = PlanExecutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_run_schema_1.OrchestrationRun.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_run_task_schema_1.OrchestrationRunTask.name)),
    __param(3, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(4, (0, mongoose_1.InjectModel)(ei_project_schema_1.RdProject.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        plan_stats_service_1.PlanStatsService,
        plan_event_stream_service_1.PlanEventStreamService,
        orchestration_context_service_1.OrchestrationContextService,
        orchestration_execution_engine_service_1.OrchestrationExecutionEngineService])
], PlanExecutionService);
//# sourceMappingURL=plan-execution.service.js.map