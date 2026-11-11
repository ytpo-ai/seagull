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
var MessageCenterEventConsumerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageCenterEventConsumerService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../libs/infra/src/index");
const os_1 = require("os");
const message_center_service_1 = require("./message-center.service");
const CHANNEL_FORWARD_EVENT_TYPES_REDIS_KEY = String(process.env.CHANNEL_FORWARD_EVENT_TYPES_REDIS_KEY || '').trim()
    || 'config:message-center:channel-forward-event-types';
const CHANNEL_FORWARD_EVENT_TYPES_DEFAULT = [
    'orchestration.task.completed',
    'agent.action.completed',
    'agent.cost.exceeded',
    'system.alert.scheduler',
    'meeting.session.ended',
    'meeting.summary.generated',
    'scheduler.report.generated',
];
let MessageCenterEventConsumerService = MessageCenterEventConsumerService_1 = class MessageCenterEventConsumerService {
    constructor(redisService, messageCenterService, messageBus) {
        this.redisService = redisService;
        this.messageCenterService = messageCenterService;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(MessageCenterEventConsumerService_1.name);
        this.consumerName = `${(0, os_1.hostname)()}-${process.pid}`;
        this.forwardTypeReloadIntervalMs = Math.max(1000, Number(process.env.CHANNEL_FORWARD_EVENT_TYPES_RELOAD_MS || 10000));
        this.forwardEventTypes = new Set();
        this.lastForwardTypeReloadAt = 0;
    }
    async onModuleInit() {
        this.forwardEventTypes = this.parseForwardEventTypes(String(process.env.CHANNEL_FORWARD_EVENT_TYPES || ''));
        this.subscription = await this.messageBus.subscribe('message-center.events', (context) => this.handleMessage(context), {
            group: 'message-center-group',
            consumer: this.consumerName,
            batchSize: 20,
            blockMs: 2000,
        });
        this.logger.log('Message-center event consumer started via MessageBus');
    }
    async onModuleDestroy() {
        if (this.subscription) {
            await this.subscription.unsubscribe();
            this.subscription = undefined;
        }
    }
    async handleMessage(context) {
        const { envelope } = context;
        await this.reloadForwardEventTypesIfNeeded();
        const rawPayload = envelope.payload;
        const validated = (0, infra_1.validateMessageCenterEventEnvelope)(rawPayload);
        if (!validated.ok || !validated.event) {
            this.logger.warn(`[message-center] validation failed messageId=${envelope.messageId} error=${validated.error}`);
            await context.nack(validated.error || 'contract_validation_failed', { noRetry: true });
            return;
        }
        let created = false;
        try {
            const persisted = await this.persistAsSystemMessage(validated.event);
            created = persisted.created;
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'persist_failed');
            await context.nack(reason);
            return;
        }
        if (created) {
            try {
                await this.forwardToChannelIfNeeded(validated.event);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error || 'forward_failed');
                this.logger.warn(`Forward message-center event to channel stream failed unexpectedly (non-blocking): eventId=${validated.event.eventId} reason=${reason}`);
            }
        }
        await context.ack();
    }
    async forwardToChannelIfNeeded(event) {
        if (!this.forwardEventTypes.has(event.eventType)) {
            return;
        }
        const channelEvent = (0, infra_1.buildChannelEventFromMessageCenter)(event);
        try {
            await this.messageBus.publish('channel.events', {
                payload: channelEvent,
            });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Forward message-center event to channel stream failed (non-blocking): eventId=${event.eventId} eventType=${event.eventType} reason=${reason}`);
        }
    }
    async persistAsSystemMessage(event) {
        if (!String(event.data.receiverId || '').trim()) {
            return { created: true };
        }
        return this.messageCenterService.createSystemMessage({
            receiverId: String(event.data.receiverId || '').trim(),
            type: event.data.messageType,
            title: event.data.title,
            content: event.data.content,
            source: event.source,
            eventId: event.eventId,
            dedupKey: event.data.bizKey,
            payload: {
                eventType: event.eventType,
                eventVersion: event.version,
                traceId: event.traceId,
                occurredAt: event.occurredAt,
                redirectPath: event.data.actionUrl || undefined,
                ...event.data.extra,
            },
        });
    }
    async reloadForwardEventTypesIfNeeded() {
        const now = Date.now();
        if (now - this.lastForwardTypeReloadAt < this.forwardTypeReloadIntervalMs) {
            return;
        }
        this.lastForwardTypeReloadAt = now;
        let next = this.parseForwardEventTypes(String(process.env.CHANNEL_FORWARD_EVENT_TYPES || ''));
        try {
            const redisRaw = await this.redisService.get(CHANNEL_FORWARD_EVENT_TYPES_REDIS_KEY);
            if (redisRaw && redisRaw.trim()) {
                next = this.parseForwardEventTypes(redisRaw);
            }
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Load channel forward event types from redis failed: reason=${reason}`);
        }
        if (!this.sameSet(this.forwardEventTypes, next)) {
            this.forwardEventTypes = next;
            this.logger.log(`Updated channel forward event types: ${Array.from(next.values()).join(',')}`);
        }
    }
    parseForwardEventTypes(raw) {
        const parsed = String(raw || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        const values = parsed.length ? parsed : CHANNEL_FORWARD_EVENT_TYPES_DEFAULT;
        return new Set(values);
    }
    sameSet(left, right) {
        if (left.size !== right.size) {
            return false;
        }
        for (const value of left.values()) {
            if (!right.has(value)) {
                return false;
            }
        }
        return true;
    }
};
exports.MessageCenterEventConsumerService = MessageCenterEventConsumerService;
exports.MessageCenterEventConsumerService = MessageCenterEventConsumerService = MessageCenterEventConsumerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [infra_1.RedisService,
        message_center_service_1.MessageCenterService, Object])
], MessageCenterEventConsumerService);
//# sourceMappingURL=message-center-event-consumer.service.js.map