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
var InnerMessageCollaborationAutomationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerMessageCollaborationAutomationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const infra_1 = require("../../../../../libs/infra/src/index");
const inner_message_service_1 = require("./inner-message.service");
const agent_schema_1 = require("../../schemas/agent.schema");
let InnerMessageCollaborationAutomationService = InnerMessageCollaborationAutomationService_1 = class InnerMessageCollaborationAutomationService {
    constructor(redisService, innerMessageService, agentModel) {
        this.redisService = redisService;
        this.innerMessageService = innerMessageService;
        this.agentModel = agentModel;
        this.logger = new common_1.Logger(InnerMessageCollaborationAutomationService_1.name);
        this.listener = (message) => {
            void this.handleTaskEvent(message);
        };
    }
    async onModuleInit() {
        await this.redisService.subscribe(inner_message_service_1.ORCHESTRATION_TASK_EVENT_HOOK_CHANNEL, this.listener);
    }
    async onModuleDestroy() {
        await this.redisService.unsubscribe(inner_message_service_1.ORCHESTRATION_TASK_EVENT_HOOK_CHANNEL, this.listener);
    }
    async handleTaskEvent(raw) {
        let event;
        try {
            event = JSON.parse(raw);
        }
        catch {
            this.logger.warn('Ignored malformed task hook payload for collaboration automation');
            return;
        }
        if (!event?.eventType || !event?.taskId) {
            return;
        }
        if (event.eventType === 'task.created') {
            await this.handleTaskCreated(event);
            return;
        }
        if (event.eventType === 'task.completed') {
            await this.handleTaskCompleted(event);
        }
    }
    async handleTaskCreated(event) {
        const assignment = event.payload?.assignment;
        const executorAgentId = String(assignment?.executorType === 'agent' ? assignment?.executorId || '' : '').trim();
        if (!executorAgentId) {
            return;
        }
        const ctoAgentId = await this.resolveCtoAgentId();
        if (!ctoAgentId) {
            return;
        }
        const direct = await this.innerMessageService.sendDirectMessage({
            senderAgentId: ctoAgentId,
            receiverAgentId: executorAgentId,
            eventType: 'task.assigned',
            title: `任务安排：${String(event.payload?.taskTitle || event.taskId)}`,
            content: `请处理任务 ${event.taskId}，完成后同步结果。`,
            payload: {
                taskId: event.taskId,
                planId: event.planId,
                sourceEventType: event.eventType,
            },
            source: 'inner-message-collaboration-automation',
            dedupKey: `auto:cto-assign:${event.taskId}:${executorAgentId}`,
        });
        await this.innerMessageService.acknowledgeMessage(direct.messageId, executorAgentId, 'delivered').catch(() => undefined);
        await this.innerMessageService.sendDirectMessage({
            senderAgentId: executorAgentId,
            receiverAgentId: ctoAgentId,
            eventType: 'task.assigned.ack',
            title: `任务已收到：${String(event.payload?.taskTitle || event.taskId)}`,
            content: `已收到任务 ${event.taskId}，开始执行。`,
            payload: {
                taskId: event.taskId,
                planId: event.planId,
                ackMessageId: direct.messageId,
            },
            source: 'inner-message-collaboration-automation',
            dedupKey: `auto:executor-ack:${event.taskId}:${executorAgentId}:${ctoAgentId}`,
        });
    }
    async handleTaskCompleted(event) {
        const senderAgentId = String(event.senderAgentId || '').trim();
        if (!senderAgentId || senderAgentId === 'orchestration-system') {
            return;
        }
        const ctoAgentId = await this.resolveCtoAgentId();
        if (!ctoAgentId || ctoAgentId === senderAgentId) {
            return;
        }
        await this.innerMessageService.sendDirectMessage({
            senderAgentId,
            receiverAgentId: ctoAgentId,
            eventType: 'task.completed.report',
            title: `任务完成汇报：${String(event.payload?.taskTitle || event.taskId)}`,
            content: `任务 ${event.taskId} 已完成，请审阅。`,
            payload: {
                taskId: event.taskId,
                planId: event.planId,
                sourceEventType: event.eventType,
            },
            source: 'inner-message-collaboration-automation',
            dedupKey: `auto:executor-report:${event.taskId}:${senderAgentId}:${ctoAgentId}`,
        });
    }
    async resolveCtoAgentId() {
        const configured = String(process.env.ORCHESTRATION_CTO_AGENT_ID || '').trim();
        if (configured) {
            return configured;
        }
        const ctoAgent = await this.agentModel
            .findOne({
            isActive: true,
            $or: [{ name: { $regex: 'cto', $options: 'i' } }, { description: { $regex: 'cto', $options: 'i' } }],
        })
            .select({ _id: 1 })
            .lean()
            .exec();
        return ctoAgent?._id?.toString() || undefined;
    }
};
exports.InnerMessageCollaborationAutomationService = InnerMessageCollaborationAutomationService;
exports.InnerMessageCollaborationAutomationService = InnerMessageCollaborationAutomationService = InnerMessageCollaborationAutomationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __metadata("design:paramtypes", [infra_1.RedisService,
        inner_message_service_1.InnerMessageService,
        mongoose_2.Model])
], InnerMessageCollaborationAutomationService);
//# sourceMappingURL=inner-message-collaboration-automation.service.js.map