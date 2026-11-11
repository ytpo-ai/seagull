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
exports.AgentRunSchema = exports.AgentRun = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentRun = class AgentRun {
};
exports.AgentRun = AgentRun;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentRun.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRun.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRun.prototype, "agentName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRun.prototype, "roleCode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['native', 'opencode'], default: 'native' }),
    __metadata("design:type", String)
], AgentRun.prototype, "executionChannel", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentRun.prototype, "executionData", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            state: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
            lastSyncAt: { type: Date, required: false },
            retryCount: { type: Number, default: 0 },
            nextRetryAt: { type: Date, required: false },
            lastError: { type: String, required: false },
            deadLettered: { type: Boolean, default: false },
        },
        default: {
            state: 'pending',
            retryCount: 0,
            deadLettered: false,
        },
    }),
    __metadata("design:type", Object)
], AgentRun.prototype, "sync", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRun.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRun.prototype, "taskId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRun.prototype, "taskTitle", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], AgentRun.prototype, "taskDescription", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentRun.prototype, "currentStep", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused'],
        default: 'pending',
    }),
    __metadata("design:type", String)
], AgentRun.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], AgentRun.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentRun.prototype, "finishedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRun.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], AgentRun.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentRun.prototype, "metadata", void 0);
exports.AgentRun = AgentRun = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_runs' })
], AgentRun);
exports.AgentRunSchema = mongoose_1.SchemaFactory.createForClass(AgentRun);
exports.AgentRunSchema.index({ agentId: 1, createdAt: -1 });
exports.AgentRunSchema.index({ sessionId: 1, createdAt: -1 });
exports.AgentRunSchema.index({ taskId: 1, createdAt: -1 });
exports.AgentRunSchema.index({ status: 1, updatedAt: -1 });
exports.AgentRunSchema.index({ 'sync.state': 1, updatedAt: -1 });
//# sourceMappingURL=agent-run.schema.js.map