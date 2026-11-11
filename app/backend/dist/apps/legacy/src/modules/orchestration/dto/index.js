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
exports.BatchAppendMessagesDto = exports.ArchiveSessionDto = exports.SessionQueryDto = exports.SessionMessageDto = exports.CreateSessionDto = exports.DebugTaskStepDto = exports.RunHistoryQueryDto = exports.BatchUpdateTasksDto = exports.BatchUpdateTaskItemDto = exports.ReorderPlanTasksDto = exports.UpdateTaskFullDto = exports.AddTaskToPlanDto = exports.TaskAssignmentDto = exports.UpdateTaskDraftDto = exports.PlannerReportTaskRunResultDto = exports.PlannerSubmitTaskDto = exports.CompleteHumanTaskDto = exports.ReassignTaskDto = exports.UpdatePlanDto = exports.ReplanPlanDto = exports.CancelRunDto = exports.RunPlanDto = exports.CreatePlanFromPromptDto = exports.SkillActivationDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class SkillActivationDto {
}
exports.SkillActivationDto = SkillActivationDto;
__decorate([
    (0, class_validator_1.IsEnum)(['standard', 'precise']),
    __metadata("design:type", String)
], SkillActivationDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SkillActivationDto.prototype, "skillIds", void 0);
class CreatePlanFromPromptDto {
    constructor() {
        this.domainType = 'general';
    }
}
exports.CreatePlanFromPromptDto = CreatePlanFromPromptDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "plannerAgentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['sequential', 'parallel', 'hybrid']),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['once', 'multi']),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "runMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePlanFromPromptDto.prototype, "autoRun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePlanFromPromptDto.prototype, "autoGenerate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "requirementId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['general', 'development', 'research']),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "domainType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['standard', 'easy']),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "executionMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlanFromPromptDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SkillActivationDto),
    __metadata("design:type", SkillActivationDto)
], CreatePlanFromPromptDto.prototype, "skillActivation", void 0);
class RunPlanDto {
}
exports.RunPlanDto = RunPlanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RunPlanDto.prototype, "continueOnFailure", void 0);
class CancelRunDto {
}
exports.CancelRunDto = CancelRunDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CancelRunDto.prototype, "reason", void 0);
class ReplanPlanDto {
}
exports.ReplanPlanDto = ReplanPlanDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], ReplanPlanDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ReplanPlanDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReplanPlanDto.prototype, "plannerAgentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['sequential', 'parallel', 'hybrid']),
    __metadata("design:type", String)
], ReplanPlanDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['once', 'multi']),
    __metadata("design:type", String)
], ReplanPlanDto.prototype, "runMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReplanPlanDto.prototype, "autoRun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ReplanPlanDto.prototype, "autoGenerate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['general', 'development', 'research']),
    __metadata("design:type", String)
], ReplanPlanDto.prototype, "domainType", void 0);
class UpdatePlanDto {
}
exports.UpdatePlanDto = UpdatePlanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "sourcePrompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['sequential', 'parallel', 'hybrid']),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['once', 'multi']),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "runMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "plannerAgentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdatePlanDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['general', 'development', 'research']),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "domainType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "projectId", void 0);
class ReassignTaskDto {
}
exports.ReassignTaskDto = ReassignTaskDto;
__decorate([
    (0, class_validator_1.IsEnum)(['agent', 'employee', 'unassigned']),
    __metadata("design:type", String)
], ReassignTaskDto.prototype, "executorType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReassignTaskDto.prototype, "executorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReassignTaskDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReassignTaskDto.prototype, "sourceAgentId", void 0);
class CompleteHumanTaskDto {
}
exports.CompleteHumanTaskDto = CompleteHumanTaskDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteHumanTaskDto.prototype, "summary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CompleteHumanTaskDto.prototype, "output", void 0);
class PlannerSubmitTaskDto {
}
exports.PlannerSubmitTaskDto = PlannerSubmitTaskDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "planId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['new', 'redesign']),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['low', 'medium', 'high', 'urgent']),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['research', 'development.plan', 'development.exec', 'development.review', 'general']),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "taskType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "agentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "executorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PlannerSubmitTaskDto.prototype, "requiredTools", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "reasoning", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerSubmitTaskDto.prototype, "redesignTaskId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PlannerSubmitTaskDto.prototype, "isGoalReached", void 0);
class PlannerReportTaskRunResultDto {
}
exports.PlannerReportTaskRunResultDto = PlannerReportTaskRunResultDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerReportTaskRunResultDto.prototype, "planId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['generate_next', 'stop', 'redesign', 'retry']),
    __metadata("design:type", String)
], PlannerReportTaskRunResultDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerReportTaskRunResultDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlannerReportTaskRunResultDto.prototype, "redesignTaskId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PlannerReportTaskRunResultDto.prototype, "nextTaskHints", void 0);
class UpdateTaskDraftDto {
}
exports.UpdateTaskDraftDto = UpdateTaskDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateTaskDraftDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateTaskDraftDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)([
        'research',
        'development.plan',
        'development.exec',
        'development.review',
        'general',
        'auto',
    ]),
    __metadata("design:type", String)
], UpdateTaskDraftDto.prototype, "runtimeTaskType", void 0);
class TaskAssignmentDto {
}
exports.TaskAssignmentDto = TaskAssignmentDto;
__decorate([
    (0, class_validator_1.IsEnum)(['agent', 'employee', 'unassigned']),
    __metadata("design:type", String)
], TaskAssignmentDto.prototype, "executorType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TaskAssignmentDto.prototype, "executorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TaskAssignmentDto.prototype, "reason", void 0);
class AddTaskToPlanDto {
}
exports.AddTaskToPlanDto = AddTaskToPlanDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AddTaskToPlanDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], AddTaskToPlanDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['low', 'medium', 'high', 'urgent']),
    __metadata("design:type", String)
], AddTaskToPlanDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddTaskToPlanDto.prototype, "insertAfterTaskId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AddTaskToPlanDto.prototype, "dependencyTaskIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TaskAssignmentDto),
    __metadata("design:type", TaskAssignmentDto)
], AddTaskToPlanDto.prototype, "assignment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddTaskToPlanDto.prototype, "parentTaskId", void 0);
class UpdateTaskFullDto {
}
exports.UpdateTaskFullDto = UpdateTaskFullDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateTaskFullDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateTaskFullDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['low', 'medium', 'high', 'urgent']),
    __metadata("design:type", String)
], UpdateTaskFullDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateTaskFullDto.prototype, "dependencyTaskIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TaskAssignmentDto),
    __metadata("design:type", TaskAssignmentDto)
], UpdateTaskFullDto.prototype, "assignment", void 0);
class ReorderPlanTasksDto {
}
exports.ReorderPlanTasksDto = ReorderPlanTasksDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ReorderPlanTasksDto.prototype, "taskIds", void 0);
class BatchUpdateTaskItemDto extends UpdateTaskFullDto {
}
exports.BatchUpdateTaskItemDto = BatchUpdateTaskItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BatchUpdateTaskItemDto.prototype, "taskId", void 0);
class BatchUpdateTasksDto {
}
exports.BatchUpdateTasksDto = BatchUpdateTasksDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BatchUpdateTaskItemDto),
    __metadata("design:type", Array)
], BatchUpdateTasksDto.prototype, "updates", void 0);
class RunHistoryQueryDto {
}
exports.RunHistoryQueryDto = RunHistoryQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RunHistoryQueryDto.prototype, "limit", void 0);
class DebugTaskStepDto extends UpdateTaskDraftDto {
}
exports.DebugTaskStepDto = DebugTaskStepDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DebugTaskStepDto.prototype, "resetResult", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)([
        'research',
        'development.plan',
        'development.exec',
        'development.review',
        'general',
    ]),
    __metadata("design:type", String)
], DebugTaskStepDto.prototype, "runtimeTaskTypeOverride", void 0);
class CreateSessionDto {
}
exports.CreateSessionDto = CreateSessionDto;
__decorate([
    (0, class_validator_1.IsEnum)(['agent', 'employee', 'system']),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "ownerType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "ownerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "linkedPlanId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "linkedTaskId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateSessionDto.prototype, "tags", void 0);
class SessionMessageDto {
}
exports.SessionMessageDto = SessionMessageDto;
__decorate([
    (0, class_validator_1.IsEnum)(['user', 'assistant', 'system']),
    __metadata("design:type", String)
], SessionMessageDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(12000),
    __metadata("design:type", String)
], SessionMessageDto.prototype, "content", void 0);
class SessionQueryDto {
}
exports.SessionQueryDto = SessionQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['agent', 'employee', 'system']),
    __metadata("design:type", String)
], SessionQueryDto.prototype, "ownerType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['active', 'archived', 'closed']),
    __metadata("design:type", String)
], SessionQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SessionQueryDto.prototype, "ownerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SessionQueryDto.prototype, "linkedPlanId", void 0);
class ArchiveSessionDto {
}
exports.ArchiveSessionDto = ArchiveSessionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ArchiveSessionDto.prototype, "summary", void 0);
class BatchAppendMessagesDto {
}
exports.BatchAppendMessagesDto = BatchAppendMessagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SessionMessageDto),
    __metadata("design:type", Array)
], BatchAppendMessagesDto.prototype, "messages", void 0);
//# sourceMappingURL=index.js.map