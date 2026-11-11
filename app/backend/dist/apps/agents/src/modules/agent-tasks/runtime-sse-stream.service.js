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
var RuntimeSseStreamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeSseStreamService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const infra_1 = require("../../../../../libs/infra/src/index");
let RuntimeSseStreamService = RuntimeSseStreamService_1 = class RuntimeSseStreamService {
    constructor(redisService) {
        this.redisService = redisService;
        this.logger = new common_1.Logger(RuntimeSseStreamService_1.name);
        this.heartbeatIntervalMs = Math.max(5000, Number(process.env.AGENT_TASK_SSE_HEARTBEAT_MS || 15000));
    }
    buildTaskChannel(taskId) {
        return `agent-task-events:${taskId}`;
    }
    createTaskSseStream(options) {
        const { taskId, replay } = options;
        return new rxjs_1.Observable((subscriber) => {
            replay.forEach((event) => {
                subscriber.next(this.toSseMessage(event));
            });
            const channel = this.buildTaskChannel(taskId);
            const listener = (message) => {
                try {
                    const parsed = JSON.parse(message);
                    subscriber.next(this.toSseMessage(parsed));
                }
                catch (error) {
                    const reason = error instanceof Error ? error.message : 'unknown';
                    this.logger.warn(`Failed to parse task event message taskId=${taskId}: ${reason}`);
                }
            };
            void this.redisService.subscribe(channel, listener).catch((error) => {
                const reason = error instanceof Error ? error.message : 'unknown';
                this.logger.warn(`Subscribe task channel failed taskId=${taskId}: ${reason}`);
            });
            const timer = setInterval(() => {
                const heartbeat = {
                    id: `hb-${Date.now()}`,
                    type: 'heartbeat',
                    taskId,
                    sequence: 0,
                    timestamp: new Date().toISOString(),
                    payload: {
                        ok: true,
                    },
                };
                subscriber.next(this.toSseMessage(heartbeat));
            }, this.heartbeatIntervalMs);
            return () => {
                clearInterval(timer);
                void this.redisService.unsubscribe(channel, listener).catch(() => undefined);
            };
        });
    }
    toSseMessage(event) {
        return {
            id: event.id,
            type: event.type,
            data: event,
        };
    }
};
exports.RuntimeSseStreamService = RuntimeSseStreamService;
exports.RuntimeSseStreamService = RuntimeSseStreamService = RuntimeSseStreamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService])
], RuntimeSseStreamService);
//# sourceMappingURL=runtime-sse-stream.service.js.map