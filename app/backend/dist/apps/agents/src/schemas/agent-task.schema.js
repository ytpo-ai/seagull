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
exports.AgentTaskSchema = exports.AgentTask = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentTask = class AgentTask {
};
exports.AgentTask = AgentTask;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentTask.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTask.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTask.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentTask.prototype, "prompt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentTask.prototype, "sessionContext", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'], default: 'queued' }),
    __metadata("design:type", String)
], AgentTask.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentTask.prototype, "runId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentTask.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentTask.prototype, "serveId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "progress", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AgentTask.prototype, "currentStep", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "attempt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 3 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "maxAttempts", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 120000 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "stepTimeoutMs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1200000 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "taskTimeoutMs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1000 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "retryBaseDelayMs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 5000 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "retryMaxDelayMs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentTask.prototype, "lastAttemptAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentTask.prototype, "nextRetryAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], AgentTask.prototype, "retryEnqueued", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], AgentTask.prototype, "cancelRequested", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentTask.prototype, "idempotencyKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AgentTask.prototype, "errorCode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], AgentTask.prototype, "errorMessage", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentTask.prototype, "resultSummary", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], AgentTask.prototype, "eventCursor", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentTask.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentTask.prototype, "finishedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentTask.prototype, "lastEventAt", void 0);
exports.AgentTask = AgentTask = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_tasks' })
], AgentTask);
exports.AgentTaskSchema = mongoose_1.SchemaFactory.createForClass(AgentTask);
exports.AgentTaskSchema.index({ userId: 1, createdAt: -1 });
exports.AgentTaskSchema.index({ status: 1, updatedAt: -1 });
exports.AgentTaskSchema.index({ idempotencyKey: 1, userId: 1 }, { unique: true, sparse: true });
exports.AgentTaskSchema.index({ status: 1, nextRetryAt: 1, retryEnqueued: 1 });
//# sourceMappingURL=agent-task.schema.js.map