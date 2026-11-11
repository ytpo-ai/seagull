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
var ApiKeyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const api_key_schema_1 = require("../../shared/schemas/api-key.schema");
const encryption_util_1 = require("../../shared/utils/encryption.util");
const uuid_1 = require("uuid");
let ApiKeyService = ApiKeyService_1 = class ApiKeyService {
    constructor(apiKeyModel) {
        this.apiKeyModel = apiKeyModel;
        this.logger = new common_1.Logger(ApiKeyService_1.name);
    }
    async createApiKey(apiKeyData) {
        const normalizedProvider = (apiKeyData.provider || '').trim().toLowerCase();
        const normalizedKey = (apiKeyData.key || '').trim();
        const existingKey = await this.apiKeyModel.findOne({
            name: apiKeyData.name,
            provider: normalizedProvider,
        }).exec();
        if (existingKey) {
            throw new common_1.ConflictException(`API Key with name "${apiKeyData.name}" already exists for provider ${apiKeyData.provider}`);
        }
        if (apiKeyData.isDefault) {
            await this.apiKeyModel.updateMany({ provider: normalizedProvider, isDefault: true }, { $set: { isDefault: false, updatedAt: new Date() } }).exec();
        }
        const encryptedKey = encryption_util_1.EncryptionUtil.encrypt(normalizedKey);
        const newApiKey = new this.apiKeyModel({
            id: (0, uuid_1.v4)(),
            name: apiKeyData.name,
            provider: normalizedProvider,
            keyEncrypted: encryptedKey,
            description: apiKeyData.description,
            isActive: apiKeyData.isActive ?? true,
            expiresAt: apiKeyData.expiresAt,
            isDefault: apiKeyData.isDefault ?? false,
            isDeprecated: apiKeyData.isDeprecated ?? false,
            category: apiKeyData.category ?? 'LLM',
            useCount: 0,
        });
        const saved = await newApiKey.save();
        this.logger.log(`Created encrypted API Key: ${saved.name} for ${saved.provider}`);
        return this.toResponse(saved);
    }
    async getAllApiKeys() {
        const keys = await this.apiKeyModel.find().sort({ provider: 1, name: 1 }).exec();
        return keys.map(key => this.toResponse(key));
    }
    async getApiKey(id) {
        const key = await this.apiKeyModel.findOne({ id }).exec();
        return key ? this.toResponse(key) : null;
    }
    async getApiKeysByProvider(provider) {
        const keys = await this.apiKeyModel.find({ provider }).exec();
        return keys.map(key => this.toResponse(key));
    }
    async updateApiKey(id, updates) {
        const currentKey = await this.apiKeyModel.findOne({ id }).exec();
        if (!currentKey) {
            return null;
        }
        const updateData = {
            updatedAt: new Date()
        };
        if (updates.name !== undefined)
            updateData.name = updates.name;
        if (updates.provider !== undefined)
            updateData.provider = updates.provider.trim().toLowerCase();
        if (updates.description !== undefined)
            updateData.description = updates.description;
        if (updates.isActive !== undefined)
            updateData.isActive = updates.isActive;
        if (updates.isDefault !== undefined)
            updateData.isDefault = updates.isDefault;
        if (updates.isDeprecated !== undefined)
            updateData.isDeprecated = updates.isDeprecated;
        if (updates.category !== undefined)
            updateData.category = updates.category;
        if (updates.expiresAt !== undefined)
            updateData.expiresAt = updates.expiresAt;
        if (updates.key) {
            updateData.keyEncrypted = encryption_util_1.EncryptionUtil.encrypt(updates.key.trim());
            delete updateData.key;
        }
        const providerForDefault = updateData.provider || currentKey.provider;
        const willBeDefault = updates.isDefault !== undefined ? updates.isDefault : currentKey.isDefault;
        const providerChanged = providerForDefault !== currentKey.provider;
        if (willBeDefault && (updates.isDefault || providerChanged)) {
            await this.apiKeyModel.updateMany({
                provider: providerForDefault,
                isDefault: true,
                id: { $ne: id }
            }, { $set: { isDefault: false, updatedAt: new Date() } }).exec();
        }
        const updated = await this.apiKeyModel.findOneAndUpdate({ id }, updateData, { new: true }).exec();
        if (updated) {
            this.logger.log(`Updated API Key: ${id}`);
        }
        return updated ? this.toResponse(updated) : null;
    }
    async deleteApiKey(id) {
        const result = await this.apiKeyModel.findOneAndDelete({ id }).exec();
        if (result) {
            this.logger.log(`Deleted API Key: ${id}`);
            return true;
        }
        return false;
    }
    async recordUsage(id) {
        await this.apiKeyModel.findOneAndUpdate({ id }, {
            $inc: { useCount: 1 },
            lastUsedAt: new Date()
        }).exec();
    }
    async getDecryptedKey(id) {
        const apiKey = await this.apiKeyModel.findOne({ id }).exec();
        if (!apiKey) {
            return null;
        }
        try {
            return encryption_util_1.EncryptionUtil.decrypt(apiKey.keyEncrypted).trim();
        }
        catch (error) {
            this.logger.error(`Failed to decrypt API key ${id}: ${error.message}`);
            return null;
        }
    }
    async getApiKeyStats() {
        const total = await this.apiKeyModel.countDocuments();
        const active = await this.apiKeyModel.countDocuments({ isActive: true });
        const byProvider = await this.apiKeyModel.aggregate([
            {
                $group: {
                    _id: '$provider',
                    count: { $sum: 1 },
                    activeCount: {
                        $sum: { $cond: ['$isActive', 1, 0] }
                    }
                }
            }
        ]).exec();
        return {
            total,
            active,
            inactive: total - active,
            byProvider
        };
    }
    toResponse(apiKey) {
        return {
            _id: apiKey._id.toString(),
            id: apiKey.id,
            name: apiKey.name,
            provider: apiKey.provider,
            keyMasked: this.maskKey(apiKey.keyEncrypted),
            description: apiKey.description,
            isActive: apiKey.isActive,
            lastUsedAt: apiKey.lastUsedAt,
            useCount: apiKey.useCount,
            expiresAt: apiKey.expiresAt,
            isDefault: apiKey.isDefault ?? false,
            isDeprecated: apiKey.isDeprecated ?? false,
            category: apiKey.category || 'LLM',
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
        };
    }
    maskKey(encryptedKey) {
        if (encryptedKey.length <= 12) {
            return encryptedKey;
        }
        return `${encryptedKey.substring(0, 8)}****${encryptedKey.slice(-4)}`;
    }
};
exports.ApiKeyService = ApiKeyService;
exports.ApiKeyService = ApiKeyService = ApiKeyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(api_key_schema_1.ApiKey.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ApiKeyService);
//# sourceMappingURL=api-key.service.js.map