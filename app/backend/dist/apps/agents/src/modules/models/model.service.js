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
var ModelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../../../../../libs/models/src/index");
const model_pricing_service_1 = require("./model-pricing.service");
let ModelService = ModelService_1 = class ModelService {
    normalizeFinishReason(reason) {
        if (typeof reason !== 'string' || !reason.trim()) {
            return undefined;
        }
        const normalized = reason.trim().toLowerCase();
        if (normalized === 'stop' || normalized === 'tool_calls' || normalized === 'length' || normalized === 'content_filter') {
            return normalized;
        }
        if (normalized === 'tool-calls') {
            return 'tool_calls';
        }
        return undefined;
    }
    normalizeUsage(providerName, usage) {
        if (!usage) {
            return undefined;
        }
        const inputTokens = Number(usage.inputTokens || 0);
        const outputTokens = Number(usage.outputTokens || 0);
        const reasoningTokens = Number(usage.reasoningTokens || 0) || undefined;
        const cacheRead = Number(usage.cachedInputTokens || 0) || undefined;
        const cacheWrite = Number(usage.cacheWriteTokens || 0) || undefined;
        const cacheInInputProviders = new Set(['openai', 'openrouter']);
        const includesCacheInInput = cacheInInputProviders.has(providerName.toLowerCase());
        const adjustedInputTokens = includesCacheInInput
            ? Math.max(0, inputTokens - (cacheRead || 0) - (cacheWrite || 0))
            : inputTokens;
        const totalTokens = adjustedInputTokens + outputTokens + (reasoningTokens || 0) + (cacheRead || 0) + (cacheWrite || 0);
        return {
            inputTokens: adjustedInputTokens,
            outputTokens,
            reasoningTokens,
            cacheRead,
            cacheWrite,
            totalTokens,
        };
    }
    constructor(modelPricingService) {
        this.modelPricingService = modelPricingService;
        this.logger = new common_1.Logger(ModelService_1.name);
        this.providers = new Map();
    }
    ensureProvider(model) {
        if (!this.providers.has(model.id)) {
            this.registerProvider(model);
        }
    }
    registerProvider(model, apiKey) {
        let provider;
        const normalizedProvider = (model.provider || '').toLowerCase().trim();
        const useV2 = this.shouldUseAIV2Provider(model);
        if (useV2) {
            provider = new models_1.AIV2Provider(model, apiKey);
            this.providers.set(model.id, provider);
            this.logger.log(`model=${model.model} provider=${normalizedProvider} route=v2`);
            return;
        }
        switch (normalizedProvider) {
            case 'openai':
                provider = new models_1.OpenAIProvider(model, apiKey);
                break;
            case 'anthropic':
                provider = new models_1.AnthropicProvider(model, apiKey);
                break;
            case 'google':
                provider = new models_1.GoogleAIProvider(model, apiKey);
                break;
            default:
                provider = this.createGenericProvider(model);
                break;
        }
        this.providers.set(model.id, provider);
        this.logger.log(`model=${model.model} provider=${normalizedProvider} route=v1`);
    }
    shouldUseAIV2Provider(model) {
        const provider = String(model.provider || '').toLowerCase().trim();
        const modelName = String(model.model || '').toLowerCase().trim();
        if (provider === 'alibaba' || provider === 'qwen') {
            return true;
        }
        if (provider === 'moonshotai' || provider === 'moonshot' || provider === 'kimi') {
            return true;
        }
        if (provider === 'deepseek') {
            return true;
        }
        const enabled = String(process.env.LLM_PROVIDER_V2_ENABLED || '').toLowerCase();
        if (!['1', 'true', 'yes', 'on'].includes(enabled)) {
            return false;
        }
        const providerAllowlist = this.parseCsvEnv('LLM_PROVIDER_V2_PROVIDERS');
        const modelAllowlist = this.parseCsvEnv('LLM_PROVIDER_V2_MODELS');
        const isProviderMatched = providerAllowlist.length === 0 ||
            providerAllowlist.includes('*') ||
            providerAllowlist.includes(provider);
        const isModelMatched = modelAllowlist.length === 0 ||
            modelAllowlist.includes('*') ||
            modelAllowlist.includes(modelName);
        return isProviderMatched && isModelMatched;
    }
    parseCsvEnv(name) {
        const raw = String(process.env[name] || '').trim();
        if (!raw) {
            return [];
        }
        return raw
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
    }
    ensureProviderWithKey(model, apiKey) {
        if (apiKey) {
            this.registerProvider(model, apiKey);
            return;
        }
        if (!this.providers.has(model.id)) {
            this.registerProvider(model);
        }
    }
    createGenericProvider(model) {
        return new (class extends models_1.BaseAIProvider {
            async chat(messages, options) {
                const envKey = `${model.provider.toUpperCase()}_API_KEY`;
                return `[${model.provider} - ${model.name}] API调用暂未实现。请确保已配置 ${envKey} 环境变量`;
            }
            async streamingChat(messages, onToken, options) {
                onToken(`[${model.provider} - ${model.name}] 流式响应暂未实现`);
            }
        })(model);
    }
    getProvider(modelId) {
        const provider = this.providers.get(modelId);
        if (!provider) {
            throw new Error(`Provider not found for model: ${modelId}`);
        }
        return provider;
    }
    async chat(modelId, messages, options) {
        const provider = this.getProvider(modelId);
        const result = await provider.chatWithMeta(messages, options);
        const providerName = String(provider.modelInfo.provider || '').toLowerCase();
        const usage = this.normalizeUsage(providerName, result.usage);
        let cost = typeof result.cost === 'number' && Number.isFinite(result.cost) ? result.cost : undefined;
        if (cost === undefined && usage) {
            const pricing = await this.modelPricingService.getPricing(providerName, provider.modelInfo.model);
            if (pricing) {
                cost = this.modelPricingService.calculateCost(pricing, {
                    input: usage.inputTokens,
                    output: usage.outputTokens,
                    reasoning: usage.reasoningTokens,
                    cacheRead: usage.cacheRead,
                    cacheWrite: usage.cacheWrite,
                });
            }
        }
        return {
            response: result.response,
            usage,
            finishReason: this.normalizeFinishReason(result.finishReason),
            cost,
        };
    }
    async streamingChat(modelId, messages, onToken, options) {
        const provider = this.getProvider(modelId);
        return provider.streamingChat(messages, onToken, options);
    }
    getAvailableModels() {
        return Array.from(this.providers.values()).map(provider => provider.modelInfo);
    }
    initializeDefaultModels() {
        const defaultModels = [
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                provider: 'openai',
                model: 'gpt-4-turbo-preview',
                maxTokens: 4096,
                temperature: 0.7,
            },
            {
                id: 'claude-sonnet-4-6',
                name: 'Claude Sonnet 4.6',
                provider: 'anthropic',
                model: 'claude-sonnet-4-6',
                maxTokens: 64000,
                temperature: 0.7,
            },
            {
                id: 'gemini-pro',
                name: 'Gemini Pro',
                provider: 'google',
                model: 'gemini-pro',
                maxTokens: 4096,
                temperature: 0.7,
            },
        ];
        defaultModels.forEach(model => this.registerProvider(model));
    }
};
exports.ModelService = ModelService;
exports.ModelService = ModelService = ModelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_pricing_service_1.ModelPricingService])
], ModelService);
//# sourceMappingURL=model.service.js.map