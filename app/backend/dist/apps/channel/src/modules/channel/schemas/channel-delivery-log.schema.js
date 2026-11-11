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
exports.ChannelDeliveryLogSchema = exports.ChannelDeliveryLog = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ChannelDeliveryLog = class ChannelDeliveryLog {
};
exports.ChannelDeliveryLog = ChannelDeliveryLog;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelDeliveryLog.prototype, "configId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelDeliveryLog.prototype, "eventId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelDeliveryLog.prototype, "eventType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelDeliveryLog.prototype, "providerType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['success', 'failed', 'retrying'] }),
    __metadata("design:type", String)
], ChannelDeliveryLog.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 1 }),
    __metadata("design:type", Number)
], ChannelDeliveryLog.prototype, "attempt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelDeliveryLog.prototype, "errorMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChannelDeliveryLog.prototype, "requestPayload", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], ChannelDeliveryLog.prototype, "responsePayload", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ChannelDeliveryLog.prototype, "deliveredAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ChannelDeliveryLog.prototype, "createdAt", void 0);
exports.ChannelDeliveryLog = ChannelDeliveryLog = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'channel_delivery_logs' })
], ChannelDeliveryLog);
exports.ChannelDeliveryLogSchema = mongoose_1.SchemaFactory.createForClass(ChannelDeliveryLog);
exports.ChannelDeliveryLogSchema.index({ eventId: 1, configId: 1, attempt: -1 });
exports.ChannelDeliveryLogSchema.index({ createdAt: -1 });
exports.ChannelDeliveryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
//# sourceMappingURL=channel-delivery-log.schema.js.map