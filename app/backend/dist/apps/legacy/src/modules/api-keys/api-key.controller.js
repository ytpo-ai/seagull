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
exports.ApiKeyController = void 0;
const common_1 = require("@nestjs/common");
const api_key_service_1 = require("./api-key.service");
let ApiKeyController = class ApiKeyController {
    constructor(apiKeyService) {
        this.apiKeyService = apiKeyService;
    }
    async getAllApiKeys() {
        return this.apiKeyService.getAllApiKeys();
    }
    async getStats() {
        return this.apiKeyService.getApiKeyStats();
    }
    async getByProvider(provider) {
        return this.apiKeyService.getApiKeysByProvider(provider);
    }
    async getApiKey(id) {
        const apiKey = await this.apiKeyService.getApiKey(id);
        if (!apiKey) {
            return { error: 'API Key not found' };
        }
        return apiKey;
    }
    async createApiKey(apiKeyData) {
        const created = await this.apiKeyService.createApiKey(apiKeyData);
        return {
            ...created,
            message: 'API Key created and encrypted successfully'
        };
    }
    async updateApiKey(id, updates) {
        const updated = await this.apiKeyService.updateApiKey(id, updates);
        if (!updated) {
            return { error: 'API Key not found' };
        }
        return {
            ...updated,
            message: 'API Key updated successfully'
        };
    }
    async deleteApiKey(id) {
        const deleted = await this.apiKeyService.deleteApiKey(id);
        if (!deleted) {
            return { error: 'API Key not found' };
        }
        return { message: 'API Key deleted successfully' };
    }
};
exports.ApiKeyController = ApiKeyController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "getAllApiKeys", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('by-provider/:provider'),
    __param(0, (0, common_1.Param)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "getByProvider", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "getApiKey", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "createApiKey", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "updateApiKey", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "deleteApiKey", null);
exports.ApiKeyController = ApiKeyController = __decorate([
    (0, common_1.Controller)('api-keys'),
    __metadata("design:paramtypes", [api_key_service_1.ApiKeyService])
], ApiKeyController);
//# sourceMappingURL=api-key.controller.js.map