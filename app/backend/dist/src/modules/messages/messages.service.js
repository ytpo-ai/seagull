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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_schema_1 = require("../../shared/schemas/chat.schema");
let MessagesService = class MessagesService {
    constructor(messageModel) {
        this.messageModel = messageModel;
    }
    async appendMessage(dto) {
        return this.messageModel.create({
            sceneType: dto.sceneType,
            sceneId: dto.sceneId,
            threadId: dto.threadId,
            senderType: dto.senderType,
            senderId: dto.senderId,
            senderRole: dto.senderRole,
            content: dto.content,
            messageType: dto.messageType || 'opinion',
            metadata: dto.metadata,
            occurredAt: dto.occurredAt || new Date(),
            model: dto.model,
            provider: dto.provider,
            inputTokens: dto.inputTokens,
            outputTokens: dto.outputTokens,
            latencyMs: dto.latencyMs,
            costUsd: dto.costUsd,
            toolCalls: dto.toolCalls,
            traceId: dto.traceId,
            evalTags: dto.evalTags,
        });
    }
    async appendMessages(dtos) {
        if (!dtos.length) {
            return;
        }
        await this.messageModel.insertMany(dtos.map((dto) => ({
            sceneType: dto.sceneType,
            sceneId: dto.sceneId,
            threadId: dto.threadId,
            senderType: dto.senderType,
            senderId: dto.senderId,
            senderRole: dto.senderRole,
            content: dto.content,
            messageType: dto.messageType || 'opinion',
            metadata: dto.metadata,
            occurredAt: dto.occurredAt || new Date(),
            model: dto.model,
            provider: dto.provider,
            inputTokens: dto.inputTokens,
            outputTokens: dto.outputTokens,
            latencyMs: dto.latencyMs,
            costUsd: dto.costUsd,
            toolCalls: dto.toolCalls,
            traceId: dto.traceId,
            evalTags: dto.evalTags,
        })), { ordered: true });
    }
    async listSceneMessages(query) {
        const limit = Math.min(Math.max(query.limit || 50, 1), 500);
        const filter = {
            sceneType: query.sceneType,
            sceneId: query.sceneId,
        };
        if (query.before) {
            filter.occurredAt = { $lt: query.before };
        }
        const docs = await this.messageModel
            .find(filter)
            .sort({ occurredAt: -1 })
            .limit(limit)
            .lean()
            .exec();
        return docs.reverse();
    }
    async getRecentSceneMessages(sceneType, sceneId, limit = 20) {
        return this.listSceneMessages({
            sceneType,
            sceneId,
            limit,
        });
    }
    async deleteMessagesByScene(sceneType, sceneId) {
        await this.messageModel.deleteMany({ sceneType, sceneId }).exec();
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_schema_1.Message.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], MessagesService);
//# sourceMappingURL=messages.service.js.map