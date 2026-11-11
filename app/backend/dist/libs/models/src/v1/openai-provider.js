"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const undici_1 = require("undici");
const infra_1 = require("../../../infra/src/index");
const base_provider_1 = require("./base-provider");
class OpenAIProvider extends base_provider_1.BaseAIProvider {
    shouldUseMaxCompletionTokens(modelName) {
        const normalized = String(modelName || '').trim().toLowerCase();
        return normalized.startsWith('gpt-5');
    }
    buildTokenLimitParams(options) {
        const tokenLimit = Number(options?.maxTokens || this.model.maxTokens);
        if (!Number.isFinite(tokenLimit) || tokenLimit <= 0) {
            return {};
        }
        if (this.shouldUseMaxCompletionTokens(this.model.model)) {
            return { max_completion_tokens: tokenLimit };
        }
        return { max_tokens: tokenLimit };
    }
    parseEnvInt(name, fallback, min, max) {
        const raw = process.env[name];
        const parsed = Number(raw);
        if (!Number.isFinite(parsed))
            return fallback;
        return Math.max(min, Math.min(Math.floor(parsed), max));
    }
    constructor(model, apiKey) {
        super(model, apiKey);
        const dispatcher = (0, infra_1.getProxyDispatcher)();
        const timeoutMs = this.parseEnvInt('OPENAI_TIMEOUT_MS', 60000, 5000, 180000);
        const maxRetries = this.parseEnvInt('OPENAI_MAX_RETRIES', 1, 0, 3);
        const clientOptions = {
            apiKey: apiKey || process.env.OPENAI_API_KEY,
            timeout: timeoutMs,
            maxRetries,
        };
        if (dispatcher) {
            clientOptions.fetch = (url, init) => (0, undici_1.fetch)(url, {
                ...init,
                dispatcher,
            });
        }
        this.client = new openai_1.default(clientOptions);
    }
    normalizeFinishReason(reason) {
        if (typeof reason !== 'string' || !reason.trim()) {
            return undefined;
        }
        const normalized = reason.trim().toLowerCase();
        if (normalized === 'tool_calls') {
            return 'tool_calls';
        }
        if (normalized === 'stop' || normalized === 'length' || normalized === 'content_filter') {
            return normalized;
        }
        return normalized;
    }
    async chatWithMeta(messages, options) {
        const response = await this.client.chat.completions.create({
            model: this.model.model,
            messages: this.formatMessages(messages),
            ...this.buildTokenLimitParams(options),
            temperature: options?.temperature || this.model.temperature || 0.7,
            top_p: options?.topP || this.model.topP || 1,
            ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
        });
        const usage = response.usage;
        const inputTokens = Number(usage?.prompt_tokens || 0);
        const outputTokens = Number(usage?.completion_tokens || 0);
        const totalTokens = Number(usage?.total_tokens || inputTokens + outputTokens);
        const reasoningTokens = Number(usage?.completion_tokens_details?.reasoning_tokens || 0) || undefined;
        const cachedInputTokens = Number(usage?.prompt_tokens_details?.cached_tokens || 0) || undefined;
        return {
            response: response.choices[0]?.message?.content || '',
            usage: usage
                ? {
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    reasoningTokens,
                    cachedInputTokens,
                }
                : undefined,
            finishReason: this.normalizeFinishReason(response.choices?.[0]?.finish_reason),
        };
    }
    async chat(messages, options) {
        const result = await this.chatWithMeta(messages, options);
        return result.response;
    }
    async streamingChat(messages, onToken, options) {
        const stream = await this.client.chat.completions.create({
            model: this.model.model,
            messages: this.formatMessages(messages),
            ...this.buildTokenLimitParams(options),
            temperature: options?.temperature || this.model.temperature || 0.7,
            top_p: options?.topP || this.model.topP || 1,
            ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
            stream: true,
        });
        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            if (token) {
                onToken(token);
            }
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai-provider.js.map