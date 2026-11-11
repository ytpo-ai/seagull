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
var ChannelInboundWorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelInboundWorkerService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../libs/infra/src/index");
const channel_inbound_service_1 = require("./channel-inbound.service");
let ChannelInboundWorkerService = ChannelInboundWorkerService_1 = class ChannelInboundWorkerService {
    constructor(redisService, channelInboundService) {
        this.redisService = redisService;
        this.channelInboundService = channelInboundService;
        this.logger = new common_1.Logger(ChannelInboundWorkerService_1.name);
        this.queueKey = infra_1.CHANNEL_INBOUND_QUEUE_KEY;
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
                const payload = await this.redisService.brpop(this.queueKey, 2);
                if (!payload) {
                    continue;
                }
                await this.handlePayload(payload);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error || 'unknown_error');
                this.logger.warn(`Inbound worker consume loop error: ${reason}`);
                await this.sleep(1000);
            }
        }
    }
    async handlePayload(payload) {
        let event;
        try {
            event = JSON.parse(payload);
        }
        catch {
            this.logger.warn('Ignored malformed inbound payload');
            return;
        }
        if (!event?.externalUserId || !event?.externalChatId || !event?.messageId) {
            this.logger.warn('Ignored invalid inbound payload');
            return;
        }
        await this.channelInboundService.handleInboundEvent(event);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.ChannelInboundWorkerService = ChannelInboundWorkerService;
exports.ChannelInboundWorkerService = ChannelInboundWorkerService = ChannelInboundWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService,
        channel_inbound_service_1.ChannelInboundService])
], ChannelInboundWorkerService);
//# sourceMappingURL=channel-inbound-worker.service.js.map