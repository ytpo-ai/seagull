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
exports.OrchestrationService = void 0;
const common_1 = require("@nestjs/common");
const plan_management_service_1 = require("./services/plan-management.service");
const task_management_service_1 = require("./services/task-management.service");
const plan_execution_service_1 = require("./services/plan-execution.service");
const task_lifecycle_service_1 = require("./services/task-lifecycle.service");
const plan_stats_service_1 = require("./services/plan-stats.service");
const plan_event_stream_service_1 = require("./services/plan-event-stream.service");
const orchestration_context_service_1 = require("./services/orchestration-context.service");
const incremental_planning_service_1 = require("./services/incremental-planning.service");
let OrchestrationService = class OrchestrationService {
    constructor(planManagementService, taskManagementService, planExecutionService, taskLifecycleService, planStatsService, planEventStreamService, orchestrationContextService, incrementalPlanningService) {
        this.planManagementService = planManagementService;
        this.taskManagementService = taskManagementService;
        this.planExecutionService = planExecutionService;
        this.taskLifecycleService = taskLifecycleService;
        this.planStatsService = planStatsService;
        this.planEventStreamService = planEventStreamService;
        this.orchestrationContextService = orchestrationContextService;
        this.incrementalPlanningService = incrementalPlanningService;
    }
    async createPlanFromPrompt(createdBy, dto) {
        return this.planManagementService.createPlanFromPrompt(createdBy, dto);
    }
    async streamPlanEvents(planId) {
        return this.planEventStreamService.streamPlanEvents(planId);
    }
    async listPlans(filters) {
        return this.planManagementService.listPlans(filters);
    }
    async replanPlan(planId, dto) {
        return this.planManagementService.replanPlan(planId, dto);
    }
    async replanPlanAsync(planId, dto) {
        return this.planManagementService.replanPlanAsync(planId, dto);
    }
    async startGeneration(planId) {
        return this.planManagementService.startGeneration(planId);
    }
    async generateNext(planId) {
        return this.planManagementService.generateNext(planId);
    }
    async stopGeneration(planId, reason) {
        return this.planManagementService.stopGeneration(planId, reason);
    }
    async updatePlan(planId, dto) {
        return this.planManagementService.updatePlan(planId, dto);
    }
    async updatePlanMetadata(planId, patch) {
        return this.planManagementService.updatePlanMetadata(planId, patch);
    }
    async deletePlan(planId) {
        return this.planManagementService.deletePlan(planId);
    }
    async getPlanById(planId) {
        return this.planManagementService.getPlanById(planId);
    }
    async listTasksByPlan(planId) {
        return this.taskManagementService.listTasksByPlan(planId);
    }
    async listPlanRuns(planId, limit = 20) {
        return this.planExecutionService.listPlanRuns(planId, limit);
    }
    async getLatestPlanRun(planId) {
        return this.planExecutionService.getLatestPlanRun(planId);
    }
    async getRunById(runId) {
        return this.planExecutionService.getRunById(runId);
    }
    async listRunTasks(runId) {
        return this.planExecutionService.listRunTasks(runId);
    }
    async addTaskToPlan(planId, dto) {
        return this.taskManagementService.addTaskToPlan(planId, dto);
    }
    async removeTaskFromPlan(taskId) {
        return this.taskManagementService.removeTaskFromPlan(taskId);
    }
    async updateTaskFull(taskId, dto) {
        return this.taskManagementService.updateTaskFull(taskId, dto);
    }
    async reorderPlanTasks(planId, dto) {
        return this.taskManagementService.reorderPlanTasks(planId, dto);
    }
    async batchUpdateTasks(planId, dto) {
        return this.taskManagementService.batchUpdateTasks(planId, dto);
    }
    async duplicateTask(planId, sourceTaskId) {
        return this.taskManagementService.duplicateTask(planId, sourceTaskId);
    }
    async runPlan(planId, dto) {
        return this.planExecutionService.runPlan(planId, dto);
    }
    async runPlanAsync(planId, dto) {
        return this.planExecutionService.runPlanAsync(planId, dto);
    }
    async cancelRun(runId, reason) {
        return this.planExecutionService.cancelRun(runId, reason);
    }
    async publishPlan(planId) {
        return this.planManagementService.publishPlan(planId);
    }
    async unlockPlan(planId) {
        return this.planManagementService.unlockPlan(planId);
    }
    async executePlanRun(planId, triggerType, options) {
        return this.planExecutionService.executePlanRun(planId, triggerType, options);
    }
    async reassignTask(taskId, dto) {
        return this.taskLifecycleService.reassignTask(taskId, dto);
    }
    async completeHumanTask(taskId, dto) {
        return this.taskLifecycleService.completeHumanTask(taskId, dto);
    }
    async retryTask(taskId) {
        return this.taskLifecycleService.retryTask(taskId);
    }
    async updateTaskDraft(taskId, dto) {
        return this.taskManagementService.updateTaskDraft(taskId, dto);
    }
    async debugTaskStep(taskId, dto) {
        return this.taskLifecycleService.debugTaskStep(taskId, dto);
    }
    async executeStandaloneTask(taskId) {
        return this.taskLifecycleService.executeStandaloneTask(taskId);
    }
    async submitPlannerTask(dto) {
        return this.incrementalPlanningService.submitPlannerTaskFromTool(dto);
    }
    async reportPlannerTaskRunResult(dto) {
        return this.incrementalPlanningService.reportTaskRunResultFromTool(dto);
    }
};
exports.OrchestrationService = OrchestrationService;
exports.OrchestrationService = OrchestrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plan_management_service_1.PlanManagementService,
        task_management_service_1.TaskManagementService,
        plan_execution_service_1.PlanExecutionService,
        task_lifecycle_service_1.TaskLifecycleService,
        plan_stats_service_1.PlanStatsService,
        plan_event_stream_service_1.PlanEventStreamService,
        orchestration_context_service_1.OrchestrationContextService,
        incremental_planning_service_1.IncrementalPlanningService])
], OrchestrationService);
//# sourceMappingURL=orchestration.service.js.map