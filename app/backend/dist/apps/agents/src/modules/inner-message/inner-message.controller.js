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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerMessageSubscriptionController = exports.InnerMessageController = void 0;
const common_1 = require("@nestjs/common");
const inner_message_service_1 = require("./inner-message.service");
let InnerMessageController = class InnerMessageController {
    constructor(innerMessageService) {
        this.innerMessageService = innerMessageService;
    }
    async sendDirect(payload) {
        const message = await this.innerMessageService.sendDirectMessage({
            senderAgentId: payload.senderAgentId,
            receiverAgentId: payload.receiverAgentId,
            eventType: payload.eventType || 'inner.direct',
            title: payload.title,
            content: payload.content,
            payload: payload.payload,
            source: payload.source,
            dedupKey: payload.dedupKey,
            maxAttempts: payload.maxAttempts,
        });
        return {
            success: true,
            data: message,
        };
    }
    async publish(payload) {
        const result = await this.innerMessageService.publishMessage(payload);
        return {
            success: true,
            data: result,
        };
    }
    async acknowledge(messageId, payload) {
        const normalizedMessageId = String(messageId || '').trim();
        if (!normalizedMessageId) {
            throw new common_1.BadRequestException('messageId is required');
        }
        const receiverAgentId = String(payload?.receiverAgentId || '').trim();
        if (!receiverAgentId) {
            throw new common_1.BadRequestException('receiverAgentId is required');
        }
        const status = payload?.status || 'delivered';
        if (!['delivered', 'processing'].includes(status)) {
            throw new common_1.BadRequestException('status must be delivered or processing');
        }
        const updated = await this.innerMessageService.acknowledgeMessage(normalizedMessageId, receiverAgentId, status);
        return {
            success: true,
            data: updated,
        };
    }
    async processed(messageId, payload) {
        const normalizedMessageId = String(messageId || '').trim();
        if (!normalizedMessageId) {
            throw new common_1.BadRequestException('messageId is required');
        }
        const receiverAgentId = String(payload?.receiverAgentId || '').trim();
        if (!receiverAgentId) {
            throw new common_1.BadRequestException('receiverAgentId is required');
        }
        const updated = await this.innerMessageService.markMessageProcessed(normalizedMessageId, receiverAgentId, payload?.result);
        return {
            success: true,
            data: updated,
        };
    }
};
exports.InnerMessageController = InnerMessageController;
__decorate([
    (0, common_1.Post)('direct'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InnerMessageController.prototype, "sendDirect", null);
__decorate([
    (0, common_1.Post)('publish'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InnerMessageController.prototype, "publish", null);
__decorate([
    (0, common_1.Patch)(':messageId/ack'),
    __param(0, (0, common_1.Param)('messageId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InnerMessageController.prototype, "acknowledge", null);
__decorate([
    (0, common_1.Patch)(':messageId/processed'),
    __param(0, (0, common_1.Param)('messageId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InnerMessageController.prototype, "processed", null);
exports.InnerMessageController = InnerMessageController = __decorate([
    (0, common_1.Controller)('inner-messages'),
    __metadata("design:paramtypes", [inner_message_service_1.InnerMessageService])
], InnerMessageController);
let InnerMessageSubscriptionController = class InnerMessageSubscriptionController {
    constructor(innerMessageService) {
        this.innerMessageService = innerMessageService;
    }
    async createOrUpdate(payload) {
        const subscription = await this.innerMessageService.createOrUpdateSubscription(payload);
        return {
            success: true,
            data: subscription,
        };
    }
    async list(subscriberAgentId, eventType, isActive) {
        const normalizedIsActive = typeof isActive === 'string'
            ? isActive.toLowerCase() === 'true'
                ? true
                : isActive.toLowerCase() === 'false'
                    ? false
                    : undefined
            : undefined;
        const data = await this.innerMessageService.listSubscriptions({
            subscriberAgentId,
            eventType,
            isActive: normalizedIsActive,
        });
        return {
            success: true,
            data,
        };
    }
    async listEventDefinitions(domain, keyword, limit) {
        const normalizedLimit = Number.isFinite(Number(limit)) ? Number(limit) : undefined;
        const data = await this.innerMessageService.listEventDefinitions({
            domain,
            keyword,
            limit: normalizedLimit,
        });
        return {
            success: true,
            data,
        };
    }
    async rebuildIndex() {
        await this.innerMessageService.rebuildSubscriptionRedisIndex();
        return {
            success: true,
            data: {
                rebuilt: true,
            },
        };
    }
};
exports.InnerMessageSubscriptionController = InnerMessageSubscriptionController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InnerMessageSubscriptionController.prototype, "createOrUpdate", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('subscriberAgentId')),
    __param(1, (0, common_1.Query)('eventType')),
    __param(2, (0, common_1.Query)('isActive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], InnerMessageSubscriptionController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('event-definitions'),
    __param(0, (0, common_1.Query)('domain')),
    __param(1, (0, common_1.Query)('keyword')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], InnerMessageSubscriptionController.prototype, "listEventDefinitions", null);
__decorate([
    (0, common_1.Post)('rebuild-index'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InnerMessageSubscriptionController.prototype, "rebuildIndex", null);
exports.InnerMessageSubscriptionController = InnerMessageSubscriptionController = __decorate([
    (0, common_1.Controller)('inner-message-subscriptions'),
    __metadata("design:paramtypes", [inner_message_service_1.InnerMessageService])
], InnerMessageSubscriptionController);
//# sourceMappingURL=inner-message.controller.js.map