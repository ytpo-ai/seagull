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
var OpenCodeAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let OpenCodeAdapter = OpenCodeAdapter_1 = class OpenCodeAdapter {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(OpenCodeAdapter_1.name);
        this.defaultRequestTimeoutMs = this.resolveTimeoutMs('OPENCODE_REQUEST_TIMEOUT_MS', 120000);
        this.messageRequestTimeoutMs = this.resolveTimeoutMs('OPENCODE_MESSAGE_REQUEST_TIMEOUT_MS', 1800000);
    }
    async createSession(input) {
        const config = input.config || {};
        const directory = String(config.directory || config.projectPath || '').trim() || undefined;
        const session = await this.request('POST', '/session', {
            params: directory ? { directory } : undefined,
            data: {
                title: input.title || 'OpenCode Runtime Session',
                ...(input.model ? { model: input.model } : {}),
                ...config,
            },
            runtime: input.runtime,
            throwOnError: true,
        });
        return {
            id: String(session?.id || ''),
            title: session?.title,
            createdAt: session?.createdAt,
        };
    }
    async promptSession(input, options) {
        const result = await this.request('POST', `/session/${encodeURIComponent(input.sessionId)}/message`, {
            data: {
                parts: [{ type: 'text', text: input.prompt }],
                ...(input.model ? { model: input.model } : {}),
            },
            runtime: input.runtime,
            throwOnError: true,
            signal: options?.signal,
        });
        const info = (result?.info || {});
        const tokens = this.extractTokenUsage(info);
        const cost = this.extractCost(info);
        return {
            response: this.extractResponseText(result),
            metadata: info,
            tokens,
            cost,
        };
    }
    async abortSession(sessionId, runtime, options) {
        const result = await this.request('POST', `/session/${encodeURIComponent(sessionId)}/abort`, {
            runtime,
            data: {},
            ...(options?.timeoutMs ? { timeout: options.timeoutMs } : {}),
        });
        return {
            response: this.extractResponseText(result),
            metadata: (result?.info || {}),
        };
    }
    async getSessionStatus(sessionId, runtime) {
        try {
            const session = await this.request('GET', `/session/${encodeURIComponent(sessionId)}`, {
                runtime,
                timeout: 5000,
                throwOnError: true,
            });
            const messages = this.extractSessionMessages(session);
            const lastMessage = this.findLastMessage(messages);
            const lastAssistantMessage = this.findLastAssistantMessage(messages);
            const sessionState = String(session?.status || session?.state || '').trim().toLowerCase();
            const activeBySessionFlag = this.resolveSessionActiveFlag(session);
            const activeBySessionState = this.isActiveSessionState(sessionState);
            const activeByLastMessage = this.isActiveMessage(lastMessage);
            const activeByAssistantMessage = this.isActiveMessage(lastAssistantMessage);
            const inactiveBySessionState = this.isTerminalSessionState(sessionState);
            const fallbackActiveBySessionPresence = this.hasSessionPayload(session) && !inactiveBySessionState;
            const lastActivityAt = this.resolveLastActivityAt(lastMessage, session);
            const activeBySignals = activeBySessionState
                || activeByLastMessage
                || activeByAssistantMessage
                || fallbackActiveBySessionPresence;
            const active = activeBySessionFlag !== undefined ? activeBySessionFlag : activeBySignals;
            return {
                active: inactiveBySessionState ? false : active,
                ...(lastActivityAt ? { lastActivityAt } : {}),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[session_status_error] sessionId=${sessionId} error=${message} — treating as inactive`);
            return { active: false };
        }
    }
    hasSessionPayload(session) {
        return Boolean(session && typeof session === 'object' && !Array.isArray(session));
    }
    resolveSessionActiveFlag(session) {
        if (!this.hasSessionPayload(session)) {
            return undefined;
        }
        const payload = session;
        const candidates = [
            payload.active,
            payload.isActive,
            payload.busy,
            payload.inProgress,
            payload.running,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === 'boolean') {
                return candidate;
            }
        }
        return undefined;
    }
    extractResponseText(result) {
        const direct = [result?.info?.content, result?.content, result?.message, result?.output];
        for (const value of direct) {
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }
        const candidates = [result?.parts, result?.info?.parts, result?.payload?.parts];
        for (const parts of candidates) {
            const text = this.extractTextFromParts(parts);
            if (text) {
                return text;
            }
        }
        return '';
    }
    extractTextFromParts(parts) {
        if (!Array.isArray(parts)) {
            return '';
        }
        const chunks = [];
        for (const part of parts) {
            if (!part || typeof part !== 'object' || Array.isArray(part)) {
                continue;
            }
            const row = part;
            if (typeof row.text === 'string' && row.text.trim()) {
                chunks.push(row.text);
                continue;
            }
            if (typeof row.content === 'string' && row.content.trim()) {
                chunks.push(row.content);
            }
        }
        return chunks.join('').trim();
    }
    extractSessionMessages(session) {
        if (!session || typeof session !== 'object' || Array.isArray(session)) {
            return [];
        }
        const data = session;
        const direct = data.messages;
        if (Array.isArray(direct)) {
            return direct.filter((item) => Boolean(item && typeof item === 'object'));
        }
        const nestedInfo = data.info;
        if (nestedInfo && typeof nestedInfo === 'object' && !Array.isArray(nestedInfo)) {
            const nestedMessages = nestedInfo.messages;
            if (Array.isArray(nestedMessages)) {
                return nestedMessages.filter((item) => Boolean(item && typeof item === 'object'));
            }
        }
        return [];
    }
    findLastAssistantMessage(messages) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            const role = String(message.role || '').trim().toLowerCase();
            if (role === 'assistant') {
                return message;
            }
        }
        return undefined;
    }
    findLastMessage(messages) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message && typeof message === 'object') {
                return message;
            }
        }
        return undefined;
    }
    isActiveMessage(message) {
        if (!message) {
            return false;
        }
        const status = String(message.status || message.state || '').trim().toLowerCase();
        if (!status) {
            return true;
        }
        return this.isActiveSessionState(status);
    }
    isActiveSessionState(status) {
        if (!status) {
            return false;
        }
        return status === 'pending' || status === 'running' || status === 'in_progress' || status === 'processing';
    }
    isTerminalSessionState(status) {
        if (!status) {
            return false;
        }
        return status === 'completed'
            || status === 'done'
            || status === 'failed'
            || status === 'error'
            || status === 'aborted'
            || status === 'cancelled'
            || status === 'canceled'
            || status === 'stopped';
    }
    resolveLastActivityAt(message, session) {
        const candidates = [
            message?.updatedAt,
            message?.createdAt,
            message?.timestamp,
            session?.updatedAt,
            session?.createdAt,
        ];
        for (const value of candidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    }
    async *subscribeEvents(sessionId, runtime) {
        for await (const event of this.streamSse(runtime)) {
            const payload = event.payload;
            const eventSessionId = this.resolveSessionId(payload);
            if (sessionId && eventSessionId && eventSessionId !== sessionId) {
                continue;
            }
            yield {
                type: event.type,
                sessionId: eventSessionId,
                timestamp: new Date().toISOString(),
                payload,
                raw: payload,
            };
        }
    }
    getBaseUrl(runtime) {
        return String(runtime?.baseUrl || this.configService.get('OPENCODE_SERVER_URL') || 'http://localhost:4096')
            .trim()
            .replace(/\/+$/, '');
    }
    getPassword() {
        return String(this.configService.get('OPENCODE_SERVER_PASSWORD') || '').trim();
    }
    isAuthEnabled(runtime) {
        return runtime?.authEnable === true;
    }
    async request(method, route, options) {
        const runtime = options?.runtime;
        const baseUrl = this.getBaseUrl(runtime);
        const username = 'opencode';
        const authEnabled = this.isAuthEnabled(runtime);
        const password = authEnabled ? this.getPassword() : '';
        const hasPassword = Boolean(password);
        const timeoutMs = this.resolveRequestTimeoutMs(route, runtime, options?.timeout);
        const requestUrl = this.buildRequestUrl(baseUrl, route, options?.params);
        if (authEnabled && !password) {
            this.logger.error(`[opencode_request_config_invalid] method=${method} url=${requestUrl} username=${username} authEnabled=${authEnabled} hasPassword=${hasPassword} timeoutMs=${timeoutMs} error=OpenCode password is missing`);
            throw new Error('OpenCode password is missing. Please set OPENCODE_SERVER_PASSWORD');
        }
        try {
            const response = await axios_1.default.request({
                method,
                baseURL: baseUrl,
                url: route,
                ...(authEnabled ? { auth: { username, password } } : {}),
                params: options?.params,
                data: options?.data,
                timeout: timeoutMs,
                responseType: options?.responseType,
                signal: options?.signal,
            });
            return response.data;
        }
        catch (error) {
            const message = error?.message || String(error || 'unknown error');
            const status = error?.response?.status;
            const code = error?.code;
            const isTimeout = this.isTimeoutError(error);
            this.logger.error(`[opencode_request_failed] method=${method} url=${requestUrl} username=${username} authEnabled=${authEnabled} hasPassword=${hasPassword} timeoutMs=${timeoutMs} isTimeout=${isTimeout} status=${status || 'unknown'} code=${code || 'none'} error=${message}`);
            if (options?.throwOnError) {
                throw error;
            }
            return undefined;
        }
    }
    buildRequestUrl(baseUrl, route, params) {
        const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
        const url = new URL(normalizedRoute, `${baseUrl}/`);
        if (params && typeof params === 'object') {
            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null)
                    continue;
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (item === undefined || item === null)
                            continue;
                        url.searchParams.append(key, String(item));
                    }
                    continue;
                }
                url.searchParams.set(key, String(value));
            }
        }
        return url.toString();
    }
    isTimeoutError(error) {
        const code = String(error?.code || '').toUpperCase();
        if (code === 'ECONNABORTED') {
            return true;
        }
        const message = String(error?.message || '').toLowerCase();
        return message.includes('timeout');
    }
    resolveRequestTimeoutMs(route, runtime, requestedTimeoutMs) {
        if (requestedTimeoutMs !== undefined && requestedTimeoutMs !== null) {
            return this.normalizeTimeoutMs(requestedTimeoutMs, this.defaultRequestTimeoutMs);
        }
        if (runtime?.requestTimeoutMs !== undefined && runtime?.requestTimeoutMs !== null) {
            return this.normalizeTimeoutMs(runtime.requestTimeoutMs, this.defaultRequestTimeoutMs);
        }
        if (this.isMessageRoute(route)) {
            return this.messageRequestTimeoutMs;
        }
        return this.defaultRequestTimeoutMs;
    }
    isMessageRoute(route) {
        const normalizedRoute = route.toLowerCase();
        return normalizedRoute.includes('/session/') && normalizedRoute.endsWith('/message');
    }
    resolveTimeoutMs(envKey, fallback) {
        const raw = this.configService.get(envKey);
        return this.normalizeTimeoutMs(raw, fallback);
    }
    normalizeTimeoutMs(rawValue, fallback) {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return fallback;
        }
        if (parsed === 0) {
            return 0;
        }
        return Math.max(1000, Math.floor(parsed));
    }
    parseSsePayload(rawData) {
        const value = rawData.trim();
        if (!value) {
            return {};
        }
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
            return { value: parsed };
        }
        catch {
            return { message: value };
        }
    }
    async *streamSse(runtime) {
        const stream = await this.request('GET', '/event', {
            responseType: 'stream',
            timeout: 0,
            runtime,
            throwOnError: true,
        });
        let buffer = '';
        let eventType = 'message';
        let dataLines = [];
        const flush = () => {
            if (dataLines.length === 0) {
                eventType = 'message';
                return null;
            }
            const payload = this.parseSsePayload(dataLines.join('\n'));
            const type = String(payload.type || payload.eventType || payload.kind || eventType || 'message');
            dataLines = [];
            eventType = 'message';
            return { type, payload };
        };
        try {
            for await (const chunk of stream) {
                buffer += chunk.toString('utf8');
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line) {
                        const item = flush();
                        if (item) {
                            yield item;
                        }
                        continue;
                    }
                    if (line.startsWith('event:')) {
                        eventType = line.slice('event:'.length).trim() || 'message';
                        continue;
                    }
                    if (line.startsWith('data:')) {
                        const data = line.slice('data:'.length).trimStart();
                        if (data !== '[DONE]') {
                            dataLines.push(data);
                        }
                    }
                }
            }
        }
        finally {
            if (typeof stream?.destroy === 'function') {
                stream.destroy();
            }
        }
    }
    extractTokenUsage(info) {
        const tokens = info.tokens;
        if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
            return undefined;
        }
        const t = tokens;
        const input = typeof t.input === 'number' && Number.isFinite(t.input) ? t.input : 0;
        const output = typeof t.output === 'number' && Number.isFinite(t.output) ? t.output : 0;
        const reasoning = typeof t.reasoning === 'number' && Number.isFinite(t.reasoning) ? t.reasoning : 0;
        const cache = t.cache && typeof t.cache === 'object' && !Array.isArray(t.cache)
            ? t.cache
            : undefined;
        const cacheRead = typeof cache?.read === 'number' && Number.isFinite(cache.read) ? cache.read : 0;
        const cacheWrite = typeof cache?.write === 'number' && Number.isFinite(cache.write) ? cache.write : 0;
        if (input === 0 && output === 0 && reasoning === 0 && cacheRead === 0 && cacheWrite === 0) {
            return undefined;
        }
        return { input, output, reasoning, cache: { read: cacheRead, write: cacheWrite } };
    }
    extractCost(info) {
        const cost = info.cost;
        if (typeof cost === 'number' && Number.isFinite(cost) && cost > 0) {
            return cost;
        }
        return undefined;
    }
    resolveSessionId(payload) {
        const properties = payload.properties && typeof payload.properties === 'object' && !Array.isArray(payload.properties)
            ? payload.properties
            : undefined;
        const info = properties?.info && typeof properties.info === 'object' && !Array.isArray(properties.info)
            ? properties.info
            : undefined;
        const part = properties?.part && typeof properties.part === 'object' && !Array.isArray(properties.part)
            ? properties.part
            : undefined;
        const directCandidates = [
            payload.sessionId,
            payload.sessionID,
            payload.session_id,
            payload.path?.id,
            payload.meta?.sessionId,
            payload.metadata?.sessionId,
            properties?.sessionId,
            properties?.sessionID,
            properties?.session_id,
            info?.sessionId,
            info?.sessionID,
            info?.session_id,
            part?.sessionId,
            part?.sessionID,
            part?.session_id,
            properties?.status?.sessionId,
            properties?.status?.sessionID,
        ];
        for (const value of directCandidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    }
};
exports.OpenCodeAdapter = OpenCodeAdapter;
exports.OpenCodeAdapter = OpenCodeAdapter = OpenCodeAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenCodeAdapter);
//# sourceMappingURL=opencode.adapter.js.map