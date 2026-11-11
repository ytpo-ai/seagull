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
var RuntimeController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeController = void 0;
const common_1 = require("@nestjs/common");
const runtime_orchestrator_service_1 = require("./runtime-orchestrator.service");
const hook_dispatcher_service_1 = require("./hook-dispatcher.service");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const runtime_ei_sync_service_1 = require("./runtime-ei-sync.service");
const runtime_run_diagnosis_service_1 = require("./runtime-run-diagnosis.service");
const runtime_control_contract_1 = require("./contracts/runtime-control.contract");
let RuntimeController = RuntimeController_1 = class RuntimeController {
    constructor(runtimeOrchestrator, hookDispatcher, persistence, runtimeEiSyncService, runDiagnosisService) {
        this.runtimeOrchestrator = runtimeOrchestrator;
        this.hookDispatcher = hookDispatcher;
        this.persistence = persistence;
        this.runtimeEiSyncService = runtimeEiSyncService;
        this.runDiagnosisService = runDiagnosisService;
        this.logger = new common_1.Logger(RuntimeController_1.name);
        this.diagnoseRateWindowMs = 60000;
        this.diagnoseRateLimit = 10;
        this.diagnoseRateTracker = new Map();
    }
    getUserContext(req) {
        const context = req.userContext;
        if (!context) {
            throw new common_1.ForbiddenException('Missing user context');
        }
        return context;
    }
    assertRuntimeControlPermission(context) {
    }
    assertSystemRole(context) {
    }
    assertOrganizationAccess(runOrganizationId, context) {
        const role = (context.role || '').toLowerCase();
        if (role === 'system') {
            return;
        }
        if (!runOrganizationId) {
            return;
        }
    }
    async getAuthorizedRun(runId, context) {
        const run = await this.runtimeOrchestrator.getRun(runId);
        if (!run) {
            throw new common_1.NotFoundException('Runtime run not found');
        }
        return run;
    }
    toActor(context, body) {
        const role = (context.role || '').toLowerCase();
        const actorType = body?.actorType ||
            (role === 'system' ? 'system' : 'employee');
        return {
            actorId: body?.actorId || context.employeeId || 'unknown-actor',
            actorType,
            reason: body?.reason,
        };
    }
    toDateOrUndefined(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return undefined;
        }
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed;
    }
    toPositiveNumberOrUndefined(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return undefined;
        }
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return undefined;
        }
        return Math.floor(parsed);
    }
    assertDiagnoseRateLimit(context) {
        const actorId = String(context.employeeId || context.role || 'anonymous').trim();
        const now = Date.now();
        const cutoff = now - this.diagnoseRateWindowMs;
        const history = (this.diagnoseRateTracker.get(actorId) || []).filter((ts) => ts >= cutoff);
        if (history.length >= this.diagnoseRateLimit) {
            throw new common_1.BadRequestException('诊断请求过于频繁，请稍后重试');
        }
        history.push(now);
        this.diagnoseRateTracker.set(actorId, history);
    }
    async listRuns(req, agentId, status, from, to, page, pageSize) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId) {
            throw new common_1.BadRequestException('agentId is required');
        }
        const result = await this.runtimeOrchestrator.listRuns(normalizedAgentId, {
            status: String(status || '').trim() || undefined,
            from: this.toDateOrUndefined(from),
            to: this.toDateOrUndefined(to),
            page: this.toPositiveNumberOrUndefined(page),
            pageSize: this.toPositiveNumberOrUndefined(pageSize),
        });
        return {
            success: true,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
            items: result.items,
        };
    }
    async getRun(runId, req) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const run = await this.getAuthorizedRun(runId, context);
        return {
            found: Boolean(run),
            run,
        };
    }
    async getRuntimeMetrics(req) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const [outbox, deadLetter] = await Promise.all([
            this.persistence.countOutboxByStatus(),
            this.persistence.getDeadLetterSummary(),
        ]);
        return {
            hookDispatcher: this.hookDispatcher.getMetrics(),
            outbox,
            deadLetter,
            timestamp: Date.now(),
        };
    }
    async pauseRun(runId, req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        await this.getAuthorizedRun(runId, context);
        const body = runtime_control_contract_1.RuntimeControlBodySchema.parse(rawBody || {});
        await this.runtimeOrchestrator.pauseRunWithActor(runId, this.toActor(context, body));
        return { success: true, runId, action: 'paused' };
    }
    async resumeRun(runId, req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        await this.getAuthorizedRun(runId, context);
        const body = runtime_control_contract_1.RuntimeControlBodySchema.parse(rawBody || {});
        await this.runtimeOrchestrator.resumeRunWithActor(runId, this.toActor(context, body));
        return { success: true, runId, action: 'resumed' };
    }
    async cancelRun(runId, req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        await this.getAuthorizedRun(runId, context);
        const body = runtime_control_contract_1.RuntimeControlBodySchema.parse(rawBody || {});
        await this.runtimeOrchestrator.cancelRunWithActor(runId, this.toActor(context, body));
        return { success: true, runId, action: 'cancelled' };
    }
    async replayRun(runId, req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        await this.getAuthorizedRun(runId, context);
        const body = runtime_control_contract_1.RuntimeReplayBodySchema.parse(rawBody || {});
        const dispatched = await this.runtimeOrchestrator.replayRun(runId, {
            eventTypes: body?.eventTypes,
            fromSequence: body?.fromSequence,
            toSequence: body?.toSequence,
            channel: body?.channel,
            limit: body?.limit,
        });
        return {
            success: true,
            runId,
            action: 'replayed',
            dispatched,
        };
    }
    async replayRunToEngineeringIntelligence(runId, req) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        await this.getAuthorizedRun(runId, context);
        const result = await this.runtimeEiSyncService.syncRunNow(runId, { replay: true });
        return {
            success: result.success,
            runId,
            action: 'sync_ei_replay',
            reason: result.reason,
        };
    }
    async getEngineeringIntelligenceDeadLetterRuns(req, rawQuery) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const query = runtime_control_contract_1.RuntimeEiSyncDeadLetterQuerySchema.parse(rawQuery || {});
        const rows = await this.runtimeEiSyncService.listDeadLetterRuns(query.limit || 100);
        return {
            success: true,
            total: rows.length,
            runs: rows.map((run) => ({
                runId: run.id,
                agentId: run.agentId,
                status: run.status,
                sync: run.sync,
                updatedAt: run.updatedAt,
            })),
        };
    }
    async requeueEngineeringIntelligenceDeadLetterRuns(req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const body = runtime_control_contract_1.RuntimeEiSyncRequeueBodySchema.parse(rawBody || {});
        const result = await this.runtimeEiSyncService.requeueDeadLetterRuns(body.runIds, body.limit || 100, Boolean(body.dryRun));
        return {
            success: true,
            dryRun: Boolean(body.dryRun),
            matched: result.matched,
            requeued: result.requeued,
        };
    }
    async getDeadLetterEvents(req, rawQuery) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const query = runtime_control_contract_1.RuntimeDeadLetterQuerySchema.parse(rawQuery || {});
        const rows = await this.persistence.findDeadLetterEvents({
            limit: query.limit || 200,
            runId: query.runId,
            eventType: query.eventType,
        });
        const total = await this.persistence.countDeadLetterEvents({
            runId: query.runId,
            eventType: query.eventType,
        });
        return {
            success: true,
            total,
            returned: rows.length,
            hasMore: total > rows.length,
            events: rows.map((row) => ({
                eventId: row.eventId,
                eventType: row.eventType,
                runId: row.runId,
                sessionId: row.sessionId,
                sequence: row.sequence,
                attempts: row.attempts,
                lastError: row.lastError,
                nextRetryAt: row.nextRetryAt,
                updatedAt: row.updatedAt,
            })),
        };
    }
    async requeueDeadLetterEvents(req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const body = runtime_control_contract_1.RuntimeDeadLetterRequeueBodySchema.parse(rawBody || {});
        const batchId = `requeue-${Date.now()}`;
        let requeued = 0;
        let matched = 0;
        if (body.eventIds?.length) {
            const rows = await this.persistence.findDeadLetterEventsByEventIds(body.eventIds);
            const eventIds = rows.map((row) => row.eventId);
            matched = eventIds.length;
            if (!body.dryRun) {
                requeued = await this.persistence.requeueDeadLetterByEventIds(eventIds);
            }
        }
        else {
            const rows = await this.persistence.findDeadLetterEvents({
                limit: body.limit || 200,
                runId: body.runId,
                eventType: body.eventType,
            });
            matched = rows.length;
            if (!body.dryRun) {
                requeued = await this.persistence.requeueDeadLetterByEventIds(rows.map((row) => row.eventId));
            }
        }
        await this.persistence.createMaintenanceAudit({
            action: 'dead_letter_requeue',
            batchId,
            actorId: context.employeeId,
            actorRole: context.role || 'unknown',
            dryRun: Boolean(body.dryRun),
            matched,
            affected: requeued,
            summary: `dead_letter_requeue matched=${matched} requeued=${requeued} dryRun=${Boolean(body.dryRun)}`,
            scope: {
                runId: body.runId,
                eventType: body.eventType,
                eventIdsCount: body.eventIds?.length || 0,
            },
            result: {
                requeued,
            },
        });
        return {
            success: true,
            batchId,
            dryRun: Boolean(body.dryRun),
            matched,
            requeued,
            scope: {
                runId: body.runId,
                eventType: body.eventType,
            },
        };
    }
    async getMaintenanceAudits(req, rawQuery) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const query = runtime_control_contract_1.RuntimeMaintenanceAuditQuerySchema.parse(rawQuery || {});
        const rows = await this.persistence.listMaintenanceAudits({
            limit: query.limit || 50,
            action: query.action,
            batchId: query.batchId,
        });
        return {
            success: true,
            total: rows.length,
            audits: rows.map((row) => ({
                id: row.id,
                action: row.action,
                batchId: row.batchId,
                actorId: row.actorId,
                actorRole: row.actorRole,
                dryRun: row.dryRun,
                matched: row.matched,
                affected: row.affected,
                summary: row.summary,
                scope: row.scope,
                result: row.result,
                createdAt: row.createdAt,
            })),
        };
    }
    async purgeLegacyRuntimeData(req, rawBody) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        this.assertSystemRole(context);
        const body = runtime_control_contract_1.RuntimePurgeLegacyBodySchema.parse(rawBody || {});
        const defaultCollections = [
            'agentsessions',
            'agent_sessions',
        ];
        const collections = body.collections?.length ? body.collections : defaultCollections;
        const batchId = `purge-${Date.now()}`;
        const results = body.dryRun
            ? collections.map((collection) => ({ collection, deletedCount: 0 }))
            : await this.persistence.purgeCollections(collections);
        await this.persistence.createMaintenanceAudit({
            action: 'purge_legacy',
            batchId,
            actorId: context.employeeId,
            actorRole: context.role || 'unknown',
            dryRun: Boolean(body.dryRun),
            matched: collections.length,
            affected: results.reduce((sum, item) => sum + item.deletedCount, 0),
            summary: `purge_legacy collections=${collections.length} deleted=${results.reduce((sum, item) => sum + item.deletedCount, 0)} dryRun=${Boolean(body.dryRun)}`,
            scope: {
                collections,
            },
            result: {
                collections: results,
            },
        });
        return {
            success: true,
            batchId,
            purgedBy: context.employeeId,
            dryRun: Boolean(body.dryRun),
            collections: results,
        };
    }
    async listSessions(ownerType, ownerId, status, sessionType, keyword, page, pageSize) {
        const normalizedPage = Math.max(1, Number(page || 1));
        const normalizedPageSize = Math.max(1, Math.min(100, Number(pageSize || 20)));
        const [sessions, total] = await Promise.all([
            this.persistence.listSessions({
                ownerType,
                ownerId: ownerId?.trim() || undefined,
                status,
                sessionType,
                keyword: keyword?.trim() || undefined,
                page: normalizedPage,
                pageSize: normalizedPageSize,
            }),
            this.persistence.countSessions({
                ownerType,
                ownerId: ownerId?.trim() || undefined,
                status,
                sessionType,
                keyword: keyword?.trim() || undefined,
            }),
        ]);
        return {
            total,
            page: normalizedPage,
            pageSize: normalizedPageSize,
            totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
            sessions,
        };
    }
    async getSession(id) {
        const session = await this.persistence.getSessionDetailById(id);
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    async createSession(body) {
        const session = await this.persistence.ensureSession({
            sessionId: body.sessionId,
            sessionType: body.sessionType || 'task',
            ownerType: body.ownerType || 'agent',
            ownerId: body.ownerId,
            title: body.title,
            planContext: body.planContext,
            meetingContext: body.meetingContext,
            domainContext: body.domainContext,
            collaborationContext: body.collaborationContext,
            metadata: body.metadata,
        });
        return session;
    }
    async getOrCreateMeetingSession(body) {
        const session = await this.persistence.getOrCreateMeetingSession(body.meetingId, body.agentId, body.title, body.meetingContext);
        return session;
    }
    async getOrCreatePlanSession(body) {
        const session = await this.persistence.getOrCreatePlanSession(body.planId, body.agentId, body.title, {
            currentTaskId: body.currentTaskId,
            orchestrationRunId: body.orchestrationRunId,
            domainContext: body.domainContext,
            collaborationContext: body.collaborationContext,
        });
        return session;
    }
    async getOrCreateTaskSession(body) {
        const session = await this.persistence.getOrCreateTaskSession(body.taskId, body.agentId, body.title, body.planContext);
        return session;
    }
    async appendMessage(id, body) {
        const messageId = String(body.messageId || '').trim();
        if (messageId) {
            await this.persistence.appendMessageIdToSession(id, messageId);
        }
        else if (body.runId && body.agentId) {
            await this.persistence.createMessage({
                runId: body.runId,
                agentId: body.agentId,
                sessionId: id,
                role: body.role,
                sequence: 0,
                content: body.content ?? '',
                status: body.status,
                metadata: body.metadata,
            });
        }
        else {
            throw new common_1.NotFoundException('messageId or (runId + agentId) is required');
        }
        const session = await this.persistence.getSessionById(id);
        return session;
    }
    async getSessionMessages(sessionId) {
        const messages = await this.persistence.listSessionMessagesById(sessionId);
        return {
            sessionId,
            total: messages.length,
            messages,
        };
    }
    async getMessageParts(messageId) {
        const parts = await this.persistence.listMessageParts(messageId);
        return {
            messageId,
            total: parts.length,
            parts,
        };
    }
    async getRunMessages(runId) {
        const [runMessages, run] = await Promise.all([
            this.persistence.listRunMessagesWithParts(runId),
            this.persistence.getRun(runId),
        ]);
        let messages = runMessages;
        if (run?.sessionId) {
            const initialSysMessages = await this.persistence.getSessionInitialSystemMessages(run.sessionId);
            if (initialSysMessages?.length) {
                const systemMessageViews = initialSysMessages.map((msg, index) => ({
                    id: msg.id || `sys-init-${index}`,
                    runId,
                    taskId: run.taskId,
                    parentMessageId: undefined,
                    role: 'system',
                    sequence: index + 1,
                    content: msg.content,
                    status: 'completed',
                    metadata: { ...(msg.metadata || {}), source: 'session.initialSystemMessages' },
                    modelID: undefined,
                    providerID: undefined,
                    finish: undefined,
                    tokens: undefined,
                    cost: undefined,
                    stepIndex: undefined,
                    timestamp: run.createdAt || new Date(),
                    parts: [],
                }));
                messages = [...systemMessageViews, ...runMessages];
            }
        }
        return {
            runId,
            total: messages.length,
            messages,
        };
    }
    async diagnoseRun(runId, body, req, res) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const question = String(body?.question || '').trim();
        if (!question) {
            throw new common_1.BadRequestException('question is required');
        }
        await this.getAuthorizedRun(runId, context);
        this.assertDiagnoseRateLimit(context);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.flushHeaders?.();
        try {
            await this.runDiagnosisService.diagnoseStream(runId, question, (chunk) => {
                res.write(`event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            });
            res.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'diagnose_failed';
            this.logger.warn(`diagnose_run_failed runId=${runId}: ${message}`);
            res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
        }
        finally {
            res.end();
        }
    }
    async archiveSession(id, body) {
        await this.persistence.archiveSession(id, body?.summary);
        const session = await this.persistence.getSessionById(id);
        return session;
    }
    async resumeSession(id) {
        await this.persistence.resumeSession(id);
        const session = await this.persistence.getSessionById(id);
        return session;
    }
};
exports.RuntimeController = RuntimeController;
__decorate([
    (0, common_1.Get)('runs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "listRuns", null);
__decorate([
    (0, common_1.Get)('runs/:runId'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getRun", null);
__decorate([
    (0, common_1.Get)('metrics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getRuntimeMetrics", null);
__decorate([
    (0, common_1.Post)('runs/:runId/pause'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "pauseRun", null);
__decorate([
    (0, common_1.Post)('runs/:runId/resume'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "resumeRun", null);
__decorate([
    (0, common_1.Post)('runs/:runId/cancel'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "cancelRun", null);
__decorate([
    (0, common_1.Post)('runs/:runId/replay'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "replayRun", null);
__decorate([
    (0, common_1.Post)('runs/:runId/sync-ei-replay'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "replayRunToEngineeringIntelligence", null);
__decorate([
    (0, common_1.Get)('sync-ei/dead-letter'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getEngineeringIntelligenceDeadLetterRuns", null);
__decorate([
    (0, common_1.Post)('sync-ei/dead-letter/requeue'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "requeueEngineeringIntelligenceDeadLetterRuns", null);
__decorate([
    (0, common_1.Get)('outbox/dead-letter'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getDeadLetterEvents", null);
__decorate([
    (0, common_1.Post)('outbox/dead-letter/requeue'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "requeueDeadLetterEvents", null);
__decorate([
    (0, common_1.Get)('maintenance/audits'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getMaintenanceAudits", null);
__decorate([
    (0, common_1.Post)('maintenance/purge-legacy'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "purgeLegacyRuntimeData", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Query)('ownerType')),
    __param(1, (0, common_1.Query)('ownerId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('sessionType')),
    __param(4, (0, common_1.Query)('keyword')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getSession", null);
__decorate([
    (0, common_1.Post)('sessions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "createSession", null);
__decorate([
    (0, common_1.Post)('sessions/meeting'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getOrCreateMeetingSession", null);
__decorate([
    (0, common_1.Post)('sessions/plan'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getOrCreatePlanSession", null);
__decorate([
    (0, common_1.Post)('sessions/task'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getOrCreateTaskSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "appendMessage", null);
__decorate([
    (0, common_1.Get)('sessions/:sessionId/messages'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getSessionMessages", null);
__decorate([
    (0, common_1.Get)('messages/:messageId/parts'),
    __param(0, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getMessageParts", null);
__decorate([
    (0, common_1.Get)('runs/:runId/messages'),
    __param(0, (0, common_1.Param)('runId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "getRunMessages", null);
__decorate([
    (0, common_1.Post)('runs/:runId/diagnose'),
    (0, common_1.Header)('Cache-Control', 'no-cache, no-transform'),
    (0, common_1.Header)('Connection', 'keep-alive'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "diagnoseRun", null);
__decorate([
    (0, common_1.Post)('sessions/:id/archive'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "archiveSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/resume'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RuntimeController.prototype, "resumeSession", null);
exports.RuntimeController = RuntimeController = RuntimeController_1 = __decorate([
    (0, common_1.Controller)('agents/runtime'),
    __metadata("design:paramtypes", [runtime_orchestrator_service_1.RuntimeOrchestratorService,
        hook_dispatcher_service_1.HookDispatcherService,
        runtime_persistence_service_1.RuntimePersistenceService,
        runtime_ei_sync_service_1.RuntimeEiSyncService,
        runtime_run_diagnosis_service_1.RuntimeRunDiagnosisService])
], RuntimeController);
//# sourceMappingURL=runtime.controller.js.map