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
var HookDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../libs/infra/src/index");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const runtime_action_log_service_1 = require("./runtime-action-log.service");
let HookDispatcherService = HookDispatcherService_1 = class HookDispatcherService {
    constructor(redisService, persistence, runtimeActionLogIngestionService, messageBus) {
        this.redisService = redisService;
        this.persistence = persistence;
        this.runtimeActionLogIngestionService = runtimeActionLogIngestionService;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(HookDispatcherService_1.name);
        this.flushing = false;
        this.metrics = {
            published: 0,
            failed: 0,
            replayPublished: 0,
            replayFailed: 0,
            flushRuns: 0,
            lastFlushAt: 0,
        };
        this.useBusForEvents = process.env.MESSAGE_BUS_ENABLED !== 'false';
    }
    onModuleInit() {
        this.timer = setInterval(() => {
            void this.flushOutbox();
        }, 2000);
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    async dispatch(event, options) {
        const shouldUpdateOutboxStatus = options?.updateOutboxStatus !== false;
        try {
            if (this.useBusForEvents && !options?.channel) {
                const result = await this.messageBus.publish('runtime.events', {
                    payload: event,
                    partitionKey: event.agentId,
                });
                if (!result.accepted) {
                    throw new Error('MessageBus publish not accepted');
                }
            }
            else {
                const channel = options?.channel || this.getChannel(event);
                if (!this.redisService.isReady()) {
                    throw new Error('Redis pub/sub is not ready');
                }
                await this.redisService.publish(channel, event);
            }
            if (!options?.replay) {
                await this.runtimeActionLogIngestionService.syncRuntimeEvent(event);
            }
            if (options?.replay) {
                this.metrics.replayPublished += 1;
            }
            else {
                this.metrics.published += 1;
            }
            if (shouldUpdateOutboxStatus) {
                await this.persistence.markEventDispatched(event.eventId);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown hook dispatch error';
            if (options?.replay) {
                this.metrics.replayFailed += 1;
            }
            else {
                this.metrics.failed += 1;
            }
            this.logger.warn(`Hook dispatch failed eventId=${event.eventId} type=${event.eventType}: ${message}`);
            if (shouldUpdateOutboxStatus) {
                await this.persistence.markEventFailed(event.eventId, message);
            }
        }
    }
    async flushOutbox() {
        if (this.flushing)
            return;
        this.flushing = true;
        try {
            this.metrics.flushRuns += 1;
            this.metrics.lastFlushAt = Date.now();
            const records = await this.persistence.findDispatchableEvents(100);
            for (const record of records) {
                const event = {
                    eventId: record.eventId,
                    eventType: record.eventType,
                    agentId: record.agentId,
                    sessionId: record.sessionId,
                    runId: record.runId,
                    taskId: record.taskId,
                    messageId: record.messageId,
                    partId: record.partId,
                    toolCallId: record.toolCallId,
                    sequence: record.sequence,
                    timestamp: record.timestamp.getTime(),
                    traceId: record.payload?.traceId || `trace-replay-${record.eventId}`,
                    payload: record.payload || {},
                };
                await this.dispatch(event);
            }
        }
        finally {
            this.flushing = false;
        }
    }
    getMetrics() {
        return {
            ...this.metrics,
            queueFlushing: this.flushing,
        };
    }
    getChannel(event) {
        return `agent-runtime:${event.agentId}`;
    }
};
exports.HookDispatcherService = HookDispatcherService;
exports.HookDispatcherService = HookDispatcherService = HookDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [infra_1.RedisService,
        runtime_persistence_service_1.RuntimePersistenceService,
        runtime_action_log_service_1.RuntimeActionLogIngestionService, Object])
], HookDispatcherService);
//# sourceMappingURL=hook-dispatcher.service.js.map