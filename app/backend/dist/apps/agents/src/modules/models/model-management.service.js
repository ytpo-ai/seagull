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
var ModelManagementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelManagementService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const models_1 = require("../../../../../src/config/models");
const model_registry_schema_1 = require("../../schemas/model-registry.schema");
const model_pricing_service_1 = require("./model-pricing.service");
let ModelManagementService = ModelManagementService_1 = class ModelManagementService {
    constructor(modelRegistryModel, modelPricingService) {
        this.modelRegistryModel = modelRegistryModel;
        this.modelPricingService = modelPricingService;
        this.logger = new common_1.Logger(ModelManagementService_1.name);
        this.settings = {
            defaultTemperature: 0.7,
            defaultMaxTokens: 4096,
            enableStreaming: true,
            autoSelectBestModel: false,
        };
        this.founderModels = {
            ceo: null,
            cto: null,
        };
    }
    async getAvailableModels() {
        const docs = await this.modelRegistryModel.find().sort({ provider: 1, model: 1 }).lean().exec();
        const models = docs.map((item) => this.toAIModel(item));
        return this.enrichModelsWithPricing(models);
    }
    getModelCategories() {
        return models_1.MODEL_CATEGORIES;
    }
    getRecommendedModels() {
        return (0, models_1.getRecommendedModels)();
    }
    async getModelsByProvider(provider) {
        const normalizedProvider = this.normalizeProvider(provider);
        const docs = await this.modelRegistryModel
            .find({ provider: normalizedProvider })
            .sort({ model: 1 })
            .lean()
            .exec();
        const models = docs.map((item) => this.toAIModel(item));
        return this.enrichModelsWithPricing(models);
    }
    async createModel(modelData) {
        const result = await this.addModelToSystem(modelData);
        if (!result.created) {
            if (result.duplicateBy === 'id') {
                throw new common_1.ConflictException(`Model with ID ${result.model.id} already exists`);
            }
            throw new common_1.ConflictException(`Model ${result.model.provider}/${result.model.model} already exists (id=${result.model.id})`);
        }
        return result.model;
    }
    async addModelToSystem(modelData) {
        const { id, ...modelWithoutId } = modelData;
        const normalizedProvider = this.normalizeProvider(modelWithoutId.provider);
        const normalizedModel = String(modelWithoutId.model || '').trim().toLowerCase();
        const normalizedName = String(modelWithoutId.name || normalizedModel || id || 'Custom Model').trim();
        const normalizedDescription = this.normalizeOptionalText(modelWithoutId.description);
        const normalizedAvailability = this.normalizeOptionalText(modelWithoutId.availability);
        const deprecated = Boolean(modelWithoutId.deprecated);
        if (!normalizedProvider || !normalizedModel) {
            throw new common_1.BadRequestException('provider and model are required');
        }
        const generatedId = this.buildModelId(normalizedProvider, normalizedModel);
        const modelId = (id || generatedId || (0, uuid_1.v4)()).trim();
        const existingModel = await this.modelRegistryModel.findOne({ id: modelId }).lean().exec();
        if (existingModel) {
            return {
                created: false,
                model: this.toAIModel(existingModel),
                message: `Model with ID ${modelId} already exists`,
                duplicateBy: 'id',
            };
        }
        const existingByProviderModel = await this.modelRegistryModel
            .findOne({ provider: normalizedProvider, model: normalizedModel })
            .lean()
            .exec();
        if (existingByProviderModel) {
            return {
                created: false,
                model: this.toAIModel(existingByProviderModel),
                message: `Model ${normalizedProvider}/${normalizedModel} already exists`,
                duplicateBy: 'provider_model',
            };
        }
        const payload = {
            name: normalizedName,
            description: normalizedDescription,
            availability: normalizedAvailability,
            deprecated,
            provider: normalizedProvider,
            model: normalizedModel,
            id: modelId,
            maxTokens: modelWithoutId.maxTokens,
            temperature: modelWithoutId.temperature,
            topP: modelWithoutId.topP,
            cost: this.normalizeCost(modelWithoutId.cost),
            reasoning: this.normalizeReasoning(modelWithoutId.reasoning),
        };
        try {
            const created = await this.modelRegistryModel.create(payload);
            const newModel = this.toAIModel(created.toObject());
            this.logger.log(`Created new model: ${newModel.name} (${newModel.id})`);
            return {
                created: true,
                model: newModel,
                message: `Model ${newModel.name} added successfully`,
            };
        }
        catch (error) {
            if (this.isDuplicateKeyError(error)) {
                const byId = await this.modelRegistryModel.findOne({ id: modelId }).lean().exec();
                if (byId) {
                    return {
                        created: false,
                        model: this.toAIModel(byId),
                        message: `Model with ID ${modelId} already exists`,
                        duplicateBy: 'id',
                    };
                }
                const byProviderModel = await this.modelRegistryModel
                    .findOne({ provider: normalizedProvider, model: normalizedModel })
                    .lean()
                    .exec();
                if (byProviderModel) {
                    return {
                        created: false,
                        model: this.toAIModel(byProviderModel),
                        message: `Model ${normalizedProvider}/${normalizedModel} already exists`,
                        duplicateBy: 'provider_model',
                    };
                }
            }
            throw error;
        }
    }
    async updateModel(modelId, updates) {
        const existing = await this.modelRegistryModel.findOne({ id: modelId }).lean().exec();
        if (!existing) {
            throw new common_1.NotFoundException(`Model with ID ${modelId} not found`);
        }
        const { id, ...updateData } = updates;
        const normalizedUpdateData = {
            ...updateData,
            provider: updateData.provider ? this.normalizeProvider(updateData.provider) : undefined,
            model: updateData.model ? String(updateData.model).trim().toLowerCase() : undefined,
            name: updateData.name?.trim(),
            description: updateData.description === undefined ? undefined : this.normalizeOptionalText(updateData.description),
            availability: updateData.availability === undefined ? undefined : this.normalizeOptionalText(updateData.availability),
            deprecated: updateData.deprecated === undefined ? undefined : Boolean(updateData.deprecated),
            cost: updateData.cost === undefined ? undefined : this.normalizeCost(updateData.cost),
            reasoning: updateData.reasoning === undefined
                ? undefined
                : this.normalizeReasoning(updateData.reasoning),
        };
        if (normalizedUpdateData.provider || normalizedUpdateData.model) {
            const candidateProvider = String(normalizedUpdateData.provider || existing.provider);
            const candidateModel = String(normalizedUpdateData.model || existing.model);
            const conflict = await this.modelRegistryModel
                .findOne({ provider: candidateProvider, model: candidateModel, id: { $ne: modelId } })
                .lean()
                .exec();
            if (conflict) {
                throw new common_1.ConflictException(`Model ${candidateProvider}/${candidateModel} already exists (id=${String(conflict.id)})`);
            }
        }
        await this.modelRegistryModel.updateOne({ id: modelId }, { $set: normalizedUpdateData }).exec();
        const updated = await this.modelRegistryModel.findOne({ id: modelId }).lean().exec();
        if (!updated) {
            throw new common_1.NotFoundException(`Model with ID ${modelId} not found`);
        }
        this.logger.log(`Updated model: ${modelId}`);
        return this.toAIModel(updated);
    }
    async deleteModel(modelId) {
        const deleted = await this.modelRegistryModel.findOneAndDelete({ id: modelId }).lean().exec();
        if (!deleted) {
            throw new common_1.NotFoundException(`Model with ID ${modelId} not found`);
        }
        this.logger.log(`Deleted model: ${modelId}`);
        return {
            success: true,
            message: `Model ${modelId} deleted successfully`,
        };
    }
    async deleteModelByProviderAndModel(provider, model) {
        const normalizedProvider = this.normalizeProvider(provider);
        const normalizedModel = String(model || '').trim().toLowerCase();
        const removed = await this.modelRegistryModel
            .findOneAndDelete({ provider: normalizedProvider, model: normalizedModel })
            .lean()
            .exec();
        if (!removed) {
            throw new common_1.NotFoundException(`Model ${normalizedProvider}/${normalizedModel} not found`);
        }
        this.logger.log(`Deleted model by provider/model: ${normalizedProvider}/${normalizedModel} (id=${removed.id})`);
        return {
            success: true,
            message: `Model ${normalizedProvider}/${normalizedModel} deleted successfully`,
            id: removed.id,
        };
    }
    getModelSettings() {
        return this.settings;
    }
    updateModelSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        return this.settings;
    }
    async selectModelForFounder(founderType, modelId) {
        const model = await this.getModelById(modelId);
        if (!model) {
            return {
                success: false,
                message: `Model with ID ${modelId} not found`,
            };
        }
        this.founderModels[founderType] = model;
        return {
            success: true,
            message: `${founderType.toUpperCase()} model updated successfully`,
            model,
        };
    }
    getFounderModels() {
        return this.founderModels;
    }
    async getModelById(modelId) {
        const model = await this.modelRegistryModel.findOne({ id: modelId }).lean().exec();
        return model ? this.toAIModel(model) : undefined;
    }
    normalizeProvider(provider) {
        const value = String(provider || '').trim().toLowerCase();
        if (value === 'kimi' || value === 'moonshot')
            return 'moonshotai';
        if (value === 'claude')
            return 'anthropic';
        if (value === 'zhipu')
            return 'zhipuai';
        return value;
    }
    buildModelId(provider, model) {
        const normalizedProvider = provider.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const normalizedModel = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return `${normalizedProvider}-${normalizedModel}`;
    }
    toAIModel(doc) {
        return {
            id: String(doc.id || ''),
            name: String(doc.name || ''),
            description: this.normalizeOptionalText(doc.description),
            availability: this.normalizeOptionalText(doc.availability),
            deprecated: Boolean(doc.deprecated),
            provider: this.normalizeProvider(String(doc.provider || 'custom')),
            model: String(doc.model || ''),
            maxTokens: Number(doc.maxTokens || this.settings.defaultMaxTokens),
            temperature: Number(doc.temperature ?? this.settings.defaultTemperature),
            topP: Number(doc.topP ?? 1),
            cost: this.normalizeCost(doc.cost),
            reasoning: this.normalizeReasoning(doc.reasoning),
        };
    }
    normalizeCost(cost) {
        if (!cost || typeof cost !== 'object') {
            return undefined;
        }
        const normalized = {};
        const input = Number(cost.input);
        const output = Number(cost.output);
        const cacheRead = Number(cost.cache_read);
        const cacheWrite = Number(cost.cache_write);
        const reasoning = Number(cost.reasoning);
        if (Number.isFinite(input))
            normalized.input = input;
        if (Number.isFinite(output))
            normalized.output = output;
        if (Number.isFinite(cacheRead))
            normalized.cache_read = cacheRead;
        if (Number.isFinite(cacheWrite))
            normalized.cache_write = cacheWrite;
        if (Number.isFinite(reasoning))
            normalized.reasoning = reasoning;
        return Object.keys(normalized).length > 0 ? normalized : undefined;
    }
    normalizeReasoning(reasoning) {
        if (!reasoning) {
            return undefined;
        }
        const enabled = Boolean(reasoning.enabled);
        const effortValue = String(reasoning.effort || '').trim().toLowerCase();
        const verbosityValue = String(reasoning.verbosity || '').trim().toLowerCase();
        const validEfforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
        const validVerbosity = new Set(['low', 'medium', 'high']);
        return {
            enabled,
            ...(validEfforts.has(effortValue) ? { effort: effortValue } : {}),
            ...(validVerbosity.has(verbosityValue)
                ? { verbosity: verbosityValue }
                : {}),
        };
    }
    isDuplicateKeyError(error) {
        const err = error;
        return Number(err?.code) === 11000;
    }
    async enrichModelsWithPricing(models) {
        const enriched = [];
        for (const model of models) {
            if (model.cost && (Number.isFinite(model.cost.input) || Number.isFinite(model.cost.output))) {
                enriched.push(model);
                continue;
            }
            const pricing = await this.modelPricingService.getPricing(model.provider, model.model);
            if (pricing) {
                enriched.push({ ...model, cost: pricing });
            }
            else {
                enriched.push(model);
            }
        }
        return enriched;
    }
    normalizeOptionalText(value) {
        const normalized = String(value || '').trim();
        return normalized.length > 0 ? normalized : undefined;
    }
    async seedDefaultModels() {
        let insertedCount = 0;
        for (const baseModel of models_1.AVAILABLE_MODELS) {
            const normalizedProvider = this.normalizeProvider(baseModel.provider);
            const normalizedModel = String(baseModel.model || '').trim().toLowerCase();
            if (!normalizedProvider || !normalizedModel) {
                continue;
            }
            const modelId = String(baseModel.id || this.buildModelId(normalizedProvider, normalizedModel)).trim();
            const payload = {
                id: modelId,
                name: String(baseModel.name || normalizedModel).trim(),
                description: this.normalizeOptionalText(baseModel.description),
                availability: this.normalizeOptionalText(baseModel.availability),
                deprecated: Boolean(baseModel.deprecated),
                provider: normalizedProvider,
                model: normalizedModel,
                maxTokens: Number(baseModel.maxTokens || this.settings.defaultMaxTokens),
                temperature: Number(baseModel.temperature ?? this.settings.defaultTemperature),
                topP: Number(baseModel.topP ?? 1),
                reasoning: this.normalizeReasoning(baseModel.reasoning),
            };
            try {
                const existing = await this.modelRegistryModel
                    .findOne({ provider: payload.provider, model: payload.model })
                    .lean()
                    .exec();
                if (existing) {
                    continue;
                }
                await this.modelRegistryModel.create(payload);
                insertedCount += 1;
            }
            catch (error) {
                if (!this.isDuplicateKeyError(error)) {
                    this.logger.warn(`Seed default model failed: ${payload.provider}/${payload.model} (${error instanceof Error ? error.message : 'unknown error'})`);
                }
            }
        }
        if (insertedCount > 0) {
            this.logger.log(`Seeded default models: ${insertedCount}`);
        }
        const validKeys = new Set(models_1.AVAILABLE_MODELS.map((m) => {
            const p = this.normalizeProvider(m.provider);
            const mod = String(m.model || '').trim().toLowerCase();
            return `${p}:${mod}`;
        }));
        const allDocs = await this.modelRegistryModel.find().select({ id: 1, provider: 1, model: 1 }).lean().exec();
        const staleIds = [];
        for (const doc of allDocs) {
            const key = `${String(doc.provider)}:${String(doc.model)}`;
            if (!validKeys.has(key)) {
                staleIds.push(String(doc.id));
            }
        }
        if (staleIds.length > 0) {
            const result = await this.modelRegistryModel.deleteMany({ id: { $in: staleIds } }).exec();
            this.logger.log(`Removed stale models: ${result.deletedCount} (ids: ${staleIds.join(', ')})`);
        }
    }
};
exports.ModelManagementService = ModelManagementService;
exports.ModelManagementService = ModelManagementService = ModelManagementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(model_registry_schema_1.ModelRegistry.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        model_pricing_service_1.ModelPricingService])
], ModelManagementService);
//# sourceMappingURL=model-management.service.js.map