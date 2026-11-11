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
exports.AgentRunScoreSchema = exports.AgentRunScore = exports.AgentRunScoreDeduction = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentRunScoreDeduction = class AgentRunScoreDeduction {
};
exports.AgentRunScoreDeduction = AgentRunScoreDeduction;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRunScoreDeduction.prototype, "ruleId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], AgentRunScoreDeduction.prototype, "points", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], AgentRunScoreDeduction.prototype, "round", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRunScoreDeduction.prototype, "toolId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRunScoreDeduction.prototype, "detail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: Date.now }),
    __metadata("design:type", Date)
], AgentRunScoreDeduction.prototype, "timestamp", void 0);
exports.AgentRunScoreDeduction = AgentRunScoreDeduction = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], AgentRunScoreDeduction);
let AgentRunScore = class AgentRunScore {
};
exports.AgentRunScore = AgentRunScore;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentRunScore.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentRunScore.prototype, "runId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRunScore.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRunScore.prototype, "taskId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRunScore.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], AgentRunScore.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 100 }),
    __metadata("design:type", Number)
], AgentRunScore.prototype, "baseScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentRunScore.prototype, "totalDeductions", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            totalRounds: { type: Number, default: 0 },
            totalToolCalls: { type: Number, default: 0 },
            successfulToolCalls: { type: Number, default: 0 },
            failedToolCalls: { type: Number, default: 0 },
        },
        required: true,
    }),
    __metadata("design:type", Object)
], AgentRunScore.prototype, "stats", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], AgentRunScore.prototype, "deductionsByRule", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [AgentRunScoreDeduction], default: [] }),
    __metadata("design:type", Array)
], AgentRunScore.prototype, "deductions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: '1.0' }),
    __metadata("design:type", String)
], AgentRunScore.prototype, "ruleVersion", void 0);
exports.AgentRunScore = AgentRunScore = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_run_scores' })
], AgentRunScore);
exports.AgentRunScoreSchema = mongoose_1.SchemaFactory.createForClass(AgentRunScore);
exports.AgentRunScoreSchema.index({ runId: 1 }, { unique: true, name: 'uk_runId' });
exports.AgentRunScoreSchema.index({ id: 1 }, { unique: true, name: 'uk_id' });
exports.AgentRunScoreSchema.index({ agentId: 1, createdAt: -1 }, { name: 'idx_agent_created' });
exports.AgentRunScoreSchema.index({ score: 1, createdAt: -1 }, { name: 'idx_score' });
//# sourceMappingURL=agent-run-score.schema.js.map