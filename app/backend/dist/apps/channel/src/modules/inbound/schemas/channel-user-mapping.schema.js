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
exports.ChannelUserMappingSchema = exports.ChannelUserMapping = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ChannelUserMapping = class ChannelUserMapping {
};
exports.ChannelUserMapping = ChannelUserMapping;
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['feishu-app'] }),
    __metadata("design:type", String)
], ChannelUserMapping.prototype, "providerType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelUserMapping.prototype, "externalUserId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ChannelUserMapping.prototype, "employeeId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelUserMapping.prototype, "displayName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], ChannelUserMapping.prototype, "boundAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], ChannelUserMapping.prototype, "lastActiveAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ChannelUserMapping.prototype, "isActive", void 0);
exports.ChannelUserMapping = ChannelUserMapping = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'channel_user_mappings' })
], ChannelUserMapping);
exports.ChannelUserMappingSchema = mongoose_1.SchemaFactory.createForClass(ChannelUserMapping);
exports.ChannelUserMappingSchema.index({ providerType: 1, externalUserId: 1 }, { unique: true });
exports.ChannelUserMappingSchema.index({ employeeId: 1 });
//# sourceMappingURL=channel-user-mapping.schema.js.map