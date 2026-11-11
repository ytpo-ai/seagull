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
exports.ModelController = void 0;
const common_1 = require("@nestjs/common");
const model_service_1 = require("./model.service");
let ModelController = class ModelController {
    constructor(modelService) {
        this.modelService = modelService;
    }
    getAvailableModels() {
        return this.modelService.getAvailableModels();
    }
    getDebugStatus() {
        const models = this.modelService.getAvailableModels();
        return {
            registeredModels: models.length,
            models: models.map(m => ({
                id: m.id,
                name: m.name,
                provider: m.provider,
                model: m.model
            })),
            timestamp: new Date().toISOString()
        };
    }
    async chat(modelId, body) {
        const response = await this.modelService.chat(modelId, body.messages, body.options);
        return response;
    }
    async testModel(modelId) {
        const testMessages = [
            {
                role: 'user',
                content: 'Hello! Please respond with "AI Model Connected Successfully"',
                timestamp: new Date()
            }
        ];
        try {
            const startTime = Date.now();
            const result = await this.modelService.chat(modelId, testMessages, {
                temperature: 0.7,
                maxTokens: 100
            });
            const duration = Date.now() - startTime;
            return {
                success: true,
                modelId,
                response: result.response,
                usage: result.usage,
                finishReason: result.finishReason,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                success: false,
                modelId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    registerModel(modelId, model) {
        this.modelService.registerProvider(model);
        return { message: 'Model registered successfully' };
    }
};
exports.ModelController = ModelController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ModelController.prototype, "getAvailableModels", null);
__decorate([
    (0, common_1.Get)('debug/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ModelController.prototype, "getDebugStatus", null);
__decorate([
    (0, common_1.Post)(':modelId/chat'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ModelController.prototype, "chat", null);
__decorate([
    (0, common_1.Post)(':modelId/test'),
    __param(0, (0, common_1.Param)('modelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ModelController.prototype, "testModel", null);
__decorate([
    (0, common_1.Post)(':modelId/register'),
    __param(0, (0, common_1.Param)('modelId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ModelController.prototype, "registerModel", null);
exports.ModelController = ModelController = __decorate([
    (0, common_1.Controller)('models'),
    __metadata("design:paramtypes", [model_service_1.ModelService])
], ModelController);
//# sourceMappingURL=model.controller.js.map