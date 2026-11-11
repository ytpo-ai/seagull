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
exports.WsMessageService = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const redis_service_1 = require("./redis.service");
const ws_message_types_1 = require("./ws-message.types");
let WsMessageService = class WsMessageService {
    constructor(redisService) {
        this.redisService = redisService;
    }
    async publishSystemMessage(input) {
        const channel = (0, ws_message_types_1.buildWsSystemChannel)();
        const message = {
            protocol: ws_message_types_1.WS_PROTOCOL_VERSION,
            messageId: (0, uuid_1.v4)(),
            level: 'system',
            event: input.event,
            timestamp: new Date().toISOString(),
            source: input.source,
            target: { channel },
            data: input.data,
            meta: input.meta,
        };
        return this.redisService.publish(channel, message);
    }
    async publishUserMessage(input) {
        const userId = String(input.userId || '').trim();
        if (!userId) {
            return 0;
        }
        const channel = (0, ws_message_types_1.buildWsUserChannel)(userId);
        const message = {
            protocol: ws_message_types_1.WS_PROTOCOL_VERSION,
            messageId: (0, uuid_1.v4)(),
            level: 'user',
            event: input.event,
            timestamp: new Date().toISOString(),
            source: input.source,
            target: { channel, userId },
            data: input.data,
            meta: input.meta,
        };
        return this.redisService.publish(channel, message);
    }
    async publishFeatureMessage(input) {
        const feature = String(input.feature || '').trim();
        const entityId = String(input.entityId || '').trim();
        if (!feature || !entityId) {
            return 0;
        }
        const channel = (0, ws_message_types_1.buildWsFeatureChannel)(feature, entityId);
        const message = {
            protocol: ws_message_types_1.WS_PROTOCOL_VERSION,
            messageId: (0, uuid_1.v4)(),
            level: 'feature',
            event: input.event,
            timestamp: new Date().toISOString(),
            source: input.source,
            target: { channel, feature, entityId },
            data: input.data,
            meta: input.meta,
        };
        return this.redisService.publish(channel, message);
    }
};
exports.WsMessageService = WsMessageService;
exports.WsMessageService = WsMessageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], WsMessageService);
//# sourceMappingURL=ws-message.service.js.map