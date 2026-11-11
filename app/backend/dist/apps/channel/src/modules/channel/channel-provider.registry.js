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
exports.ChannelProviderRegistry = void 0;
const common_1 = require("@nestjs/common");
const feishu_app_provider_1 = require("../../providers/feishu/feishu-app.provider");
const feishu_webhook_provider_1 = require("../../providers/feishu/feishu-webhook.provider");
let ChannelProviderRegistry = class ChannelProviderRegistry {
    constructor(feishuWebhookProvider, feishuAppProvider) {
        this.providerMap = new Map([
            [feishuWebhookProvider.providerType, feishuWebhookProvider],
            [feishuAppProvider.providerType, feishuAppProvider],
        ]);
    }
    getProvider(providerType) {
        const normalizedProviderType = String(providerType || '').trim();
        const provider = this.providerMap.get(normalizedProviderType);
        if (!provider) {
            throw new common_1.NotFoundException(`channel provider not found: ${normalizedProviderType}`);
        }
        return provider;
    }
};
exports.ChannelProviderRegistry = ChannelProviderRegistry;
exports.ChannelProviderRegistry = ChannelProviderRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_webhook_provider_1.FeishuWebhookProvider,
        feishu_app_provider_1.FeishuAppProvider])
], ChannelProviderRegistry);
//# sourceMappingURL=channel-provider.registry.js.map