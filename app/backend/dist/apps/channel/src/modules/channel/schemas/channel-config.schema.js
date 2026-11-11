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
exports.ChannelConfigSchema = exports.ChannelConfig = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ChannelConfig = class ChannelConfig {
};
exports.ChannelConfig = ChannelConfig;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelConfig.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['feishu', 'feishu-app'] }),
    __metadata("design:type", String)
], ChannelConfig.prototype, "providerType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['group', 'user'] }),
    __metadata("design:type", String)
], ChannelConfig.prototype, "targetType", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        webhookUrlEncrypted: { type: String },
        webhookSecretEncrypted: { type: String },
        appIdEncrypted: { type: String },
        appSecretEncrypted: { type: String },
        encryptKeyEncrypted: { type: String },
        receiveId: { type: String },
        receiveIdType: { type: String, enum: ['chat_id', 'open_id'] },
    })),
    __metadata("design:type", Object)
], ChannelConfig.prototype, "providerConfig", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ChannelConfig.prototype, "eventFilters", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ChannelConfig.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelConfig.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ChannelConfig.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ChannelConfig.prototype, "updatedAt", void 0);
exports.ChannelConfig = ChannelConfig = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'channel_configs' })
], ChannelConfig);
exports.ChannelConfigSchema = mongoose_1.SchemaFactory.createForClass(ChannelConfig);
exports.ChannelConfigSchema.index({ providerType: 1, isActive: 1 });
exports.ChannelConfigSchema.index({ eventFilters: 1, isActive: 1 });
//# sourceMappingURL=channel-config.schema.js.map