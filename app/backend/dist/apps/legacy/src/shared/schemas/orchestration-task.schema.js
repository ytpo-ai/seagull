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
exports.OrchestrationTaskSchema = exports.OrchestrationTask = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let OrchestrationTask = class OrchestrationTask {
};
exports.OrchestrationTask = OrchestrationTask;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "planId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "projectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: false }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "requirementId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "priority", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['pending', 'assigned', 'in_progress', 'blocked', 'waiting_human', 'completed', 'failed', 'cancelled'], default: 'pending' }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], OrchestrationTask.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], OrchestrationTask.prototype, "dependencyTaskIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], OrchestrationTask.prototype, "mergedFromTaskIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: false, index: true }),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "parentTaskId", void 0);
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
], OrchestrationTask.prototype, "taskType", void 0);
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
], OrchestrationTask.prototype, "runtimeTaskType", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        executorType: { type: String, enum: ['agent', 'employee', 'unassigned'], default: 'unassigned' },
        executorId: { type: String },
        reason: { type: String },
    })),
    __metadata("design:type", Object)
], OrchestrationTask.prototype, "assignment", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        summary: { type: String },
        output: { type: String },
        error: { type: String },
    })),
    __metadata("design:type", Object)
], OrchestrationTask.prototype, "result", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationTask.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{
                timestamp: { type: Date, default: Date.now },
                level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
                message: { type: String, required: true },
                metadata: { type: Object },
            }], default: [] }),
    __metadata("design:type", Array)
], OrchestrationTask.prototype, "runLogs", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OrchestrationTask.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OrchestrationTask.prototype, "completedAt", void 0);
exports.OrchestrationTask = OrchestrationTask = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'orchestration_tasks' })
], OrchestrationTask);
exports.OrchestrationTaskSchema = mongoose_1.SchemaFactory.createForClass(OrchestrationTask);
exports.OrchestrationTaskSchema.index({ planId: 1, order: 1 });
exports.OrchestrationTaskSchema.index({ planId: 1, parentTaskId: 1, order: 1 });
exports.OrchestrationTaskSchema.index({ requirementId: 1, status: 1, updatedAt: -1 });
exports.OrchestrationTaskSchema.index({ status: 1 });
exports.OrchestrationTaskSchema.index({ projectId: 1, status: 1 });
//# sourceMappingURL=orchestration-task.schema.js.map