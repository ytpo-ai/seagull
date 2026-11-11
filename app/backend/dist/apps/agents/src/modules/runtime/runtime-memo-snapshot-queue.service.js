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
var RuntimeMemoSnapshotQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeMemoSnapshotQueueService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../libs/infra/src/index");
const uuid_1 = require("uuid");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const RUNTIME_MEMO_SNAPSHOT_QUEUE_KEY = 'queue:runtime:memo-snapshot:commands';
const RUNTIME_MEMO_SNAPSHOT_DEAD_LETTER_KEY = 'queue:runtime:memo-snapshot:dead-letter';
let RuntimeMemoSnapshotQueueService = RuntimeMemoSnapshotQueueService_1 = class RuntimeMemoSnapshotQueueService {
    constructor(redisService, persistence) {
        this.redisService = redisService;
        this.persistence = persistence;
        this.logger = new common_1.Logger(RuntimeMemoSnapshotQueueService_1.name);
        this.dedupTtlSeconds = Math.max(60, Number(process.env.RUNTIME_MEMO_SNAPSHOT_DEDUP_TTL_SECONDS || 24 * 60 * 60));
        this.maxAttempts = Math.max(1, Number(process.env.RUNTIME_MEMO_SNAPSHOT_MAX_ATTEMPTS || 3));
        this.running = false;
    }
    onModuleInit() {
        this.running = true;
        void this.consumeLoop();
    }
    onModuleDestroy() {
        this.running = false;
    }
    async enqueueSnapshotUpdate(sessionId, snapshot) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) {
            return { queued: false, requestId: '' };
        }
        const requestId = (0, uuid_1.v4)();
        const idempotencyKey = `snapshot:${normalizedSessionId}:${snapshot.refreshedAt || ''}`.slice(0, 180);
        const command = {
            requestId,
            sessionId: normalizedSessionId,
            snapshot,
            idempotencyKey,
            attempt: 1,
            maxAttempts: this.maxAttempts,
        };
        await this.redisService.lpush(RUNTIME_MEMO_SNAPSHOT_QUEUE_KEY, JSON.stringify(command));
        return { queued: true, requestId };
    }
    async consumeLoop() {
        while (this.running) {
            if (!this.redisService.isReady()) {
                await this.sleep(1000);
                continue;
            }
            try {
                const payload = await this.redisService.brpop(RUNTIME_MEMO_SNAPSHOT_QUEUE_KEY, 2);
                if (!payload) {
                    continue;
                }
                await this.handlePayload(payload);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Runtime memo snapshot consume loop error: ${message}`);
                await this.sleep(1000);
            }
        }
    }
    async handlePayload(payload) {
        let command;
        try {
            command = JSON.parse(payload);
        }
        catch {
            this.logger.warn('Ignored malformed runtime memo snapshot payload');
            return;
        }
        if (!command?.requestId || !command?.sessionId || !command?.snapshot) {
            this.logger.warn('Ignored invalid runtime memo snapshot payload');
            return;
        }
        const dedupKey = `runtime:memo-snapshot:processed:${command.idempotencyKey || command.requestId}`;
        const alreadyProcessed = await this.redisService.get(dedupKey);
        if (alreadyProcessed) {
            return;
        }
        try {
            await this.persistence.updateSessionMemoSnapshot(command.sessionId, command.snapshot);
            await this.redisService.set(dedupKey, '1', this.dedupTtlSeconds);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const nextAttempt = Number(command.attempt || 1) + 1;
            const maxAttempts = Math.max(1, Number(command.maxAttempts || this.maxAttempts));
            if (nextAttempt <= maxAttempts) {
                await this.redisService.lpush(RUNTIME_MEMO_SNAPSHOT_QUEUE_KEY, JSON.stringify({
                    ...command,
                    attempt: nextAttempt,
                }));
                this.logger.warn(`Runtime memo snapshot retry queued requestId=${command.requestId} attempt=${nextAttempt}/${maxAttempts}: ${errorMessage}`);
            }
            else {
                await this.redisService.lpush(RUNTIME_MEMO_SNAPSHOT_DEAD_LETTER_KEY, JSON.stringify({
                    ...command,
                    failedAt: new Date().toISOString(),
                    error: errorMessage,
                }));
                this.logger.error(`Runtime memo snapshot moved to dead letter requestId=${command.requestId} attempts=${maxAttempts}: ${errorMessage}`);
            }
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.RuntimeMemoSnapshotQueueService = RuntimeMemoSnapshotQueueService;
exports.RuntimeMemoSnapshotQueueService = RuntimeMemoSnapshotQueueService = RuntimeMemoSnapshotQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService,
        runtime_persistence_service_1.RuntimePersistenceService])
], RuntimeMemoSnapshotQueueService);
//# sourceMappingURL=runtime-memo-snapshot-queue.service.js.map