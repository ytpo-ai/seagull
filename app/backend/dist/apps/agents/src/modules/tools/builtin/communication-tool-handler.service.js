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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunicationToolHandler = void 0;
const common_1 = require("@nestjs/common");
const composio_service_1 = require("../composio.service");
const internal_api_client_service_1 = require("../internal-api-client.service");
let CommunicationToolHandler = class CommunicationToolHandler {
    constructor(composioService, internalApiClient) {
        this.composioService = composioService;
        this.internalApiClient = internalApiClient;
    }
    async sendInternalMessage(params, agentId) {
        const senderAgentId = String(agentId || '').trim();
        if (!senderAgentId) {
            throw new Error('send_internal_message requires execution agentId');
        }
        const receiverAgentId = String(params?.receiverAgentId || '').trim();
        const title = String(params?.title || '').trim();
        const content = String(params?.content || '').trim();
        const eventType = String(params?.eventType || '').trim() || 'inner.direct';
        if (!receiverAgentId) {
            throw new Error('send_internal_message requires receiverAgentId');
        }
        if (!title || !content) {
            throw new Error('send_internal_message requires title and content');
        }
        const payload = params?.payload && typeof params.payload === 'object' && !Array.isArray(params.payload)
            ? params.payload
            : {};
        const maxAttempts = Number(params?.maxAttempts || 0);
        const response = await this.internalApiClient.callInnerMessageApi('POST', '/direct', {
            senderAgentId,
            receiverAgentId,
            eventType,
            title,
            content,
            payload,
            source: 'agent-mcp.send_internal_message',
            ...(params?.dedupKey ? { dedupKey: String(params.dedupKey).trim() } : {}),
            ...(Number.isFinite(maxAttempts) && maxAttempts > 0 ? { maxAttempts: Math.floor(maxAttempts) } : {}),
        });
        const message = response;
        const messageId = String(message?.messageId || '').trim();
        return {
            action: 'send_internal_message',
            sent: Boolean(messageId),
            messageId,
            status: String(message?.status || 'sent').trim() || 'sent',
            senderAgentId,
            receiverAgentId,
            eventType,
            sentAt: message?.sentAt || new Date().toISOString(),
            raw: message,
        };
    }
    async sendSlackMessage(params, userId) {
        if (!params?.channel || !params?.text) {
            throw new Error('slack requires parameters: channel, text');
        }
        const result = await this.composioService.slackSendMessage(params.channel, params.text, userId);
        if (!result.successful) {
            throw new Error(result.error || 'Composio slack send failed');
        }
        return {
            provider: 'composio/slack',
            status: 'sent',
            channel: params.channel,
            text: params.text,
            raw: result.data,
        };
    }
    async sendGmail(params, userId) {
        if (!params?.to || !params?.subject || !params?.body) {
            throw new Error('gmail requires parameters: to, subject, body');
        }
        const action = params.action || 'send';
        const result = await this.composioService.gmailSendEmail(params.to, params.subject, params.body, action, userId);
        if (!result.successful) {
            throw new Error(result.error || 'Composio gmail send failed');
        }
        return {
            provider: 'composio/gmail',
            status: action === 'draft' ? 'drafted' : 'sent',
            to: params.to,
            subject: params.subject,
            action,
            raw: result.data,
        };
    }
};
exports.CommunicationToolHandler = CommunicationToolHandler;
exports.CommunicationToolHandler = CommunicationToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [composio_service_1.ComposioService,
        internal_api_client_service_1.InternalApiClient])
], CommunicationToolHandler);
//# sourceMappingURL=communication-tool-handler.service.js.map