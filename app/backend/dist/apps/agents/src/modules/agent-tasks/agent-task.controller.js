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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTaskController = void 0;
const common_1 = require("@nestjs/common");
const agent_task_service_1 = require("./agent-task.service");
const agent_task_contract_1 = require("./contracts/agent-task.contract");
const runtime_sse_stream_service_1 = require("./runtime-sse-stream.service");
let AgentTaskController = class AgentTaskController {
    constructor(taskService, sseStreamService) {
        this.taskService = taskService;
        this.sseStreamService = sseStreamService;
    }
    getUserContext(req) {
        const context = req.userContext;
        if (!context?.employeeId) {
            throw new common_1.ForbiddenException('Missing user context');
        }
        return context;
    }
    async createTask(rawBody, req) {
        const body = agent_task_contract_1.CreateAgentTaskBodySchema.parse(rawBody || {});
        const context = this.getUserContext(req);
        return this.taskService.createTask(body, context);
    }
    async getTask(taskId, req) {
        const context = this.getUserContext(req);
        const task = await this.taskService.getTask(taskId, context);
        return {
            taskId: task.id,
            runId: task.runId,
            status: task.status,
            progress: task.progress || 0,
            currentStep: task.currentStep,
            error: task.errorMessage,
            resultSummary: task.resultSummary,
            attempt: task.attempt || 0,
            maxAttempts: task.maxAttempts,
            nextRetryAt: task.nextRetryAt,
            lastAttemptAt: task.lastAttemptAt,
            stepTimeoutMs: task.stepTimeoutMs,
            taskTimeoutMs: task.taskTimeoutMs,
            lastEventAt: task.lastEventAt,
            startedAt: task.startedAt,
            finishedAt: task.finishedAt,
            cancelRequested: Boolean(task.cancelRequested),
            serveId: task.serveId,
        };
    }
    async cancelTask(taskId, rawBody, req) {
        const body = agent_task_contract_1.CancelAgentTaskBodySchema.parse(rawBody || {});
        const context = this.getUserContext(req);
        return this.taskService.cancelTask(taskId, context, body.reason);
    }
    streamTaskEvents(taskId, lastEventId, lastSequence, req) {
        return this.createTaskEventStream(taskId, lastEventId, lastSequence, req);
    }
    async createTaskEventStream(taskId, queryLastEventId, queryLastSequence, req) {
        const context = this.getUserContext(req);
        const task = await this.taskService.getTask(taskId, context);
        const header = req.headers['last-event-id'];
        const headerLastEventId = Array.isArray(header) ? header[0] : header;
        const lastEventId = queryLastEventId || headerLastEventId;
        const replayFromEventId = String(lastEventId || '').trim() || undefined;
        const parsedLastSequence = Number(queryLastSequence);
        const replaySequence = Number.isFinite(parsedLastSequence) && parsedLastSequence >= 0 ? parsedLastSequence : undefined;
        const effectiveLastSequence = await this.taskService.resolveLastSequence(task.id, replaySequence, replayFromEventId);
        const replay = await this.taskService.getReplayEvents(task, {
            lastSequence: effectiveLastSequence,
            lastEventId: effectiveLastSequence > 0 ? undefined : replayFromEventId,
        });
        return this.sseStreamService.createTaskSseStream({
            taskId: task.id,
            replay,
        });
    }
};
exports.AgentTaskController = AgentTaskController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AgentTaskController.prototype, "createTask", null);
__decorate([
    (0, common_1.Get)(':taskId'),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentTaskController.prototype, "getTask", null);
__decorate([
    (0, common_1.Post)(':taskId/cancel'),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AgentTaskController.prototype, "cancelTask", null);
__decorate([
    (0, common_1.Sse)(':taskId/events'),
    (0, common_1.Header)('Cache-Control', 'no-cache, no-transform'),
    (0, common_1.Header)('Connection', 'keep-alive'),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Query)('lastEventId')),
    __param(2, (0, common_1.Query)('lastSequence')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], AgentTaskController.prototype, "streamTaskEvents", null);
exports.AgentTaskController = AgentTaskController = __decorate([
    (0, common_1.Controller)('agents/tasks'),
    __metadata("design:paramtypes", [agent_task_service_1.AgentTaskService,
        runtime_sse_stream_service_1.RuntimeSseStreamService])
], AgentTaskController);
//# sourceMappingURL=agent-task.controller.js.map