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
var OrchestrationMessageCenterEventService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationMessageCenterEventService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const infra_1 = require("../../../../libs/infra/src/index");
const mongoose_2 = require("mongoose");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
let OrchestrationMessageCenterEventService = OrchestrationMessageCenterEventService_1 = class OrchestrationMessageCenterEventService {
    constructor(redisService, orchestrationPlanModel, messageBus) {
        this.redisService = redisService;
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(OrchestrationMessageCenterEventService_1.name);
    }
    async publishTaskCompletedEvent(input) {
        const planId = String(input.planId || '').trim();
        const taskId = String(input.taskId || '').trim();
        if (!planId || !taskId) {
            return;
        }
        const plan = await this.orchestrationPlanModel
            .findOne({ _id: planId })
            .select({ createdBy: 1, title: 1 })
            .lean()
            .exec();
        const receiverId = String(plan?.createdBy || '').trim();
        if (!receiverId) {
            this.logger.log(`Skip orchestration completion message-center event: planId=${planId} taskId=${taskId} reason=missing_receiver`);
            return;
        }
        const planTitle = String(plan?.title || '').trim();
        const taskTitle = String(input.taskTitle || '').trim() || taskId;
        const statusLabel = input.status === 'completed' ? '成功' : '失败';
        const summary = String(input.summary || '').trim();
        const errorText = String(input.error || '').trim();
        const output = summary || errorText || `任务执行${statusLabel}`;
        const actionUrl = `/orchestration?planId=${encodeURIComponent(planId)}&taskId=${encodeURIComponent(taskId)}`;
        const event = (0, infra_1.buildMessageCenterEvent)({
            eventType: 'orchestration.task.completed',
            source: infra_1.MESSAGE_CENTER_EVENT_SOURCE_ORCHESTRATION,
            data: {
                receiverId,
                messageType: 'orchestration',
                title: `编排任务${statusLabel}`,
                content: `计划「${planTitle || planId}」中的任务「${taskTitle}」执行${statusLabel}。${output}`,
                bizKey: `orchestration:${planId}:${taskId}:${input.status}`,
                actionUrl,
                priority: input.status === 'failed' ? 'high' : 'normal',
                extra: {
                    planId,
                    taskId,
                    taskTitle,
                    status: input.status,
                    summary,
                    error: errorText || undefined,
                },
            },
        });
        try {
            await this.messageBus.publish('message-center.events', { payload: event });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Publish orchestration task completion message-center event failed (non-blocking): planId=${planId} taskId=${taskId} reason=${reason}`);
        }
    }
};
exports.OrchestrationMessageCenterEventService = OrchestrationMessageCenterEventService;
exports.OrchestrationMessageCenterEventService = OrchestrationMessageCenterEventService = OrchestrationMessageCenterEventService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(2, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [infra_1.RedisService,
        mongoose_2.Model, Object])
], OrchestrationMessageCenterEventService);
//# sourceMappingURL=orchestration-message-center-event.service.js.map