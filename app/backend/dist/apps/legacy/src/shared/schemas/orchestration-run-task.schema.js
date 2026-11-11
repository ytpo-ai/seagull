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
exports.OrchestrationRunTaskSchema = exports.OrchestrationRunTask = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let OrchestrationRunTask = class OrchestrationRunTask {
};
exports.OrchestrationRunTask = OrchestrationRunTask;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "runId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "planId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "sourceTaskId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: false, index: true }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "parentTaskId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], OrchestrationRunTask.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "priority", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['pending', 'assigned', 'in_progress', 'blocked', 'waiting_human', 'completed', 'failed', 'cancelled'], default: 'pending' }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        executorType: { type: String, enum: ['agent', 'employee', 'unassigned'], default: 'unassigned' },
        executorId: { type: String },
        reason: { type: String },
    })),
    __metadata("design:type", Object)
], OrchestrationRunTask.prototype, "assignment", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], OrchestrationRunTask.prototype, "dependencyTaskIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: [
            'research',
            'development.plan',
            'development.exec',
            'development.review',
            'general',
        ],
        default: 'general',
    }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "taskType", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: [
            'research',
            'development.plan',
            'development.exec',
            'development.review',
            'general',
        ],
        required: false,
    }),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "runtimeTaskType", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        summary: { type: String },
        output: { type: String },
        error: { type: String },
    })),
    __metadata("design:type", Object)
], OrchestrationRunTask.prototype, "result", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationRunTask.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{
                timestamp: { type: Date, default: Date.now },
                level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
                message: { type: String, required: true },
                metadata: { type: Object },
            }], default: [] }),
    __metadata("design:type", Array)
], OrchestrationRunTask.prototype, "runLogs", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OrchestrationRunTask.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OrchestrationRunTask.prototype, "completedAt", void 0);
exports.OrchestrationRunTask = OrchestrationRunTask = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'orchestration_run_tasks' })
], OrchestrationRunTask);
exports.OrchestrationRunTaskSchema = mongoose_1.SchemaFactory.createForClass(OrchestrationRunTask);
exports.OrchestrationRunTaskSchema.index({ runId: 1, order: 1 });
exports.OrchestrationRunTaskSchema.index({ planId: 1, runId: 1 });
exports.OrchestrationRunTaskSchema.index({ runId: 1, parentTaskId: 1, order: 1 });
exports.OrchestrationRunTaskSchema.index({ sourceTaskId: 1 });
//# sourceMappingURL=orchestration-run-task.schema.js.map