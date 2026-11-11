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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var GatewayProxyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayProxyService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../../../libs/auth/src/index");
const crypto_1 = require("crypto");
const mongoose_2 = require("mongoose");
const operation_log_schema_1 = require("../../../src/shared/schemas/operation-log.schema");
const employee_schema_1 = require("../../../src/shared/schemas/employee.schema");
let GatewayProxyService = GatewayProxyService_1 = class GatewayProxyService {
    constructor(operationLogModel, employeeModel) {
        this.operationLogModel = operationLogModel;
        this.employeeModel = employeeModel;
        this.logger = new common_1.Logger(GatewayProxyService_1.name);
        this.agentsBaseUrl = process.env.AGENTS_SERVICE_URL || 'http://localhost:3002';
        this.legacyBaseUrl = process.env.LEGACY_SERVICE_URL || 'http://localhost:3001';
        this.lifeScriptBaseUrl = String(process.env.LIFE_SCRIPT_BASE_URL || 'http://localhost:3101')
            .trim()
            .replace(/\/+$/, '');
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
        this.defaultProxyTimeoutMs = this.parseTimeout(process.env.GATEWAY_PROXY_TIMEOUT_MS, 30000);
        this.debugRunTimeoutMs = this.parseTimeout(process.env.GATEWAY_DEBUG_RUN_TIMEOUT_MS, 180000);
        this.sseProxyTimeoutMs = this.parseTimeout(process.env.GATEWAY_SSE_PROXY_TIMEOUT_MS, 1800000);
        this.sensitiveKeyPattern = /password|passwd|secret|token|authorization|cookie|api[-_]?key/i;
    }
    resolveTarget(originalUrl) {
        if (originalUrl.startsWith('/api/agents') ||
            originalUrl.startsWith('/api/tools') ||
            originalUrl.startsWith('/api/skills') ||
            originalUrl.startsWith('/api/memos') ||
            originalUrl.startsWith('/api/models') ||
            originalUrl.startsWith('/api/model-management') ||
            originalUrl.startsWith('/api/usage') ||
            originalUrl.startsWith('/api/prompt-registry') ||
            originalUrl.startsWith('/api/agent-action-logs') ||
            originalUrl.startsWith('/api/inner-messages') ||
            originalUrl.startsWith('/api/inner-message-subscriptions') ||
            originalUrl.startsWith('/api/message-center/inner-messages')) {
            return this.agentsBaseUrl;
        }
        if (originalUrl.startsWith('/api/life-script')) {
            return this.lifeScriptBaseUrl;
        }
        if (originalUrl.startsWith('/api/auth/issue-redirect-token')) {
            return this.lifeScriptBaseUrl;
        }
        return this.legacyBaseUrl;
    }
    getSourceService(originalUrl) {
        const target = this.resolveTarget(originalUrl);
        if (target === this.agentsBaseUrl) {
            return 'agents';
        }
        if (target === this.lifeScriptBaseUrl) {
            return 'life-script';
        }
        return 'legacy';
    }
    sanitizeForLog(input, depth = 0) {
        if (input === null || input === undefined)
            return input;
        if (depth > 4)
            return '[Truncated]';
        if (Array.isArray(input)) {
            return input.slice(0, 20).map((item) => this.sanitizeForLog(item, depth + 1));
        }
        if (typeof input === 'object') {
            const result = {};
            Object.entries(input).forEach(([key, value]) => {
                if (this.sensitiveKeyPattern.test(key)) {
                    result[key] = '[REDACTED]';
                    return;
                }
                result[key] = this.sanitizeForLog(value, depth + 1);
            });
            return result;
        }
        if (typeof input === 'string') {
            if (input.length > 500) {
                return `${input.slice(0, 500)}...[truncated]`;
            }
            return input;
        }
        return input;
    }
    extractIp(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded.length) {
            return forwarded.split(',')[0].trim();
        }
        return req.ip || req.socket?.remoteAddress;
    }
    async findHumanSnapshot(employeeId) {
        const human = await this.employeeModel
            .findOne({ id: employeeId, type: employee_schema_1.EmployeeType.HUMAN })
            .select({ id: 1, exclusiveAssistantAgentId: 1 })
            .lean()
            .exec();
        if (!human?.id) {
            return null;
        }
        return {
            humanEmployeeId: human.id,
            assistantAgentId: human.exclusiveAssistantAgentId,
        };
    }
    async recordOperationLog(params) {
        const { req, userContext, statusCode, durationMs, requestId, sourceService, errorMessage } = params;
        if (!userContext?.employeeId)
            return;
        const method = String(req.method || '').toUpperCase();
        if (method === 'GET') {
            return;
        }
        const path = (req.originalUrl || req.url || '').split('?')[0] || '/';
        if (path === '/api/operation-logs') {
            return;
        }
        const snapshot = await this.findHumanSnapshot(userContext.employeeId);
        if (!snapshot)
            return;
        const payload = this.sanitizeForLog(req.body);
        const query = this.sanitizeForLog(req.query);
        await this.operationLogModel.create({
            humanEmployeeId: snapshot.humanEmployeeId,
            assistantAgentId: snapshot.assistantAgentId,
            action: `${method} ${path}`,
            resource: path,
            httpMethod: method,
            statusCode,
            success: statusCode < 400,
            requestId,
            ip: this.extractIp(req),
            userAgent: req.headers['user-agent'],
            query,
            payload,
            responseSummary: errorMessage ? { error: errorMessage } : undefined,
            sourceService,
            durationMs,
            timestamp: new Date(),
        });
    }
    parseRuntimeControlPath(path) {
        const match = path.match(/^\/api\/agents\/runtime\/runs\/([^/]+)\/(pause|resume|cancel|replay)$/);
        if (match) {
            return { runId: match[1], action: match[2] };
        }
        if (path === '/api/agents/runtime/outbox/dead-letter/requeue') {
            return { runId: 'outbox', action: 'dead_letter_requeue' };
        }
        if (path === '/api/agents/runtime/maintenance/purge-legacy') {
            return { runId: 'maintenance', action: 'purge_legacy' };
        }
        return null;
    }
    parseTimeout(value, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return parsed;
    }
    resolveTimeoutMs(path) {
        if (this.isSseTaskEventsPath(path)) {
            return this.sseProxyTimeoutMs;
        }
        if (/^\/api\/orchestration\/tasks\/[^/]+\/debug-run$/.test(path)) {
            return this.debugRunTimeoutMs;
        }
        return this.defaultProxyTimeoutMs;
    }
    isSseTaskEventsPath(path) {
        return /^\/api\/agents\/tasks\/[^/]+\/events$/.test(path);
    }
    buildSignedHeaders(userContext) {
        if (!userContext)
            return {};
        const encoded = (0, auth_1.encodeUserContext)(userContext);
        const signature = (0, auth_1.signEncodedContext)(encoded, this.contextSecret);
        return {
            'x-user-context': encoded,
            'x-user-signature': signature,
        };
    }
    async forward(req, res) {
        const start = Date.now();
        const requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
        const originalUrl = req.originalUrl || req.url;
        const targetBase = this.resolveTarget(originalUrl);
        const sourceService = this.getSourceService(originalUrl);
        const pathOnly = String(originalUrl || '').split('?')[0] || '/';
        const runtimeControl = this.parseRuntimeControlPath(pathOnly);
        const rewrittenPath = pathOnly.startsWith('/api/life-script')
            ? pathOnly.replace('/api/life-script', '/api')
            : pathOnly;
        const targetUrl = `${targetBase}${rewrittenPath}`;
        const headers = {};
        if (req.headers['content-type']) {
            headers['content-type'] = req.headers['content-type'];
        }
        if (req.headers.authorization) {
            headers.authorization = req.headers.authorization;
        }
        headers['x-request-id'] = requestId;
        Object.assign(headers, this.buildSignedHeaders(req.userContext));
        if (req.projectApiKeyContext) {
            headers['x-project-api-key-context'] = Buffer.from(JSON.stringify(req.projectApiKeyContext)).toString('base64url');
        }
        const timeoutMs = this.resolveTimeoutMs(pathOnly);
        const wantsSse = this.isSseTaskEventsPath(pathOnly) ||
            String(req.headers.accept || '').toLowerCase().includes('text/event-stream');
        const config = {
            url: targetUrl,
            method: req.method,
            headers,
            params: req.query,
            data: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
            validateStatus: () => true,
            timeout: timeoutMs,
            responseType: wantsSse ? 'stream' : 'arraybuffer',
        };
        try {
            const response = await axios_1.default.request(config);
            const latency = Date.now() - start;
            Object.entries(response.headers || {}).forEach(([key, value]) => {
                if (value === undefined)
                    return;
                if (key.toLowerCase() === 'transfer-encoding')
                    return;
                res.setHeader(key, value);
            });
            res.setHeader('x-request-id', requestId);
            this.logger.log(`requestId=${requestId} ${req.method} ${req.originalUrl || req.url} -> ${targetBase} status=${response.status} latency=${latency}ms`);
            if (runtimeControl) {
                const actorId = req.userContext?.employeeId || 'unknown';
                const actorRole = req.userContext?.role || 'unknown';
            }
            void this.recordOperationLog({
                req,
                userContext: req.userContext,
                statusCode: response.status,
                durationMs: latency,
                requestId,
                sourceService,
            }).catch((error) => {
                const message = error instanceof Error ? error.message : 'Unknown operation log error';
                this.logger.warn(`requestId=${requestId} operation log skipped: ${message}`);
            });
            if (wantsSse) {
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                res.status(response.status);
                const stream = response.data;
                stream.on('error', () => {
                    res.end();
                });
                req.on('close', () => {
                    if (typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                });
                stream.pipe(res);
                return;
            }
            res.status(response.status).send(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Gateway proxy error';
            const latency = Date.now() - start;
            this.logger.error(`requestId=${requestId} ${req.method} ${req.originalUrl || req.url} -> ${targetBase} failed latency=${latency}ms: ${message}`);
            if (runtimeControl) {
                const actorId = req.userContext?.employeeId || 'unknown';
                const actorRole = req.userContext?.role || 'unknown';
                this.logger.warn(`runtime_control_audit requestId=${requestId} action=${runtimeControl.action} runId=${runtimeControl.runId} actorId=${actorId} actorRole=${actorRole} status=failed error=${message}`);
            }
            void this.recordOperationLog({
                req,
                userContext: req.userContext,
                statusCode: 500,
                durationMs: latency,
                requestId,
                sourceService,
                errorMessage: message,
            }).catch((logError) => {
                const logMessage = logError instanceof Error ? logError.message : 'Unknown operation log error';
                this.logger.warn(`requestId=${requestId} operation log skipped: ${logMessage}`);
            });
            if (axios_1.default.isAxiosError(error) && error.code === 'ECONNABORTED') {
                const timeoutSeconds = Math.ceil(timeoutMs / 1000);
                throw new common_1.GatewayTimeoutException(`Gateway request timeout ${timeoutSeconds}s`);
            }
            throw new common_1.BadGatewayException('Gateway proxy failed');
        }
    }
};
exports.GatewayProxyService = GatewayProxyService;
exports.GatewayProxyService = GatewayProxyService = GatewayProxyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(operation_log_schema_1.OperationLog.name)),
    __param(1, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], GatewayProxyService);
//# sourceMappingURL=gateway-proxy.service.js.map