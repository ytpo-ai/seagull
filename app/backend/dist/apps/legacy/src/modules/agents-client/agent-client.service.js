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
var AgentClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentClientService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../../../libs/auth/src/index");
const common_2 = require("../../../libs/common/src/index");
const infra_1 = require("../../../libs/infra/src/index");
const crypto_1 = require("crypto");
const unwrap_response_envelope_1 = require("../../shared/common/utils/unwrap-response-envelope");
let AgentClientService = AgentClientService_1 = class AgentClientService {
    constructor(redisService) {
        this.redisService = redisService;
        this.logger = new common_1.Logger(AgentClientService_1.name);
        this.baseUrl = process.env.AGENTS_SERVICE_URL || 'http://localhost:3002';
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
        this.timeout = Number(process.env.AGENTS_CLIENT_TIMEOUT_MS || 20000);
    }
    buildSignedHeaders(extra) {
        const now = Date.now();
        const context = {
            employeeId: 'legacy-service',
            role: 'system',
            issuedAt: now,
            expiresAt: now + 60 * 1000,
        };
        const encoded = (0, auth_1.encodeUserContext)(context);
        const signature = (0, auth_1.signEncodedContext)(encoded, this.contextSecret);
        return {
            'x-user-context': encoded,
            'x-user-signature': signature,
            ...(extra || {}),
        };
    }
    unwrapResponseEnvelope(payload) {
        return (0, unwrap_response_envelope_1.unwrapResponseEnvelope)(payload);
    }
    async resolvePrompt(input) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/prompt-registry/templates/effective`, {
                params: {
                    scene: input.scene,
                    role: input.role,
                },
                headers: this.buildSignedHeaders(),
                timeout: this.timeout,
            });
            const body = this.unwrapResponseEnvelope(response.data);
            const content = String(body?.content || '').trim();
            if (content) {
                return {
                    content,
                    source: String(body?.source || 'api'),
                    version: typeof body?.version === 'number' ? body.version : undefined,
                };
            }
            return {
                content: input.defaultContent,
                source: 'code_default',
            };
        }
        catch (error) {
            this.logger.warn(`[prompt_resolve_http_failed] scene=${input.scene} role=${input.role} error=${error instanceof Error ? error.message : 'unknown'}`);
            return {
                content: input.defaultContent,
                source: 'code_default',
            };
        }
    }
    async getAgent(agentId) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/agents/${agentId}`, {
                headers: this.buildSignedHeaders(),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to fetch agent ${agentId}: ${message}`);
            return null;
        }
    }
    async getAllAgents(filters) {
        const response = await axios_1.default.get(`${this.baseUrl}/api/agents`, {
            params: {
                ...(filters?.projectId !== undefined ? { projectId: filters.projectId } : {}),
            },
            headers: this.buildSignedHeaders(),
            timeout: this.timeout,
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async getActiveAgents(filters) {
        const response = await axios_1.default.get(`${this.baseUrl}/api/agents/active`, {
            params: {
                ...(filters?.projectId !== undefined ? { projectId: filters.projectId } : {}),
            },
            headers: this.buildSignedHeaders(),
            timeout: this.timeout,
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async getToolExecutions(agentId, toolId) {
        const response = await axios_1.default.get(`${this.baseUrl}/api/tools/executions/history`, {
            params: {
                ...(agentId ? { agentId } : {}),
                ...(toolId ? { toolId } : {}),
            },
            headers: this.buildSignedHeaders(),
            timeout: Number(process.env.AGENTS_CLIENT_TIMEOUT_MS || 15000),
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async createAgent(agentData) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/agents`, agentData, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: this.timeout,
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async updateAgent(agentId, updates) {
        try {
            const response = await axios_1.default.put(`${this.baseUrl}/api/agents/${agentId}`, updates, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to update agent ${agentId}: ${message}`);
            return null;
        }
    }
    async executeTaskDetailed(agentId, task, context) {
        const startedAt = Date.now();
        const requestId = (0, crypto_1.randomUUID)();
        const executionMode = this.resolveExecutionMode(context);
        const contextType = this.resolveContextType(context);
        const contextId = this.resolveContextId(context, task);
        const contextSessionId = this.resolveAgentSessionId(context);
        try {
            this.logger.log(`[agents_execute_request] requestId=${requestId} agentId=${agentId} taskId=${task.id || 'unknown'} contextType=${contextType} contextId=${contextId || 'none'} executionMode=${executionMode} sessionId=${contextSessionId || 'none'} title="${this.compactLogText(task.title)}"`);
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/${agentId}/execute`, {
                task,
                context: {
                    ...(context || {}),
                    requestMeta: {
                        requestId,
                        source: 'legacy-agent-client',
                    },
                },
            }, {
                headers: this.buildSignedHeaders({
                    'content-type': 'application/json',
                    'x-request-id': requestId,
                }),
                timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
            });
            const rawPayload = response.data;
            const envelope = (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload))
                ? rawPayload
                : {};
            const body = this.unwrapResponseEnvelope(rawPayload);
            const responseText = typeof body?.response === 'string'
                ? body.response
                : typeof body?.output === 'string'
                    ? body.output
                    : '';
            const runId = typeof body?.runId === 'string'
                ? body.runId
                : typeof envelope?.runId === 'string'
                    ? envelope.runId
                    : undefined;
            const sessionId = typeof body?.sessionId === 'string'
                ? body.sessionId
                : typeof envelope?.sessionId === 'string'
                    ? envelope.sessionId
                    : undefined;
            this.logger.log(`[agents_execute_response] requestId=${requestId} agentId=${agentId} taskId=${task.id || 'unknown'} status=success durationMs=${Date.now() - startedAt} runId=${runId || 'none'} sessionId=${sessionId || 'none'} responseLength=${responseText.length}`);
            return {
                response: responseText,
                runId,
                sessionId,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const axiosError = error;
            const status = axiosError?.response?.status;
            const errorDetail = this.extractErrorDetail(axiosError?.response?.data);
            this.logger.error(`[agents_execute_failed] requestId=${requestId} agentId=${agentId} taskId=${task.id || 'unknown'} status=${status || 'unknown'} durationMs=${Date.now() - startedAt} error=${this.compactLogText(message)} detail="${errorDetail}"`);
            throw error;
        }
    }
    compactLogText(value, maxLength = 120) {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        if (!normalized)
            return '';
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
    }
    extractErrorDetail(payload) {
        if (!payload)
            return 'none';
        if (typeof payload === 'string') {
            return this.compactLogText(payload, 300) || 'none';
        }
        if (typeof payload === 'object') {
            const message = payload.message;
            const error = payload.error;
            const code = payload.code || payload.errorCode;
            const parts = [
                code ? `code=${this.compactLogText(code, 80)}` : '',
                message
                    ? `message=${Array.isArray(message)
                        ? this.compactLogText(message.join('; '), 300)
                        : this.compactLogText(message, 300)}`
                    : '',
                error ? `error=${this.compactLogText(error, 120)}` : '',
            ].filter(Boolean);
            return parts.join(' ') || this.compactLogText(JSON.stringify(payload), 300) || 'none';
        }
        return this.compactLogText(payload, 300) || 'none';
    }
    async executeTask(agentId, task, context) {
        const result = await this.executeTaskDetailed(agentId, task, context);
        return result.response;
    }
    async createAsyncAgentTask(input) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/agents/tasks`, {
            agentId: input.agentId,
            task: input.prompt,
            sessionContext: input.sessionContext,
            idempotencyKey: input.idempotencyKey,
        }, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
        });
        const body = this.unwrapResponseEnvelope(response.data);
        const taskId = String(body?.taskId || '').trim();
        if (!taskId) {
            throw new Error('createAsyncAgentTask response missing taskId');
        }
        const runId = typeof body?.runId === 'string' ? body.runId : undefined;
        const status = String(body?.status || 'queued').trim().toLowerCase();
        return {
            taskId,
            runId,
            status,
        };
    }
    async getAsyncAgentTask(taskId) {
        const normalizedTaskId = String(taskId || '').trim();
        if (!normalizedTaskId) {
            throw new Error('taskId is required');
        }
        const response = await axios_1.default.get(`${this.baseUrl}/api/agents/tasks/${encodeURIComponent(normalizedTaskId)}`, {
            headers: this.buildSignedHeaders(),
            timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
        });
        const body = this.unwrapResponseEnvelope(response.data);
        const normalizedBody = (body && typeof body === 'object')
            ? body
            : {};
        const resolvedTaskId = String(body?.taskId || normalizedTaskId).trim() || normalizedTaskId;
        const status = String(body?.status || '').trim().toLowerCase();
        return {
            ...normalizedBody,
            taskId: resolvedTaskId,
            status,
        };
    }
    async waitForAsyncAgentTaskCompletionBySse(taskId, options) {
        const normalizedTaskId = String(taskId || '').trim();
        if (!normalizedTaskId) {
            throw new Error('taskId is required');
        }
        const timeoutMs = Math.max(1000, Number(options?.timeoutMs || process.env.AGENTS_EXEC_TIMEOUT_MS || 120000));
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        const linkedSignal = options?.signal;
        const abortByLinkedSignal = () => controller.abort();
        if (linkedSignal) {
            if (linkedSignal.aborted) {
                clearTimeout(timeoutHandle);
                controller.abort();
            }
            else {
                linkedSignal.addEventListener('abort', abortByLinkedSignal, { once: true });
            }
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/agents/tasks/${encodeURIComponent(normalizedTaskId)}/events`, {
                headers: this.buildSignedHeaders({ accept: 'text/event-stream' }),
                responseType: 'stream',
                timeout: 0,
                signal: controller.signal,
            });
            return await this.consumeAsyncTaskSseStream(response.data, normalizedTaskId);
        }
        catch (error) {
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
                throw new Error(`Async agent task SSE wait timeout: ${normalizedTaskId}`);
            }
            throw error;
        }
        finally {
            clearTimeout(timeoutHandle);
            if (linkedSignal) {
                linkedSignal.removeEventListener('abort', abortByLinkedSignal);
            }
        }
    }
    async consumeAsyncTaskSseStream(stream, taskId) {
        let buffer = '';
        let eventType = 'message';
        let dataLines = [];
        const resolveFromEvent = (payload, sseEventType) => {
            if (!payload || typeof payload !== 'object') {
                return null;
            }
            const event = (payload.data && typeof payload.data === 'object') ? payload.data : payload;
            const type = String(event.type || sseEventType || '').toLowerCase();
            const body = event.payload && typeof event.payload === 'object' ? event.payload : {};
            const status = String(body.status || '').toLowerCase();
            if (type === 'result' || status === 'succeeded') {
                return {
                    status: 'succeeded',
                    runId: typeof event.runId === 'string' ? event.runId : undefined,
                    sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
                    output: typeof body.response === 'string' ? body.response : undefined,
                };
            }
            if (type === 'error' || status === 'failed') {
                return {
                    status: 'failed',
                    runId: typeof event.runId === 'string' ? event.runId : undefined,
                    error: typeof body.error === 'string' ? body.error : 'Async agent task failed',
                };
            }
            if (status === 'cancelled') {
                return {
                    status: 'cancelled',
                    runId: typeof event.runId === 'string' ? event.runId : undefined,
                    error: typeof body.error === 'string' ? body.error : 'Async agent task cancelled',
                };
            }
            return null;
        };
        const flush = () => {
            if (!dataLines.length) {
                eventType = 'message';
                return null;
            }
            const raw = dataLines.join('\n').trim();
            dataLines = [];
            const currentType = eventType;
            eventType = 'message';
            if (!raw || raw === '[DONE]') {
                return null;
            }
            try {
                const parsed = JSON.parse(raw);
                return resolveFromEvent(parsed, currentType);
            }
            catch {
                return null;
            }
        };
        try {
            for await (const chunk of stream) {
                buffer += chunk.toString('utf8');
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line) {
                        const terminal = flush();
                        if (terminal) {
                            return terminal;
                        }
                        continue;
                    }
                    if (line.startsWith('event:')) {
                        eventType = line.slice('event:'.length).trim() || 'message';
                        continue;
                    }
                    if (line.startsWith('data:')) {
                        dataLines.push(line.slice('data:'.length).trimStart());
                    }
                }
            }
        }
        finally {
            if (typeof stream.destroy === 'function') {
                stream.destroy();
            }
        }
        throw new Error(`Async agent task SSE stream ended before terminal event: ${taskId}`);
    }
    resolveContextType(context) {
        const collaborationContext = context?.collaborationContext;
        if (!collaborationContext)
            return 'chat';
        if (collaborationContext.planId)
            return 'orchestration';
        if (collaborationContext.taskId || collaborationContext.orchestrationTaskId || collaborationContext.taskKey)
            return 'orchestration';
        return 'chat';
    }
    resolveContextId(context, task) {
        const collaborationContext = context?.collaborationContext;
        if (collaborationContext?.meetingId)
            return collaborationContext.meetingId;
        if (collaborationContext?.planId)
            return collaborationContext.planId;
        if (collaborationContext?.taskId)
            return collaborationContext.taskId;
        if (collaborationContext?.orchestrationTaskId)
            return collaborationContext.orchestrationTaskId;
        if (collaborationContext?.taskKey)
            return collaborationContext.taskKey;
        if (task?.id)
            return task.id;
        const rawTask = task;
        return rawTask?._id?.toString ? rawTask._id.toString() : undefined;
    }
    resolveExecutionMode(context) {
        const mode = String(context?.executionMode || '').toLowerCase();
        return mode === 'chat' ? 'chat' : 'task';
    }
    resolveAgentSessionId(context) {
        const candidates = [
            context?.agentSessionId,
            context?.sessionId,
            context?.collaborationContext?.agentSessionId,
            context?.collaborationContext?.sessionId,
        ];
        for (const value of candidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    }
    async executeTool(toolId, agentId, parameters, taskId, executionContext) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/tools/${toolId}/execute`, { agentId, parameters, taskId, executionContext }, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async executeToolQuery(toolId, agentId, parameters, options) {
        const context = options?.context;
        const source = options?.source || 'chat_query';
        return this.executeTool(toolId, agentId, parameters, context?.collaborationContext?.taskId, {
            ...(context || {}),
            source,
            executionMode: 'chat',
        });
    }
    async publishInnerMessage(input) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/inner-messages/publish`, input, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: this.timeout,
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async sendDirectInnerMessage(input) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/inner-messages/direct`, input, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: this.timeout,
        });
        const rawPayload = response.data;
        const envelope = (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload))
            ? rawPayload
            : {};
        const body = this.unwrapResponseEnvelope(rawPayload) || {};
        const messageId = String(body?.messageId || body?.id || '').trim();
        const isSuccess = typeof envelope?.code === 'number'
            ? Number(envelope.code) === 0
            : envelope?.success === undefined
                ? true
                : Boolean(envelope.success);
        return {
            messageId,
            accepted: Boolean(isSuccess && messageId),
        };
    }
    async publishTaskLifecycleEvent(input) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/inner-messages/publish`, {
            senderAgentId: input.senderAgentId || 'orchestration-system',
            eventType: input.eventType,
            title: input.title || `Task Event: ${input.eventType}`,
            content: input.content || `Task ${input.taskId} emitted event ${input.eventType}`,
            payload: {
                taskId: input.taskId,
                planId: input.planId,
                status: input.status,
                ...(input.payload || {}),
            },
            source: 'orchestration',
            dedupKey: `${input.eventType}:${input.taskId}:${input.status || 'na'}`,
        }, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: this.timeout,
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async listInnerMessages(input) {
        const response = await axios_1.default.get(`${this.baseUrl}/api/message-center/inner-messages`, {
            headers: this.buildSignedHeaders(),
            timeout: this.timeout,
            params: {
                ...(input.page ? { page: input.page } : {}),
                ...(input.pageSize ? { pageSize: input.pageSize } : {}),
                ...(input.mode ? { mode: input.mode } : {}),
                ...(input.status ? { status: input.status } : {}),
                ...(input.eventType ? { eventType: input.eventType } : {}),
                ...(input.source ? { source: input.source } : {}),
                ...(input.scheduleId ? { scheduleId: input.scheduleId } : {}),
                ...(input.messageId ? { messageId: input.messageId } : {}),
            },
        });
        const data = this.unwrapResponseEnvelope(response.data) || {};
        return {
            total: Number(data.total || 0),
            page: Number(data.page || 1),
            pageSize: Number(data.pageSize || 20),
            totalPages: Number(data.totalPages || 0),
            items: Array.isArray(data.items) ? data.items : [],
            fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : undefined,
        };
    }
    async testAgentConnection(agentId, body) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/agents/${agentId}/test`, body || {}, {
            headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
            timeout: this.timeout,
        });
        return this.unwrapResponseEnvelope(response.data);
    }
    async getAgentMemoSnapshot(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            return null;
        const fetchByKind = async (memoKind) => {
            const response = await axios_1.default.get(`${this.baseUrl}/api/memos`, {
                headers: this.buildSignedHeaders(),
                timeout: this.timeout,
                params: {
                    agentId: normalizedAgentId,
                    memoKind,
                    page: 1,
                    pageSize: memoKind === 'topic' ? 5 : 2,
                },
            });
            const body = this.unwrapResponseEnvelope(response.data);
            const rows = Array.isArray(body?.items) ? body.items : [];
            return rows.map((item) => ({
                id: String(item?.id || ''),
                memoKind,
                title: String(item?.title || ''),
                slug: item?.slug ? String(item.slug) : undefined,
                content: String(item?.content || '').slice(0, 3000),
                updatedAt: item?.updatedAt ? String(item.updatedAt) : undefined,
            }));
        };
        try {
            const [identity, todo, topic] = await Promise.all([
                fetchByKind('identity'),
                fetchByKind('todo'),
                fetchByKind('topic'),
            ]);
            return {
                agentId: normalizedAgentId,
                refreshedAt: new Date().toISOString(),
                identity,
                todo,
                topic,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to fetch memo snapshot for agent ${normalizedAgentId}: ${message}`);
            return null;
        }
    }
    async flushMemoEvents(agentId) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/memos/events/flush`, agentId ? { agentId } : {}, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to flush memo events: ${message}`);
            return null;
        }
    }
    async triggerMemoFullAggregation() {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/memos/aggregation/full`, {}, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: Number(process.env.AGENTS_EXEC_TIMEOUT_MS || 120000),
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to trigger full memo aggregation: ${message}`);
            return null;
        }
    }
    async enqueueMemoAggregationCommand(options) {
        const command = {
            requestId: (0, crypto_1.randomUUID)(),
            commandType: options.commandType,
            scheduleId: options.scheduleId,
            taskId: options.taskId,
            agentId: options.agentId,
            triggeredBy: options.triggeredBy || 'scheduler',
            requestedAt: new Date().toISOString(),
            attempt: 1,
            maxAttempts: Math.max(1, Number(options.maxAttempts || process.env.MEMO_AGGREGATION_MAX_ATTEMPTS || 3)),
        };
        const queued = await this.redisService.lpush(common_2.MEMO_AGGREGATION_COMMAND_QUEUE_KEY, JSON.stringify(command));
        if (!queued) {
            this.logger.warn(`Failed to enqueue memo aggregation command ${command.requestId}: redis unavailable`);
            return { accepted: false, queued: false, requestId: command.requestId };
        }
        return { accepted: true, queued: true, requestId: command.requestId };
    }
    async getSession(sessionId) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/agents/runtime/sessions/${sessionId}`, {
                headers: this.buildSignedHeaders(),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to get session ${sessionId}: ${message}`);
            return null;
        }
    }
    async createSession(input) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions`, input, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to create session: ${message}`);
            return null;
        }
    }
    async appendSessionMessage(sessionId, message) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions/${sessionId}/messages`, message, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to append message to session ${sessionId}: ${message}`);
            return null;
        }
    }
    async archiveSession(sessionId, summary) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions/${sessionId}/archive`, { summary }, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to archive session ${sessionId}: ${message}`);
            return null;
        }
    }
    async resumeSession(sessionId) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions/${sessionId}/resume`, {}, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to resume session ${sessionId}: ${message}`);
            return null;
        }
    }
    async getOrCreateMeetingSession(meetingId, agentId, title, meetingContext) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions/meeting`, { meetingId, agentId, title, meetingContext }, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to get/create meeting session: ${message}`);
            return null;
        }
    }
    async getOrCreateTaskSession(taskId, agentId, title, planContext) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions/task`, { taskId, agentId, title, planContext }, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to get/create task session: ${message}`);
            return null;
        }
    }
    async getOrCreatePlanSession(planId, agentId, title, options) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/agents/runtime/sessions/plan`, { planId, agentId, title, ...options }, {
                headers: this.buildSignedHeaders({ 'content-type': 'application/json' }),
                timeout: this.timeout,
            });
            return this.unwrapResponseEnvelope(response.data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to get/create plan session: ${message}`);
            return null;
        }
    }
};
exports.AgentClientService = AgentClientService;
exports.AgentClientService = AgentClientService = AgentClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService])
], AgentClientService);
//# sourceMappingURL=agent-client.service.js.map