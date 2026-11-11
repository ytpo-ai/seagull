"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStreamAdapter = void 0;
const crypto_1 = require("crypto");
const common_1 = require("../../../../common/src/index");
const ENV_DEFAULTS = {
    batchSize: Math.max(1, Number(process.env.MESSAGE_BUS_STREAM_BATCH_SIZE || 10)),
    blockMs: Math.max(0, Number(process.env.MESSAGE_BUS_STREAM_BLOCK_MS || 2000)),
    maxRetries: Math.max(0, Number(process.env.MESSAGE_BUS_STREAM_MAX_RETRIES || 5)),
    retryBackoffMs: Math.max(100, Number(process.env.MESSAGE_BUS_STREAM_RETRY_BACKOFF_MS || 5000)),
    defaultMaxLen: Math.max(1000, Number(process.env.MESSAGE_BUS_STREAM_DEFAULT_MAX_LEN || 100000)),
};
class RedisStreamAdapter {
    constructor(redis, registry) {
        this.redis = redis;
        this.type = 'redis-stream';
        this.logger = (0, common_1.createServiceLogger)('RedisStreamAdapter');
        this.registry = registry;
    }
    async publish(envelope, config) {
        const streamKey = this.registry.resolveBackendKey(config, envelope.headers.partitionKey);
        const maxLen = config.maxLen ?? ENV_DEFAULTS.defaultMaxLen;
        try {
            const fields = {
                event: JSON.stringify(envelope),
            };
            const sequenceId = await this.redis.xadd(streamKey, fields, { maxLen, approximate: true });
            return {
                messageId: envelope.messageId,
                sequenceId: sequenceId ?? undefined,
                accepted: !!sequenceId,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`[stream_publish_failed] topic=${config.name} stream=${streamKey} error=${msg}`);
            return { messageId: envelope.messageId, accepted: false };
        }
    }
    async subscribe(config, handler, options) {
        const streamKey = this.registry.resolveBackendKey(config, undefined);
        const group = options?.group || config.consumerGroup || `${config.name}-group`;
        const consumer = options?.consumer || `consumer-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        const batchSize = options?.batchSize ?? ENV_DEFAULTS.batchSize;
        const blockMs = options?.blockMs ?? ENV_DEFAULTS.blockMs;
        const maxRetries = config.maxRetries ?? ENV_DEFAULTS.maxRetries;
        const dlqKey = config.dlqKey;
        let running = true;
        const loop = async () => {
            await this.ensureGroup(streamKey, group);
            while (running) {
                if (!this.redis.isReady()) {
                    await this.sleep(1000);
                    continue;
                }
                try {
                    const results = await this.redis.xreadgroup(streamKey, group, consumer, {
                        count: batchSize,
                        blockMs,
                        streamId: '>',
                    });
                    if (!results.length)
                        continue;
                    for (const streamResult of results) {
                        for (const message of streamResult.messages) {
                            if (!running)
                                break;
                            await this.processMessage(streamKey, group, message.id, message.fields, config, handler, maxRetries, dlqKey);
                        }
                    }
                }
                catch (error) {
                    if (!running)
                        break;
                    const msg = error instanceof Error ? error.message : String(error);
                    this.logger.warn(`[stream_consume_error] topic=${config.name} stream=${streamKey} group=${group} error=${msg}`);
                    await this.sleep(1000);
                }
            }
        };
        void loop();
        return {
            unsubscribe: async () => {
                running = false;
            },
        };
    }
    async processMessage(streamKey, group, entryId, fields, config, handler, maxRetries, dlqKey) {
        let envelope;
        try {
            const raw = fields['event'] || fields['data'] || '';
            envelope = JSON.parse(raw);
        }
        catch {
            this.logger.warn(`[stream_parse_error] topic=${config.name} stream=${streamKey} entryId=${entryId} — moving to DLQ`);
            await this.moveToDlq(streamKey, group, entryId, fields, dlqKey, 'parse_error');
            return;
        }
        const retryCount = envelope.headers?.retryCount ?? 0;
        let nackCalled = false;
        let nackReason;
        let nackNoRetry = false;
        try {
            await handler({
                envelope,
                ack: async () => {
                    await this.redis.xack(streamKey, group, [entryId]);
                },
                nack: async (reason, options) => {
                    nackCalled = true;
                    nackReason = reason;
                    nackNoRetry = options?.noRetry === true;
                },
            });
            if (!nackCalled) {
                await this.redis.xack(streamKey, group, [entryId]);
                return;
            }
            await this.handleNack(streamKey, group, entryId, fields, envelope, retryCount, nackNoRetry ? 0 : maxRetries, dlqKey, nackReason, config);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.handleNack(streamKey, group, entryId, fields, envelope, retryCount, maxRetries, dlqKey, msg, config);
        }
    }
    async handleNack(streamKey, group, entryId, fields, envelope, retryCount, maxRetries, dlqKey, reason, config) {
        await this.redis.xack(streamKey, group, [entryId]);
        if (retryCount < maxRetries) {
            const retryEnvelope = {
                ...envelope,
                headers: {
                    ...envelope.headers,
                    retryCount: retryCount + 1,
                    correlationId: envelope.headers?.correlationId || envelope.messageId,
                    lastNackReason: reason,
                },
            };
            const maxLen = config.maxLen ?? ENV_DEFAULTS.defaultMaxLen;
            await this.redis.xadd(streamKey, { event: JSON.stringify(retryEnvelope) }, { maxLen, approximate: true });
            this.logger.warn(`[stream_retry] topic=${config.name} messageId=${envelope.messageId} retry=${retryCount + 1}/${maxRetries} reason=${reason || 'unknown'}`);
        }
        else {
            await this.moveToDlq(streamKey, group, entryId, fields, dlqKey, reason);
            this.logger.warn(`[stream_dlq] topic=${config.name} messageId=${envelope.messageId} retries_exhausted reason=${reason || 'unknown'}`);
        }
    }
    async moveToDlq(streamKey, group, entryId, fields, dlqKey, reason) {
        const targetDlq = dlqKey || `${streamKey}:dlq`;
        try {
            await this.redis.xadd(targetDlq, {
                ...fields,
                dlq_reason: reason || 'unknown',
                dlq_source_stream: streamKey,
                dlq_source_group: group,
                dlq_source_entry_id: entryId,
                dlq_timestamp: new Date().toISOString(),
            }, { maxLen: 10000, approximate: true });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`[stream_dlq_write_failed] stream=${streamKey} dlq=${targetDlq} error=${msg}`);
        }
    }
    async ensureGroup(streamKey, group) {
        try {
            await this.redis.xgroupCreate(streamKey, group, '0', true);
        }
        catch {
        }
    }
    async healthCheck() {
        const ready = this.redis.isReady();
        return { healthy: ready, details: ready ? 'redis streams ready' : 'redis not ready' };
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.RedisStreamAdapter = RedisStreamAdapter;
//# sourceMappingURL=redis-stream.adapter.js.map