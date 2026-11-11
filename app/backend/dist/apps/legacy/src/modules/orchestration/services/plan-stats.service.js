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
exports.PlanStatsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const orchestration_plan_session_schema_1 = require("../../../shared/schemas/orchestration-plan-session.schema");
let PlanStatsService = class PlanStatsService {
    constructor(orchestrationPlanModel, orchestrationTaskModel, planSessionModel) {
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.planSessionModel = planSessionModel;
    }
    async refreshPlanStats(planId) {
        const tasks = await this.orchestrationTaskModel.find({ planId }).exec();
        const stats = {
            totalTasks: tasks.length,
            completedTasks: 0,
            failedTasks: 0,
            waitingHumanTasks: 0,
        };
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                stats,
            },
        })
            .exec();
    }
    async setPlanStatus(planId, status) {
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            $set: {
                status,
            },
        })
            .exec();
    }
    async setPlanSessionStatus(planId, status) {
        const mappedStatus = status === 'drafting' ? 'active' : 'active';
        await this.planSessionModel
            .updateOne({ planId }, {
            $set: {
                status: mappedStatus,
            },
        })
            .exec();
    }
    normalizePlanStatus(status, taskCount = 0) {
        if (status === 'draft'
            || status === 'drafting'
            || status === 'planned'
            || status === 'production'
            || status === 'running'
            || status === 'paused'
            || status === 'completed') {
            return status;
        }
        if (status === 'failed' && taskCount === 0) {
            return 'draft';
        }
        if (status === 'failed') {
            return 'failed';
        }
        return 'planned';
    }
    async syncPlanSessionTasks(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).select({ title: 1 }).lean().exec();
        const tasks = await this.orchestrationTaskModel
            .find({ planId })
            .sort({ order: 1 })
            .lean()
            .exec();
        const snapshots = tasks.map((task, index) => ({
            taskId: this.getEntityId(task),
            order: index,
            title: task.title,
            status: task.status,
            input: task.description,
            output: task.result?.output,
            error: task.result?.error,
            executorType: task.assignment?.executorType,
            executorId: task.assignment?.executorId,
            updatedAt: new Date(),
        }));
        await this.planSessionModel
            .updateOne({ planId }, {
            $set: {
                ...(plan?.title ? { title: plan.title } : {}),
                tasks: snapshots,
            },
        }, { upsert: true })
            .exec();
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
    async updatePlanSessionTask(planId, taskId, patch) {
        if (!String(planId || '').trim()) {
            return;
        }
        const setPayload = {
            'tasks.$.updatedAt': new Date(),
        };
        if (patch.status)
            setPayload['tasks.$.status'] = patch.status;
        if (patch.input !== undefined)
            setPayload['tasks.$.input'] = patch.input;
        if (patch.output !== undefined)
            setPayload['tasks.$.output'] = patch.output;
        if (patch.error !== undefined)
            setPayload['tasks.$.error'] = patch.error;
        if (patch.executorType !== undefined)
            setPayload['tasks.$.executorType'] = patch.executorType;
        if (patch.executorId !== undefined)
            setPayload['tasks.$.executorId'] = patch.executorId;
        if (patch.agentSessionId !== undefined)
            setPayload['tasks.$.agentSessionId'] = patch.agentSessionId;
        if (patch.agentRunId !== undefined)
            setPayload['tasks.$.agentRunId'] = patch.agentRunId;
        await this.planSessionModel
            .updateOne({ planId, 'tasks.taskId': taskId }, {
            $set: setPayload,
        })
            .exec();
    }
};
exports.PlanStatsService = PlanStatsService;
exports.PlanStatsService = PlanStatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_plan_session_schema_1.PlanSession.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], PlanStatsService);
//# sourceMappingURL=plan-stats.service.js.map