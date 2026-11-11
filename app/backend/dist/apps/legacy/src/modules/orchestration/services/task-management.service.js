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
exports.TaskManagementService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_run_schema_1 = require("../../../shared/schemas/orchestration-run.schema");
const plan_stats_service_1 = require("./plan-stats.service");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
let TaskManagementService = class TaskManagementService {
    constructor(orchestrationTaskModel, orchestrationPlanModel, orchestrationRunModel, planStatsService, planEventStreamService, contextService) {
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.orchestrationRunModel = orchestrationRunModel;
        this.planStatsService = planStatsService;
        this.planEventStreamService = planEventStreamService;
        this.contextService = contextService;
    }
    async listTasksByPlan(planId) {
        return this.orchestrationTaskModel
            .find({ planId })
            .sort({ order: 1 })
            .exec();
    }
    async addTaskToPlan(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        await this.assertPlanEditable(plan);
        const title = String(dto.title || '').trim();
        const description = String(dto.description || '').trim();
        if (!title || !description) {
            throw new common_1.BadRequestException('title and description are required');
        }
        let assignment = this.normalizeAssignment(dto.assignment);
        const dependencyTaskIds = this.normalizeDependencyTaskIds(dto.dependencyTaskIds);
        const parentTaskId = String(dto.parentTaskId || '').trim() || undefined;
        let parentTask;
        let inheritedTaskType;
        let inheritedRuntimeTaskType;
        let inheritedSessionId;
        if (parentTaskId && String(dto.insertAfterTaskId || '').trim()) {
            throw new common_1.BadRequestException('insertAfterTaskId cannot be used together with parentTaskId');
        }
        if (dependencyTaskIds.length) {
            await this.assertTaskIdsBelongToPlan(planId, dependencyTaskIds);
        }
        const tasks = await this.listTasksByPlan(planId);
        let insertIndex = tasks.length;
        const insertAfterTaskId = String(dto.insertAfterTaskId || '').trim();
        if (parentTaskId) {
            parentTask = tasks.find((item) => this.getEntityId(item) === parentTaskId);
            if (!parentTask) {
                throw new common_1.BadRequestException('parentTaskId does not belong to current plan');
            }
            const inherited = this.resolveDevelopmentSubtaskInheritance(parentTask);
            if (inherited) {
                assignment = inherited.assignment;
                inheritedTaskType = inherited.taskType;
                inheritedRuntimeTaskType = inherited.runtimeTaskType;
                inheritedSessionId = inherited.sessionId;
            }
            insertIndex = this.resolveInsertIndexForParent(tasks, parentTaskId);
        }
        else if (insertAfterTaskId) {
            const targetIndex = tasks.findIndex((item) => this.getEntityId(item) === insertAfterTaskId);
            if (targetIndex < 0) {
                throw new common_1.BadRequestException('insertAfterTaskId does not belong to current plan');
            }
            insertIndex = targetIndex + 1;
        }
        if (insertIndex < tasks.length) {
            await this.orchestrationTaskModel
                .updateMany({ planId, order: { $gte: insertIndex } }, { $inc: { order: 1 } })
                .exec();
        }
        const inheritedProjectId = parentTaskId
            ? tasks.find((item) => this.getEntityId(item) === parentTaskId)?.projectId || plan.projectId
            : plan.projectId;
        const createdTask = await new this.orchestrationTaskModel({
            planId,
            title,
            description,
            priority: dto.priority || 'medium',
            status: this.resolveTaskStatusByAssignment(assignment),
            order: insertIndex,
            dependencyTaskIds,
            ...(parentTaskId ? { parentTaskId } : {}),
            assignment,
            ...(inheritedTaskType ? { taskType: inheritedTaskType } : {}),
            ...(inheritedRuntimeTaskType ? { runtimeTaskType: inheritedRuntimeTaskType } : {}),
            ...(inheritedSessionId ? { sessionId: inheritedSessionId } : {}),
            runLogs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task added manually',
                    metadata: {
                        insertAfterTaskId: insertAfterTaskId || undefined,
                        parentTaskId,
                        inheritedFromParentTask: Boolean(parentTaskId && inheritedTaskType),
                        inheritedRuntimeTaskType,
                        inheritedSessionId: inheritedSessionId || undefined,
                    },
                },
            ],
            ...(inheritedProjectId ? { projectId: inheritedProjectId } : {}),
        }).save();
        const nextTaskIds = tasks.map((item) => this.getEntityId(item));
        nextTaskIds.splice(insertIndex, 0, createdTask._id.toString());
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                taskIds: nextTaskIds,
            },
        })
            .exec();
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.task.added', {
            planId,
            task: createdTask.toObject(),
        });
        this.planEventStreamService.emitTaskLifecycleEvent(this.getEntityId(createdTask), 'task.created', {
            planId,
            status: createdTask.status,
            taskTitle: createdTask.title,
            assignment: createdTask.assignment,
        });
        return createdTask;
    }
    async removeTaskFromPlan(taskId) {
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        const planId = this.requirePlanId(task);
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        await this.assertPlanEditable(plan, task);
        const isSubtask = Boolean(String(task.parentTaskId || '').trim());
        if (task.status === 'in_progress' || task.status === 'waiting_human') {
            throw new common_1.BadRequestException(`Task in "${task.status}" status cannot be deleted`);
        }
        if (task.status === 'completed' && !isSubtask) {
            throw new common_1.BadRequestException(`Task in "${task.status}" status cannot be deleted`);
        }
        const subtaskCount = await this.orchestrationTaskModel
            .countDocuments({ planId, parentTaskId: taskId })
            .exec();
        if (subtaskCount > 0) {
            throw new common_1.BadRequestException('Task has subtasks and cannot be deleted');
        }
        await this.orchestrationTaskModel
            .updateMany({ planId, dependencyTaskIds: taskId }, { $pull: { dependencyTaskIds: taskId } })
            .exec();
        if (isSubtask) {
            await this.cleanupParentTaskSubtaskOutput(planId, String(task.parentTaskId || '').trim(), taskId);
        }
        await this.orchestrationTaskModel.deleteOne({ _id: taskId }).exec();
        const remainingTasks = await this.listTasksByPlan(planId);
        if (remainingTasks.length) {
            await this.orchestrationTaskModel
                .bulkWrite(remainingTasks.map((item, index) => ({
                updateOne: {
                    filter: { _id: this.getEntityId(item) },
                    update: { $set: { order: index } },
                },
            })));
        }
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                taskIds: remainingTasks.map((item) => this.getEntityId(item)),
            },
        })
            .exec();
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.task.removed', {
            planId,
            taskId,
        });
        return { success: true };
    }
    async cleanupParentTaskSubtaskOutput(planId, parentTaskId, subtaskId) {
        if (!parentTaskId || !subtaskId) {
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
        const existingOutput = String(parentTask.result?.output || '');
        const nextOutput = existingOutput
            .replace(new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'g'), '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        if (nextOutput === existingOutput.trim()) {
            return;
        }
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
                    message: 'Subtask output removed after subtask deletion',
                    metadata: {
                        subtaskId,
                    },
                },
            },
        })
            .exec();
        await this.planStatsService.updatePlanSessionTask(planId, parentTaskId, {
            output: nextOutput || undefined,
        });
        this.planEventStreamService.emitTaskLifecycleEvent(parentTaskId, 'task.updated', {
            planId,
            taskId: parentTaskId,
            reason: 'subtask_deleted_cleanup_output',
            subtaskId,
        });
    }
    async updateTaskFull(taskId, dto) {
        return this.updateTaskFullInternal(taskId, dto, {
            emitPlanEvent: true,
            emitTaskLogMessage: 'Task updated manually',
        });
    }
    async reorderPlanTasks(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        await this.assertPlanEditable(plan);
        const nextTaskIds = this.normalizeTaskIdList(dto.taskIds);
        const tasks = await this.listTasksByPlan(planId);
        const currentTaskIds = tasks.map((task) => this.getEntityId(task));
        const currentSet = new Set(currentTaskIds);
        if (nextTaskIds.length !== currentTaskIds.length) {
            throw new common_1.BadRequestException('taskIds length mismatch');
        }
        for (const taskId of nextTaskIds) {
            if (!currentSet.has(taskId)) {
                throw new common_1.BadRequestException('taskIds must contain exactly tasks from current plan');
            }
        }
        const orderByTaskId = new Map();
        nextTaskIds.forEach((item, index) => {
            orderByTaskId.set(item, index);
        });
        if (tasks.length) {
            await this.orchestrationTaskModel
                .bulkWrite(tasks.map((task) => ({
                updateOne: {
                    filter: { _id: this.getEntityId(task) },
                    update: { $set: { order: orderByTaskId.get(this.getEntityId(task)) || 0 } },
                },
            })));
        }
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                taskIds: nextTaskIds,
            },
        })
            .exec();
        await this.planStatsService.syncPlanSessionTasks(planId);
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.tasks.reordered', {
            planId,
            taskIds: nextTaskIds,
        });
        return { success: true };
    }
    async batchUpdateTasks(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        await this.assertPlanEditable(plan);
        const updates = Array.isArray(dto.updates) ? dto.updates : [];
        if (!updates.length) {
            throw new common_1.BadRequestException('updates is required');
        }
        const updateTaskIds = this.normalizeTaskIdList(updates.map((item) => item.taskId));
        await this.assertTaskIdsBelongToPlan(planId, updateTaskIds);
        const updatedTasks = [];
        for (const item of updates) {
            const updated = await this.updateTaskFullInternal(item.taskId, item, {
                emitPlanEvent: false,
                emitTaskLogMessage: 'Task updated in batch',
            });
            updatedTasks.push(updated);
        }
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.tasks.batch-updated', {
            planId,
            taskIds: updatedTasks.map((task) => this.getEntityId(task)),
            totalUpdated: updatedTasks.length,
        });
        return updatedTasks;
    }
    async duplicateTask(planId, sourceTaskId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        await this.assertPlanEditable(plan);
        const sourceTask = await this.orchestrationTaskModel
            .findOne({ _id: sourceTaskId, planId })
            .exec();
        if (!sourceTask) {
            throw new common_1.NotFoundException('Source task not found');
        }
        const insertOrder = sourceTask.order + 1;
        await this.orchestrationTaskModel
            .updateMany({ planId, order: { $gte: insertOrder } }, { $inc: { order: 1 } })
            .exec();
        let assignment;
        try {
            assignment = this.normalizeAssignment(sourceTask.assignment);
        }
        catch {
            assignment = { executorType: 'unassigned' };
        }
        const duplicatedTask = await new this.orchestrationTaskModel({
            planId,
            title: `${sourceTask.title} (副本)`,
            description: sourceTask.description,
            priority: sourceTask.priority || 'medium',
            status: this.resolveTaskStatusByAssignment(assignment),
            order: insertOrder,
            dependencyTaskIds: [],
            assignment,
            runLogs: [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Task duplicated manually',
                    metadata: {
                        sourceTaskId,
                    },
                },
            ],
            ...(plan.projectId ? { projectId: plan.projectId } : {}),
        }).save();
        const tasks = await this.listTasksByPlan(planId);
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                taskIds: tasks.map((task) => this.getEntityId(task)),
            },
        })
            .exec();
        await this.planStatsService.refreshPlanStats(planId);
        await this.planStatsService.syncPlanSessionTasks(planId);
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.task.added', {
            planId,
            sourceTaskId,
            task: duplicatedTask.toObject(),
        });
        this.planEventStreamService.emitTaskLifecycleEvent(this.getEntityId(duplicatedTask), 'task.created', {
            planId,
            status: duplicatedTask.status,
            taskTitle: duplicatedTask.title,
            sourceTaskId,
            assignment: duplicatedTask.assignment,
        });
        return duplicatedTask;
    }
    async updateTaskDraft(taskId, dto) {
        return this.updateTaskFullInternal(taskId, dto, {
            emitPlanEvent: false,
            emitTaskLogMessage: 'Task draft updated for step debugging',
        });
    }
    async updateTaskFullInternal(taskId, dto, options) {
        const task = await this.orchestrationTaskModel.findOne({ _id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        const planId = this.requirePlanId(task);
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        await this.assertPlanEditable(plan, task);
        const normalizedRuntimeTaskType = this.contextService.normalizeRuntimeTaskTypeOverride(dto.runtimeTaskType);
        if (task.status === 'in_progress') {
            throw new common_1.BadRequestException(`Task in "${task.status}" status cannot be edited`);
        }
        const setPayload = {};
        const normalizedTitle = dto.title === undefined ? undefined : String(dto.title || '').trim();
        const normalizedDescription = dto.description === undefined ? undefined : String(dto.description || '').trim();
        if (normalizedTitle !== undefined) {
            if (!normalizedTitle) {
                throw new common_1.BadRequestException('title cannot be empty');
            }
            setPayload.title = normalizedTitle;
        }
        if (normalizedDescription !== undefined) {
            if (!normalizedDescription) {
                throw new common_1.BadRequestException('description cannot be empty');
            }
            setPayload.description = normalizedDescription;
        }
        if (dto.runtimeTaskType !== undefined) {
            if (dto.runtimeTaskType === 'auto') {
                setPayload.runtimeTaskType = undefined;
            }
            else {
                setPayload.runtimeTaskType = normalizedRuntimeTaskType;
            }
        }
        if (dto.priority !== undefined) {
            setPayload.priority = dto.priority;
        }
        if (dto.assignment !== undefined) {
            const assignment = this.normalizeAssignment(dto.assignment);
            setPayload.assignment = assignment;
            setPayload.status = this.resolveTaskStatusByAssignment(assignment, task.status);
        }
        if (dto.dependencyTaskIds !== undefined) {
            const dependencyTaskIds = this.normalizeDependencyTaskIds(dto.dependencyTaskIds);
            if (dependencyTaskIds.includes(taskId)) {
                throw new common_1.BadRequestException('Task cannot depend on itself');
            }
            await this.assertTaskIdsBelongToPlan(planId, dependencyTaskIds);
            await this.assertNoDependencyCycle(planId, taskId, dependencyTaskIds);
            setPayload.dependencyTaskIds = dependencyTaskIds;
        }
        if (!Object.keys(setPayload).length) {
            throw new common_1.BadRequestException('At least one updatable field is required');
        }
        const unsetPayload = {};
        if (dto.runtimeTaskType === 'auto') {
            delete setPayload.runtimeTaskType;
            unsetPayload.runtimeTaskType = 1;
        }
        const updated = await this.orchestrationTaskModel
            .findOneAndUpdate({ _id: taskId }, {
            ...(Object.keys(setPayload).length ? { $set: setPayload } : {}),
            ...(Object.keys(unsetPayload).length ? { $unset: unsetPayload } : {}),
            $push: {
                runLogs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: options.emitTaskLogMessage,
                },
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Task not found');
        }
        await this.planStatsService.updatePlanSessionTask(planId, taskId, {
            input: updated.description,
            status: updated.status,
            executorType: updated.assignment?.executorType,
            executorId: updated.assignment?.executorId,
        });
        if (options.emitPlanEvent) {
            this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.task.updated', {
                planId,
                task: updated.toObject(),
            });
        }
        return updated;
    }
    requirePlanId(task) {
        if (!task.planId) {
            throw new common_1.BadRequestException('Task is not associated with orchestration plan');
        }
        return task.planId;
    }
    async assertPlanEditable(plan, _task) {
        const planId = this.getEntityId(plan);
        if (planId && await this.isPlanRunActive(planId)) {
            throw new common_1.BadRequestException('Plan is running and cannot be edited');
        }
        return 'full';
    }
    normalizeTaskIdList(taskIds) {
        if (!Array.isArray(taskIds)) {
            return [];
        }
        const next = [];
        for (const item of taskIds) {
            const value = String(item || '').trim();
            if (!value) {
                continue;
            }
            if (!next.includes(value)) {
                next.push(value);
            }
        }
        return next;
    }
    normalizeDependencyTaskIds(taskIds) {
        return this.normalizeTaskIdList(taskIds);
    }
    normalizeAssignment(assignment) {
        const executorType = assignment?.executorType || 'unassigned';
        const executorId = String(assignment?.executorId || '').trim() || undefined;
        const reason = String(assignment?.reason || '').trim() || undefined;
        if (executorType === 'unassigned') {
            return {
                executorType,
                ...(reason ? { reason } : {}),
            };
        }
        if (!executorId) {
            throw new common_1.BadRequestException('executorId is required when executorType is agent or employee');
        }
        return {
            executorType,
            executorId,
            ...(reason ? { reason } : {}),
        };
    }
    resolveTaskStatusByAssignment(assignment, fallbackStatus = 'pending') {
        if (assignment.executorType === 'unassigned') {
            return 'pending';
        }
        if (!assignment.executorId) {
            return 'pending';
        }
        if (fallbackStatus === 'failed' || fallbackStatus === 'cancelled') {
            return fallbackStatus;
        }
        return 'assigned';
    }
    resolveDevelopmentSubtaskInheritance(parentTask) {
        const parentRuntimeTaskType = this.contextService.normalizeRuntimeTaskTypeOverride(parentTask.runtimeTaskType || parentTask.taskType);
        const isDevelopmentParent = parentRuntimeTaskType === 'development.plan'
            || parentRuntimeTaskType === 'development.exec'
            || parentRuntimeTaskType === 'development.review';
        if (!isDevelopmentParent) {
            return null;
        }
        const parentAssignment = this.normalizeAssignment(parentTask.assignment);
        if (parentAssignment.executorType !== 'agent' || !parentAssignment.executorId) {
            throw new common_1.BadRequestException('Development subtask parent must have an assigned agent executor');
        }
        const inheritedSessionId = String(parentTask.sessionId || '').trim() || undefined;
        return {
            assignment: {
                executorType: 'agent',
                executorId: parentAssignment.executorId,
                reason: 'Inherited from parent development task',
            },
            taskType: parentRuntimeTaskType,
            runtimeTaskType: parentRuntimeTaskType,
            ...(inheritedSessionId ? { sessionId: inheritedSessionId } : {}),
        };
    }
    async assertTaskIdsBelongToPlan(planId, taskIds) {
        if (!taskIds.length) {
            return;
        }
        const count = await this.orchestrationTaskModel
            .countDocuments({
            planId,
            _id: { $in: taskIds },
        })
            .exec();
        if (count !== taskIds.length) {
            throw new common_1.BadRequestException('dependencyTaskIds must all belong to current plan');
        }
    }
    async assertNoDependencyCycle(planId, targetTaskId, targetDependencies) {
        const tasks = await this.orchestrationTaskModel
            .find({ planId })
            .select({ _id: 1, dependencyTaskIds: 1 })
            .lean()
            .exec();
        const graph = tasks.map((item) => {
            const id = item._id.toString();
            return {
                id,
                dependencyTaskIds: id === targetTaskId ? targetDependencies : (item.dependencyTaskIds || []),
            };
        });
        if (this.hasCyclicDependency(graph)) {
            throw new common_1.BadRequestException('dependencyTaskIds introduces cyclic dependency');
        }
    }
    hasCyclicDependency(tasks) {
        const ids = new Set(tasks.map((task) => task.id));
        const indegree = new Map();
        const edges = new Map();
        for (const task of tasks) {
            indegree.set(task.id, 0);
            edges.set(task.id, []);
        }
        for (const task of tasks) {
            for (const dependency of task.dependencyTaskIds || []) {
                if (!ids.has(dependency)) {
                    continue;
                }
                edges.get(dependency)?.push(task.id);
                indegree.set(task.id, (indegree.get(task.id) || 0) + 1);
            }
        }
        const queue = [];
        for (const [id, degree] of indegree.entries()) {
            if (degree === 0) {
                queue.push(id);
            }
        }
        let visited = 0;
        while (queue.length) {
            const current = queue.shift();
            visited += 1;
            for (const nextId of edges.get(current) || []) {
                const nextDegree = (indegree.get(nextId) || 0) - 1;
                indegree.set(nextId, nextDegree);
                if (nextDegree === 0) {
                    queue.push(nextId);
                }
            }
        }
        return visited !== tasks.length;
    }
    async isPlanRunActive(planId) {
        const runningRun = await this.orchestrationRunModel
            .findOne({ planId, status: 'running' })
            .select({ _id: 1 })
            .lean()
            .exec();
        return Boolean(runningRun);
    }
    getEntityId(entity) {
        const docId = entity?._id;
        if (typeof docId === 'string') {
            return docId;
        }
        if (docId?.toString) {
            return docId.toString();
        }
        return String(entity?.id || '');
    }
    resolveInsertIndexForParent(tasks, parentTaskId) {
        const parentIndex = tasks.findIndex((item) => this.getEntityId(item) === parentTaskId);
        if (parentIndex < 0) {
            return tasks.length;
        }
        const subtreeTaskIds = new Set([parentTaskId]);
        let insertIndex = parentIndex + 1;
        while (insertIndex < tasks.length) {
            const candidate = tasks[insertIndex];
            const candidateParentId = String(candidate?.parentTaskId || '').trim();
            if (!candidateParentId || !subtreeTaskIds.has(candidateParentId)) {
                break;
            }
            subtreeTaskIds.add(this.getEntityId(candidate));
            insertIndex += 1;
        }
        return insertIndex;
    }
};
exports.TaskManagementService = TaskManagementService;
exports.TaskManagementService = TaskManagementService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_run_schema_1.OrchestrationRun.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        plan_stats_service_1.PlanStatsService,
        plan_event_stream_service_1.PlanEventStreamService,
        orchestration_context_service_1.OrchestrationContextService])
], TaskManagementService);
//# sourceMappingURL=task-management.service.js.map