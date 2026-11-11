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
exports.ScheduleSchema = exports.Schedule = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Schedule = class Schedule {
};
exports.Schedule = Schedule;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Schedule.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Schedule.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Schedule.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        type: { type: String, enum: ['cron', 'interval'], required: true },
        expression: { type: String },
        intervalMs: { type: Number },
        timezone: { type: String, default: 'Asia/Shanghai' },
    })),
    __metadata("design:type", Object)
], Schedule.prototype, "schedule", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        executorType: { type: String, enum: ['agent'], default: 'agent' },
        executorId: { type: String, required: true },
        executorName: { type: String },
    })),
    __metadata("design:type", Object)
], Schedule.prototype, "target", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        prompt: { type: String },
        payload: { type: Object },
    })),
    __metadata("design:type", Object)
], Schedule.prototype, "input", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        eventType: { type: String, default: 'schedule.trigger' },
        title: { type: String },
    })),
    __metadata("design:type", Object)
], Schedule.prototype, "message", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Schedule.prototype, "planId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], Schedule.prototype, "projectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Schedule.prototype, "enabled", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['idle', 'running', 'paused', 'error'], default: 'idle' }),
    __metadata("design:type", String)
], Schedule.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Schedule.prototype, "nextRunAt", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        startedAt: { type: Date },
        completedAt: { type: Date },
        success: { type: Boolean },
        result: { type: String },
        error: { type: String },
        taskId: { type: String },
        sessionId: { type: String },
        attempts: { type: Number },
    })),
    __metadata("design:type", Object)
], Schedule.prototype, "lastRun", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{
                failedAt: { type: Date, default: Date.now },
                taskId: { type: String },
                triggerType: { type: String, enum: ['auto', 'manual'], required: true },
                reason: { type: String, required: true },
                attempts: { type: Number, default: 1 },
            }], default: [] }),
    __metadata("design:type", Array)
], Schedule.prototype, "deadLetters", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        totalRuns: { type: Number, default: 0 },
        successRuns: { type: Number, default: 0 },
        failedRuns: { type: Number, default: 0 },
        skippedRuns: { type: Number, default: 0 },
    })),
    __metadata("design:type", Object)
], Schedule.prototype, "stats", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Schedule.prototype, "createdBy", void 0);
exports.Schedule = Schedule = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'orchestration_schedules' })
], Schedule);
exports.ScheduleSchema = mongoose_1.SchemaFactory.createForClass(Schedule);
exports.ScheduleSchema.index({ enabled: 1, updatedAt: -1 });
exports.ScheduleSchema.index({ nextRunAt: 1 });
exports.ScheduleSchema.index({ 'target.executorId': 1, enabled: 1 });
exports.ScheduleSchema.index({ projectId: 1, enabled: 1 });
//# sourceMappingURL=schedule.schema.js.map