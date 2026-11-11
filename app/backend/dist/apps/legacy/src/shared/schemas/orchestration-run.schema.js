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
exports.OrchestrationRunSchema = exports.OrchestrationRun = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let OrchestrationRun = class OrchestrationRun {
};
exports.OrchestrationRun = OrchestrationRun;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "planId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "projectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['manual', 'schedule', 'autorun'], required: true }),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "triggerType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "scheduleId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['running', 'completed', 'failed', 'cancelled'], default: 'running' }),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], OrchestrationRun.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], OrchestrationRun.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], OrchestrationRun.prototype, "durationMs", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], OrchestrationRun.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        totalTasks: { type: Number, default: 0 },
        completedTasks: { type: Number, default: 0 },
        failedTasks: { type: Number, default: 0 },
        waitingHumanTasks: { type: Number, default: 0 },
    })),
    __metadata("design:type", Object)
], OrchestrationRun.prototype, "stats", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], OrchestrationRun.prototype, "metadata", void 0);
exports.OrchestrationRun = OrchestrationRun = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'orchestration_runs' })
], OrchestrationRun);
exports.OrchestrationRunSchema = mongoose_1.SchemaFactory.createForClass(OrchestrationRun);
exports.OrchestrationRunSchema.index({ planId: 1, startedAt: -1 });
exports.OrchestrationRunSchema.index({ scheduleId: 1, startedAt: -1 });
exports.OrchestrationRunSchema.index({ status: 1 });
exports.OrchestrationRunSchema.index({ projectId: 1, startedAt: -1 });
//# sourceMappingURL=orchestration-run.schema.js.map