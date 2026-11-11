"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicRouterService = void 0;
const common_1 = require("../../../common/src/index");
class TopicRouterService {
    constructor(registry) {
        this.registry = registry;
        this.logger = (0, common_1.createServiceLogger)('TopicRouter');
        this.adapters = new Map();
    }
    registerAdapter(adapter) {
        this.adapters.set(adapter.type, adapter);
        this.logger.log(`Adapter registered: ${adapter.type}`);
    }
    resolve(topicName) {
        const config = this.registry.get(topicName);
        if (!config) {
            throw new Error(`[TopicRouter] Unknown topic "${topicName}". Register it in TopicRegistry first.`);
        }
        const adapter = this.adapters.get(config.adapter);
        if (!adapter) {
            throw new Error(`[TopicRouter] No adapter registered for type "${config.adapter}" (topic "${topicName}"). ` +
                `Available adapters: [${Array.from(this.adapters.keys()).join(', ')}]`);
        }
        return { adapter, config };
    }
    async healthCheck() {
        const results = [];
        for (const [type, adapter] of this.adapters) {
            const status = await adapter.healthCheck();
            results.push({ type, ...status });
        }
        return results;
    }
    getRegistry() {
        return this.registry;
    }
}
exports.TopicRouterService = TopicRouterService;
//# sourceMappingURL=topic-router.service.js.map