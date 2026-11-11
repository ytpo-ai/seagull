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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var FeishuWebhookProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuWebhookProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const feishu_card_builder_1 = require("./feishu-card-builder");
let FeishuWebhookProvider = FeishuWebhookProvider_1 = class FeishuWebhookProvider {
    constructor(cardBuilder) {
        this.cardBuilder = cardBuilder;
        this.providerType = 'feishu';
        this.logger = new common_1.Logger(FeishuWebhookProvider_1.name);
        this.timeoutMs = 5000;
        this.retryTimes = 2;
        this.retryBaseDelayMs = 500;
    }
    async send(target, message) {
        const config = this.resolveConfig(target.providerConfig);
        if (!config) {
            return {
                success: false,
                providerType: this.providerType,
                errorMessage: 'invalid provider config',
                deliveredAt: new Date(),
            };
        }
        const payload = this.buildPayload(message, config.webhookSecret);
        const maxAttempts = this.retryTimes + 1;
        let lastError = 'unknown error';
        let lastStatusCode;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const response = await axios_1.default.post(config.webhookUrl, payload, {
                    timeout: this.timeoutMs,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                lastStatusCode = response.status;
                const responseData = response.data || {};
                const code = Number(responseData.code || responseData.StatusCode || 0);
                if (code === 0) {
                    return {
                        success: true,
                        providerType: this.providerType,
                        statusCode: response.status,
                        deliveredAt: new Date(),
                    };
                }
                const reason = String(responseData.msg || responseData.StatusMessage || `business_error_${code}`);
                lastError = `business:${reason}`;
                if (!this.shouldRetry(undefined, response.status, reason, attempt, maxAttempts)) {
                    break;
                }
                await this.sleep(this.retryBaseDelayMs * attempt);
            }
            catch (error) {
                const reason = this.classifyError(error);
                lastError = reason;
                const statusCode = error?.response?.status;
                if (typeof statusCode === 'number') {
                    lastStatusCode = statusCode;
                }
                if (!this.shouldRetry(error, statusCode, reason, attempt, maxAttempts)) {
                    break;
                }
                await this.sleep(this.retryBaseDelayMs * attempt);
            }
        }
        this.logger.warn(`Feishu delivery failed: configId=${target.configId} statusCode=${String(lastStatusCode || 'n/a')} reason=${lastError}`);
        return {
            success: false,
            providerType: this.providerType,
            statusCode: lastStatusCode,
            errorMessage: lastError,
            deliveredAt: new Date(),
        };
    }
    async validateConfig(config) {
        const resolved = this.resolveConfig(config);
        if (!resolved?.webhookUrl) {
            return false;
        }
        try {
            const parsed = new URL(resolved.webhookUrl);
            if (parsed.protocol !== 'https:') {
                return false;
            }
            const allowedHosts = new Set(['open.feishu.cn', 'open.larksuite.com']);
            if (!allowedHosts.has(parsed.hostname)) {
                return false;
            }
            return parsed.pathname.includes('/open-apis/bot/v2/hook/');
        }
        catch {
            return false;
        }
    }
    resolveConfig(input) {
        const webhookUrl = String(input.webhookUrl || '').trim();
        const webhookSecret = String(input.webhookSecret || '').trim() || undefined;
        if (!webhookUrl) {
            return null;
        }
        return {
            webhookUrl,
            webhookSecret,
        };
    }
    buildPayload(message, webhookSecret) {
        let payload;
        if (message.contentType === 'card') {
            payload = {
                msg_type: 'interactive',
                card: this.cardBuilder.buildCard(message),
            };
        }
        else {
            payload = {
                msg_type: 'text',
                content: {
                    text: `${message.title}\n${message.content}`,
                },
            };
        }
        if (webhookSecret) {
            const timestamp = `${Math.floor(Date.now() / 1000)}`;
            const sign = this.buildSign(timestamp, webhookSecret);
            payload.timestamp = timestamp;
            payload.sign = sign;
        }
        return payload;
    }
    buildSign(timestamp, secret) {
        const stringToSign = `${timestamp}\n${secret}`;
        return (0, crypto_1.createHmac)('sha256', stringToSign).update('').digest('base64');
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    classifyError(error) {
        const statusCode = error?.response?.status;
        if (statusCode === 429) {
            return 'rate_limit';
        }
        if (statusCode && statusCode >= 400 && statusCode < 500) {
            return `business:http_${statusCode}`;
        }
        if (statusCode && statusCode >= 500) {
            return `network:http_${statusCode}`;
        }
        const code = String(error?.code || '').toUpperCase();
        if (code.includes('ECONN') || code.includes('ETIMEDOUT') || code.includes('ENOTFOUND')) {
            return `network:${code.toLowerCase()}`;
        }
        const message = error instanceof Error ? error.message : String(error || 'unknown_error');
        return `network:${message}`;
    }
    shouldRetry(_error, statusCode, reason, attempt, maxAttempts) {
        if (attempt >= maxAttempts) {
            return false;
        }
        if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
            return true;
        }
        if (reason.startsWith('network:')) {
            return true;
        }
        return false;
    }
};
exports.FeishuWebhookProvider = FeishuWebhookProvider;
exports.FeishuWebhookProvider = FeishuWebhookProvider = FeishuWebhookProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feishu_card_builder_1.FeishuCardBuilder])
], FeishuWebhookProvider);
//# sourceMappingURL=feishu-webhook.provider.js.map