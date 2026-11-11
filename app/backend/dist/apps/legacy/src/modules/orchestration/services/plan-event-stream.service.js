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
exports.PlanEventStreamService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const rxjs_1 = require("rxjs");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
let PlanEventStreamService = class PlanEventStreamService {
    constructor(orchestrationPlanModel, orchestrationTaskModel, agentClientService) {
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.agentClientService = agentClientService;
        this.planEventStreams = new Map();
    }
    async streamPlanEvents(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).lean().exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        return new rxjs_1.Observable((subscriber) => {
            let streamSet = this.planEventStreams.get(planId);
            if (!streamSet) {
                streamSet = new Set();
                this.planEventStreams.set(planId, streamSet);
            }
            const channel = new rxjs_1.Subject();
            const channelSubscription = channel.subscribe({
                next: (event) => subscriber.next(event),
                error: (error) => subscriber.error(error),
                complete: () => subscriber.complete(),
            });
            streamSet.add(channel);
            void Promise.all([
                this.orchestrationPlanModel.findOne({ _id: planId }).lean().exec(),
                this.orchestrationTaskModel.find({ planId }).sort({ order: 1 }).lean().exec(),
            ])
                .then(([latestPlan, tasks]) => {
                channel.next({
                    data: {
                        type: 'plan.snapshot',
                        data: {
                            planId,
                            status: latestPlan?.status,
                            stats: latestPlan?.stats,
                            tasks: tasks || [],
                        },
                    },
                });
            })
                .catch(() => undefined);
            return () => {
                channelSubscription.unsubscribe();
                const targetSet = this.planEventStreams.get(planId);
                if (!targetSet) {
                    return;
                }
                targetSet.delete(channel);
                channel.complete();
                if (!targetSet.size) {
                    this.planEventStreams.delete(planId);
                }
            };
        });
    }
    emitPlanStreamEvent(planId, eventType, data) {
        const listeners = this.planEventStreams.get(planId);
        if (!listeners?.size) {
            return;
        }
        const event = {
            data: {
                type: eventType,
                data,
            },
        };
        for (const channel of listeners) {
            channel.next(event);
        }
    }
    emitTaskLifecycleEvent(taskId, eventType, payload) {
        void this.agentClientService
            .publishTaskLifecycleEvent({
            eventType,
            taskId,
            planId: String(payload.planId || ''),
            status: payload.status,
            senderAgentId: String(payload.senderAgentId || 'orchestration-system'),
            title: `${eventType}: ${String(payload.taskTitle || taskId)}`,
            content: `Task ${String(payload.taskTitle || taskId)} event ${eventType}`,
            payload,
        })
            .catch(() => undefined);
    }
};
exports.PlanEventStreamService = PlanEventStreamService;
exports.PlanEventStreamService = PlanEventStreamService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        agent_client_service_1.AgentClientService])
], PlanEventStreamService);
//# sourceMappingURL=plan-event-stream.service.js.map