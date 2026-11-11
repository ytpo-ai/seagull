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
exports.ChannelUserMappingController = void 0;
const common_1 = require("@nestjs/common");
const channel_user_mapping_dto_1 = require("./dto/channel-user-mapping.dto");
const channel_user_mapping_service_1 = require("./channel-user-mapping.service");
let ChannelUserMappingController = class ChannelUserMappingController {
    constructor(channelUserMappingService) {
        this.channelUserMappingService = channelUserMappingService;
    }
    async createMapping(dto) {
        return this.channelUserMappingService.bindUser(dto);
    }
    async listMappings() {
        return this.channelUserMappingService.listMappings();
    }
    async deleteMapping(id) {
        return this.channelUserMappingService.unbindUser(id);
    }
    async bindByEmail(dto) {
        return this.channelUserMappingService.bindByEmail(dto);
    }
};
exports.ChannelUserMappingController = ChannelUserMappingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_user_mapping_dto_1.CreateChannelUserMappingDto]),
    __metadata("design:returntype", Promise)
], ChannelUserMappingController.prototype, "createMapping", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChannelUserMappingController.prototype, "listMappings", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChannelUserMappingController.prototype, "deleteMapping", null);
__decorate([
    (0, common_1.Post)('bind-by-email'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_user_mapping_dto_1.BindChannelUserByEmailDto]),
    __metadata("design:returntype", Promise)
], ChannelUserMappingController.prototype, "bindByEmail", null);
exports.ChannelUserMappingController = ChannelUserMappingController = __decorate([
    (0, common_1.Controller)('channel/user-mappings'),
    __metadata("design:paramtypes", [channel_user_mapping_service_1.ChannelUserMappingService])
], ChannelUserMappingController);
//# sourceMappingURL=channel-user-mapping.controller.js.map