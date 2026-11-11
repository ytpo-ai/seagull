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
var RuntimeEiSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeEiSyncService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../../../../../libs/auth/src/index");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const unwrap_response_envelope_1 = require("../../../../../src/shared/common/utils/unwrap-response-envelope");
let RuntimeEiSyncService = RuntimeEiSyncService_1 = class RuntimeEiSyncService {
    constructor(runModel, persistence, messageBus) {
        this.runModel = runModel;
        this.persistence = persistence;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(RuntimeEiSyncService_1.name);
        this.flushing = false;
        this.eiBaseUrl = this.resolveEiBaseUrl();
        this.eiSyncUrl = `${this.eiBaseUrl}/ei/sync-batches`;
        this.contextSecret = String(process.env.INTERNAL_CONTEXT_SECRET || '').trim();
        this.maxRetry = Math.max(1, Number(process.env.RUNTIME_EI_SYNC_MAX_RETRY || 5));
        this.pollIntervalMs = Math.max(1000, Number(process.env.RUNTIME_EI_SYNC_POLL_INTERVAL_MS || 5000));
        this.timeoutMs = Math.max(2000, Number(process.env.RUNTIME_EI_SYNC_TIMEOUT_MS || 10000));
        this.batchLimit = Math.max(1, Number(process.env.RUNTIME_EI_SYNC_BATCH_LIMIT || 20));
        this.envId = String(process.env.RUNTIME_SYNC_ENV_ID || process.env.NODE_ENV || 'local').trim();
        this.nodeId = String(process.env.RUNTIME_SYNC_NODE_ID || 'agents-node').trim();
        this.streamEnabled = process.env.RUNTIME_EI_SYNC_STREAM_ENABLED !== 'false';
        this.httpEnabled = process.env.RUNTIME_EI_SYNC_HTTP_ENABLED === 'true';
        if (!this.contextSecret) {
            throw new Error('INTERNAL_CONTEXT_SECRET is required');
        }
    }
    onModuleInit() {
        const mode = this.httpEnabled ? (this.streamEnabled ? 'dual-write' : 'http-only') : (this.streamEnabled ? 'stream-only' : 'disabled');
        this.logger.log(`EI sync mode=${mode} httpEnabled=${this.httpEnabled} streamEnabled=${this.streamEnabled} eiSyncUrl=${this.eiSyncUrl}`);
        if (this.httpEnabled) {
            this.timer = setInterval(() => {
                void this.flushPendingRuns();
            }, this.pollIntervalMs);
        }
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    async scheduleRunSync(runId) {
        await this.runModel.updateOne({ id: runId }, {
            $set: {
                'sync.state': 'pending',
                'sync.nextRetryAt': new Date(),
            },
            $setOnInsert: {
                'sync.retryCount': 0,
            },
        }).exec();
    }
    async syncRunNow(runId, options) {
        const run = await this.runModel.findOne({ id: runId }).exec();
        if (!run) {
            return { success: false, reason: 'run_not_found' };
        }
        try {
            const payload = await this.buildRunSyncPayload(run);
            const results = await this.dualWriteSync(runId, payload);
            if (!results.anySuccess) {
                throw new Error(results.lastError || 'all_channels_failed');
            }
            await this.runModel.updateOne({ id: runId }, {
                $set: {
                    'sync.state': 'synced',
                    'sync.lastSyncAt': new Date(),
                    'sync.lastError': undefined,
                    'sync.nextRetryAt': undefined,
                    'executionData.sync': {
                        ...(run.executionData?.sync || {}),
                        lastResult: results.duplicate ? 'duplicate' : 'synced',
                        replay: Boolean(options?.replay),
                        syncedAt: new Date().toISOString(),
                        channel: results.channel,
                    },
                },
            }).exec();
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'sync_failed');
            const retryCount = Number(run.sync?.retryCount || 0) + 1;
            const deadLettered = retryCount >= this.maxRetry;
            const backoffMs = Math.min(60000, retryCount * 5000);
            await this.runModel.updateOne({ id: runId }, {
                $set: {
                    'sync.state': 'failed',
                    'sync.retryCount': retryCount,
                    'sync.lastError': message,
                    'sync.nextRetryAt': deadLettered ? undefined : new Date(Date.now() + backoffMs),
                    'sync.deadLettered': deadLettered,
                    'executionData.sync': {
                        ...(run.executionData?.sync || {}),
                        lastResult: 'failed',
                        replay: Boolean(options?.replay),
                        failedAt: new Date().toISOString(),
                        error: message,
                    },
                },
            }).exec();
            this.logger.warn(`EI sync failed runId=${runId} retry=${retryCount} deadLettered=${deadLettered}: ${message}`);
            return { success: false, reason: message };
        }
    }
    async dualWriteSync(runId, payload) {
        let streamOk = false;
        let httpOk = false;
        let duplicate = false;
        let lastError;
        const channels = [];
        if (this.streamEnabled) {
            try {
                const result = await this.messageBus.publish('runtime.ei-sync', {
                    payload,
                    headers: { source: 'agents-runtime', partitionKey: runId },
                });
                streamOk = result.accepted;
                if (streamOk)
                    channels.push('stream');
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                this.logger.warn(`[ei_sync_stream_failed] runId=${runId} error=${lastError}`);
            }
        }
        if (this.httpEnabled) {
            try {
                const response = await axios_1.default.post(this.eiSyncUrl, payload, {
                    headers: this.buildSignedHeaders(),
                    timeout: this.timeoutMs,
                });
                httpOk = true;
                const body = (0, unwrap_response_envelope_1.unwrapResponseEnvelope)(response?.data);
                duplicate = Boolean(body?.duplicate);
                channels.push('http');
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                this.logger.warn(`[ei_sync_http_failed] runId=${runId} error=${lastError}`);
            }
        }
        return {
            anySuccess: streamOk || httpOk,
            duplicate,
            channel: channels.join('+') || 'none',
            lastError: (streamOk || httpOk) ? undefined : lastError,
        };
    }
    async flushPendingRuns() {
        if (this.flushing)
            return;
        this.flushing = true;
        try {
            const now = new Date();
            const runs = await this.runModel.find({
                status: { $in: ['completed', 'failed', 'cancelled'] },
                $or: [
                    { 'sync.state': 'pending' },
                    {
                        'sync.state': 'failed',
                        'sync.deadLettered': { $ne: true },
                        $or: [
                            { 'sync.nextRetryAt': { $exists: false } },
                            { 'sync.nextRetryAt': null },
                            { 'sync.nextRetryAt': { $lte: now } },
                        ],
                    },
                ],
            }).sort({ updatedAt: 1 }).limit(this.batchLimit).exec();
            for (const run of runs) {
                await this.syncRunNow(run.id);
            }
        }
        finally {
            this.flushing = false;
        }
    }
    async listDeadLetterRuns(limit = 100) {
        return this.runModel.find({ 'sync.state': 'failed', 'sync.deadLettered': true })
            .sort({ updatedAt: -1 })
            .limit(Math.max(1, Math.min(500, limit)))
            .exec();
    }
    async requeueDeadLetterRuns(runIds, limit = 100, dryRun = false) {
        const query = {
            'sync.state': 'failed',
            'sync.deadLettered': true,
        };
        if (runIds?.length) {
            query.id = { $in: runIds };
        }
        const rows = await this.runModel.find(query).sort({ updatedAt: -1 }).limit(Math.max(1, Math.min(500, limit))).exec();
        if (dryRun || rows.length === 0) {
            return { matched: rows.length, requeued: 0 };
        }
        const ids = rows.map((row) => row.id);
        const result = await this.runModel.updateMany({ id: { $in: ids } }, {
            $set: {
                'sync.state': 'pending',
                'sync.deadLettered': false,
                'sync.nextRetryAt': new Date(),
            },
        }).exec();
        return { matched: rows.length, requeued: result.modifiedCount || 0 };
    }
    async buildRunSyncPayload(run) {
        const events = await this.persistence.findEventsByRun(run.id, { limit: 5000 });
        const syncBatchId = `sync-${run.id}-${Date.now()}`;
        return {
            syncBatchId,
            envId: this.envId,
            nodeId: this.nodeId,
            run: {
                runId: run.id,
                agentId: run.agentId,
                roleCode: run.roleCode,
                status: run.status,
                startedAt: run.startedAt?.toISOString?.() || new Date().toISOString(),
                completedAt: run.finishedAt?.toISOString?.(),
            },
            events: events.map((event) => ({
                eventId: event.eventId,
                sequence: event.sequence,
                eventType: event.eventType,
                timestamp: event.timestamp.toISOString(),
                payloadDigest: this.buildPayloadDigest(event.payload),
            })),
        };
    }
    buildPayloadDigest(payload) {
        const text = JSON.stringify(payload || {});
        return Buffer.from(text).toString('base64').slice(0, 128);
    }
    buildSignedHeaders() {
        const now = Date.now();
        const context = {
            employeeId: 'agents-service',
            role: 'system',
            issuedAt: now,
            expiresAt: now + 60 * 1000,
        };
        const encoded = (0, auth_1.encodeUserContext)(context);
        const signature = (0, auth_1.signEncodedContext)(encoded, this.contextSecret);
        return {
            'x-user-context': encoded,
            'x-user-signature': signature,
            'content-type': 'application/json',
        };
    }
    resolveEiBaseUrl() {
        const raw = String(process.env.ENGINEERING_INTELLIGENCE_SERVICE_URL || 'http://localhost:3004').trim();
        const normalized = raw.replace(/\/+$/, '');
        return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    }
};
exports.RuntimeEiSyncService = RuntimeEiSyncService;
exports.RuntimeEiSyncService = RuntimeEiSyncService = RuntimeEiSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_run_schema_1.AgentRun.name)),
    __param(2, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        runtime_persistence_service_1.RuntimePersistenceService, Object])
], RuntimeEiSyncService);
//# sourceMappingURL=runtime-ei-sync.service.js.map