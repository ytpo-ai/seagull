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
exports.PlanSessionSchema = exports.PlanSession = exports.PlanTaskSnapshot = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let PlanTaskSnapshot = class PlanTaskSnapshot {
};
exports.PlanTaskSnapshot = PlanTaskSnapshot;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "taskId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], PlanTaskSnapshot.prototype, "order", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['pending', 'assigned', 'in_progress', 'blocked', 'waiting_human', 'completed', 'failed', 'cancelled'], default: 'pending' }),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "input", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "output", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "executorType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "executorId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "agentSessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], PlanTaskSnapshot.prototype, "agentRunId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], PlanTaskSnapshot.prototype, "updatedAt", void 0);
exports.PlanTaskSnapshot = PlanTaskSnapshot = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PlanTaskSnapshot);
const PlanTaskSnapshotSchema = mongoose_1.SchemaFactory.createForClass(PlanTaskSnapshot);
let PlanSession = class PlanSession {
};
exports.PlanSession = PlanSession;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], PlanSession.prototype, "planId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], PlanSession.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'completed', 'failed', 'cancelled'], default: 'active' }),
    __metadata("design:type", String)
], PlanSession.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [PlanTaskSnapshotSchema], default: [] }),
    __metadata("design:type", Array)
], PlanSession.prototype, "tasks", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], PlanSession.prototype, "metadata", void 0);
exports.PlanSession = PlanSession = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'orchestration_plan_sessions' })
], PlanSession);
exports.PlanSessionSchema = mongoose_1.SchemaFactory.createForClass(PlanSession);
exports.PlanSessionSchema.index({ createdAt: -1 });
exports.PlanSessionSchema.index({ planId: 1 }, { unique: true });
//# sourceMappingURL=orchestration-plan-session.schema.js.map