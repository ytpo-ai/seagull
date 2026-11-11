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
exports.UpdateChannelConfigDto = exports.CreateChannelConfigDto = void 0;
const class_validator_1 = require("class-validator");
class CreateChannelConfigDto {
}
exports.CreateChannelConfigDto = CreateChannelConfigDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateChannelConfigDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['feishu', 'feishu-app']),
    __metadata("design:type", String)
], CreateChannelConfigDto.prototype, "providerType", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['group', 'user']),
    __metadata("design:type", String)
], CreateChannelConfigDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateChannelConfigDto.prototype, "providerConfig", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateChannelConfigDto.prototype, "eventFilters", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateChannelConfigDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateChannelConfigDto.prototype, "createdBy", void 0);
class UpdateChannelConfigDto {
}
exports.UpdateChannelConfigDto = UpdateChannelConfigDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateChannelConfigDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['group', 'user']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateChannelConfigDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateChannelConfigDto.prototype, "providerConfig", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateChannelConfigDto.prototype, "eventFilters", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateChannelConfigDto.prototype, "isActive", void 0);
//# sourceMappingURL=channel-config.dto.js.map