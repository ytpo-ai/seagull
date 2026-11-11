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
var AgentTaskService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTaskService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const events_1 = require("events");
const uuid_1 = require("uuid");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_task_schema_1 = require("../../schemas/agent-task.schema");
const runtime_persistence_service_1 = require("../runtime/runtime-persistence.service");
const runtime_orchestrator_service_1 = require("../runtime/runtime-orchestrator.service");
const hook_pipeline_service_1 = require("../runtime/hooks/hook-pipeline.service");
const agent_task_contract_1 = require("./contracts/agent-task.contract");
const runtime_sse_stream_service_1 = require("./runtime-sse-stream.service");
const agent_task_runtime_status_util_1 = require("./agent-task-runtime-status.util");
let AgentTaskService = AgentTaskService_1 = class AgentTaskService {
    constructor(taskModel, runtimePersistence, runtimeOrchestrator, redisService, sseStreamService, hookPipeline) {
        this.taskModel = taskModel;
        this.runtimePersistence = runtimePersistence;
        this.runtimeOrchestrator = runtimeOrchestrator;
        this.redisService = redisService;
        this.sseStreamService = sseStreamService;
        this.hookPipeline = hookPipeline;
        this.logger = new common_1.Logger(AgentTaskService_1.name);
        this.queueKey = String(process.env.AGENT_TASK_QUEUE_KEY || 'agent-task:queue').trim();
        this.cancelEmitter = new events_1.EventEmitter();
        this.defaultMaxAttempts = Math.max(1, Number(process.env.AGENT_TASK_MAX_ATTEMPTS || 3));
        this.defaultStepTimeoutMs = Math.max(1000, Number(process.env.AGENT_TASK_STEP_TIMEOUT_MS || 120000));
        this.defaultTaskTimeoutMs = Math.max(1000, Number(process.env.AGENT_TASK_TIMEOUT_MS || 1200000));
        this.defaultRetryBaseDelayMs = Math.max(100, Number(process.env.AGENT_TASK_RETRY_BASE_DELAY_MS || 1000));
        this.defaultRetryMaxDelayMs = Math.max(this.defaultRetryBaseDelayMs, Number(process.env.AGENT_TASK_RETRY_MAX_DELAY_MS || 5000));
    }
    async createTask(body, userContext) {
        const userId = String(userContext.employeeId || '').trim();
        if (!userId) {
            throw new common_1.NotFoundException('Missing employeeId in user context');
        }
        const idempotencyKey = body.idempotencyKey?.trim();
        if (idempotencyKey) {
            const existing = await this.taskModel.findOne({ userId, idempotencyKey }).exec();
            if (existing) {
                return {
                    taskId: existing.id,
                    runId: existing.runId,
                    status: existing.status,
                };
            }
        }
        const taskId = `task-${(0, uuid_1.v4)()}`;
        const created = await this.taskModel.create({
            id: taskId,
            userId,
            agentId: body.agentId,
            prompt: body.task,
            sessionContext: body.sessionContext || {},
            status: 'queued',
            progress: 0,
            attempt: 0,
            maxAttempts: this.defaultMaxAttempts,
            stepTimeoutMs: this.defaultStepTimeoutMs,
            taskTimeoutMs: this.defaultTaskTimeoutMs,
            retryBaseDelayMs: this.defaultRetryBaseDelayMs,
            retryMaxDelayMs: this.defaultRetryMaxDelayMs,
            retryEnqueued: true,
            cancelRequested: false,
            idempotencyKey,
            eventCursor: 0,
            lastEventAt: new Date(),
        });
        await this.publishTaskEvent({
            id: `evt-${(0, uuid_1.v4)()}`,
            type: 'status',
            taskId,
            sequence: 1,
            timestamp: new Date().toISOString(),
            payload: {
                status: 'queued',
            },
        });
        await this.redisService.lpush(this.queueKey, JSON.stringify({ taskId: created.id }));
        void this.runTaskPipeline('task.created', {
            taskId: created.id,
            agentId: body.agentId,
            payload: { task: { id: created.id, prompt: body.task, agentId: body.agentId, status: 'queued' } },
        });
        return {
            taskId: created.id,
            status: created.status,
        };
    }
    async getTask(taskId, userContext) {
        const task = await this.taskModel.findOne({ id: taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        this.assertTaskPermission(task, userContext);
        return task;
    }
    async cancelTask(taskId, userContext, reason) {
        const task = await this.getTask(taskId, userContext);
        if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled') {
            return {
                success: true,
                taskId: task.id,
                cancelRequested: Boolean(task.cancelRequested),
            };
        }
        task.cancelRequested = true;
        task.errorMessage = reason || task.errorMessage;
        await task.save();
        this.cancelEmitter.emit(`cancel:${task.id}`);
        if (task.runId) {
            await this.runtimeOrchestrator.cancelRunWithActor(task.runId, {
                actorId: String(userContext.employeeId || 'unknown'),
                actorType: 'employee',
                reason: reason || 'task_cancel_requested',
            });
        }
        await this.publishTaskEvent({
            id: `evt-${(0, uuid_1.v4)()}`,
            type: 'status',
            taskId: task.id,
            runId: task.runId,
            sequence: (task.eventCursor || 0) + 1,
            timestamp: new Date().toISOString(),
            payload: {
                status: 'cancelling',
                cancelRequested: true,
            },
        });
        void this.runTaskPipeline('task.cancelled', {
            taskId: task.id,
            agentId: task.agentId,
            runId: task.runId,
            sessionId: task.sessionId,
            payload: { task: { id: task.id, agentId: task.agentId }, reason: reason || 'user_cancel' },
        });
        return {
            success: true,
            taskId: task.id,
            cancelRequested: true,
        };
    }
    async getReplayEvents(task, options) {
        const lastSequence = await this.resolveLastSequence(task.id, options?.lastSequence, options?.lastEventId);
        if (!task.runId) {
            return [];
        }
        const runtimeEvents = await this.runtimePersistence.findEventsByRun(task.runId, {
            fromSequence: lastSequence + 1,
            limit: 500,
        });
        return runtimeEvents.map((event) => this.mapRuntimeEventToTaskEvent(task.id, event));
    }
    async updateTaskState(input) {
        const task = await this.taskModel.findOne({ id: input.taskId }).exec();
        if (!task) {
            throw new common_1.NotFoundException('Task not found');
        }
        if (input.status)
            task.status = input.status;
        if (input.runId)
            task.runId = input.runId;
        if (input.sessionId)
            task.sessionId = input.sessionId;
        if (input.serveId)
            task.serveId = input.serveId;
        if (input.progress !== undefined)
            task.progress = input.progress;
        if (input.attempt !== undefined)
            task.attempt = input.attempt;
        if (input.maxAttempts !== undefined)
            task.maxAttempts = input.maxAttempts;
        if (input.stepTimeoutMs !== undefined)
            task.stepTimeoutMs = input.stepTimeoutMs;
        if (input.taskTimeoutMs !== undefined)
            task.taskTimeoutMs = input.taskTimeoutMs;
        if (input.retryBaseDelayMs !== undefined)
            task.retryBaseDelayMs = input.retryBaseDelayMs;
        if (input.retryMaxDelayMs !== undefined)
            task.retryMaxDelayMs = input.retryMaxDelayMs;
        if (input.nextRetryAt !== undefined)
            task.nextRetryAt = input.nextRetryAt;
        if (input.lastAttemptAt !== undefined)
            task.lastAttemptAt = input.lastAttemptAt;
        if (input.retryEnqueued !== undefined)
            task.retryEnqueued = input.retryEnqueued;
        if (input.currentStep !== undefined)
            task.currentStep = input.currentStep;
        if (input.errorCode !== undefined)
            task.errorCode = input.errorCode;
        if (input.errorMessage !== undefined)
            task.errorMessage = input.errorMessage;
        if (input.resultSummary !== undefined)
            task.resultSummary = input.resultSummary;
        if (input.startedAt)
            task.startedAt = input.startedAt;
        if (input.finishedAt)
            task.finishedAt = input.finishedAt;
        task.lastEventAt = new Date();
        await task.save();
        return task;
    }
    async popQueuedTaskId(timeoutSeconds = 2) {
        const payload = await this.redisService.brpop(this.queueKey, timeoutSeconds);
        if (!payload) {
            return null;
        }
        try {
            const parsed = JSON.parse(payload);
            const taskId = String(parsed?.taskId || '').trim();
            return taskId || null;
        }
        catch {
            return null;
        }
    }
    async getTaskById(taskId) {
        return this.taskModel.findOne({ id: taskId }).exec();
    }
    async scheduleRetry(taskId) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            return { scheduled: false };
        }
        const attempt = Number(task.attempt || 0);
        const maxAttempts = Math.max(1, Number(task.maxAttempts || this.defaultMaxAttempts));
        if (attempt >= maxAttempts) {
            return { scheduled: false, attempt };
        }
        const base = Math.max(100, Number(task.retryBaseDelayMs || this.defaultRetryBaseDelayMs));
        const max = Math.max(base, Number(task.retryMaxDelayMs || this.defaultRetryMaxDelayMs));
        const expDelay = Math.min(max, Math.floor(base * Math.pow(2, Math.max(0, attempt - 1))));
        const jitter = Math.floor(Math.random() * Math.max(100, Math.floor(expDelay * 0.3)));
        const delayMs = expDelay + jitter;
        const nextRetryAt = new Date(Date.now() + delayMs);
        await this.updateTaskState({
            taskId,
            status: 'queued',
            nextRetryAt,
            retryEnqueued: false,
            currentStep: 'retry_scheduled',
        });
        return {
            scheduled: true,
            delayMs,
            nextRetryAt,
            attempt,
        };
    }
    async enqueueRetry(taskId) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            return false;
        }
        if (task.status !== 'queued' || task.retryEnqueued) {
            return false;
        }
        await this.redisService.lpush(this.queueKey, JSON.stringify({ taskId: task.id }));
        await this.updateTaskState({
            taskId: task.id,
            retryEnqueued: true,
            nextRetryAt: undefined,
        });
        return true;
    }
    async listDueRetries(limit = 20) {
        return this.taskModel
            .find({
            status: 'queued',
            retryEnqueued: false,
            nextRetryAt: { $lte: new Date() },
        })
            .sort({ nextRetryAt: 1 })
            .limit(limit)
            .exec();
    }
    async publishTaskEvent(event) {
        const parsed = agent_task_contract_1.AgentTaskEventSchema.parse(event);
        const task = await this.taskModel.findOne({ id: parsed.taskId }).exec();
        if (!task) {
            return;
        }
        const nextSequence = parsed.sequence > 0 ? parsed.sequence : (task.eventCursor || 0) + 1;
        task.eventCursor = nextSequence;
        task.lastEventAt = new Date(parsed.timestamp);
        await task.save();
        const normalized = {
            ...parsed,
            sequence: nextSequence,
        };
        const channel = this.sseStreamService.buildTaskChannel(parsed.taskId);
        await this.redisService.publish(channel, JSON.stringify(normalized));
    }
    async markAgentTaskToolIdle(agentId, taskId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId || !this.redisService.isReady()) {
            return;
        }
        const payload = (0, agent_task_runtime_status_util_1.buildIdleAgentRuntimeStatus)(normalizedAgentId, taskId);
        await this.redisService.set((0, agent_task_runtime_status_util_1.buildAgentRuntimeStatusKey)(normalizedAgentId), JSON.stringify(payload), agent_task_runtime_status_util_1.AGENT_TASK_RUNTIME_STATUS_TTL_SECONDS);
        await this.redisService.sadd(agent_task_runtime_status_util_1.AGENT_TASK_RUNTIME_STATUS_INDEX_KEY, [normalizedAgentId]);
    }
    mapRuntimeEventToTaskEvent(taskId, event) {
        const eventType = String(event?.eventType || '').toLowerCase();
        const mappedType = eventType.includes('llm.delta')
            ? 'token'
            : eventType.includes('tool.')
                ? 'tool'
                : eventType.includes('failed')
                    ? 'error'
                    : eventType.includes('completed')
                        ? 'result'
                        : eventType.includes('step')
                            ? 'progress'
                            : 'status';
        return {
            id: String(event.eventId || `evt-${(0, uuid_1.v4)()}`),
            type: mappedType,
            taskId,
            runId: event.runId,
            sequence: Number(event.sequence || 0),
            timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : new Date(event.timestamp || Date.now()).toISOString(),
            payload: event.payload || {},
        };
    }
    async resolveLastSequenceFromEventId(taskId, lastEventId) {
        if (!lastEventId) {
            return 0;
        }
        const task = await this.taskModel.findOne({ id: taskId }).exec();
        if (!task?.runId) {
            return 0;
        }
        const exact = await this.runtimePersistence.findEventByEventId(lastEventId);
        if (!exact || exact.runId !== task.runId) {
            return 0;
        }
        return Number(exact.sequence || 0);
    }
    async resolveLastSequence(taskId, lastSequence, lastEventId) {
        if (typeof lastSequence === 'number' && Number.isFinite(lastSequence) && lastSequence >= 0) {
            return Math.floor(lastSequence);
        }
        return this.resolveLastSequenceFromEventId(taskId, lastEventId);
    }
    async runTaskPipeline(phase, input) {
        try {
            const context = {
                phase,
                runId: input.runId || '',
                agentId: input.agentId,
                taskId: input.taskId,
                sessionId: input.sessionId,
                traceId: input.traceId || `trace-task-${input.taskId}`,
                timestamp: Date.now(),
                payload: input.payload,
            };
            await this.hookPipeline.run(context);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`[task_pipeline_error] phase=${phase} taskId=${input.taskId} error=${message}`);
        }
    }
    assertTaskPermission(task, userContext) {
        const actorId = String(userContext.employeeId || '').trim();
        const role = String(userContext.role || '').trim().toLowerCase();
        if (role === 'system' || role === 'admin' || role === 'owner') {
            return;
        }
        if (!actorId || task.userId !== actorId) {
            throw new common_1.NotFoundException('Task not found');
        }
    }
};
exports.AgentTaskService = AgentTaskService;
exports.AgentTaskService = AgentTaskService = AgentTaskService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_task_schema_1.AgentTask.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        runtime_persistence_service_1.RuntimePersistenceService,
        runtime_orchestrator_service_1.RuntimeOrchestratorService,
        infra_1.RedisService,
        runtime_sse_stream_service_1.RuntimeSseStreamService,
        hook_pipeline_service_1.HookPipelineService])
], AgentTaskService);
//# sourceMappingURL=agent-task.service.js.map