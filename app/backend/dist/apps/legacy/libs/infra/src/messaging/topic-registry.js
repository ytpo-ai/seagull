"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicRegistry = exports.DEFAULT_TOPICS = void 0;
exports.DEFAULT_TOPICS = [
    {
        name: 'runtime.events',
        deliveryMode: 'fire-and-forget',
        adapter: 'redis-pubsub',
        backendKey: 'agent-runtime:{partitionKey}',
    },
    {
        name: 'task.events',
        deliveryMode: 'fire-and-forget',
        adapter: 'redis-pubsub',
        backendKey: 'agent-task-events:{partitionKey}',
    },
    {
        name: 'meeting.events',
        deliveryMode: 'fire-and-forget',
        adapter: 'redis-pubsub',
        backendKey: 'meeting:{partitionKey}',
    },
    {
        name: 'runtime.ei-sync',
        deliveryMode: 'reliable',
        adapter: 'redis-stream',
        backendKey: 'streams:runtime:ei-sync',
        consumerGroup: 'ei-sync-group',
        dlqKey: 'streams:runtime:ei-sync:dlq',
        maxRetries: 5,
        retryBackoffMs: 5000,
        maxLen: 100000,
    },
    {
        name: 'message-center.events',
        deliveryMode: 'reliable',
        adapter: 'redis-stream',
        backendKey: 'streams:message-center:events',
        consumerGroup: 'message-center-group',
        dlqKey: 'streams:message-center:events:dlq',
        maxRetries: 5,
        retryBackoffMs: 5000,
        maxLen: 100000,
    },
    {
        name: 'channel.events',
        deliveryMode: 'reliable',
        adapter: 'redis-stream',
        backendKey: 'streams:channel:events',
        consumerGroup: 'channel-group',
        dlqKey: 'streams:channel:events:dlq',
        maxRetries: 5,
        retryBackoffMs: 5000,
        maxLen: 100000,
    },
];
class TopicRegistry {
    constructor(initialTopics = exports.DEFAULT_TOPICS) {
        this.topics = new Map();
        for (const topic of initialTopics) {
            this.topics.set(topic.name, topic);
        }
    }
    register(config) {
        this.topics.set(config.name, config);
    }
    get(topicName) {
        return this.topics.get(topicName);
    }
    list() {
        return Array.from(this.topics.values());
    }
    resolveBackendKey(config, partitionKey) {
        const raw = config.backendKey || `streams:${config.name.replace(/\./g, ':')}`;
        if (!partitionKey)
            return raw;
        return raw.replace('{partitionKey}', partitionKey);
    }
}
exports.TopicRegistry = TopicRegistry;
//# sourceMappingURL=topic-registry.js.map