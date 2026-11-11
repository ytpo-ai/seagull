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
exports.ChannelConfigService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const encryption_util_1 = require("../../../../../src/shared/utils/encryption.util");
const channel_config_schema_1 = require("./schemas/channel-config.schema");
const channel_delivery_log_schema_1 = require("./schemas/channel-delivery-log.schema");
const channel_provider_registry_1 = require("./channel-provider.registry");
let ChannelConfigService = class ChannelConfigService {
    constructor(channelConfigModel, channelDeliveryLogModel, providerRegistry) {
        this.channelConfigModel = channelConfigModel;
        this.channelDeliveryLogModel = channelDeliveryLogModel;
        this.providerRegistry = providerRegistry;
    }
    async createConfig(dto) {
        const provider = this.providerRegistry.getProvider(dto.providerType);
        const providerConfig = this.normalizeProviderConfig(dto.providerType, dto.targetType, dto.providerConfig, undefined);
        const isValid = await provider.validateConfig(providerConfig);
        if (!isValid) {
            throw new common_1.BadRequestException('invalid provider config');
        }
        const created = await this.channelConfigModel.create({
            name: String(dto.name || '').trim(),
            providerType: dto.providerType,
            targetType: dto.targetType,
            providerConfig: this.encryptProviderConfig(dto.providerType, providerConfig),
            eventFilters: this.normalizeEventFilters(dto.eventFilters),
            isActive: dto.isActive !== false,
            createdBy: String(dto.createdBy || '').trim() || undefined,
        });
        return this.toResponse(created);
    }
    async listConfigs() {
        const configs = await this.channelConfigModel.find().sort({ createdAt: -1 }).exec();
        return configs.map((item) => this.toResponse(item));
    }
    async updateConfig(id, dto) {
        const current = await this.channelConfigModel.findOne({ _id: id }).exec();
        if (!current) {
            throw new common_1.NotFoundException('channel config not found');
        }
        const nextTargetType = dto.targetType || current.targetType;
        const nextProviderConfig = this.normalizeProviderConfig(current.providerType, nextTargetType, dto.providerConfig || {}, current.providerConfig);
        const provider = this.providerRegistry.getProvider(current.providerType);
        const isValid = await provider.validateConfig(nextProviderConfig);
        if (!isValid) {
            throw new common_1.BadRequestException('invalid provider config');
        }
        const updated = await this.channelConfigModel
            .findOneAndUpdate({ _id: id }, {
            $set: {
                ...(dto.name !== undefined ? { name: String(dto.name || '').trim() } : {}),
                ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
                providerConfig: this.encryptProviderConfig(current.providerType, nextProviderConfig),
                ...(dto.eventFilters !== undefined ? { eventFilters: this.normalizeEventFilters(dto.eventFilters) } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('channel config not found');
        }
        return this.toResponse(updated);
    }
    async deleteConfig(id) {
        const deleted = await this.channelConfigModel.findOneAndDelete({ _id: id }).exec();
        if (!deleted) {
            throw new common_1.NotFoundException('channel config not found');
        }
        return { success: true };
    }
    async testPush(id) {
        const config = await this.channelConfigModel.findOne({ _id: id }).exec();
        if (!config) {
            throw new common_1.NotFoundException('channel config not found');
        }
        const provider = this.providerRegistry.getProvider(config.providerType);
        const target = this.resolveTarget(config);
        const message = {
            title: 'Channel 测试消息',
            content: '这是一条来自 channel 服务的测试消息。',
            contentType: 'card',
            payload: {
                status: 'completed',
                summary: '测试推送成功',
                actionUrl: 'https://open.feishu.cn/',
            },
            sourceEvent: {
                eventId: `test-${Date.now()}`,
                eventType: 'channel.config.test',
                occurredAt: new Date().toISOString(),
            },
        };
        const result = await provider.send(target, message);
        await this.createDeliveryLog({
            configId: target.configId,
            eventId: message.sourceEvent.eventId,
            eventType: message.sourceEvent.eventType,
            providerType: target.providerType,
            status: result.success ? 'success' : 'failed',
            attempt: 1,
            errorMessage: result.errorMessage,
            requestPayload: {
                title: message.title,
                contentType: message.contentType,
            },
            responsePayload: {
                success: result.success,
                statusCode: result.statusCode,
            },
            deliveredAt: result.deliveredAt,
        });
        return result;
    }
    async findActiveTargetsByEventType(eventType) {
        const eventTypeValue = String(eventType || '').trim();
        if (!eventTypeValue) {
            return [];
        }
        const configs = await this.channelConfigModel.find({ isActive: true }).exec();
        const matched = configs.filter((item) => this.matchEventFilter(item.eventFilters, eventTypeValue));
        return matched.map((item) => this.resolveTarget(item));
    }
    matchEventFilter(filters, eventType) {
        for (const filter of filters || []) {
            const normalizedFilter = String(filter || '').trim();
            if (!normalizedFilter) {
                continue;
            }
            if (normalizedFilter === eventType) {
                return true;
            }
            if (normalizedFilter.endsWith('*')) {
                const prefix = normalizedFilter.slice(0, -1);
                if (prefix && eventType.startsWith(prefix)) {
                    return true;
                }
            }
        }
        return false;
    }
    async createDeliveryLog(input) {
        await this.channelDeliveryLogModel.create({
            configId: input.configId,
            eventId: input.eventId,
            eventType: input.eventType,
            providerType: input.providerType,
            status: input.status,
            attempt: input.attempt,
            errorMessage: String(input.errorMessage || '').trim() || undefined,
            requestPayload: input.requestPayload,
            responsePayload: input.responsePayload,
            deliveredAt: input.deliveredAt,
        });
    }
    resolveTarget(config) {
        const providerConfig = this.decryptProviderConfig(config.providerConfig);
        return {
            configId: config._id.toString(),
            providerType: config.providerType,
            targetType: config.targetType,
            providerConfig,
        };
    }
    toResponse(config) {
        const providerConfig = this.decryptProviderConfig(config.providerConfig);
        const common = {
            id: config._id.toString(),
            name: config.name,
            providerType: config.providerType,
            targetType: config.targetType,
            eventFilters: config.eventFilters,
            isActive: config.isActive,
            createdBy: config.createdBy,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
        };
        if (config.providerType === 'feishu-app') {
            return {
                ...common,
                providerConfig: {
                    appIdMasked: this.maskSensitiveText(String(providerConfig.appId || ''), 3, 3),
                    hasAppSecret: Boolean(providerConfig.appSecret),
                    hasEncryptKey: Boolean(providerConfig.encryptKey),
                    receiveId: String(providerConfig.receiveId || ''),
                    receiveIdType: String(providerConfig.receiveIdType || ''),
                },
            };
        }
        return {
            ...common,
            providerConfig: {
                webhookUrlMasked: this.maskWebhookUrl(String(providerConfig.webhookUrl || '')),
                hasWebhookSecret: Boolean(providerConfig.webhookSecret),
            },
        };
    }
    normalizeEventFilters(value) {
        const list = Array.isArray(value) ? value : [];
        return Array.from(new Set(list
            .map((item) => String(item || '').trim())
            .filter(Boolean)));
    }
    normalizeProviderConfig(providerType, targetType, value, currentEncrypted) {
        const current = currentEncrypted
            ? this.decryptProviderConfig(currentEncrypted)
            : {};
        if (providerType === 'feishu-app') {
            const appId = String(value.appId ?? current.appId ?? '').trim();
            const appSecret = String(value.appSecret ?? current.appSecret ?? '').trim();
            const encryptKey = String(value.encryptKey ?? current.encryptKey ?? '').trim() || undefined;
            const receiveId = String(value.receiveId ?? current.receiveId ?? '').trim();
            const receiveIdTypeRaw = String(value.receiveIdType ?? current.receiveIdType ?? '').trim();
            const receiveIdType = receiveIdTypeRaw === 'chat_id' || receiveIdTypeRaw === 'open_id'
                ? receiveIdTypeRaw
                : targetType === 'user'
                    ? 'open_id'
                    : 'chat_id';
            if (!appId || !appSecret || !receiveId) {
                throw new common_1.BadRequestException('providerConfig.appId/appSecret/receiveId are required for feishu-app');
            }
            return {
                appId,
                appSecret,
                encryptKey,
                receiveId,
                receiveIdType,
            };
        }
        const webhookUrl = String(value.webhookUrl ?? current.webhookUrl ?? '').trim();
        const webhookSecret = String(value.webhookSecret ?? current.webhookSecret ?? '').trim() || undefined;
        if (!webhookUrl) {
            throw new common_1.BadRequestException('providerConfig.webhookUrl is required');
        }
        return {
            webhookUrl,
            webhookSecret,
        };
    }
    encryptProviderConfig(providerType, input) {
        if (providerType === 'feishu-app') {
            return {
                appIdEncrypted: encryption_util_1.EncryptionUtil.encrypt(String(input.appId || '')),
                appSecretEncrypted: encryption_util_1.EncryptionUtil.encrypt(String(input.appSecret || '')),
                encryptKeyEncrypted: input.encryptKey ? encryption_util_1.EncryptionUtil.encrypt(String(input.encryptKey || '')) : undefined,
                receiveId: String(input.receiveId || ''),
                receiveIdType: String(input.receiveIdType || 'chat_id'),
            };
        }
        return {
            webhookUrlEncrypted: encryption_util_1.EncryptionUtil.encrypt(String(input.webhookUrl || '')),
            webhookSecretEncrypted: input.webhookSecret ? encryption_util_1.EncryptionUtil.encrypt(String(input.webhookSecret || '')) : undefined,
        };
    }
    decryptProviderConfig(input) {
        const appIdEncrypted = String(input.appIdEncrypted || '').trim();
        const appSecretEncrypted = String(input.appSecretEncrypted || '').trim();
        if (appIdEncrypted && appSecretEncrypted) {
            const encryptKeyRaw = String(input.encryptKeyEncrypted || '').trim();
            return {
                appId: encryption_util_1.EncryptionUtil.decrypt(appIdEncrypted),
                appSecret: encryption_util_1.EncryptionUtil.decrypt(appSecretEncrypted),
                encryptKey: encryptKeyRaw ? encryption_util_1.EncryptionUtil.decrypt(encryptKeyRaw) : undefined,
                receiveId: String(input.receiveId || '').trim(),
                receiveIdType: String(input.receiveIdType || '').trim() || undefined,
            };
        }
        const webhookUrlEncrypted = String(input.webhookUrlEncrypted || '').trim();
        const webhookSecretEncrypted = String(input.webhookSecretEncrypted || '').trim();
        return {
            webhookUrl: webhookUrlEncrypted ? encryption_util_1.EncryptionUtil.decrypt(webhookUrlEncrypted) : '',
            webhookSecret: webhookSecretEncrypted ? encryption_util_1.EncryptionUtil.decrypt(webhookSecretEncrypted) : undefined,
        };
    }
    maskWebhookUrl(webhookUrl) {
        if (!webhookUrl) {
            return '';
        }
        try {
            const parsed = new URL(webhookUrl);
            const hookPath = parsed.pathname.split('/').filter(Boolean).pop() || '';
            const masked = hookPath.length > 6 ? `${hookPath.slice(0, 3)}***${hookPath.slice(-3)}` : '***';
            return `${parsed.origin}/open-apis/bot/v2/hook/${masked}`;
        }
        catch {
            return '***';
        }
    }
    maskSensitiveText(value, prefixSize, suffixSize) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return '';
        }
        if (normalized.length <= prefixSize + suffixSize) {
            return `${normalized.slice(0, 1)}***`;
        }
        return `${normalized.slice(0, prefixSize)}***${normalized.slice(-suffixSize)}`;
    }
};
exports.ChannelConfigService = ChannelConfigService;
exports.ChannelConfigService = ChannelConfigService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(channel_config_schema_1.ChannelConfig.name)),
    __param(1, (0, mongoose_1.InjectModel)(channel_delivery_log_schema_1.ChannelDeliveryLog.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        channel_provider_registry_1.ChannelProviderRegistry])
], ChannelConfigService);
//# sourceMappingURL=channel-config.service.js.map