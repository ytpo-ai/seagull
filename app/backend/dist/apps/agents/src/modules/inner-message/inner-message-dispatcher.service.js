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
var InnerMessageDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerMessageDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const inner_message_service_1 = require("./inner-message.service");
const infra_1 = require("../../../../../libs/infra/src/index");
const inner_message_agent_runtime_bridge_service_1 = require("./inner-message-agent-runtime-bridge.service");
let InnerMessageDispatcherService = InnerMessageDispatcherService_1 = class InnerMessageDispatcherService {
    constructor(innerMessageService, redisService, innerMessageAgentRuntimeBridgeService) {
        this.innerMessageService = innerMessageService;
        this.redisService = redisService;
        this.innerMessageAgentRuntimeBridgeService = innerMessageAgentRuntimeBridgeService;
        this.logger = new common_1.Logger(InnerMessageDispatcherService_1.name);
        this.running = false;
    }
    onModuleInit() {
        this.running = true;
        void this.consumeLoop();
    }
    onModuleDestroy() {
        this.running = false;
    }
    async consumeLoop() {
        while (this.running) {
            try {
                if (!this.redisService.isReady()) {
                    await this.sleep(1000);
                    continue;
                }
                const payload = await this.redisService.brpop(inner_message_service_1.INNER_MESSAGE_DISPATCH_QUEUE_KEY, 2);
                if (!payload) {
                    continue;
                }
                await this.handlePayload(payload);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Inner message dispatch consume loop error: ${message}`);
                await this.sleep(1000);
            }
        }
    }
    async handlePayload(payload) {
        let envelope;
        try {
            envelope = JSON.parse(payload);
        }
        catch {
            this.logger.warn('Ignored malformed inner message dispatch payload');
            return;
        }
        if (!envelope?.messageId || !envelope?.receiverAgentId) {
            this.logger.warn('Ignored invalid inner message dispatch payload');
            return;
        }
        const message = await this.innerMessageService.getMessageById(envelope.messageId);
        if (!message) {
            this.logger.warn(`Message not found for dispatch: messageId=${envelope.messageId}`);
            return;
        }
        if (['processed', 'failed'].includes(String(message.status || '').trim())) {
            return;
        }
        try {
            const nextAttempt = Number(envelope.attempt || 0) + 1;
            await this.innerMessageService.markDispatchAttempt(envelope.messageId, nextAttempt);
            await this.innerMessageService.publishToAgentInbox(message);
            await this.innerMessageAgentRuntimeBridgeService.processMessage(message);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const nextAttempt = Number(envelope.attempt || 0) + 1;
            const maxAttempts = Math.max(1, Number(envelope.maxAttempts || 3));
            if (nextAttempt < maxAttempts) {
                await this.innerMessageService.requeueDispatch({
                    ...envelope,
                    attempt: nextAttempt,
                    maxAttempts,
                });
                this.logger.warn(`Inner message dispatch retry queued messageId=${envelope.messageId} attempt=${nextAttempt}/${maxAttempts}: ${errorMessage}`);
                return;
            }
            await this.innerMessageService.markDispatchFailed(envelope.messageId, errorMessage);
            await this.innerMessageService.deadLetterDispatch({
                ...envelope,
                attempt: nextAttempt,
                maxAttempts,
            }, errorMessage);
            this.logger.error(`Inner message dispatch moved to dead letter messageId=${envelope.messageId} attempts=${maxAttempts}: ${errorMessage}`);
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.InnerMessageDispatcherService = InnerMessageDispatcherService;
exports.InnerMessageDispatcherService = InnerMessageDispatcherService = InnerMessageDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inner_message_service_1.InnerMessageService,
        infra_1.RedisService,
        inner_message_agent_runtime_bridge_service_1.InnerMessageAgentRuntimeBridgeService])
], InnerMessageDispatcherService);
//# sourceMappingURL=inner-message-dispatcher.service.js.map