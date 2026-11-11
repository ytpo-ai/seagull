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
exports.ChannelConfigController = void 0;
const common_1 = require("@nestjs/common");
const channel_config_service_1 = require("./channel-config.service");
const channel_config_dto_1 = require("./dto/channel-config.dto");
let ChannelConfigController = class ChannelConfigController {
    constructor(channelConfigService) {
        this.channelConfigService = channelConfigService;
    }
    async createConfig(dto) {
        return this.channelConfigService.createConfig(dto);
    }
    async listConfigs() {
        return this.channelConfigService.listConfigs();
    }
    async updateConfig(id, dto) {
        return this.channelConfigService.updateConfig(id, dto);
    }
    async deleteConfig(id) {
        return this.channelConfigService.deleteConfig(id);
    }
    async testPush(id) {
        return this.channelConfigService.testPush(id);
    }
};
exports.ChannelConfigController = ChannelConfigController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_config_dto_1.CreateChannelConfigDto]),
    __metadata("design:returntype", Promise)
], ChannelConfigController.prototype, "createConfig", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChannelConfigController.prototype, "listConfigs", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, channel_config_dto_1.UpdateChannelConfigDto]),
    __metadata("design:returntype", Promise)
], ChannelConfigController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChannelConfigController.prototype, "deleteConfig", null);
__decorate([
    (0, common_1.Post)(':id/test'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChannelConfigController.prototype, "testPush", null);
exports.ChannelConfigController = ChannelConfigController = __decorate([
    (0, common_1.Controller)('channel/configs'),
    __metadata("design:paramtypes", [channel_config_service_1.ChannelConfigService])
], ChannelConfigController);
//# sourceMappingURL=channel-config.controller.js.map