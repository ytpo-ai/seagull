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
exports.OrchestrationPlanSchema = exports.OrchestrationPlan = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let OrchestrationPlan = class OrchestrationPlan {
};
exports.OrchestrationPlan = OrchestrationPlan;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "sourcePrompt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['draft', 'drafting', 'planned', 'production', 'running', 'paused', 'completed', 'failed'],
        default: 'planned',
    }),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        plannerAgentId: { type: String },
        mode: { type: String, enum: ['sequential', 'parallel', 'hybrid'], default: 'sequential' },
        runMode: { type: String, enum: ['once', 'multi'], default: 'multi' },
        executionMode: { type: String, enum: ['standard', 'easy'], default: undefined },
        skillActivation: {
            type: {
                mode: { type: String, enum: ['standard', 'precise'] },
                skillIds: { type: [String], default: [] },
            },
            default: undefined,
        },
    })),
    __metadata("design:type", Object)
], OrchestrationPlan.prototype, "strategy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], OrchestrationPlan.prototype, "taskIds", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "lastRunId", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        totalTasks: { type: Number, default: 0 },
        completedTasks: { type: Number, default: 0 },
        failedTasks: { type: Number, default: 0 },
        waitingHumanTasks: { type: Number, default: 0 },
    })),
    __metadata("design:type", Object)
], OrchestrationPlan.prototype, "stats", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], OrchestrationPlan.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['general', 'development', 'research'], default: 'general', required: true }),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "domainType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['batch', 'incremental'], default: 'incremental' }),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "generationMode", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        maxRetries: { type: Number, default: 3 },
        maxTotalFailures: { type: Number, default: 6 },
        maxCostTokens: { type: Number, default: 500000 },
        maxTasks: { type: Number, default: 15 },
    })),
    __metadata("design:type", Object)
], OrchestrationPlan.prototype, "generationConfig", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], OrchestrationPlan.prototype, "projectId", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        currentStep: { type: Number, default: 0 },
        totalGenerated: { type: Number, default: 0 },
        totalRetries: { type: Number, default: 0 },
        consecutiveFailures: { type: Number, default: 0 },
        totalFailures: { type: Number, default: 0 },
        totalCost: { type: Number, default: 0 },
        isComplete: { type: Boolean, default: false },
        lastError: { type: String },
        currentPhase: { type: String, enum: ['initialize', 'generating', 'pre_execute', 'executing', 'post_execute', 'easy_run', 'idle'], default: 'idle' },
        lastDecision: { type: String, enum: ['generate_next', 'stop', 'redesign', 'retry'] },
        plannerSessionId: { type: String },
        plannerSessionIds: { type: Object },
        currentTaskId: { type: String },
    })),
    __metadata("design:type", Object)
], OrchestrationPlan.prototype, "generationState", void 0);
exports.OrchestrationPlan = OrchestrationPlan = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'orchestration_plans' })
], OrchestrationPlan);
exports.OrchestrationPlanSchema = mongoose_1.SchemaFactory.createForClass(OrchestrationPlan);
exports.OrchestrationPlanSchema.index({ createdAt: -1 });
exports.OrchestrationPlanSchema.index({ status: 1 });
exports.OrchestrationPlanSchema.index({ projectId: 1, createdAt: -1 });
//# sourceMappingURL=orchestration-plan.schema.js.map