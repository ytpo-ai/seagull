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
exports.InnerMessageSchema = exports.InnerMessage = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
let InnerMessage = class InnerMessage {
};
exports.InnerMessage = InnerMessage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], InnerMessage.prototype, "messageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['direct', 'subscription'] }),
    __metadata("design:type", String)
], InnerMessage.prototype, "mode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], InnerMessage.prototype, "eventType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'system' }),
    __metadata("design:type", String)
], InnerMessage.prototype, "senderAgentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], InnerMessage.prototype, "receiverAgentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], InnerMessage.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], InnerMessage.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], InnerMessage.prototype, "payload", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['sent', 'delivered', 'processing', 'processed', 'failed'], default: 'sent' }),
    __metadata("design:type", String)
], InnerMessage.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], InnerMessage.prototype, "sentAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], InnerMessage.prototype, "deliveredAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], InnerMessage.prototype, "processingAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], InnerMessage.prototype, "processedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], InnerMessage.prototype, "failedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], InnerMessage.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], InnerMessage.prototype, "attempt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 3 }),
    __metadata("design:type", Number)
], InnerMessage.prototype, "maxAttempts", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], InnerMessage.prototype, "dedupKey", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], InnerMessage.prototype, "source", void 0);
exports.InnerMessage = InnerMessage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'inner_messages' })
], InnerMessage);
exports.InnerMessageSchema = mongoose_1.SchemaFactory.createForClass(InnerMessage);
exports.InnerMessageSchema.index({ messageId: 1 }, { unique: true });
exports.InnerMessageSchema.index({ receiverAgentId: 1, status: 1, createdAt: -1 });
exports.InnerMessageSchema.index({ senderAgentId: 1, createdAt: -1 });
exports.InnerMessageSchema.index({ eventType: 1, createdAt: -1 });
exports.InnerMessageSchema.index({ dedupKey: 1 }, { unique: true, sparse: true });
exports.InnerMessageSchema.index({ source: 1, 'payload.scheduleId': 1, createdAt: -1 });
//# sourceMappingURL=inner-message.schema.js.map