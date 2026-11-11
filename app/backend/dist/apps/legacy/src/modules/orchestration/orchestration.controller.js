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
exports.OrchestrationController = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const auth_1 = require("../../../libs/auth/src/index");
const auth_service_1 = require("../auth/auth.service");
const orchestration_service_1 = require("./orchestration.service");
const dto_1 = require("./dto");
const session_manager_service_1 = require("./session-manager.service");
const orchestration_events_1 = require("./orchestration-events");
let OrchestrationController = class OrchestrationController {
    constructor(orchestrationService, sessionManagerService, authService, eventEmitter) {
        this.orchestrationService = orchestrationService;
        this.sessionManagerService = sessionManagerService;
        this.authService = authService;
        this.eventEmitter = eventEmitter;
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
    }
    resolveUserFromInternalContext(encoded, signature) {
        if (!encoded || !signature) {
            return null;
        }
        if (!(0, auth_1.verifyEncodedContext)(encoded, signature, this.contextSecret)) {
            return null;
        }
        const context = (0, auth_1.decodeUserContext)(encoded);
        if (!context?.employeeId) {
            return null;
        }
        if (context.expiresAt <= Date.now()) {
            return null;
        }
        return {
            id: context.employeeId,
        };
    }
    async getUserFromAuthHeader(authHeader, encodedContext, signature, tokenOverride) {
        const internal = this.resolveUserFromInternalContext(encodedContext, signature);
        if (internal) {
            return internal;
        }
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            if (tokenOverride?.trim()) {
                const employee = await this.authService.getEmployeeFromToken(tokenOverride.trim());
                if (employee) {
                    return { id: employee.id };
                }
            }
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        return { id: employee.id };
    }
    async createPlanFromPrompt(dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.createPlanFromPrompt(user.id, dto);
    }
    async streamPlanEvents(planId, authHeader, internalContext, internalSignature, accessToken) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature, accessToken);
        return this.orchestrationService.streamPlanEvents(planId);
    }
    async listPlans(authHeader, internalContext, internalSignature, projectId) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        const filters = projectId !== undefined ? { projectId } : undefined;
        return this.orchestrationService.listPlans(filters);
    }
    async getPlan(planId, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.getPlanById(planId);
    }
    async updatePlan(planId, dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.updatePlan(planId, dto);
    }
    async updatePlanMetadata(planId, patch, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.updatePlanMetadata(planId, patch || {});
    }
    async deletePlan(planId, authHeader) {
        const user = await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.deletePlan(planId);
    }
    async listTasks(planId, authHeader) {
        const user = await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.listTasksByPlan(planId);
    }
    async addTaskToPlan(planId, dto, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.addTaskToPlan(planId, dto);
    }
    async runPlan(planId, dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.runPlanAsync(planId, dto || {});
    }
    async cancelRun(runId, dto, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.cancelRun(runId, dto?.reason);
    }
    async publishPlan(planId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.publishPlan(planId);
    }
    async unlockPlan(planId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.unlockPlan(planId);
    }
    async listPlanRuns(planId, query, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.listPlanRuns(planId, query.limit || 20);
    }
    async getLatestPlanRun(planId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.getLatestPlanRun(planId);
    }
    async getRunDetail(runId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.getRunById(runId);
    }
    async listRunTasks(runId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.listRunTasks(runId);
    }
    async replanPlan(planId, dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.replanPlanAsync(planId, dto);
    }
    async generatePlanNext(planId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.generateNext(planId);
    }
    async stopPlanGeneration(planId, dto, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.stopGeneration(planId, dto?.reason);
    }
    async advancePlan(planId, dto, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        this.eventEmitter.emit(orchestration_events_1.ORCH_EVENTS.ADVANCE_REQUESTED, {
            planId,
            source: 'api',
            targetPhase: dto?.targetPhase,
            metadata: dto?.metadata,
        });
        return { accepted: true };
    }
    async submitPlannerTask(dto, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.submitPlannerTask(dto);
    }
    async reportPlannerTaskRunResult(dto, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.reportPlannerTaskRunResult(dto);
    }
    async reassignTask(taskId, dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.reassignTask(taskId, dto);
    }
    async completeHumanTask(taskId, dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.completeHumanTask(taskId, dto);
    }
    async retryTask(taskId, authHeader) {
        const user = await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.retryTask(taskId);
    }
    async updateTaskDraft(taskId, dto, authHeader) {
        const user = await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.updateTaskDraft(taskId, dto);
    }
    async updateTaskFull(taskId, dto, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.updateTaskFull(taskId, dto);
    }
    async removeTaskFromPlan(taskId, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.removeTaskFromPlan(taskId);
    }
    async reorderPlanTasks(planId, dto, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.reorderPlanTasks(planId, dto);
    }
    async batchUpdateTasks(planId, dto, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.batchUpdateTasks(planId, dto);
    }
    async duplicateTask(planId, taskId, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.orchestrationService.duplicateTask(planId, taskId);
    }
    async debugTaskStep(taskId, dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.orchestrationService.debugTaskStep(taskId, dto);
    }
    async createSession(dto) {
        return this.sessionManagerService.createSession(dto);
    }
    async listSessions(query) {
        return this.sessionManagerService.listSessions(query);
    }
    async getSession(sessionId) {
        return this.sessionManagerService.getSessionOrThrow(sessionId);
    }
    async appendSessionMessage(sessionId, dto) {
        return this.sessionManagerService.appendMessage(sessionId, dto);
    }
    async appendSessionMessages(sessionId, dto) {
        return this.sessionManagerService.appendMessages(sessionId, dto.messages);
    }
    async archiveSession(sessionId, dto) {
        return this.sessionManagerService.archiveSession(sessionId, dto.summary);
    }
    async resumeSession(sessionId) {
        return this.sessionManagerService.resumeSession(sessionId);
    }
};
exports.OrchestrationController = OrchestrationController;
__decorate([
    (0, common_1.Post)('plans/from-prompt'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreatePlanFromPromptDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "createPlanFromPrompt", null);
__decorate([
    (0, common_1.Sse)('plans/:id/events'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __param(4, (0, common_1.Query)('access_token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "streamPlanEvents", null);
__decorate([
    (0, common_1.Get)('plans'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-user-context')),
    __param(2, (0, common_1.Headers)('x-user-signature')),
    __param(3, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Get)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "getPlan", null);
__decorate([
    (0, common_1.Patch)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdatePlanDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Patch)('plans/:id/metadata'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "updatePlanMetadata", null);
__decorate([
    (0, common_1.Delete)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Get)('plans/:id/tasks'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "listTasks", null);
__decorate([
    (0, common_1.Post)('plans/:planId/tasks'),
    __param(0, (0, common_1.Param)('planId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.AddTaskToPlanDto, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "addTaskToPlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/run'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.RunPlanDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "runPlan", null);
__decorate([
    (0, common_1.Post)('runs/:runId/cancel'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CancelRunDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "cancelRun", null);
__decorate([
    (0, common_1.Post)('plans/:id/publish'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "publishPlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/unlock'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "unlockPlan", null);
__decorate([
    (0, common_1.Get)('plans/:id/runs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.RunHistoryQueryDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "listPlanRuns", null);
__decorate([
    (0, common_1.Get)('plans/:id/runs/latest'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "getLatestPlanRun", null);
__decorate([
    (0, common_1.Get)('runs/:runId'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "getRunDetail", null);
__decorate([
    (0, common_1.Get)('runs/:runId/tasks'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "listRunTasks", null);
__decorate([
    (0, common_1.Post)('plans/:id/replan'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ReplanPlanDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "replanPlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/generate-next'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "generatePlanNext", null);
__decorate([
    (0, common_1.Post)('plans/:id/stop-generation'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "stopPlanGeneration", null);
__decorate([
    (0, common_1.Post)('plans/:id/advance'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "advancePlan", null);
__decorate([
    (0, common_1.Post)('planner/submit-task'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PlannerSubmitTaskDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "submitPlannerTask", null);
__decorate([
    (0, common_1.Post)('planner/report-task-run-result'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PlannerReportTaskRunResultDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "reportPlannerTaskRunResult", null);
__decorate([
    (0, common_1.Post)('tasks/:id/reassign'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ReassignTaskDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "reassignTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/complete-human'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CompleteHumanTaskDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "completeHumanTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/retry'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "retryTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/draft'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateTaskDraftDto, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "updateTaskDraft", null);
__decorate([
    (0, common_1.Patch)('tasks/:taskId'),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateTaskFullDto, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "updateTaskFull", null);
__decorate([
    (0, common_1.Delete)('tasks/:taskId'),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "removeTaskFromPlan", null);
__decorate([
    (0, common_1.Put)('plans/:planId/tasks/reorder'),
    __param(0, (0, common_1.Param)('planId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ReorderPlanTasksDto, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "reorderPlanTasks", null);
__decorate([
    (0, common_1.Put)('plans/:planId/tasks/batch-update'),
    __param(0, (0, common_1.Param)('planId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.BatchUpdateTasksDto, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "batchUpdateTasks", null);
__decorate([
    (0, common_1.Post)('plans/:planId/tasks/duplicate/:taskId'),
    __param(0, (0, common_1.Param)('planId')),
    __param(1, (0, common_1.Param)('taskId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "duplicateTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/debug-run'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.DebugTaskStepDto, String, String, String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "debugTaskStep", null);
__decorate([
    (0, common_1.Post)('sessions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateSessionDto]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SessionQueryDto]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "getSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SessionMessageDto]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "appendSessionMessage", null);
__decorate([
    (0, common_1.Post)('sessions/:id/messages/batch'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.BatchAppendMessagesDto]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "appendSessionMessages", null);
__decorate([
    (0, common_1.Post)('sessions/:id/archive'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ArchiveSessionDto]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "archiveSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/resume'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrchestrationController.prototype, "resumeSession", null);
exports.OrchestrationController = OrchestrationController = __decorate([
    (0, common_1.Controller)('orchestration'),
    __metadata("design:paramtypes", [orchestration_service_1.OrchestrationService,
        session_manager_service_1.SessionManagerService,
        auth_service_1.AuthService,
        event_emitter_1.EventEmitter2])
], OrchestrationController);
//# sourceMappingURL=orchestration.controller.js.map