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
var MessageCenterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageCenterService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const system_message_schema_1 = require("../../shared/schemas/system-message.schema");
const infra_1 = require("../../../libs/infra/src/index");
let MessageCenterService = MessageCenterService_1 = class MessageCenterService {
    constructor(systemMessageModel, wsMessageService) {
        this.systemMessageModel = systemMessageModel;
        this.wsMessageService = wsMessageService;
        this.logger = new common_1.Logger(MessageCenterService_1.name);
    }
    async listMessages(query) {
        const page = Math.max(1, Math.min(Number(query.page || 1), 10000));
        const pageSize = Math.max(1, Math.min(Number(query.pageSize || 20), 100));
        const skip = (page - 1) * pageSize;
        const filter = {
            receiverId: query.receiverId,
            status: 'active',
        };
        if (typeof query.isRead === 'boolean') {
            filter.isRead = query.isRead;
        }
        if (query.type) {
            filter.type = query.type;
        }
        const [total, unreadCount, list] = await Promise.all([
            this.systemMessageModel.countDocuments(filter).exec(),
            this.systemMessageModel.countDocuments({ receiverId: query.receiverId, isRead: false, status: 'active' }).exec(),
            this.systemMessageModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean()
                .exec(),
        ]);
        return {
            total,
            unreadCount,
            page,
            pageSize,
            totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
            items: list,
            fetchedAt: new Date().toISOString(),
        };
    }
    async getUnreadCount(receiverId) {
        return this.systemMessageModel.countDocuments({ receiverId, isRead: false, status: 'active' }).exec();
    }
    async markAsRead(receiverId, messageId) {
        const doc = await this.systemMessageModel
            .findOneAndUpdate({ receiverId, messageId, status: 'active' }, {
            $set: {
                isRead: true,
                readAt: new Date(),
            },
        }, { new: true })
            .lean()
            .exec();
        if (!doc) {
            throw new common_1.NotFoundException('Message not found');
        }
        return doc;
    }
    async markAllAsRead(receiverId) {
        const result = await this.systemMessageModel
            .updateMany({ receiverId, isRead: false, status: 'active' }, {
            $set: {
                isRead: true,
                readAt: new Date(),
            },
        })
            .exec();
        return {
            updatedCount: result.modifiedCount || 0,
        };
    }
    async createSystemMessage(input) {
        if (!input.receiverId?.trim()) {
            throw new common_1.BadRequestException('receiverId is required');
        }
        if (!input.title?.trim() || !input.content?.trim()) {
            throw new common_1.BadRequestException('title and content are required');
        }
        let created;
        try {
            created = await this.systemMessageModel.create({
                receiverId: input.receiverId,
                type: input.type,
                title: input.title,
                content: input.content,
                payload: input.payload || {},
                source: input.source || 'system',
                status: input.status || 'active',
                isRead: false,
                eventId: String(input.eventId || '').trim() || undefined,
                dedupKey: String(input.dedupKey || '').trim() || undefined,
            });
        }
        catch (error) {
            if (Number(error?.code) !== 11000) {
                throw error;
            }
            const normalizedEventId = String(input.eventId || '').trim();
            const normalizedDedupKey = String(input.dedupKey || '').trim();
            let existing = null;
            if (normalizedEventId) {
                existing = await this.systemMessageModel.findOne({ eventId: normalizedEventId }).exec();
            }
            if (!existing && normalizedDedupKey) {
                existing = await this.systemMessageModel
                    .findOne({
                    receiverId: input.receiverId,
                    type: input.type,
                    dedupKey: normalizedDedupKey,
                })
                    .exec();
            }
            if (!existing) {
                throw error;
            }
            this.logger.log(`Ignored duplicate system message write: receiverId=${input.receiverId} type=${input.type} eventId=${normalizedEventId || 'n/a'} dedupKey=${normalizedDedupKey || 'n/a'}`);
            return {
                message: existing,
                created: false,
            };
        }
        const unreadCount = await this.getUnreadCount(input.receiverId);
        void this.wsMessageService
            .publishUserMessage({
            userId: input.receiverId,
            event: 'message-center.message.created',
            source: input.source || 'message-center',
            data: {
                messageId: created.messageId,
                type: created.type,
                title: created.title,
                unreadCount,
                createdAt: new Date().toISOString(),
            },
        })
            .catch(() => {
        });
        return {
            message: created,
            created: true,
        };
    }
};
exports.MessageCenterService = MessageCenterService;
exports.MessageCenterService = MessageCenterService = MessageCenterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(system_message_schema_1.SystemMessage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        infra_1.WsMessageService])
], MessageCenterService);
//# sourceMappingURL=message-center.service.js.map