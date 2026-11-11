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
exports.MessageCenterService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const inner_message_schema_1 = require("../../schemas/inner-message.schema");
let MessageCenterService = class MessageCenterService {
    constructor(innerMessageModel) {
        this.innerMessageModel = innerMessageModel;
    }
    async listInnerMessages(query) {
        const page = Math.max(1, Math.min(Number(query.page || 1), 10000));
        const pageSize = Math.max(1, Math.min(Number(query.pageSize || 20), 100));
        const skip = (page - 1) * pageSize;
        const filter = {};
        if (query.mode) {
            filter.mode = query.mode;
        }
        if (query.status) {
            filter.status = query.status;
        }
        if (query.eventType?.trim()) {
            filter.eventType = query.eventType.trim();
        }
        if (query.source?.trim()) {
            filter.source = query.source.trim();
        }
        if (query.scheduleId?.trim()) {
            filter['payload.scheduleId'] = query.scheduleId.trim();
        }
        if (query.messageId?.trim()) {
            filter.messageId = query.messageId.trim();
        }
        const [total, list] = await Promise.all([
            this.innerMessageModel.countDocuments(filter).exec(),
            this.innerMessageModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean()
                .exec(),
        ]);
        return {
            total,
            page,
            pageSize,
            totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
            items: list,
            fetchedAt: new Date().toISOString(),
        };
    }
};
exports.MessageCenterService = MessageCenterService;
exports.MessageCenterService = MessageCenterService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(inner_message_schema_1.InnerMessage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], MessageCenterService);
//# sourceMappingURL=message-center.service.js.map