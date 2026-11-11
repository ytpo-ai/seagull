"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ModelPricingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelPricingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const model_registry_schema_1 = require("../../schemas/model-registry.schema");
let ModelPricingService = ModelPricingService_1 = class ModelPricingService {
    constructor(modelRegistryModel) {
        this.modelRegistryModel = modelRegistryModel;
        this.logger = new common_1.Logger(ModelPricingService_1.name);
        this.pricingCache = new Map();
        this.overrideCache = new Map();
        const cwd = process.cwd();
        const configuredPath = String(process.env.MODELS_PRICING_CACHE_PATH || '').trim();
        if (configuredPath) {
            this.cachePath = path.isAbsolute(configuredPath)
                ? configuredPath
                : path.resolve(cwd, configuredPath);
        }
        else {
            this.cachePath = path.basename(cwd) === 'backend'
                ? path.resolve(cwd, '../data/cache/models-pricing.json')
                : path.resolve(cwd, 'data/cache/models-pricing.json');
        }
        const configuredTtl = Number(process.env.MODEL_PRICING_OVERRIDE_TTL_MS || 300000);
        this.overrideTtlMs = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 300000;
    }
    async onModuleInit() {
        await this.loadFromLocalCache();
        void this.refreshFromRemote();
        this.startPeriodicRefresh();
    }
    async getPricing(provider, model) {
        const normalizedProvider = this.normalizeProvider(provider);
        const normalizedModel = String(model || '').trim().toLowerCase();
        if (!normalizedProvider || !normalizedModel) {
            return undefined;
        }
        const override = await this.getRegistryOverride(normalizedProvider, normalizedModel);
        if (override) {
            return override;
        }
        return this.pricingCache.get(this.getCacheKey(normalizedProvider, normalizedModel));
    }
    calculateCost(pricing, tokens) {
        const input = Number(tokens.input || 0);
        const output = Number(tokens.output || 0);
        const cacheRead = Number(tokens.cacheRead || 0);
        const cacheWrite = Number(tokens.cacheWrite || 0);
        const reasoning = Number(tokens.reasoning || 0);
        const total = (input * pricing.input) / 1000000 +
            (output * pricing.output) / 1000000 +
            (cacheRead * (pricing.cache_read ?? pricing.input)) / 1000000 +
            (cacheWrite * (pricing.cache_write ?? pricing.input)) / 1000000 +
            (reasoning * (pricing.reasoning ?? pricing.output)) / 1000000;
        return Number.isFinite(total) ? total : 0;
    }
    async getPricingStatus() {
        const overrideCount = await this.countOverrides();
        return {
            lastRefresh: this.lastRefreshAt?.toISOString(),
            modelCount: this.pricingCache.size,
            overrideCount,
            source: 'models.dev+cache',
        };
    }
    async manualRefresh() {
        const refreshed = await this.refreshFromRemote();
        return {
            success: refreshed,
            modelCount: this.pricingCache.size,
            refreshedAt: new Date().toISOString(),
        };
    }
    async getRegistryOverride(provider, model) {
        const cacheKey = this.getCacheKey(provider, model);
        const now = Date.now();
        const cached = this.overrideCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.cost;
        }
        const doc = await this.modelRegistryModel
            .findOne({ provider, model })
            .select({ cost: 1 })
            .lean()
            .exec();
        const normalizedCost = this.normalizeCost(doc?.cost);
        this.overrideCache.set(cacheKey, {
            expiresAt: now + this.overrideTtlMs,
            cost: normalizedCost,
        });
        return normalizedCost;
    }
    async loadFromLocalCache() {
        try {
            const content = await (0, promises_1.readFile)(this.cachePath, 'utf-8');
            const parsed = JSON.parse(content);
            const records = Array.isArray(parsed?.records) ? parsed.records : [];
            for (const record of records) {
                const provider = this.normalizeProvider(record.provider);
                const model = String(record.model || '').trim().toLowerCase();
                const cost = this.normalizeCost(record.cost);
                if (!provider || !model || !cost) {
                    continue;
                }
                this.pricingCache.set(this.getCacheKey(provider, model), cost);
            }
            if (parsed?.updatedAt) {
                const parsedDate = new Date(parsed.updatedAt);
                if (!Number.isNaN(parsedDate.getTime())) {
                    this.lastRefreshAt = parsedDate;
                }
            }
            this.logger.log(`Loaded model pricing cache records=${this.pricingCache.size}`);
        }
        catch (error) {
            this.logger.log('Model pricing cache file not found, skip preload');
        }
    }
    async refreshFromRemote() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('https://models.dev/api.json', {
                method: 'GET',
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`models.dev request failed: ${response.status}`);
            }
            const payload = (await response.json());
            const records = this.flattenPricing(payload);
            if (records.length === 0) {
                throw new Error('models.dev payload has no pricing records');
            }
            this.pricingCache.clear();
            for (const record of records) {
                this.pricingCache.set(this.getCacheKey(record.provider, record.model), record.cost);
            }
            this.lastRefreshAt = new Date();
            await this.persistCache(records);
            this.logger.log(`Refreshed model pricing from models.dev records=${records.length}`);
            return true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.warn(`Refresh model pricing failed: ${message}`);
            return false;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    flattenPricing(payload) {
        const records = [];
        for (const [providerKey, providerValue] of Object.entries(payload || {})) {
            const provider = this.normalizeProvider(String(providerValue?.id || providerKey));
            const models = providerValue?.models && typeof providerValue.models === 'object' ? providerValue.models : {};
            for (const [modelKey, modelValue] of Object.entries(models)) {
                const model = String(modelValue?.id || modelKey || '').trim().toLowerCase();
                const cost = this.normalizeCost(modelValue?.cost);
                if (!provider || !model || !cost) {
                    continue;
                }
                records.push({ provider, model, cost });
            }
        }
        return records;
    }
    async persistCache(records) {
        const cacheDir = path.dirname(this.cachePath);
        await (0, promises_1.mkdir)(cacheDir, { recursive: true });
        const payload = {
            source: 'models.dev',
            updatedAt: new Date().toISOString(),
            records,
        };
        await (0, promises_1.writeFile)(this.cachePath, JSON.stringify(payload, null, 2), 'utf-8');
    }
    startPeriodicRefresh() {
        this.refreshTimer = setInterval(() => {
            void this.refreshFromRemote();
        }, 60 * 60 * 1000);
        this.refreshTimer.unref();
    }
    async countOverrides() {
        return this.modelRegistryModel.countDocuments({
            $or: [
                { 'cost.input': { $type: 'number' } },
                { 'cost.output': { $type: 'number' } },
                { 'cost.cache_read': { $type: 'number' } },
                { 'cost.cache_write': { $type: 'number' } },
                { 'cost.reasoning': { $type: 'number' } },
            ],
        });
    }
    getCacheKey(provider, model) {
        return `${provider}:${model}`;
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
    normalizeCost(raw) {
        if (!raw || typeof raw !== 'object') {
            return undefined;
        }
        const input = Number(raw.input);
        const output = Number(raw.output);
        if (!Number.isFinite(input) || !Number.isFinite(output)) {
            return undefined;
        }
        const normalized = {
            input,
            output,
        };
        const cacheRead = Number(raw.cache_read);
        const cacheWrite = Number(raw.cache_write);
        const reasoning = Number(raw.reasoning);
        if (Number.isFinite(cacheRead))
            normalized.cache_read = cacheRead;
        if (Number.isFinite(cacheWrite))
            normalized.cache_write = cacheWrite;
        if (Number.isFinite(reasoning))
            normalized.reasoning = reasoning;
        return normalized;
    }
};
exports.ModelPricingService = ModelPricingService;
exports.ModelPricingService = ModelPricingService = ModelPricingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(model_registry_schema_1.ModelRegistry.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ModelPricingService);
//# sourceMappingURL=model-pricing.service.js.map