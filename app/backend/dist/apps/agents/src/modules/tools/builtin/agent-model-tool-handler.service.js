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
exports.ModelToolHandler = void 0;
const common_1 = require("@nestjs/common");
const model_management_service_1 = require("../../models/model-management.service");
let ModelToolHandler = class ModelToolHandler {
    constructor(modelManagementService) {
        this.modelManagementService = modelManagementService;
    }
    normalizeProvider(provider) {
        const value = String(provider || '').trim().toLowerCase();
        if (value === 'kimi' || value === 'moonshot' || value === 'moonshotai')
            return 'moonshotai';
        if (value === 'claude')
            return 'anthropic';
        return value;
    }
    toModelDisplayName(model) {
        return model
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    async addModelToSystem(params) {
        if (!params?.provider || !params?.model) {
            throw new Error('model_mcp_add_model requires parameters: provider, model');
        }
        const normalizedProvider = this.normalizeProvider(params.provider);
        const normalizedModel = String(params.model).trim().toLowerCase();
        const maxTokens = Number.isFinite(Number(params.maxTokens)) ? Number(params.maxTokens) : 8192;
        const temperature = Number.isFinite(Number(params.temperature)) ? Number(params.temperature) : 0.7;
        const topP = Number.isFinite(Number(params.topP)) ? Number(params.topP) : 1;
        const result = await this.modelManagementService.addModelToSystem({
            id: params.id,
            name: params.name?.trim() || this.toModelDisplayName(normalizedModel),
            provider: normalizedProvider,
            model: normalizedModel,
            maxTokens,
            temperature,
            topP,
        });
        return {
            created: result.created,
            duplicateBy: result.duplicateBy || null,
            message: result.message,
            model: result.model,
            timestamp: new Date().toISOString(),
        };
    }
    async listSystemModels(params) {
        const provider = this.normalizeProvider(params?.provider);
        const limit = Math.max(1, Math.min(Number(params?.limit || 200), 500));
        const sourceModels = provider
            ? await this.modelManagementService.getModelsByProvider(provider)
            : await this.modelManagementService.getAvailableModels();
        const models = sourceModels.slice(0, limit).map((model) => ({
            id: model.id,
            name: model.name,
            provider: this.normalizeProvider(model.provider),
            model: model.model,
            maxTokens: model.maxTokens,
            temperature: model.temperature,
            topP: model.topP,
        }));
        return {
            total: sourceModels.length,
            returned: models.length,
            provider: provider || 'all',
            models,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.ModelToolHandler = ModelToolHandler;
exports.ModelToolHandler = ModelToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_management_service_1.ModelManagementService])
], ModelToolHandler);
//# sourceMappingURL=agent-model-tool-handler.service.js.map