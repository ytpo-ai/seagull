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
var InternalApiClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalApiClient = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../../../../../libs/auth/src/index");
const unwrap_response_envelope_1 = require("../../../../../src/shared/common/utils/unwrap-response-envelope");
let InternalApiClient = InternalApiClient_1 = class InternalApiClient {
    constructor() {
        this.logger = new common_1.Logger(InternalApiClient_1.name);
        this.orchestrationBaseUrl = process.env.LEGACY_SERVICE_URL || 'http://localhost:3001/api';
        this.backendBaseUrl = process.env.LEGACY_SERVICE_URL || 'http://localhost:3001/api';
        this.agentsBaseUrl = process.env.AGENTS_SERVICE_URL || 'http://localhost:3002/api';
        this.engineeringIntelligenceBaseUrl = this.resolveEiBaseUrl();
        this.contextSecret = String(process.env.INTERNAL_CONTEXT_SECRET || '').trim();
        if (!this.contextSecret) {
            throw new Error('INTERNAL_CONTEXT_SECRET is required');
        }
    }
    buildSignedHeaders(context) {
        const now = Date.now();
        const actorId = String(context?.actorId || 'agents-service').trim() || 'agents-service';
        const actorRole = String(context?.actorRole || 'system').trim() || 'system';
        const originSessionId = String(context?.originSessionId || '').trim();
        const userContext = {
            employeeId: actorId,
            role: actorRole,
            issuedAt: now,
            expiresAt: now + 60 * 1000,
        };
        const encoded = (0, auth_1.encodeUserContext)(userContext);
        const signature = (0, auth_1.signEncodedContext)(encoded, this.contextSecret);
        return {
            'x-user-context': encoded,
            'x-user-signature': signature,
            'x-actor-id': actorId,
            'x-actor-role': actorRole,
            ...(originSessionId ? { 'x-origin-session-id': originSessionId } : {}),
            'content-type': 'application/json',
        };
    }
    async callOrchestrationApi(method, endpoint, body) {
        return this.callApi({
            system: 'Orchestration',
            errorCode: 'orchestration_api_request_failed',
            method,
            endpoint,
            url: `${this.orchestrationBaseUrl}/orchestration${endpoint}`,
            body,
        });
    }
    async callEiApi(method, endpoint, body) {
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return this.callApiWithRetry({
            system: 'EI',
            errorCode: 'ei_api_request_failed',
            method,
            endpoint: normalizedEndpoint,
            url: `${this.engineeringIntelligenceBaseUrl}/ei${normalizedEndpoint}`,
            body,
        });
    }
    async callMeetingApi(method, endpoint, body) {
        return this.callApi({
            system: 'Meeting',
            errorCode: 'meeting_api_request_failed',
            method,
            endpoint,
            url: `${this.backendBaseUrl}/meetings${endpoint}`,
            body,
        });
    }
    async callDiscussionApi(method, endpoint, body) {
        return this.callApi({
            system: 'Discussion',
            errorCode: 'discussion_api_request_failed',
            method,
            endpoint,
            url: `${this.backendBaseUrl}/discussions${endpoint}`,
            body,
        });
    }
    async callInnerMessageApi(method, endpoint, body) {
        return this.callApi({
            system: 'InnerMessage',
            errorCode: 'inner_message_api_request_failed',
            method,
            endpoint,
            url: `${this.agentsBaseUrl}/inner-messages${endpoint}`,
            body,
        });
    }
    async callAgentsApi(method, endpoint, body) {
        return this.callApi({
            system: 'Agents',
            errorCode: 'agents_api_request_failed',
            method,
            endpoint,
            url: `${this.agentsBaseUrl}${endpoint}`,
            body,
        });
    }
    async postEngineeringStatistics(payload) {
        const response = await axios_1.default.post(`${this.engineeringIntelligenceBaseUrl}/ei/statistics/snapshots`, payload, {
            headers: this.buildSignedHeaders(),
            timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
        });
        return (0, unwrap_response_envelope_1.unwrapResponseEnvelope)(response.data);
    }
    async postDocsHeatRefresh(payload) {
        const response = await axios_1.default.post(`${this.engineeringIntelligenceBaseUrl}/ei/docs-heat/refresh`, payload, {
            headers: this.buildSignedHeaders(),
            timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
        });
        return (0, unwrap_response_envelope_1.unwrapResponseEnvelope)(response.data);
    }
    async callApi(args) {
        try {
            const response = await axios_1.default.request({
                method: args.method,
                url: args.url,
                headers: this.buildSignedHeaders(),
                data: args.body,
                timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
            });
            return (0, unwrap_response_envelope_1.unwrapResponseEnvelope)(response.data);
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const statusText = error.response?.statusText;
                const responseSummary = this.summarizeApiErrorBody(error.response?.data);
                this.logger.error(`${args.system} API request failed: ${args.method} ${args.endpoint}, status=${status || 'unknown'}${statusText ? ` ${statusText}` : ''}, response=${responseSummary}`);
                throw new Error(`${args.errorCode}: ${args.method} ${args.endpoint} returned ${status || 'unknown'}; response=${responseSummary}`);
            }
            throw error;
        }
    }
    async callApiWithRetry(args) {
        const maxRetry = Math.max(0, Math.floor(Number(process.env.AGENTS_INTERNAL_API_RETRY_MAX || 1)));
        const retryDelayMs = Math.max(100, Math.floor(Number(process.env.AGENTS_INTERNAL_API_RETRY_DELAY_MS || 300)));
        for (let attempt = 0;; attempt += 1) {
            try {
                return await this.callApi(args);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const shouldRetry = attempt < maxRetry &&
                    (message.includes(' returned 502;') ||
                        message.includes(' returned 503;') ||
                        message.includes(' returned 504;') ||
                        message.includes(' returned unknown;'));
                if (!shouldRetry) {
                    throw error;
                }
                this.logger.warn(`${args.system} API transient failure, retrying ${args.method} ${args.endpoint} (attempt ${attempt + 2}/${maxRetry + 1})`);
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
            }
        }
    }
    resolveEiBaseUrl() {
        const raw = String(process.env.ENGINEERING_INTELLIGENCE_SERVICE_URL || 'http://localhost:3004').trim();
        const normalized = raw.replace(/\/+$/, '');
        return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    }
    summarizeApiErrorBody(body) {
        if (body === undefined || body === null) {
            return 'empty';
        }
        const maxLen = 800;
        let text;
        if (typeof body === 'string') {
            text = body;
        }
        else {
            try {
                text = JSON.stringify(body);
            }
            catch {
                text = String(body);
            }
        }
        return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
    }
};
exports.InternalApiClient = InternalApiClient;
exports.InternalApiClient = InternalApiClient = InternalApiClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], InternalApiClient);
//# sourceMappingURL=internal-api-client.service.js.map