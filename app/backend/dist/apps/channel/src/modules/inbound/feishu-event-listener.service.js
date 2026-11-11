"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FeishuEventListenerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuEventListenerService = void 0;
const common_1 = require("@nestjs/common");
const lark = __importStar(require("@larksuiteoapi/node-sdk"));
const channel_inbound_service_1 = require("./channel-inbound.service");
const feishu_app_provider_1 = require("../../providers/feishu/feishu-app.provider");
let FeishuEventListenerService = FeishuEventListenerService_1 = class FeishuEventListenerService {
    constructor(channelInboundService, feishuAppProvider) {
        this.channelInboundService = channelInboundService;
        this.feishuAppProvider = feishuAppProvider;
        this.logger = new common_1.Logger(FeishuEventListenerService_1.name);
        this.inboundEnabled = String(process.env.CHANNEL_INBOUND_ENABLED || 'false').toLowerCase() === 'true';
        this.appId = String(process.env.FEISHU_APP_ID || '').trim();
        this.appSecret = String(process.env.FEISHU_APP_SECRET || '').trim();
        this.botOpenId = String(process.env.FEISHU_BOT_OPEN_ID || '').trim();
    }
    onModuleInit() {
        if (!this.inboundEnabled) {
            this.logger.log('Inbound listener disabled by CHANNEL_INBOUND_ENABLED');
            return;
        }
        if (!this.appId || !this.appSecret) {
            this.logger.warn('Inbound listener skipped: FEISHU_APP_ID/FEISHU_APP_SECRET not configured');
            return;
        }
        try {
            this.startWsClient();
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown_error');
            this.logger.error(`Failed to start Feishu WS listener: ${reason}`);
        }
    }
    startWsClient() {
        const larkAny = lark;
        const eventDispatcher = new larkAny.EventDispatcher({});
        eventDispatcher.register({
            'im.message.receive_v1': async (raw) => {
                await this.handleIncomingMessage(raw);
            },
            'card.action.trigger': async (raw) => {
                await this.handleCardAction(raw);
            },
        });
        this.wsClient = new larkAny.WSClient({
            appId: this.appId,
            appSecret: this.appSecret,
            loggerLevel: larkAny.LoggerLevel?.info,
        });
        this.wsClient.start({ eventDispatcher });
        this.logger.log('Feishu WS listener started');
    }
    async handleIncomingMessage(raw) {
        const payload = this.extractPayload(raw);
        const event = payload?.event || payload?.data || payload;
        const externalUserId = String(event?.sender?.sender_id?.open_id || '').trim();
        const externalChatId = String(event?.message?.chat_id || '').trim();
        const messageId = String(event?.message?.message_id || '').trim();
        const chatType = String(event?.message?.chat_type || 'p2p').trim();
        const content = this.parseMessageContent(String(event?.message?.content || '').trim());
        const messageText = this.sanitizeIncomingText(String(content?.text || '').trim());
        const mentions = this.extractMentionIds(event?.message?.mentions);
        if (!externalUserId || !externalChatId || !messageId || !messageText) {
            return;
        }
        if (chatType === 'group' && this.botOpenId && !mentions.includes(this.botOpenId)) {
            return;
        }
        await this.feishuAppProvider.replyText(externalChatId, '处理中，请稍候...', messageId).catch(() => undefined);
        const inbound = {
            providerType: 'feishu-app',
            externalUserId,
            externalChatId,
            chatType,
            messageId,
            messageText,
            displayName: String(event?.sender?.name || event?.sender?.sender_id?.union_id || '').trim() || undefined,
            mentions,
            rawEvent: payload,
            receivedAt: new Date().toISOString(),
        };
        const queued = await this.channelInboundService.enqueueInbound(inbound);
        if (!queued) {
            this.logger.debug(`Ignored duplicated inbound message: messageId=${messageId}`);
        }
    }
    async handleCardAction(raw) {
        const payload = this.extractPayload(raw);
        const event = payload?.event || payload?.data || payload;
        const actionEnvelope = {
            providerType: 'feishu-app',
            operatorOpenId: String(event?.operator?.open_id || '').trim(),
            chatId: String(event?.open_chat_id || '').trim() || undefined,
            messageId: String(event?.open_message_id || '').trim() || undefined,
            actionValue: this.extractActionValue(event?.action?.value),
            rawEvent: payload,
        };
        if (!actionEnvelope.operatorOpenId || !Object.keys(actionEnvelope.actionValue).length) {
            return;
        }
        const resultText = await this.channelInboundService.handleCardAction(actionEnvelope);
        if (actionEnvelope.chatId) {
            await this.feishuAppProvider.replyText(actionEnvelope.chatId, resultText, actionEnvelope.messageId).catch(() => undefined);
        }
    }
    extractPayload(raw) {
        if (raw && typeof raw === 'object') {
            return raw;
        }
        return {};
    }
    parseMessageContent(rawContent) {
        if (!rawContent) {
            return {};
        }
        try {
            const parsed = JSON.parse(rawContent);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
            return {};
        }
        catch {
            return { text: rawContent };
        }
    }
    extractMentionIds(mentions) {
        if (!Array.isArray(mentions)) {
            return [];
        }
        return mentions
            .map((item) => {
            const mention = item;
            return String(mention?.id?.open_id || '').trim();
        })
            .filter(Boolean);
    }
    extractActionValue(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
            catch {
                return {};
            }
        }
        return {};
    }
    sanitizeIncomingText(text) {
        const raw = String(text || '').trim();
        if (!raw) {
            return '';
        }
        return raw
            .replace(/<at\b[^>]*>.*?<\/at>/gi, ' ')
            .replace(/@_user_\d+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
};
exports.FeishuEventListenerService = FeishuEventListenerService;
exports.FeishuEventListenerService = FeishuEventListenerService = FeishuEventListenerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [channel_inbound_service_1.ChannelInboundService,
        feishu_app_provider_1.FeishuAppProvider])
], FeishuEventListenerService);
//# sourceMappingURL=feishu-event-listener.service.js.map