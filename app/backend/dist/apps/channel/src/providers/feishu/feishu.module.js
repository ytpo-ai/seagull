"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuModule = void 0;
const common_1 = require("@nestjs/common");
const feishu_card_builder_1 = require("./feishu-card-builder");
const feishu_app_provider_1 = require("./feishu-app.provider");
const feishu_webhook_provider_1 = require("./feishu-webhook.provider");
let FeishuModule = class FeishuModule {
};
exports.FeishuModule = FeishuModule;
exports.FeishuModule = FeishuModule = __decorate([
    (0, common_1.Module)({
        providers: [feishu_card_builder_1.FeishuCardBuilder, feishu_webhook_provider_1.FeishuWebhookProvider, feishu_app_provider_1.FeishuAppProvider],
        exports: [feishu_webhook_provider_1.FeishuWebhookProvider, feishu_app_provider_1.FeishuAppProvider],
    })
], FeishuModule);
//# sourceMappingURL=feishu.module.js.map