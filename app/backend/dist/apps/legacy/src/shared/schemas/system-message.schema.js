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
exports.SystemMessageSchema = exports.SystemMessage = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
let SystemMessage = class SystemMessage {
};
exports.SystemMessage = SystemMessage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], SystemMessage.prototype, "messageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SystemMessage.prototype, "receiverId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['engineering_statistics', 'orchestration', 'system_alert'] }),
    __metadata("design:type", String)
], SystemMessage.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SystemMessage.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], SystemMessage.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], SystemMessage.prototype, "payload", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], SystemMessage.prototype, "isRead", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], SystemMessage.prototype, "readAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'system' }),
    __metadata("design:type", String)
], SystemMessage.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'active' }),
    __metadata("design:type", String)
], SystemMessage.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SystemMessage.prototype, "eventId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], SystemMessage.prototype, "dedupKey", void 0);
exports.SystemMessage = SystemMessage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'system_messages' })
], SystemMessage);
exports.SystemMessageSchema = mongoose_1.SchemaFactory.createForClass(SystemMessage);
exports.SystemMessageSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });
exports.SystemMessageSchema.index({ type: 1, createdAt: -1 });
exports.SystemMessageSchema.index({ messageId: 1 }, { unique: true });
exports.SystemMessageSchema.index({ eventId: 1 }, { unique: true, sparse: true });
exports.SystemMessageSchema.index({ receiverId: 1, type: 1, dedupKey: 1 }, { unique: true, sparse: true });
//# sourceMappingURL=system-message.schema.js.map