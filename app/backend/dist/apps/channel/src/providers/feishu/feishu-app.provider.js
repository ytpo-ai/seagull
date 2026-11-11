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
var FeishuAppProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuAppProvider = void 0;
const common_1 = require("@nestjs/common");
const lark = __importStar(require("@larksuiteoapi/node-sdk"));
const feishu_card_builder_1 = require("./feishu-card-builder");
let FeishuAppProvider = FeishuAppProvider_1 = class FeishuAppProvider {
    constructor(cardBuilder) {
        this.cardBuilder = cardBuilder;
        this.providerType = 'feishu-app';
        this.logger = new common_1.Logger(FeishuAppProvider_1.name);
        this.clientCache = new Map();
    }
    async replyText(chatId, text, replyToMessageId) {
        const normalizedChatId = String(chatId || '').trim();
        const normalizedText = String(text || '').trim();
        if (!normalizedChatId || !normalizedText) {
            return;
        }
        const runtimeConfig = this.resolveRuntimeConfig();
        if (!runtimeConfig) {
            throw new Error('feishu runtime config not available');
        }
        const client = this.getOrCreateClient(runtimeConfig);
        const replyMessageId = String(replyToMessageId || '').trim();
        const body = {
            content: JSON.stringify({ text: normalizedText }),
            msg_type: 'text',
        };
        if (replyMessageId && client?.im?.message?.reply) {
            await client.im.message.reply({
                path: {
                    message_id: replyMessageId,
                },
                data: body,
            });
            return;
        }
        await client.im.message.create({
            params: {
                receive_id_type: 'chat_id',
            },
            data: {
                receive_id: normalizedChatId,
                ...body,
            },
        });
    }
    async send(target, message) {
        const config = this.resolveConfig(target.providerConfig, target.targetType);
        if (!config) {
            return {
                success: false,
                providerType: this.providerType,
                errorMessage: 'invalid provider config',
                deliveredAt: new Date(),
            };
        }
        try {
            const client = this.getOrCreateClient(config);
            const card = this.cardBuilder.buildCard(message);
            const response = await client.im.message.create({
                params: {
                    receive_id_type: config.receiveIdType,
                },
                data: {
                    receive_id: config.receiveId,
                    msg_type: 'interactive',
                    content: JSON.stringify(card),
                },
            });
            const code = Number(response?.code || 0);
            if (code === 0) {
                return {
                    success: true,
                    providerType: this.providerType,
                    statusCode: 200,
                    deliveredAt: new Date(),
                };
            }
            return {
                success: false,
                providerType: this.providerType,
                statusCode: Number(response?.statusCode || 500),
                errorMessage: String(response?.msg || `feishu_app_error_${code}`),
                deliveredAt: new Date(),
            };
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Feishu app provider send failed: configId=${target.configId} reason=${reason}`);
            return {
                success: false,
                providerType: this.providerType,
                errorMessage: reason,
                deliveredAt: new Date(),
            };
        }
    }
    async validateConfig(config) {
        const resolved = this.resolveConfig(config, 'group');
        if (!resolved) {
            return false;
        }
        try {
            const client = this.getOrCreateClient(resolved);
            const response = await client.auth.v3.tenantAccessToken.internal({
                data: {
                    app_id: resolved.appId,
                    app_secret: resolved.appSecret,
                },
            });
            return Number(response?.code || 0) === 0;
        }
        catch {
            return false;
        }
    }
    resolveConfig(input, targetType) {
        const appId = String(input.appId || '').trim();
        const appSecret = String(input.appSecret || '').trim();
        const receiveId = String(input.receiveId || '').trim();
        const encryptKey = String(input.encryptKey || '').trim() || undefined;
        const receiveIdTypeRaw = String(input.receiveIdType || '').trim();
        const receiveIdType = receiveIdTypeRaw === 'chat_id' || receiveIdTypeRaw === 'open_id'
            ? receiveIdTypeRaw
            : targetType === 'user'
                ? 'open_id'
                : 'chat_id';
        if (!appId || !appSecret || !receiveId) {
            return null;
        }
        return {
            appId,
            appSecret,
            encryptKey,
            receiveId,
            receiveIdType,
        };
    }
    getOrCreateClient(config) {
        const cacheKey = `${config.appId}:${config.appSecret}`;
        const cached = this.clientCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const larkAny = lark;
        const client = new larkAny.Client({
            appId: config.appId,
            appSecret: config.appSecret,
            appType: larkAny.AppType?.SelfBuild,
            domain: larkAny.Domain?.Feishu,
            disableTokenCache: false,
        });
        this.clientCache.set(cacheKey, client);
        return client;
    }
    resolveRuntimeConfig() {
        const appId = String(process.env.FEISHU_APP_ID || '').trim();
        const appSecret = String(process.env.FEISHU_APP_SECRET || '').trim();
        const encryptKey = String(process.env.FEISHU_APP_ENCRYPT_KEY || '').trim() || undefined;
        if (!appId || !appSecret) {
            return null;
        }
        return {
            appId,
            appSecret,
            encryptKey,
            receiveId: 'runtime_chat',
            receiveIdType: 'chat_id',
        };
    }
};
exports.FeishuAppProvider = FeishuAppProvider;
exports.FeishuAppProvider = FeishuAppProvider = FeishuAppProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_card_builder_1.FeishuCardBuilder])
], FeishuAppProvider);
//# sourceMappingURL=feishu-app.provider.js.map