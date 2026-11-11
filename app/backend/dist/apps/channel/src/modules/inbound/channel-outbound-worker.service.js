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
var ChannelOutboundWorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelOutboundWorkerService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../libs/infra/src/index");
const feishu_app_provider_1 = require("../../providers/feishu/feishu-app.provider");
const channel_session_service_1 = require("./channel-session.service");
let ChannelOutboundWorkerService = ChannelOutboundWorkerService_1 = class ChannelOutboundWorkerService {
    constructor(redisService, feishuAppProvider, channelSessionService) {
        this.redisService = redisService;
        this.feishuAppProvider = feishuAppProvider;
        this.channelSessionService = channelSessionService;
        this.logger = new common_1.Logger(ChannelOutboundWorkerService_1.name);
        this.messageListener = (message) => {
            void this.handleMessage(message);
        };
    }
    async onModuleInit() {
        await this.redisService.subscribe(infra_1.CHANNEL_OUTBOUND_FEISHU_CHANNEL, this.messageListener);
    }
    async onModuleDestroy() {
        await this.redisService.unsubscribe(infra_1.CHANNEL_OUTBOUND_FEISHU_CHANNEL, this.messageListener);
    }
    async handleMessage(raw) {
        let payload;
        try {
            payload = JSON.parse(raw);
        }
        catch {
            this.logger.warn('Ignored malformed outbound payload');
            return;
        }
        const chatId = String(payload.chatId || '').trim();
        const text = this.normalizeReplyText(String(payload.text || '').trim());
        if (!chatId || !text) {
            return;
        }
        try {
            await this.feishuAppProvider.replyText(chatId, text, payload.replyToMessageId);
            if (payload.channelSessionId && payload.sessionId) {
                await this.channelSessionService.updateAgentSessionId(payload.channelSessionId, payload.sessionId);
            }
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown_error');
            this.logger.warn(`Outbound feishu reply failed: ${reason}`);
        }
    }
    normalizeReplyText(text) {
        const normalized = String(text || '').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.length <= 500) {
            return normalized;
        }
        const hardLimit = 500;
        const softStart = 360;
        const chunk = normalized.slice(0, hardLimit);
        const newlineCut = chunk.lastIndexOf('\n');
        const sentenceCut = Math.max(chunk.lastIndexOf('。'), chunk.lastIndexOf('. '));
        const cutAt = Math.max(newlineCut, sentenceCut);
        const safeCut = cutAt >= softStart ? cutAt + 1 : hardLimit;
        return `${normalized.slice(0, safeCut).trim()}\n\n（内容较长，已截断展示）`;
    }
};
exports.ChannelOutboundWorkerService = ChannelOutboundWorkerService;
exports.ChannelOutboundWorkerService = ChannelOutboundWorkerService = ChannelOutboundWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService,
        feishu_app_provider_1.FeishuAppProvider,
        channel_session_service_1.ChannelSessionService])
], ChannelOutboundWorkerService);
//# sourceMappingURL=channel-outbound-worker.service.js.map