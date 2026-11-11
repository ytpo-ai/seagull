"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPubSubAdapter = void 0;
const common_1 = require("../../../../common/src/index");
class RedisPubSubAdapter {
    constructor(redis, registry) {
        this.redis = redis;
        this.type = 'redis-pubsub';
        this.logger = (0, common_1.createServiceLogger)('RedisPubSubAdapter');
        this.registry = registry;
    }
    async publish(envelope, config) {
        const channel = this.registry.resolveBackendKey(config, envelope.headers.partitionKey);
        try {
            const message = JSON.stringify(envelope);
            await this.redis.publish(channel, message);
            return { messageId: envelope.messageId, accepted: true };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`[pubsub_publish_failed] topic=${config.name} channel=${channel} error=${msg}`);
            return { messageId: envelope.messageId, accepted: false };
        }
    }
    async subscribe(config, handler, options) {
        const channel = config.backendKey || config.name;
        const listener = async (raw) => {
            try {
                const envelope = JSON.parse(raw);
                await handler({
                    envelope,
                    ack: async () => {
                    },
                    nack: async () => {
                    },
                });
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                this.logger.warn(`[pubsub_consume_error] topic=${config.name} channel=${channel} error=${msg}`);
            }
        };
        await this.redis.subscribe(channel, listener);
        return {
            unsubscribe: async () => {
                await this.redis.unsubscribe(channel, listener);
            },
        };
    }
    async healthCheck() {
        const ready = this.redis.isReady();
        return { healthy: ready, details: ready ? 'redis pub/sub ready' : 'redis not ready' };
    }
}
exports.RedisPubSubAdapter = RedisPubSubAdapter;
//# sourceMappingURL=redis-pubsub.adapter.js.map