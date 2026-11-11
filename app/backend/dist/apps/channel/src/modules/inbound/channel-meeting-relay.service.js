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
var ChannelMeetingRelayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelMeetingRelayService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../libs/infra/src/index");
const feishu_app_provider_1 = require("../../providers/feishu/feishu-app.provider");
const channel_api_client_service_1 = require("./channel-api-client.service");
const channel_session_service_1 = require("./channel-session.service");
let ChannelMeetingRelayService = ChannelMeetingRelayService_1 = class ChannelMeetingRelayService {
    constructor(redisService, feishuAppProvider, apiClient, sessionService) {
        this.redisService = redisService;
        this.feishuAppProvider = feishuAppProvider;
        this.apiClient = apiClient;
        this.sessionService = sessionService;
        this.logger = new common_1.Logger(ChannelMeetingRelayService_1.name);
        this.activeRelays = new Map();
        this.senderNameCache = new Map();
        this.flushDelayMs = 1500;
        this.forceFlushMs = 3000;
        this.bufferSizeLimit = 10;
        this.senderNameCacheTtlMs = 5 * 60 * 1000;
    }
    async onModuleInit() {
        const activeSessions = await this.sessionService.listSessionsWithActiveMeeting();
        for (const session of activeSessions) {
            await this.startRelay({
                meetingId: session.meetingId,
                chatId: session.chatId,
                employeeId: session.employeeId,
            });
        }
    }
    async onModuleDestroy() {
        const relays = Array.from(this.activeRelays.values());
        for (const relay of relays) {
            await this.stopRelay(relay.meetingId, relay.employeeId);
        }
    }
    async startRelay(input) {
        const meetingId = String(input.meetingId || '').trim();
        const chatId = String(input.chatId || '').trim();
        const employeeId = String(input.employeeId || '').trim();
        if (!meetingId || !chatId || !employeeId) {
            return;
        }
        const key = this.getRelayKey(meetingId, employeeId);
        if (this.activeRelays.has(key)) {
            return;
        }
        const context = {
            meetingId,
            chatId,
            employeeId,
            listener: (message) => {
                void this.handleRelayMessage(key, message);
            },
            bufferedLines: [],
        };
        this.activeRelays.set(key, context);
        try {
            await this.redisService.subscribe(`meeting:${meetingId}`, context.listener);
        }
        catch (error) {
            this.activeRelays.delete(key);
            const reason = error instanceof Error ? error.message : 'unknown_error';
            this.logger.warn(`startRelay failed: meetingId=${meetingId} employeeId=${employeeId} reason=${reason}`);
        }
    }
    async stopRelay(meetingId, employeeId) {
        const key = this.getRelayKey(meetingId, employeeId);
        const context = this.activeRelays.get(key);
        if (!context) {
            return;
        }
        this.clearRelayTimers(context);
        this.activeRelays.delete(key);
        await this.redisService.unsubscribe(`meeting:${context.meetingId}`, context.listener).catch(() => undefined);
    }
    async handleRelayMessage(relayKey, raw) {
        const context = this.activeRelays.get(relayKey);
        if (!context) {
            return;
        }
        let event;
        try {
            event = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (event.type === 'message') {
            const line = await this.formatRelayLine(context.employeeId, event.data);
            if (!line) {
                return;
            }
            this.bufferLine(relayKey, line);
            return;
        }
        if (event.type === 'status_changed') {
            const status = String(event.data?.status || '').trim();
            if (status === 'ended') {
                await this.feishuAppProvider.replyText(context.chatId, '会议已结束。').catch(() => undefined);
                await this.stopRelay(context.meetingId, context.employeeId);
                await this.sessionService.clearActiveMeetingByMeetingId(context.meetingId);
            }
        }
    }
    async formatRelayLine(employeeId, message) {
        if (!message) {
            return '';
        }
        const senderId = String(message.senderId || '').trim();
        const senderType = String(message.senderType || '').trim();
        const content = String(message.content || '').trim();
        const source = String(message.metadata?.source || '').trim();
        const explicitSenderName = String(message.metadata?.senderName || message.metadata?.displayName || '').trim();
        if (!content) {
            return '';
        }
        if (senderType === 'system') {
            return '';
        }
        if (senderType === 'employee' && senderId === employeeId && source === 'feishu') {
            return '';
        }
        if (senderType === 'employee' && senderId === employeeId && source === 'web') {
            return `[你·网页] ${content}`;
        }
        if (senderType === 'agent') {
            const senderName = explicitSenderName ||
                (await this.resolveSenderName('agent', senderId, employeeId)) ||
                `Agent-${this.toShortId(senderId || 'unknown')}`;
            return `[${senderName}] ${content}`;
        }
        if (senderType === 'employee') {
            const senderName = explicitSenderName ||
                (await this.resolveSenderName('employee', senderId, employeeId)) ||
                `员工-${this.toShortId(senderId || 'unknown')}`;
            return `[${senderName}] ${content}`;
        }
        return content;
    }
    bufferLine(relayKey, line) {
        const context = this.activeRelays.get(relayKey);
        if (!context) {
            return;
        }
        context.bufferedLines.push(line);
        if (!context.flushTimer) {
            context.flushTimer = setTimeout(() => {
                void this.flushBuffer(relayKey);
            }, this.flushDelayMs);
        }
        if (!context.forceFlushTimer) {
            context.forceFlushTimer = setTimeout(() => {
                void this.flushBuffer(relayKey);
            }, this.forceFlushMs);
        }
        if (context.bufferedLines.length >= this.bufferSizeLimit) {
            void this.flushBuffer(relayKey);
        }
    }
    async flushBuffer(relayKey) {
        const context = this.activeRelays.get(relayKey);
        if (!context) {
            return;
        }
        const lines = [...context.bufferedLines];
        context.bufferedLines = [];
        this.clearRelayTimers(context);
        if (lines.length === 0) {
            return;
        }
        const content = lines.join('\n');
        await this.feishuAppProvider.replyText(context.chatId, content).catch(() => undefined);
    }
    clearRelayTimers(context) {
        if (context.flushTimer) {
            clearTimeout(context.flushTimer);
            context.flushTimer = undefined;
        }
        if (context.forceFlushTimer) {
            clearTimeout(context.forceFlushTimer);
            context.forceFlushTimer = undefined;
        }
    }
    getRelayKey(meetingId, employeeId) {
        return `${meetingId}:${employeeId}`;
    }
    async resolveSenderName(senderType, senderId, employeeId) {
        const normalizedId = String(senderId || '').trim();
        if (!normalizedId) {
            return undefined;
        }
        const cacheKey = `${senderType}:${normalizedId}`;
        const cached = this.senderNameCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        try {
            const profile = (await this.apiClient.callApiAsUser(employeeId, {
                method: 'get',
                url: senderType === 'agent' ? `/api/agents/${normalizedId}` : `/api/employees/${normalizedId}`,
            }));
            const name = String(profile.name || profile.displayName || profile.email || profile.id || '').trim();
            if (!name) {
                return undefined;
            }
            this.senderNameCache.set(cacheKey, {
                value: name,
                expiresAt: Date.now() + this.senderNameCacheTtlMs,
            });
            return name;
        }
        catch {
            return undefined;
        }
    }
    toShortId(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return 'unknown';
        }
        if (normalized.length <= 8) {
            return normalized;
        }
        return normalized.slice(0, 8);
    }
};
exports.ChannelMeetingRelayService = ChannelMeetingRelayService;
exports.ChannelMeetingRelayService = ChannelMeetingRelayService = ChannelMeetingRelayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService,
        feishu_app_provider_1.FeishuAppProvider,
        channel_api_client_service_1.ChannelApiClientService,
        channel_session_service_1.ChannelSessionService])
], ChannelMeetingRelayService);
//# sourceMappingURL=channel-meeting-relay.service.js.map