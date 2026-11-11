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
var InnerMessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerMessageService = exports.INNER_MESSAGE_REDIS_EVENT_DEF_ALL_KEY = exports.INNER_MESSAGE_REDIS_SUB_INDEX_VERSION_KEY = exports.ORCHESTRATION_TASK_EVENT_HOOK_CHANNEL = exports.INNER_MESSAGE_DISPATCH_DEAD_LETTER_KEY = exports.INNER_MESSAGE_DISPATCH_QUEUE_KEY = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const inner_message_schema_1 = require("../../schemas/inner-message.schema");
const inner_message_subscription_schema_1 = require("../../schemas/inner-message-subscription.schema");
const infra_1 = require("../../../../../libs/infra/src/index");
exports.INNER_MESSAGE_DISPATCH_QUEUE_KEY = 'inner:message:dispatch';
exports.INNER_MESSAGE_DISPATCH_DEAD_LETTER_KEY = 'inner:message:dispatch:dead-letter';
exports.ORCHESTRATION_TASK_EVENT_HOOK_CHANNEL = 'orchestration:task-events';
exports.INNER_MESSAGE_REDIS_SUB_INDEX_VERSION_KEY = 'inner:subscription:v1:version';
exports.INNER_MESSAGE_REDIS_EVENT_DEF_ALL_KEY = 'inner:event:def:all';
const INNER_MESSAGE_REDIS_SUB_DATA_KEY_PREFIX = 'inner:subscription:v1:data:';
const INNER_MESSAGE_REDIS_SUB_EVENT_INDEX_PREFIX = 'inner:subscription:v1:index:event:';
const INNER_MESSAGE_REDIS_SUB_DOMAIN_INDEX_PREFIX = 'inner:subscription:v1:index:domain:';
const INNER_MESSAGE_REDIS_SUB_AGENT_INDEX_PREFIX = 'inner:subscription:v1:index:agent:';
const INNER_MESSAGE_REDIS_SUB_GLOBAL_INDEX_KEY = 'inner:subscription:v1:index:global';
const INNER_MESSAGE_REDIS_EVENT_DEF_KEY_PREFIX = 'inner:event:def:';
const INNER_MESSAGE_REDIS_EVENT_DEF_DOMAIN_PREFIX = 'inner:event:def:domain:';
let InnerMessageService = InnerMessageService_1 = class InnerMessageService {
    constructor(messageModel, subscriptionModel, redisService) {
        this.messageModel = messageModel;
        this.subscriptionModel = subscriptionModel;
        this.redisService = redisService;
        this.logger = new common_1.Logger(InnerMessageService_1.name);
        this.defaultSenderAgentId = 'system';
        this.subscriptionRedisIndexReady = false;
        this.subscriptionRedisWarmupPromise = null;
    }
    async onModuleInit() {
        if (!this.redisService.isReady()) {
            return;
        }
        await this.ensureSubscriptionRedisIndexReady();
    }
    async sendDirectMessage(input) {
        const senderAgentId = String(input.senderAgentId || '').trim() || this.defaultSenderAgentId;
        const receiverAgentId = String(input.receiverAgentId || '').trim();
        const eventType = String(input.eventType || '').trim() || 'inner.direct';
        const title = String(input.title || '').trim();
        const content = String(input.content || '').trim();
        if (!receiverAgentId) {
            throw new common_1.BadRequestException('receiverAgentId is required');
        }
        if (!title || !content) {
            throw new common_1.BadRequestException('title and content are required');
        }
        const created = await this.messageModel.create({
            mode: 'direct',
            eventType,
            senderAgentId,
            receiverAgentId,
            title,
            content,
            payload: input.payload || {},
            status: 'sent',
            sentAt: new Date(),
            attempt: 0,
            maxAttempts: Math.max(1, Number(input.maxAttempts || 3)),
            source: input.source || 'inner-message',
            dedupKey: input.dedupKey || undefined,
        });
        await this.enqueueDispatch(created);
        return created;
    }
    async publishMessage(input) {
        const senderAgentId = String(input.senderAgentId || '').trim() || this.defaultSenderAgentId;
        const eventType = String(input.eventType || '').trim();
        const title = String(input.title || '').trim();
        const content = String(input.content || '').trim();
        if (!eventType) {
            throw new common_1.BadRequestException('eventType is required');
        }
        if (!title || !content) {
            throw new common_1.BadRequestException('title and content are required');
        }
        await this.upsertEventDefinitionToRedis(eventType);
        const subscriptions = await this.getActiveSubscriptionsForEvent(eventType);
        if (!subscriptions.length) {
            return {
                eventType,
                matchedSubscribers: 0,
                createdMessages: 0,
            };
        }
        let createdMessages = 0;
        for (const subscription of subscriptions) {
            const receiverAgentId = String(subscription.subscriberAgentId || '').trim();
            if (!receiverAgentId) {
                continue;
            }
            if (!this.matchesSubscriptionFilters(subscription.filters || {}, input.payload || {})) {
                continue;
            }
            const created = await this.messageModel.create({
                mode: 'subscription',
                eventType,
                senderAgentId,
                receiverAgentId,
                title,
                content,
                payload: input.payload || {},
                status: 'sent',
                sentAt: new Date(),
                attempt: 0,
                maxAttempts: Math.max(1, Number(input.maxAttempts || 3)),
                source: input.source || 'inner-message',
                dedupKey: input.dedupKey ? `${input.dedupKey}:${receiverAgentId}` : undefined,
            });
            createdMessages += 1;
            await this.enqueueDispatch(created);
        }
        return {
            eventType,
            matchedSubscribers: createdMessages,
            createdMessages,
        };
    }
    async publishTaskEvent(input) {
        const eventType = String(input.eventType || '').trim();
        const taskId = String(input.taskId || '').trim();
        if (!eventType || !taskId) {
            throw new common_1.BadRequestException('eventType and taskId are required for task event publish');
        }
        const hookPayload = {
            eventType,
            taskId,
            planId: input.planId,
            status: input.status,
            senderAgentId: input.senderAgentId || 'orchestration-system',
            payload: input.payload || {},
            timestamp: new Date().toISOString(),
        };
        await this.redisService.publish(exports.ORCHESTRATION_TASK_EVENT_HOOK_CHANNEL, hookPayload);
        await this.publishMessage({
            senderAgentId: input.senderAgentId || 'orchestration-system',
            eventType,
            title: input.title || `Task Event: ${eventType}`,
            content: input.content || `Task ${taskId} emitted event ${eventType}`,
            payload: {
                taskId,
                planId: input.planId,
                status: input.status,
                ...(input.payload || {}),
            },
            source: 'orchestration',
            dedupKey: `${eventType}:${taskId}:${input.status || 'na'}`,
        });
    }
    async createOrUpdateSubscription(input) {
        const subscriberAgentId = String(input.subscriberAgentId || '').trim();
        const eventType = String(input.eventType || '').trim();
        if (!subscriberAgentId || !eventType) {
            throw new common_1.BadRequestException('subscriberAgentId and eventType are required');
        }
        const subscription = await this.subscriptionModel
            .findOneAndUpdate({ subscriberAgentId, eventType }, {
            $set: {
                filters: input.filters || {},
                isActive: input.isActive ?? true,
                source: input.source || 'inner-message',
            },
            $setOnInsert: {
                subscriberAgentId,
                eventType,
            },
        }, { upsert: true, new: true })
            .exec();
        await this.syncSubscriptionToRedis(subscription);
        await this.upsertEventDefinitionToRedis(eventType);
        await this.bumpSubscriptionVersion();
        return subscription;
    }
    async listSubscriptions(query) {
        const filter = {};
        if (query.subscriberAgentId) {
            filter.subscriberAgentId = String(query.subscriberAgentId).trim();
        }
        if (query.eventType) {
            filter.eventType = String(query.eventType).trim();
        }
        if (typeof query.isActive === 'boolean') {
            filter.isActive = query.isActive;
        }
        return this.subscriptionModel.find(filter).sort({ createdAt: -1 }).lean().exec();
    }
    async listEventDefinitions(query) {
        const domain = String(query?.domain || '').trim();
        const keyword = String(query?.keyword || '').trim().toLowerCase();
        const limit = Math.max(1, Math.min(500, Number(query?.limit || 200)));
        if (this.redisService.isReady()) {
            const eventTypes = await this.listEventTypesFromRedis({ domain, limit });
            const rows = await Promise.all(eventTypes.map(async (eventType) => {
                const raw = await this.redisService.hgetall(`${INNER_MESSAGE_REDIS_EVENT_DEF_KEY_PREFIX}${eventType}`);
                return this.parseEventDefinitionRecord(raw, eventType);
            }));
            const filtered = rows.filter((row) => Boolean(row)).filter((row) => {
                if (!keyword) {
                    return true;
                }
                return row.eventType.toLowerCase().includes(keyword) || row.domain.toLowerCase().includes(keyword);
            });
            if (filtered.length) {
                return filtered.slice(0, limit);
            }
        }
        const mongoFilter = {};
        if (domain) {
            mongoFilter.eventType = { $regex: `^${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.` };
        }
        const rawEventTypes = await this.subscriptionModel.distinct('eventType', mongoFilter).exec();
        const normalized = rawEventTypes
            .map((eventType) => String(eventType || '').trim())
            .filter((eventType) => Boolean(eventType))
            .filter((eventType) => {
            if (!keyword) {
                return true;
            }
            const currentDomain = this.getEventDomain(eventType);
            return eventType.toLowerCase().includes(keyword) || currentDomain.toLowerCase().includes(keyword);
        })
            .slice(0, limit);
        return normalized.map((eventType) => ({
            eventType,
            domain: this.getEventDomain(eventType),
            status: 'active',
            updatedAt: new Date(0).toISOString(),
        }));
    }
    async rebuildSubscriptionRedisIndex() {
        if (!this.redisService.isReady()) {
            return;
        }
        const [dataKeys, eventIndexKeys, domainIndexKeys, agentIndexKeys, domainEventDefKeys] = await Promise.all([
            this.redisService.keys(`${INNER_MESSAGE_REDIS_SUB_DATA_KEY_PREFIX}*`),
            this.redisService.keys(`${INNER_MESSAGE_REDIS_SUB_EVENT_INDEX_PREFIX}*`),
            this.redisService.keys(`${INNER_MESSAGE_REDIS_SUB_DOMAIN_INDEX_PREFIX}*`),
            this.redisService.keys(`${INNER_MESSAGE_REDIS_SUB_AGENT_INDEX_PREFIX}*`),
            this.redisService.keys(`${INNER_MESSAGE_REDIS_EVENT_DEF_DOMAIN_PREFIX}*`),
        ]);
        const staleKeys = [
            ...dataKeys,
            ...eventIndexKeys,
            ...domainIndexKeys,
            ...agentIndexKeys,
            ...domainEventDefKeys,
            INNER_MESSAGE_REDIS_SUB_GLOBAL_INDEX_KEY,
            exports.INNER_MESSAGE_REDIS_EVENT_DEF_ALL_KEY,
        ];
        await this.redisService.delMany(staleKeys);
        const subscriptions = await this.subscriptionModel.find({}).lean().exec();
        for (const subscription of subscriptions) {
            await this.syncSubscriptionToRedis(subscription);
        }
        await this.bumpSubscriptionVersion();
        this.subscriptionRedisIndexReady = true;
    }
    async acknowledgeMessage(messageId, receiverAgentId, status) {
        const now = new Date();
        const setPayload = {
            status,
        };
        if (status === 'delivered') {
            setPayload.deliveredAt = now;
        }
        else {
            setPayload.deliveredAt = now;
            setPayload.processingAt = now;
        }
        const updated = await this.messageModel
            .findOneAndUpdate({
            messageId,
            receiverAgentId,
            status: { $in: ['sent', 'delivered', 'processing'] },
        }, {
            $set: setPayload,
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Message not found or cannot be acknowledged');
        }
        return updated;
    }
    async markMessageProcessed(messageId, receiverAgentId, result) {
        const updated = await this.messageModel
            .findOneAndUpdate({
            messageId,
            receiverAgentId,
            status: { $in: ['delivered', 'processing'] },
        }, {
            $set: {
                status: 'processed',
                processedAt: new Date(),
                ...(result ? { 'payload.processingResult': result } : {}),
            },
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Message not found or cannot be marked as processed');
        }
        return updated;
    }
    async getMessageById(messageId) {
        return this.messageModel.findOne({ messageId }).exec();
    }
    async markDispatchAttempt(messageId, attempt) {
        await this.messageModel
            .updateOne({ messageId }, {
            $set: {
                attempt,
            },
        })
            .exec();
    }
    async markDispatchFailed(messageId, errorMessage) {
        await this.messageModel
            .updateOne({ messageId, status: { $in: ['sent', 'delivered', 'processing'] } }, {
            $set: {
                status: 'failed',
                failedAt: new Date(),
                error: errorMessage,
            },
        })
            .exec();
    }
    async publishToAgentInbox(message) {
        const channel = this.buildInboxChannel(message.receiverAgentId);
        const payload = {
            event: 'inner.message.received',
            messageId: message.messageId,
            mode: message.mode,
            eventType: message.eventType,
            senderAgentId: message.senderAgentId,
            receiverAgentId: message.receiverAgentId,
            title: message.title,
            content: message.content,
            payload: message.payload || {},
            sentAt: message.sentAt || new Date(),
        };
        return this.redisService.publish(channel, payload);
    }
    async requeueDispatch(envelope) {
        await this.redisService.lpush(exports.INNER_MESSAGE_DISPATCH_QUEUE_KEY, JSON.stringify(envelope));
    }
    async deadLetterDispatch(envelope, errorMessage) {
        await this.redisService.lpush(exports.INNER_MESSAGE_DISPATCH_DEAD_LETTER_KEY, JSON.stringify({
            ...envelope,
            error: errorMessage,
            failedAt: new Date().toISOString(),
        }));
    }
    async enqueueDispatch(message) {
        const envelope = {
            dispatchId: `${message.messageId}:${message.receiverAgentId}`,
            messageId: message.messageId,
            receiverAgentId: message.receiverAgentId,
            attempt: Number(message.attempt || 0),
            maxAttempts: Math.max(1, Number(message.maxAttempts || 3)),
            createdAt: new Date().toISOString(),
        };
        const queued = await this.redisService.lpush(exports.INNER_MESSAGE_DISPATCH_QUEUE_KEY, JSON.stringify(envelope));
        if (!queued) {
            this.logger.warn(`Inner message enqueue failed or redis unavailable: messageId=${message.messageId}`);
        }
    }
    buildInboxChannel(agentId) {
        return `inner:inbox:${agentId}`;
    }
    async getActiveSubscriptionsForEvent(eventType) {
        if (this.redisService.isReady()) {
            await this.ensureSubscriptionRedisIndexReady();
            const domain = this.getEventDomain(eventType);
            const candidateIds = await this.redisService.sunion([
                `${INNER_MESSAGE_REDIS_SUB_EVENT_INDEX_PREFIX}${eventType}`,
                `${INNER_MESSAGE_REDIS_SUB_DOMAIN_INDEX_PREFIX}${domain}`,
                INNER_MESSAGE_REDIS_SUB_GLOBAL_INDEX_KEY,
            ]);
            if (!candidateIds.length) {
                return [];
            }
            const records = await Promise.all(candidateIds.map(async (subscriptionId) => {
                const raw = await this.redisService.hgetall(`${INNER_MESSAGE_REDIS_SUB_DATA_KEY_PREFIX}${subscriptionId}`);
                return this.parseSubscriptionRecord(raw);
            }));
            const validRecords = records.filter((item) => Boolean(item?.isActive));
            if (validRecords.length) {
                return validRecords;
            }
        }
        const subscriptions = await this.subscriptionModel
            .find({ eventType: { $in: [eventType, '*', this.toDomainWildcard(eventType)] }, isActive: true })
            .lean()
            .exec();
        return subscriptions.map((subscription) => ({
            subscriptionId: String(subscription.subscriptionId || ''),
            subscriberAgentId: String(subscription.subscriberAgentId || ''),
            eventType: String(subscription.eventType || ''),
            filters: (subscription.filters || {}),
            isActive: Boolean(subscription.isActive),
            source: subscription.source,
        }));
    }
    async ensureSubscriptionRedisIndexReady() {
        if (this.subscriptionRedisIndexReady) {
            return;
        }
        if (!this.subscriptionRedisWarmupPromise) {
            this.subscriptionRedisWarmupPromise = this.rebuildSubscriptionRedisIndex()
                .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Failed to rebuild inner-message subscription redis index: ${message}`);
            })
                .finally(() => {
                this.subscriptionRedisWarmupPromise = null;
            });
        }
        await this.subscriptionRedisWarmupPromise;
    }
    async syncSubscriptionToRedis(subscription) {
        if (!this.redisService.isReady()) {
            return;
        }
        const subscriptionId = String(subscription.subscriptionId || '').trim();
        const subscriberAgentId = String(subscription.subscriberAgentId || '').trim();
        const eventType = String(subscription.eventType || '').trim();
        if (!subscriptionId || !subscriberAgentId || !eventType) {
            return;
        }
        const recordKey = `${INNER_MESSAGE_REDIS_SUB_DATA_KEY_PREFIX}${subscriptionId}`;
        const previous = await this.redisService.hgetall(recordKey);
        if (Object.keys(previous).length) {
            await this.removeSubscriptionIndices(subscriptionId, previous.eventType, previous.subscriberAgentId);
        }
        const normalizedFilters = subscription.filters && typeof subscription.filters === 'object' ? subscription.filters : {};
        const isActive = subscription.isActive !== false;
        const subscriptionMeta = subscription;
        const updatedAt = subscriptionMeta.updatedAt instanceof Date
            ? subscriptionMeta.updatedAt.toISOString()
            : String(subscriptionMeta.updatedAt || new Date().toISOString());
        await this.redisService.hset(recordKey, {
            subscriptionId,
            subscriberAgentId,
            eventType,
            filtersJson: JSON.stringify(normalizedFilters),
            isActive: isActive ? '1' : '0',
            source: String(subscription.source || 'inner-message'),
            updatedAt,
        });
        if (isActive) {
            await this.addSubscriptionIndices(subscriptionId, eventType, subscriberAgentId);
        }
    }
    async addSubscriptionIndices(subscriptionId, eventType, subscriberAgentId) {
        const indexKey = this.getSubscriptionEventIndexKey(eventType);
        await Promise.all([
            this.redisService.sadd(indexKey, [subscriptionId]),
            this.redisService.sadd(`${INNER_MESSAGE_REDIS_SUB_AGENT_INDEX_PREFIX}${subscriberAgentId}`, [subscriptionId]),
        ]);
    }
    async removeSubscriptionIndices(subscriptionId, eventType, subscriberAgentId) {
        if (!eventType || !subscriberAgentId) {
            return;
        }
        const indexKey = this.getSubscriptionEventIndexKey(eventType);
        await Promise.all([
            this.redisService.srem(indexKey, [subscriptionId]),
            this.redisService.srem(`${INNER_MESSAGE_REDIS_SUB_AGENT_INDEX_PREFIX}${subscriberAgentId}`, [subscriptionId]),
        ]);
    }
    parseSubscriptionRecord(raw) {
        const subscriptionId = String(raw.subscriptionId || '').trim();
        const subscriberAgentId = String(raw.subscriberAgentId || '').trim();
        const eventType = String(raw.eventType || '').trim();
        if (!subscriptionId || !subscriberAgentId || !eventType) {
            return null;
        }
        let filters = {};
        const filtersJson = String(raw.filtersJson || '').trim();
        if (filtersJson) {
            try {
                const parsed = JSON.parse(filtersJson);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    filters = parsed;
                }
            }
            catch {
                filters = {};
            }
        }
        return {
            subscriptionId,
            subscriberAgentId,
            eventType,
            filters,
            isActive: String(raw.isActive || '0') === '1',
            source: raw.source,
        };
    }
    async upsertEventDefinitionToRedis(eventType) {
        if (!this.redisService.isReady()) {
            return;
        }
        const normalized = String(eventType || '').trim();
        if (!normalized) {
            return;
        }
        const domain = this.getEventDomain(normalized);
        const now = Date.now();
        await Promise.all([
            this.redisService.hset(`${INNER_MESSAGE_REDIS_EVENT_DEF_KEY_PREFIX}${normalized}`, {
                eventType: normalized,
                domain,
                status: 'active',
                updatedAt: new Date(now).toISOString(),
            }),
            this.redisService.sadd(`${INNER_MESSAGE_REDIS_EVENT_DEF_DOMAIN_PREFIX}${domain}`, [normalized]),
            this.redisService.zadd(exports.INNER_MESSAGE_REDIS_EVENT_DEF_ALL_KEY, now, normalized),
        ]);
    }
    async listEventTypesFromRedis(input) {
        const domain = String(input.domain || '').trim();
        const limit = Math.max(1, Math.min(500, Number(input.limit || 200)));
        if (!domain) {
            const items = await this.redisService.zrevrange(exports.INNER_MESSAGE_REDIS_EVENT_DEF_ALL_KEY, 0, limit - 1);
            return items.map((item) => String(item || '').trim()).filter((item) => Boolean(item));
        }
        const items = await this.redisService.smembers(`${INNER_MESSAGE_REDIS_EVENT_DEF_DOMAIN_PREFIX}${domain}`);
        return items.map((item) => String(item || '').trim()).filter((item) => Boolean(item)).slice(0, limit);
    }
    parseEventDefinitionRecord(raw, fallbackEventType) {
        const eventType = String(raw.eventType || fallbackEventType || '').trim();
        if (!eventType) {
            return null;
        }
        const domain = String(raw.domain || this.getEventDomain(eventType)).trim() || this.getEventDomain(eventType);
        const status = String(raw.status || 'active').trim() || 'active';
        const updatedAt = String(raw.updatedAt || new Date(0).toISOString()).trim() || new Date(0).toISOString();
        return {
            eventType,
            domain,
            status,
            updatedAt,
        };
    }
    async bumpSubscriptionVersion() {
        if (!this.redisService.isReady()) {
            return;
        }
        await this.redisService.incr(exports.INNER_MESSAGE_REDIS_SUB_INDEX_VERSION_KEY);
    }
    getSubscriptionEventIndexKey(eventType) {
        if (eventType === '*') {
            return INNER_MESSAGE_REDIS_SUB_GLOBAL_INDEX_KEY;
        }
        if (eventType.endsWith('.*')) {
            return `${INNER_MESSAGE_REDIS_SUB_DOMAIN_INDEX_PREFIX}${this.getEventDomain(eventType)}`;
        }
        return `${INNER_MESSAGE_REDIS_SUB_EVENT_INDEX_PREFIX}${eventType}`;
    }
    getEventDomain(eventType) {
        const normalized = String(eventType || '').trim();
        if (!normalized || normalized === '*') {
            return 'global';
        }
        const [domain] = normalized.split('.');
        return domain || 'global';
    }
    toDomainWildcard(eventType) {
        const normalized = String(eventType || '').trim();
        const firstDotIndex = normalized.indexOf('.');
        if (firstDotIndex <= 0) {
            return '*';
        }
        return `${normalized.slice(0, firstDotIndex)}.*`;
    }
    matchesSubscriptionFilters(filters, payload) {
        const keys = Object.keys(filters || {});
        if (!keys.length) {
            return true;
        }
        return keys.every((key) => {
            const expected = filters[key];
            const actual = payload[key];
            if (expected === undefined || expected === null || expected === '') {
                return true;
            }
            if (Array.isArray(expected)) {
                return expected.map((item) => String(item)).includes(String(actual));
            }
            return String(actual) === String(expected);
        });
    }
};
exports.InnerMessageService = InnerMessageService;
exports.InnerMessageService = InnerMessageService = InnerMessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(inner_message_schema_1.InnerMessage.name)),
    __param(1, (0, mongoose_1.InjectModel)(inner_message_subscription_schema_1.InnerMessageSubscription.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        infra_1.RedisService])
], InnerMessageService);
//# sourceMappingURL=inner-message.service.js.map