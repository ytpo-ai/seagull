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
exports.ChannelSessionSchema = exports.ChannelSession = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ChannelSession = class ChannelSession {
};
exports.ChannelSession = ChannelSession;
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['feishu-app'] }),
    __metadata("design:type", String)
], ChannelSession.prototype, "providerType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelSession.prototype, "externalChatId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelSession.prototype, "externalUserId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelSession.prototype, "employeeId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelSession.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelSession.prototype, "agentSessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelSession.prototype, "activeMeetingId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelSession.prototype, "activeMeetingType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], ChannelSession.prototype, "lastMessageAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ChannelSession.prototype, "messageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ChannelSession.prototype, "isActive", void 0);
exports.ChannelSession = ChannelSession = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'channel_sessions' })
], ChannelSession);
exports.ChannelSessionSchema = mongoose_1.SchemaFactory.createForClass(ChannelSession);
exports.ChannelSessionSchema.index({
    providerType: 1,
    externalChatId: 1,
    externalUserId: 1,
}, { unique: true });
//# sourceMappingURL=channel-session.schema.js.map