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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoWriteQueueService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("../../../../../libs/common/src/index");
const infra_1 = require("../../../../../libs/infra/src/index");
const uuid_1 = require("uuid");
let MemoWriteQueueService = class MemoWriteQueueService {
    constructor(redisService) {
        this.redisService = redisService;
        this.maxAttempts = Math.max(1, Number(process.env.MEMO_WRITE_MAX_ATTEMPTS || 3));
    }
    async queueCreateMemo(body, options) {
        return this.enqueue('create_memo', { body, options }, `create:${body.agentId}:${body.memoKind || 'topic'}:${body.title || ''}`);
    }
    async queueUpdateMemo(id, updates, options) {
        return this.enqueue('update_memo', { id, updates, options }, `update:${id}`);
    }
    async queueDeleteMemo(id) {
        return this.enqueue('delete_memo', { id }, `delete:${id}`);
    }
    async queueUpsertTaskTodo(agentId, task) {
        return this.enqueue('upsert_task_todo', { agentId, task }, `upsert_todo:${agentId}:${task.id || 'auto'}`);
    }
    async queueUpdateTodoStatus(id, status, note, options) {
        return this.enqueue('update_todo_status', { id, status, note, options }, `todo_status:${id}:${options?.taskId || 'default'}`);
    }
    async queueCompleteTaskTodo(agentId, taskId, note, status = 'success') {
        return this.enqueue('complete_task_todo', { agentId, taskId, note, status }, `complete_todo:${agentId}:${taskId || 'unknown'}`);
    }
    async queueRecordBehavior(payload) {
        return this.enqueue('record_behavior', payload, `behavior:${payload.agentId}:${payload.taskId || payload.event}:${Date.now()}`);
    }
    async enqueue(commandType, payload, idempotencySeed) {
        const requestId = (0, uuid_1.v4)();
        const queuedAt = new Date().toISOString();
        const command = {
            requestId,
            commandType,
            payload,
            idempotencyKey: this.normalizeIdempotencyKey(idempotencySeed || requestId),
            requestedAt: queuedAt,
            source: 'agents-runtime',
            attempt: 1,
            maxAttempts: this.maxAttempts,
        };
        await this.redisService.lpush(common_2.MEMO_WRITE_COMMAND_QUEUE_KEY, JSON.stringify(command));
        return {
            accepted: true,
            requestId,
            commandType,
            queuedAt,
        };
    }
    normalizeIdempotencyKey(seed) {
        return String(seed || '')
            .trim()
            .replace(/[^a-zA-Z0-9:_-]/g, '_')
            .slice(0, 180);
    }
};
exports.MemoWriteQueueService = MemoWriteQueueService;
exports.MemoWriteQueueService = MemoWriteQueueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService])
], MemoWriteQueueService);
//# sourceMappingURL=memo-write-queue.service.js.map