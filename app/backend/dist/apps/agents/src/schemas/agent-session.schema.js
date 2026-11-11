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
exports.AgentSessionSchema = exports.AgentSession = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentSession = class AgentSession {
};
exports.AgentSession = AgentSession;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentSession.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['meeting', 'task', 'plan', 'chat'], required: true }),
    __metadata("design:type", String)
], AgentSession.prototype, "sessionType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['agent', 'employee', 'system'], default: 'agent' }),
    __metadata("design:type", String)
], AgentSession.prototype, "ownerType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentSession.prototype, "ownerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentSession.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'archived', 'closed'], default: 'active' }),
    __metadata("design:type", String)
], AgentSession.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentSession.prototype, "runIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentSession.prototype, "memoIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentSession.prototype, "messageIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                id: { type: String, required: true },
                content: { type: String, required: true },
                metadata: { type: Object },
            }],
        default: undefined,
    }),
    __metadata("design:type", Array)
], AgentSession.prototype, "initialSystemMessages", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        linkedPlanId: { type: String },
        orchestrationRunId: { type: String },
        currentTaskId: { type: String },
        completedTaskIds: [{ type: String }],
        linkedTaskId: { type: String },
        latestTaskInput: { type: String },
        latestTaskOutput: { type: String },
        lastRunId: { type: String },
    })),
    __metadata("design:type", Object)
], AgentSession.prototype, "planContext", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        meetingId: { type: String },
        agendaId: { type: String },
        meetingType: { type: String },
        latestSummary: { type: String },
    })),
    __metadata("design:type", Object)
], AgentSession.prototype, "meetingContext", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        domainType: { type: String },
        description: { type: String },
        constraints: [{ type: String }],
        knowledgeRefs: [{ type: String }],
        metadata: { type: Object },
    })),
    __metadata("design:type", Object)
], AgentSession.prototype, "domainContext", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentSession.prototype, "collaborationContext", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{
                runId: { type: String, required: true },
                taskId: { type: String },
                taskTitle: { type: String },
                objective: { type: String },
                outcome: { type: String },
                keyOutputs: [{ type: String }],
                openIssues: [{ type: String }],
                completedAt: { type: Date },
            }],
        default: [],
    }),
    __metadata("design:type", Array)
], AgentSession.prototype, "runSummaries", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            input: { type: Number, default: 0 },
            output: { type: Number, default: 0 },
            reasoning: { type: Number, default: 0 },
            cacheRead: { type: Number, default: 0 },
            cacheWrite: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },
        _id: false,
        default: () => ({
            input: 0,
            output: 0,
            reasoning: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0,
        }),
    }),
    __metadata("design:type", Object)
], AgentSession.prototype, "totalTokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], AgentSession.prototype, "totalCost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentSession.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], AgentSession.prototype, "lastActiveAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentSession.prototype, "memoSnapshot", void 0);
exports.AgentSession = AgentSession = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_sessions' })
], AgentSession);
exports.AgentSessionSchema = mongoose_1.SchemaFactory.createForClass(AgentSession);
exports.AgentSessionSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
exports.AgentSessionSchema.index({ status: 1, lastActiveAt: -1 });
exports.AgentSessionSchema.index({ 'planContext.linkedPlanId': 1, 'planContext.linkedTaskId': 1 });
exports.AgentSessionSchema.index({ 'planContext.linkedPlanId': 1, ownerId: 1, sessionType: 1 });
exports.AgentSessionSchema.index({ 'planContext.linkedPlanId': 1, 'planContext.orchestrationRunId': 1, ownerId: 1, sessionType: 1 });
//# sourceMappingURL=agent-session.schema.js.map