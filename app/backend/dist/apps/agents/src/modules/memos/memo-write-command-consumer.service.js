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
var MemoWriteCommandConsumerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoWriteCommandConsumerService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("../../../../../libs/common/src/index");
const infra_1 = require("../../../../../libs/infra/src/index");
const memo_service_1 = require("./memo.service");
let MemoWriteCommandConsumerService = MemoWriteCommandConsumerService_1 = class MemoWriteCommandConsumerService {
    constructor(redisService, memoService) {
        this.redisService = redisService;
        this.memoService = memoService;
        this.logger = new common_1.Logger(MemoWriteCommandConsumerService_1.name);
        this.dedupTtlSeconds = Math.max(60, Number(process.env.MEMO_WRITE_DEDUP_TTL_SECONDS || 24 * 60 * 60));
        this.running = false;
    }
    onModuleInit() {
        this.running = true;
        void this.consumeLoop();
    }
    onModuleDestroy() {
        this.running = false;
    }
    async consumeLoop() {
        while (this.running) {
            if (!this.redisService.isReady()) {
                await this.sleep(1000);
                continue;
            }
            try {
                const payload = await this.redisService.brpop(common_2.MEMO_WRITE_COMMAND_QUEUE_KEY, 2);
                if (!payload) {
                    continue;
                }
                await this.handlePayload(payload);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Memo write command consume loop error: ${message}`);
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
            this.logger.warn('Ignored malformed memo write command payload');
            return;
        }
        if (!command?.requestId || !command?.commandType || !command.payload || typeof command.payload !== 'object') {
            this.logger.warn('Ignored invalid memo write command payload');
            return;
        }
        const dedupKey = `memo:write:processed:${command.idempotencyKey || command.requestId}`;
        const alreadyProcessed = await this.redisService.get(dedupKey);
        if (alreadyProcessed) {
            this.logger.log(`Skip duplicated memo write command requestId=${command.requestId}`);
            return;
        }
        try {
            await this.executeCommand(command);
            await this.redisService.set(dedupKey, '1', this.dedupTtlSeconds);
            await this.publishResult({
                requestId: command.requestId,
                commandType: command.commandType,
                status: 'completed',
                attempt: command.attempt,
                finishedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const nextAttempt = Number(command.attempt || 1) + 1;
            const maxAttempts = Math.max(1, Number(command.maxAttempts || 3));
            if (nextAttempt <= maxAttempts) {
                const retryCommand = {
                    ...command,
                    attempt: nextAttempt,
                };
                await this.redisService.lpush(common_2.MEMO_WRITE_COMMAND_QUEUE_KEY, JSON.stringify(retryCommand));
                this.logger.warn(`Memo write command retry queued requestId=${command.requestId} attempt=${nextAttempt}/${maxAttempts}: ${errorMessage}`);
            }
            else {
                await this.redisService.lpush(common_2.MEMO_WRITE_DEAD_LETTER_KEY, JSON.stringify({
                    ...command,
                    failedAt: new Date().toISOString(),
                    error: errorMessage,
                }));
                this.logger.error(`Memo write command moved to dead letter requestId=${command.requestId} attempts=${maxAttempts}: ${errorMessage}`);
            }
            await this.publishResult({
                requestId: command.requestId,
                commandType: command.commandType,
                status: 'failed',
                attempt: command.attempt,
                error: errorMessage,
                finishedAt: new Date().toISOString(),
            });
        }
    }
    async executeCommand(command) {
        const payload = command.payload;
        switch (command.commandType) {
            case 'create_memo':
                await this.memoService.createMemo(payload.body, payload.options);
                return;
            case 'update_memo':
                await this.memoService.updateMemo(payload.id, payload.updates, payload.options);
                return;
            case 'delete_memo':
                await this.memoService.deleteMemo(payload.id);
                return;
            case 'upsert_task_todo':
                await this.memoService.upsertTaskTodo(payload.agentId, payload.task || {});
                return;
            case 'update_todo_status':
                await this.memoService.updateTodoStatus(payload.id, payload.status, payload.note, payload.options);
                return;
            case 'complete_task_todo':
                await this.memoService.completeTaskTodo(payload.agentId, payload.taskId, payload.note, payload.status);
                return;
            case 'record_behavior':
                await this.memoService.recordBehavior(payload);
                return;
            default:
                throw new Error(`Unsupported command type: ${command.commandType}`);
        }
    }
    async publishResult(payload) {
        await this.redisService.publish(common_2.MEMO_WRITE_RESULT_CHANNEL, payload);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.MemoWriteCommandConsumerService = MemoWriteCommandConsumerService;
exports.MemoWriteCommandConsumerService = MemoWriteCommandConsumerService = MemoWriteCommandConsumerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService,
        memo_service_1.MemoService])
], MemoWriteCommandConsumerService);
//# sourceMappingURL=memo-write-command-consumer.service.js.map