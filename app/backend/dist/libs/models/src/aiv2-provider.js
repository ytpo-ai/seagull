"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIV2Provider = void 0;
const ai_1 = require("ai");
const anthropic_1 = require("@ai-sdk/anthropic");
const google_1 = require("@ai-sdk/google");
const openai_1 = require("@ai-sdk/openai");
const undici_1 = require("undici");
const contracts_1 = require("../../contracts/src/index");
const infra_1 = require("../../infra/src/index");
const base_provider_1 = require("./v1/base-provider");
const DEFAULT_MOONSHOT_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_ALIBABA_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const IMAGE_FETCH_MAX_BYTES = 20 * 1024 * 1024;
class AIV2Provider extends base_provider_1.BaseAIProvider {
    constructor(model, apiKey) {
        super(model, apiKey);
        const provider = String(model.provider || '').toLowerCase().trim();
        this.providerName = provider;
        const dispatcher = (0, infra_1.getProxyDispatcher)();
        const fetcher = dispatcher
            ? ((url, init) => (0, undici_1.fetch)(url, {
                ...init,
                dispatcher,
            }))
            : undefined;
        switch (provider) {
            case 'openai': {
                const resolvedBaseURL = String(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || process.env.AI_API_ENDPOINT || '').trim() || undefined;
                const openai = (0, openai_1.createOpenAI)({
                    apiKey: apiKey || process.env.OPENAI_API_KEY,
                    ...(resolvedBaseURL ? { baseURL: resolvedBaseURL } : {}),
                    ...(fetcher ? { fetch: fetcher } : {}),
                });
                this.openAICompatibleClient = openai;
                this.languageModel = resolvedBaseURL ? openai.chat(this.model.model) : openai(this.model.model);
                break;
            }
            case 'anthropic': {
                const anthropic = (0, anthropic_1.createAnthropic)({
                    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
                    ...(fetcher ? { fetch: fetcher } : {}),
                });
                this.languageModel = anthropic(this.model.model);
                break;
            }
            case 'google': {
                const google = (0, google_1.createGoogleGenerativeAI)({
                    apiKey: apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                    ...(fetcher ? { fetch: fetcher } : {}),
                });
                this.languageModel = google(this.model.model);
                break;
            }
            case 'moonshotai':
            case 'moonshot':
            case 'kimi': {
                const moonshot = (0, openai_1.createOpenAI)({
                    apiKey: apiKey || process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY,
                    baseURL: process.env.MOONSHOT_BASE_URL || DEFAULT_MOONSHOT_BASE_URL,
                    ...(fetcher ? { fetch: fetcher } : {}),
                });
                this.openAICompatibleClient = moonshot;
                this.languageModel = moonshot.chat(this.model.model);
                break;
            }
            case 'alibaba':
            case 'qwen': {
                const baseURL = process.env.ALIBABA_BASE_URL || process.env.DASHSCOPE_BASE_URL || DEFAULT_ALIBABA_BASE_URL;
                const alibaba = (0, openai_1.createOpenAI)({
                    apiKey: apiKey || process.env.ALIBABA_API_KEY || process.env.DASHSCOPE_API_KEY,
                    baseURL,
                    compatibility: 'compatible',
                    ...(fetcher ? { fetch: fetcher } : {}),
                });
                this.openAICompatibleClient = alibaba;
                this.alibabaBaseURL = baseURL;
                this.languageModel = alibaba.chat(this.model.model);
                break;
            }
            case 'deepseek': {
                const deepseekApiKey = apiKey || process.env.DEEPSEEK_API_KEY;
                if (!deepseekApiKey) {
                    throw new Error('DeepSeek API key is missing. Pass it using the apiKey parameter or the DEEPSEEK_API_KEY environment variable.');
                }
                const deepseek = (0, openai_1.createOpenAI)({
                    apiKey: deepseekApiKey,
                    baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
                    compatibility: 'compatible',
                    ...(fetcher ? { fetch: fetcher } : {}),
                });
                this.openAICompatibleClient = deepseek;
                this.languageModel = deepseek.chat(this.model.model);
                break;
            }
            default:
                throw new Error(`AIV2Provider does not support provider: ${model.provider}`);
        }
    }
    static inferMimeType(url) {
        const pathname = (() => {
            try {
                return new URL(url).pathname.toLowerCase();
            }
            catch {
                return String(url || '').toLowerCase();
            }
        })();
        if (pathname.endsWith('.png'))
            return 'image/png';
        if (pathname.endsWith('.webp'))
            return 'image/webp';
        if (pathname.endsWith('.gif'))
            return 'image/gif';
        if (pathname.endsWith('.bmp'))
            return 'image/bmp';
        if (pathname.endsWith('.svg'))
            return 'image/svg+xml';
        if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg'))
            return 'image/jpeg';
        return 'image/jpeg';
    }
    static isRemoteUrl(url) {
        const lower = String(url || '').trim().toLowerCase();
        return lower.startsWith('http://') || lower.startsWith('https://');
    }
    async fetchImageAsBase64(url) {
        const dispatcher = (0, infra_1.getProxyDispatcher)();
        const response = await (0, undici_1.fetch)(url, {
            ...(dispatcher ? { dispatcher } : {}),
        });
        if (!response.ok) {
            throw new Error(`failed to fetch image url=${url} status=${response.status}`);
        }
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > IMAGE_FETCH_MAX_BYTES) {
            throw new Error(`image too large: url=${url} size=${contentLength} limit=${IMAGE_FETCH_MAX_BYTES}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > IMAGE_FETCH_MAX_BYTES) {
            throw new Error(`image too large: url=${url} size=${arrayBuffer.byteLength} limit=${IMAGE_FETCH_MAX_BYTES}`);
        }
        const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim();
        const mimeType = contentType || AIV2Provider.inferMimeType(url);
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return { base64, mimeType };
    }
    async inlineRemoteImages(messages) {
        const result = [];
        for (const msg of messages) {
            if (typeof msg.content === 'string') {
                result.push(msg);
                continue;
            }
            const partPromises = msg.content.map(async (part) => {
                if (part.type !== 'image_url')
                    return part;
                const url = String(part.imageUrl?.url || '').trim();
                if (!url || !AIV2Provider.isRemoteUrl(url))
                    return part;
                const { base64, mimeType } = await this.fetchImageAsBase64(url);
                return {
                    type: 'image_url',
                    imageUrl: {
                        url: `data:${mimeType};base64,${base64}`,
                        ...(part.imageUrl.detail ? { detail: part.imageUrl.detail } : {}),
                    },
                };
            });
            const convertedParts = await Promise.all(partPromises);
            result.push({ ...msg, content: convertedParts });
        }
        return result;
    }
    hasRemoteImageUrls(messages) {
        return messages.some((msg) => {
            if (typeof msg.content === 'string')
                return false;
            return msg.content.some((part) => part.type === 'image_url' && AIV2Provider.isRemoteUrl(part.imageUrl.url));
        });
    }
    formatMessages(messages) {
        return messages.map((msg) => {
            if (typeof msg.content === 'string') {
                return { role: msg.role, content: msg.content };
            }
            const parts = msg.content.map((part) => {
                if (part.type === 'text') {
                    return { type: 'text', text: part.text };
                }
                if (part.type === 'image_url') {
                    const url = String(part.imageUrl?.url || '').trim();
                    const dataUrlMatch = url.match(/^data:([^;]+);base64,(.+)$/);
                    if (dataUrlMatch) {
                        return {
                            type: 'image',
                            image: Buffer.from(dataUrlMatch[2], 'base64'),
                            mimeType: dataUrlMatch[1],
                        };
                    }
                    return { type: 'image', image: new URL(url) };
                }
                return { type: 'text', text: (0, contracts_1.extractTextContent)([part]) };
            });
            return { role: msg.role, content: parts };
        });
    }
    isOpenAIReasoningModel() {
        const provider = String(this.model.provider || '').toLowerCase().trim();
        if (provider !== 'openai') {
            return false;
        }
        const modelName = String(this.model.model || '').toLowerCase().trim();
        if (this.model.reasoning?.enabled) {
            return true;
        }
        return modelName.startsWith('gpt-5') || modelName.startsWith('o1') || modelName.startsWith('o3') || modelName.startsWith('o4');
    }
    getReasoningProviderOptions() {
        if (!this.isOpenAIReasoningModel()) {
            return undefined;
        }
        const effort = this.model.reasoning?.effort;
        const verbosity = this.model.reasoning?.verbosity;
        return {
            openai: {
                ...(effort ? { reasoningEffort: effort } : {}),
                ...(verbosity ? { textVerbosity: verbosity } : {}),
            },
        };
    }
    buildCallOptions(options) {
        const tokenLimit = Number(options?.maxTokens || this.model.maxTokens);
        const maxOutputTokens = Number.isFinite(tokenLimit) && tokenLimit > 0 ? tokenLimit : undefined;
        const isReasoning = this.isOpenAIReasoningModel();
        const providerOptions = this.getReasoningProviderOptions();
        const mergedProviderOptions = providerOptions ? { ...providerOptions } : undefined;
        let responseFormat;
        if (options?.responseFormat?.type === 'json_object') {
            if (this.providerName === 'openai'
                || this.providerName === 'moonshotai'
                || this.providerName === 'moonshot'
                || this.providerName === 'kimi'
                || this.providerName === 'alibaba'
                || this.providerName === 'qwen'
                || this.providerName === 'deepseek') {
                responseFormat = { type: 'json_object' };
            }
            if (this.providerName === 'google') {
                const googleOptions = ((mergedProviderOptions || {}).google || {});
                const nextProviderOptions = {
                    ...(mergedProviderOptions || {}),
                    google: {
                        ...googleOptions,
                        responseMimeType: 'application/json',
                    },
                };
                return {
                    ...(maxOutputTokens ? { maxOutputTokens } : {}),
                    ...(!isReasoning
                        ? {
                            temperature: options?.temperature ?? this.model.temperature ?? 0.7,
                            topP: options?.topP ?? this.model.topP ?? 1,
                        }
                        : {}),
                    providerOptions: nextProviderOptions,
                };
            }
        }
        return {
            ...(maxOutputTokens ? { maxOutputTokens } : {}),
            ...(!isReasoning
                ? {
                    temperature: options?.temperature ?? this.model.temperature ?? 0.7,
                    topP: options?.topP ?? this.model.topP ?? 1,
                }
                : {}),
            ...(responseFormat ? { responseFormat } : {}),
            ...(mergedProviderOptions ? { providerOptions: mergedProviderOptions } : {}),
        };
    }
    isNotFoundError(error) {
        const message = error instanceof Error ? error.message : String(error || '');
        const lower = message.toLowerCase();
        return lower.includes('not found') || lower.includes('404');
    }
    isAuthenticationError(error) {
        const message = error instanceof Error ? error.message : String(error || '');
        const lower = message.toLowerCase();
        return lower.includes('invalid authentication') || lower.includes('unauthorized') || lower.includes('401');
    }
    getAlibabaFallbackModelName() {
        if (this.providerName !== 'alibaba' && this.providerName !== 'qwen') {
            return undefined;
        }
        const modelName = String(this.model.model || '').toLowerCase().trim();
        const fallbackMap = {
            'qwen-max': 'qwen-max-latest',
            'qwen-plus': 'qwen-plus-latest',
            'qwen-turbo': 'qwen-turbo-latest',
            'qwen-coder': 'qwen-coder-plus',
        };
        return fallbackMap[modelName];
    }
    normalizeUsage(usage) {
        if (!usage || typeof usage !== 'object') {
            return undefined;
        }
        const promptTokens = Number(usage.promptTokens ?? usage.inputTokens ?? 0);
        const completionTokens = Number(usage.completionTokens ?? usage.outputTokens ?? 0);
        const totalTokens = Number(usage.totalTokens ?? promptTokens + completionTokens);
        const reasoningTokens = Number(usage.reasoningTokens ?? usage.reasoning_tokens ?? 0) || undefined;
        const cachedInputTokens = Number(usage.cachedInputTokens ?? usage.cached_tokens ?? 0) || undefined;
        const cacheWriteTokens = Number(usage.cacheWriteTokens ?? usage.cache_write_tokens ?? 0) || undefined;
        return {
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            totalTokens,
            reasoningTokens,
            cachedInputTokens,
            cacheWriteTokens,
        };
    }
    async chatWithMeta(messages, options) {
        const prepared = this.hasRemoteImageUrls(messages)
            ? await this.inlineRemoteImages(messages)
            : messages;
        try {
            const result = await (0, ai_1.generateText)({
                model: this.languageModel,
                messages: this.formatMessages(prepared),
                ...this.buildCallOptions(options),
            });
            return {
                response: result.text || '',
                usage: this.normalizeUsage(result.usage),
                finishReason: result.finishReason,
            };
        }
        catch (error) {
            if (this.isAuthenticationError(error)) {
                const message = error instanceof Error ? error.message : String(error || 'Invalid Authentication');
                throw new Error(`${message} (provider=${this.providerName}; model=${this.model.model}). `
                    + '请确认：1) Agent 绑定的 apiKeyId 对应 provider 正确；2) 系统环境变量 key 有效；3) 如走代理网关请设置 OPENAI_BASE_URL/OPENAI_API_BASE。');
            }
            const fallbackModel = this.getAlibabaFallbackModelName();
            if (fallbackModel && this.isNotFoundError(error) && this.openAICompatibleClient) {
                const result = await (0, ai_1.generateText)({
                    model: this.openAICompatibleClient.chat(fallbackModel),
                    messages: this.formatMessages(prepared),
                    ...this.buildCallOptions(options),
                });
                return {
                    response: result.text || '',
                    usage: this.normalizeUsage(result.usage),
                    finishReason: result.finishReason,
                };
            }
            if ((this.providerName === 'alibaba' || this.providerName === 'qwen') && this.isNotFoundError(error)) {
                const message = error instanceof Error ? error.message : String(error || 'Not Found');
                const endpoint = this.alibabaBaseURL || DEFAULT_ALIBABA_BASE_URL;
                throw new Error(`${message} (alibaba endpoint=${endpoint}; model=${this.model.model}). ` +
                    '请确认：1) Key 与地域匹配；2) endpoint 使用 /compatible-mode/v1；3) 模型名可用（可尝试 qwen-max-latest）。');
            }
            throw error;
        }
    }
    async chat(messages, options) {
        const result = await this.chatWithMeta(messages, options);
        return result.response;
    }
    async streamingChat(messages, onToken, options) {
        const prepared = this.hasRemoteImageUrls(messages)
            ? await this.inlineRemoteImages(messages)
            : messages;
        const runStream = async (model) => {
            const result = (0, ai_1.streamText)({
                model,
                messages: this.formatMessages(prepared),
                ...this.buildCallOptions(options),
            });
            for await (const token of result.textStream) {
                if (token) {
                    onToken(token);
                }
            }
        };
        try {
            await runStream(this.languageModel);
        }
        catch (error) {
            if (this.isAuthenticationError(error)) {
                const message = error instanceof Error ? error.message : String(error || 'Invalid Authentication');
                throw new Error(`${message} (provider=${this.providerName}; model=${this.model.model}). `
                    + '请确认：1) Agent 绑定的 apiKeyId 对应 provider 正确；2) 系统环境变量 key 有效；3) 如走代理网关请设置 OPENAI_BASE_URL/OPENAI_API_BASE。');
            }
            const fallbackModel = this.getAlibabaFallbackModelName();
            if (fallbackModel && this.isNotFoundError(error) && this.openAICompatibleClient) {
                await runStream(this.openAICompatibleClient.chat(fallbackModel));
                return;
            }
            if ((this.providerName === 'alibaba' || this.providerName === 'qwen') && this.isNotFoundError(error)) {
                const message = error instanceof Error ? error.message : String(error || 'Not Found');
                const endpoint = this.alibabaBaseURL || DEFAULT_ALIBABA_BASE_URL;
                throw new Error(`${message} (alibaba endpoint=${endpoint}; model=${this.model.model}). ` +
                    '请确认：1) Key 与地域匹配；2) endpoint 使用 /compatible-mode/v1；3) 模型名可用（可尝试 qwen-max-latest）。');
            }
            throw error;
        }
    }
}
exports.AIV2Provider = AIV2Provider;
//# sourceMappingURL=aiv2-provider.js.map