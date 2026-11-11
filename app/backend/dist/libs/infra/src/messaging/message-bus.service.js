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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBusService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("../../../common/src/index");
const redis_service_1 = require("../redis.service");
const message_envelope_1 = require("./message-envelope");
const topic_registry_1 = require("./topic-registry");
const topic_router_service_1 = require("./topic-router.service");
const redis_pubsub_adapter_1 = require("./adapters/redis-pubsub.adapter");
const redis_stream_adapter_1 = require("./adapters/redis-stream.adapter");
let MessageBusService = class MessageBusService {
    constructor(redis) {
        this.redis = redis;
        this.logger = (0, common_2.createServiceLogger)('MessageBusService');
        this.adaptersRegistered = false;
        this.enabled = process.env.MESSAGE_BUS_ENABLED !== 'false';
        this.registry = new topic_registry_1.TopicRegistry(topic_registry_1.DEFAULT_TOPICS);
        this.router = new topic_router_service_1.TopicRouterService(this.registry);
        this.ensureAdaptersRegistered();
    }
    onModuleInit() {
        if (!this.enabled) {
            this.logger.log('MessageBus disabled (MESSAGE_BUS_ENABLED=false)');
            return;
        }
        this.ensureAdaptersRegistered();
        const topicCount = this.registry.list().length;
        this.logger.log(`MessageBus initialized — ${topicCount} topics registered, 2 adapters (redis-pubsub, redis-stream)`);
    }
    ensureAdaptersRegistered() {
        if (!this.enabled || this.adaptersRegistered) {
            return;
        }
        const pubsubAdapter = new redis_pubsub_adapter_1.RedisPubSubAdapter(this.redis, this.registry);
        const streamAdapter = new redis_stream_adapter_1.RedisStreamAdapter(this.redis, this.registry);
        this.router.registerAdapter(pubsubAdapter);
        this.router.registerAdapter(streamAdapter);
        this.adaptersRegistered = true;
    }
    async publish(topic, message) {
        if (!this.enabled) {
            return { messageId: 'disabled', accepted: false };
        }
        this.ensureAdaptersRegistered();
        const { adapter, config } = this.router.resolve(topic);
        const envelope = (0, message_envelope_1.buildMessageEnvelope)(topic, message.payload, {
            ...message.headers,
            partitionKey: message.partitionKey ?? message.headers?.partitionKey,
        });
        return adapter.publish(envelope, config);
    }
    async subscribe(topic, handler, options) {
        if (!this.enabled) {
            return { unsubscribe: async () => { } };
        }
        this.ensureAdaptersRegistered();
        const { adapter, config } = this.router.resolve(topic);
        return adapter.subscribe(config, handler, options);
    }
    registerTopic(config) {
        this.registry.register(config);
        this.logger.log(`Topic registered at runtime: ${config.name} (adapter=${config.adapter})`);
    }
    async healthCheck() {
        return this.router.healthCheck();
    }
    listTopics() {
        return this.registry.list();
    }
    getRouter() {
        return this.router;
    }
};
exports.MessageBusService = MessageBusService;
exports.MessageBusService = MessageBusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], MessageBusService);
//# sourceMappingURL=message-bus.service.js.map