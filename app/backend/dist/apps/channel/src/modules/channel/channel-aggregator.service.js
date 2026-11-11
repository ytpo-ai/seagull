"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelAggregatorService = void 0;
const common_1 = require("@nestjs/common");
let ChannelAggregatorService = class ChannelAggregatorService {
    constructor() {
        this.bucketMap = new Map();
        this.windowMs = Math.max(1000, Number(process.env.CHANNEL_AGENT_LOG_AGGREGATION_WINDOW_MS || 60000));
    }
    queue(target, event, onFlush) {
        const key = this.buildKey(target.configId, event.eventType);
        const existing = this.bucketMap.get(key);
        if (existing) {
            existing.events.push(event);
            return;
        }
        const timer = setTimeout(() => {
            void this.flushBucket(key, onFlush);
        }, this.windowMs);
        this.bucketMap.set(key, {
            target,
            eventType: event.eventType,
            events: [event],
            timer,
        });
    }
    getWindowSeconds() {
        return Math.ceil(this.windowMs / 1000);
    }
    async flushAll(onFlush) {
        const entries = Array.from(this.bucketMap.entries());
        this.bucketMap.clear();
        for (const [, bucket] of entries) {
            clearTimeout(bucket.timer);
            await onFlush(bucket.target, bucket.eventType, bucket.events);
        }
    }
    async onModuleDestroy() {
        await this.flushAll(async () => undefined);
    }
    async flushBucket(key, onFlush) {
        const bucket = this.bucketMap.get(key);
        if (!bucket) {
            return;
        }
        this.bucketMap.delete(key);
        clearTimeout(bucket.timer);
        await onFlush(bucket.target, bucket.eventType, bucket.events);
    }
    buildKey(configId, eventType) {
        return `${configId}:${eventType}`;
    }
};
exports.ChannelAggregatorService = ChannelAggregatorService;
exports.ChannelAggregatorService = ChannelAggregatorService = __decorate([
    (0, common_1.Injectable)()
], ChannelAggregatorService);
//# sourceMappingURL=channel-aggregator.service.js.map