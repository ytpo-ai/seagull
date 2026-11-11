"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const undici_1 = require("undici");
const contracts_1 = require("../../../contracts/src/index");
const infra_1 = require("../../../infra/src/index");
const base_provider_1 = require("./base-provider");
class AnthropicProvider extends base_provider_1.BaseAIProvider {
    constructor(model, apiKey) {
        super(model, apiKey);
        this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    }
    async chatWithMeta(messages, options) {
        const payload = this.buildMessagePayload(messages, options, false);
        const response = await this.requestAnthropic(payload);
        const data = (await response.json());
        const text = (data.content || [])
            .filter((block) => block.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text)
            .join('');
        const inputTokens = Number(data.usage?.input_tokens || 0);
        const outputTokens = Number(data.usage?.output_tokens || 0);
        const cacheRead = Number(data.usage?.cache_read_input_tokens || 0) || undefined;
        const cacheWrite = Number(data.usage?.cache_creation_input_tokens || 0) || undefined;
        const totalTokens = inputTokens + outputTokens;
        return {
            response: text,
            usage: data.usage
                ? {
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    cachedInputTokens: cacheRead,
                    cacheWriteTokens: cacheWrite,
                }
                : undefined,
            finishReason: typeof data.stop_reason === 'string' ? data.stop_reason : undefined,
        };
    }
    async chat(messages, options) {
        const result = await this.chatWithMeta(messages, options);
        return result.response;
    }
    async streamingChat(messages, onToken, options) {
        const payload = this.buildMessagePayload(messages, options, true);
        const response = await this.requestAnthropic(payload);
        if (!response.body) {
            throw new Error('Anthropic streaming response body is empty');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of response.body) {
            buffer += decoder.decode(chunk, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const event of events) {
                const lines = event.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data:'))
                        continue;
                    const raw = line.slice(5).trim();
                    if (!raw || raw === '[DONE]')
                        continue;
                    try {
                        const parsed = JSON.parse(raw);
                        const token = parsed?.delta?.text || parsed?.text || '';
                        if (token) {
                            onToken(token);
                        }
                    }
                    catch {
                    }
                }
            }
        }
    }
    buildMessagePayload(messages, options, stream) {
        const { systemMessages, chatMessages } = this.separateMessages(messages);
        return {
            model: this.model.model,
            max_tokens: options?.maxTokens || this.model.maxTokens || 1024,
            temperature: options?.temperature ?? this.model.temperature ?? 0.7,
            system: systemMessages.length > 0 ? systemMessages.join('\n') : undefined,
            messages: chatMessages,
            stream,
        };
    }
    async requestAnthropic(payload) {
        if (!this.apiKey) {
            throw new Error('Missing ANTHROPIC_API_KEY');
        }
        const dispatcher = (0, infra_1.getProxyDispatcher)();
        const response = await (0, undici_1.fetch)('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(payload),
            ...(dispatcher ? { dispatcher } : {}),
        });
        if (!response.ok) {
            const detail = await response.text();
            let modelErrorMessage = null;
            try {
                const parsed = JSON.parse(detail);
                const type = parsed?.error?.type;
                const message = parsed?.error?.message || detail;
                if (response.status === 404 && type === 'not_found_error' && String(message).includes('model')) {
                    modelErrorMessage = `Anthropic 模型不可用: ${message}`;
                }
            }
            catch {
            }
            if (modelErrorMessage) {
                throw new Error(modelErrorMessage);
            }
            throw new Error(`Anthropic API ${response.status}: ${detail}`);
        }
        return response;
    }
    separateMessages(messages) {
        const systemMessages = [];
        const chatMessages = [];
        for (const message of messages) {
            const textContent = (0, contracts_1.extractTextContent)(message.content);
            if (message.role === 'system') {
                systemMessages.push(textContent);
                continue;
            }
            if (message.role === 'assistant') {
                chatMessages.push({ role: 'assistant', content: textContent });
            }
            else {
                chatMessages.push({ role: 'user', content: textContent });
            }
        }
        if (chatMessages.length === 0) {
            chatMessages.push({ role: 'user', content: 'Hello' });
        }
        return { systemMessages, chatMessages };
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic-provider.js.map