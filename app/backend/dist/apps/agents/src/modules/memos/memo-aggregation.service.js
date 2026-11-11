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
var MemoAggregationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoAggregationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../schemas/agent.schema");
const memo_event_bus_service_1 = require("./memo-event-bus.service");
const memo_service_1 = require("./memo.service");
const identity_aggregation_service_1 = require("./identity-aggregation.service");
const evaluation_aggregation_service_1 = require("./evaluation-aggregation.service");
const deduction_aggregation_service_1 = require("./deduction-aggregation.service");
let MemoAggregationService = MemoAggregationService_1 = class MemoAggregationService {
    constructor(memoService, memoEventBus, identityAggregationService, evaluationAggregationService, deductionAggregationService, agentModel) {
        this.memoService = memoService;
        this.memoEventBus = memoEventBus;
        this.identityAggregationService = identityAggregationService;
        this.evaluationAggregationService = evaluationAggregationService;
        this.deductionAggregationService = deductionAggregationService;
        this.agentModel = agentModel;
        this.logger = new common_1.Logger(MemoAggregationService_1.name);
        this.running = false;
        this.listeners = [];
    }
    onModuleInit() {
        this.bindEventBusListeners();
        this.logger.log('Memo aggregation internal scheduler disabled; waiting for external scheduler module');
    }
    onModuleDestroy() {
        this.unbindEventBusListeners();
    }
    async triggerFullAggregation() {
        return this.handleScheduledFullAggregation();
    }
    async handleScheduledFullAggregation() {
        this.logger.log('Starting scheduled full aggregation for all agents');
        try {
            const agents = await this.agentModel.find({ isActive: true }).exec();
            for (const agent of agents) {
                try {
                    const runtimeAgentId = agent.id || agent._id?.toString();
                    if (!runtimeAgentId)
                        continue;
                    await Promise.all([
                        this.identityAggregationService.aggregateIdentity(runtimeAgentId),
                        this.evaluationAggregationService.aggregateEvaluation(runtimeAgentId),
                        this.deductionAggregationService.aggregateDeductions(runtimeAgentId),
                    ]);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    const runtimeAgentId = agent.id || agent._id?.toString();
                    this.logger.error(`Failed to aggregate identity/evaluation for agent ${runtimeAgentId}: ${message}`);
                }
            }
            this.logger.log(`Scheduled full aggregation completed for ${agents.length} agents`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Scheduled full aggregation failed: ${message}`);
        }
    }
    bindEventBusListeners() {
        const register = (name) => {
            const handler = (event) => {
                this.handleEvent(event);
            };
            this.memoEventBus.on(name, handler);
            this.listeners.push({ name, handler });
        };
        register('agent.updated');
        register('agent.skill_changed');
        register('task.completed');
        register('orchestration.task_completed');
    }
    async handleEvent(event) {
        this.logger.log(`Handling event: ${event.name} for agent: ${event.agentId}`);
        switch (event.name) {
            case 'agent.updated':
            case 'agent.skill_changed':
                try {
                    await this.identityAggregationService.aggregateIdentity(event.agentId);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    this.logger.error(`Failed to aggregate identity for agent ${event.agentId}: ${message}`);
                }
                break;
            case 'task.completed':
            case 'orchestration.task_completed':
                try {
                    await Promise.all([
                        this.evaluationAggregationService.aggregateEvaluation(event.agentId),
                        this.deductionAggregationService.aggregateDeductions(event.agentId),
                    ]);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    this.logger.error(`Failed to aggregate for agent ${event.agentId}: ${message}`);
                }
                break;
            default:
                this.logger.warn(`Unhandled event type: ${event.name}`);
        }
    }
    unbindEventBusListeners() {
        for (const item of this.listeners) {
            this.memoEventBus.off(item.name, item.handler);
        }
        this.listeners.length = 0;
    }
    async runAggregation() {
        if (this.running)
            return;
        this.running = true;
        try {
            const refreshResult = await this.memoService.flushRefreshQueue();
            if (refreshResult.jobs > 0) {
                this.logger.log(`Memo refresh queue flushed jobs=${refreshResult.jobs}, agents=${refreshResult.agents}`);
            }
            const result = await this.memoService.flushEventQueue();
            if (result.events > 0) {
                this.logger.log(`Memo aggregation flushed events=${result.events}, agents=${result.agents}, topics=${result.topics}`);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Memo aggregation failed: ${message}`);
        }
        finally {
            this.running = false;
        }
    }
};
exports.MemoAggregationService = MemoAggregationService;
exports.MemoAggregationService = MemoAggregationService = MemoAggregationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __metadata("design:paramtypes", [memo_service_1.MemoService,
        memo_event_bus_service_1.MemoEventBusService,
        identity_aggregation_service_1.IdentityAggregationService,
        evaluation_aggregation_service_1.EvaluationAggregationService,
        deduction_aggregation_service_1.DeductionAggregationService,
        mongoose_2.Model])
], MemoAggregationService);
//# sourceMappingURL=memo-aggregation.service.js.map