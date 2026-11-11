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
var ChannelDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../libs/infra/src/index");
const os_1 = require("os");
const channel_aggregator_service_1 = require("./channel-aggregator.service");
const channel_config_service_1 = require("./channel-config.service");
const channel_provider_registry_1 = require("./channel-provider.registry");
let ChannelDispatcherService = ChannelDispatcherService_1 = class ChannelDispatcherService {
    constructor(redisService, channelConfigService, providerRegistry, channelAggregatorService, messageBus) {
        this.redisService = redisService;
        this.channelConfigService = channelConfigService;
        this.providerRegistry = providerRegistry;
        this.channelAggregatorService = channelAggregatorService;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(ChannelDispatcherService_1.name);
        this.consumerName = `${(0, os_1.hostname)()}-${process.pid}`;
    }
    async onModuleInit() {
        this.subscription = await this.messageBus.subscribe('channel.events', (context) => this.handleMessage(context), {
            group: 'channel-group',
            consumer: this.consumerName,
            batchSize: 20,
            blockMs: 2000,
        });
        this.logger.log('Channel dispatcher started via MessageBus');
    }
    async onModuleDestroy() {
        if (this.subscription) {
            await this.subscription.unsubscribe();
            this.subscription = undefined;
        }
        await this.channelAggregatorService.flushAll(async (target, _eventType, events) => {
            await this.flushAggregatedEvents(target, events);
        });
    }
    async handleMessage(context) {
        const { envelope } = context;
        const rawPayload = envelope.payload;
        const validated = (0, infra_1.validateChannelEventEnvelope)(rawPayload);
        if (!validated.ok || !validated.event) {
            this.logger.warn(`[channel-dispatcher] validation failed messageId=${envelope.messageId} error=${validated.error}`);
            await context.nack(validated.error || 'contract_validation_failed', { noRetry: true });
            return;
        }
        try {
            const allFailed = await this.dispatchOneEvent(validated.event);
            if (allFailed) {
                await context.nack('all_deliveries_failed');
                return;
            }
            await context.ack();
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'dispatch_failed');
            await context.nack(reason);
        }
    }
    async dispatchOneEvent(event) {
        const targets = await this.channelConfigService.findActiveTargetsByEventType(event.eventType);
        if (!targets.length) {
            return false;
        }
        let successCount = 0;
        for (const target of targets) {
            if (this.shouldAggregate(event.eventType)) {
                this.channelAggregatorService.queue(target, event, async (flushTarget, _eventType, events) => {
                    await this.flushAggregatedEvents(flushTarget, events);
                });
                successCount += 1;
                continue;
            }
            const result = await this.sendToTarget(target, event, this.buildChannelMessage(event));
            if (result) {
                successCount += 1;
            }
        }
        return successCount === 0;
    }
    buildChannelMessage(event) {
        const extra = (event.data.extra || {});
        const cardType = this.resolveCardType(event.eventType);
        return {
            title: event.data.title,
            content: event.data.content,
            contentType: 'card',
            payload: {
                cardType,
                status: String(extra.status || '').trim(),
                durationMs: Number(extra.durationMs || 0),
                agentId: String(extra.agentId || '').trim(),
                agentName: String(extra.agentName || '').trim(),
                taskTitle: String(extra.taskTitle || '').trim(),
                action: String(extra.action || '').trim(),
                reason: String(extra.reason || '').trim(),
                scheduleName: String(extra.scheduleName || '').trim(),
                endedAt: String(extra.endedAt || '').trim(),
                summary: String(extra.summary || event.data.content || '').trim(),
                actionItems: Array.isArray(extra.actionItems) ? extra.actionItems : [],
                decisions: Array.isArray(extra.decisions) ? extra.decisions : [],
                executionTime: String(extra.executionTime || '').trim(),
                outputSummary: String(extra.outputSummary || '').trim(),
                actionUrl: event.data.actionUrl,
            },
            sourceEvent: {
                eventId: event.eventId,
                eventType: event.eventType,
                occurredAt: event.occurredAt,
            },
        };
    }
    async sendToTarget(target, event, message) {
        let deliveryResult;
        try {
            const provider = this.providerRegistry.getProvider(target.providerType);
            deliveryResult = await provider.send(target, message);
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown_provider_error');
            deliveryResult = {
                success: false,
                providerType: target.providerType,
                errorMessage: reason,
                deliveredAt: new Date(),
            };
        }
        await this.channelConfigService.createDeliveryLog({
            configId: target.configId,
            eventId: event.eventId,
            eventType: event.eventType,
            providerType: target.providerType,
            status: deliveryResult.success ? 'success' : 'failed',
            attempt: 1,
            errorMessage: deliveryResult.errorMessage,
            requestPayload: {
                contentType: message.contentType,
                title: message.title,
            },
            responsePayload: {
                success: deliveryResult.success,
                statusCode: deliveryResult.statusCode,
            },
            deliveredAt: deliveryResult.deliveredAt,
        });
        return Boolean(deliveryResult.success);
    }
    async flushAggregatedEvents(target, events) {
        if (!events.length) {
            return;
        }
        const first = events[0];
        const items = events.map((event) => {
            const extra = (event.data.extra || {});
            return {
                status: String(extra.status || '').trim(),
                action: String(extra.action || '').trim(),
                agentId: String(extra.agentId || '').trim(),
                agentName: String(extra.agentName || '').trim(),
                taskTitle: String(extra.taskTitle || '').trim(),
            };
        });
        const message = {
            title: 'Agent 执行日志汇总',
            content: `过去 ${this.channelAggregatorService.getWindowSeconds()} 秒共 ${events.length} 条执行记录`,
            contentType: 'card',
            payload: {
                cardType: 'agent_log_aggregated',
                count: events.length,
                windowSeconds: this.channelAggregatorService.getWindowSeconds(),
                items,
                actionUrl: first.data.actionUrl,
            },
            sourceEvent: {
                eventId: `aggregate:${first.eventId}`,
                eventType: first.eventType,
                occurredAt: new Date().toISOString(),
            },
        };
        await this.sendToTarget(target, {
            ...first,
            eventId: message.sourceEvent.eventId,
        }, message);
    }
    shouldAggregate(eventType) {
        return eventType === 'agent.action.completed';
    }
    resolveCardType(eventType) {
        if (eventType === 'agent.action.completed') {
            return 'agent_log';
        }
        if (eventType === 'system.alert.scheduler' || eventType === 'agent.cost.exceeded') {
            return 'alert';
        }
        if (eventType === 'meeting.session.ended') {
            return 'meeting_ended';
        }
        if (eventType === 'meeting.summary.generated') {
            return 'meeting_summary';
        }
        if (eventType === 'scheduler.report.generated') {
            return 'report';
        }
        return 'task_result';
    }
};
exports.ChannelDispatcherService = ChannelDispatcherService;
exports.ChannelDispatcherService = ChannelDispatcherService = ChannelDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [infra_1.RedisService,
        channel_config_service_1.ChannelConfigService,
        channel_provider_registry_1.ChannelProviderRegistry,
        channel_aggregator_service_1.ChannelAggregatorService, Object])
], ChannelDispatcherService);
//# sourceMappingURL=channel-dispatcher.service.js.map