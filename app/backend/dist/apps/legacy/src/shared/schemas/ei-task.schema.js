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
exports.RdTaskSchema = exports.RdTask = exports.RdTaskPriority = exports.RdTaskStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var RdTaskStatus;
(function (RdTaskStatus) {
    RdTaskStatus["PENDING"] = "pending";
    RdTaskStatus["IN_PROGRESS"] = "in_progress";
    RdTaskStatus["COMPLETED"] = "completed";
    RdTaskStatus["FAILED"] = "failed";
    RdTaskStatus["CANCELLED"] = "cancelled";
})(RdTaskStatus || (exports.RdTaskStatus = RdTaskStatus = {}));
var RdTaskPriority;
(function (RdTaskPriority) {
    RdTaskPriority["LOW"] = "low";
    RdTaskPriority["MEDIUM"] = "medium";
    RdTaskPriority["HIGH"] = "high";
    RdTaskPriority["URGENT"] = "urgent";
})(RdTaskPriority || (exports.RdTaskPriority = RdTaskPriority = {}));
let RdTask = class RdTask {
};
exports.RdTask = RdTask;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], RdTask.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], RdTask.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: RdTaskStatus, default: RdTaskStatus.PENDING }),
    __metadata("design:type", String)
], RdTask.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: RdTaskPriority, default: RdTaskPriority.MEDIUM }),
    __metadata("design:type", String)
], RdTask.prototype, "priority", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Employee', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RdTask.prototype, "assignee", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Employee' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RdTask.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdTask.prototype, "opencodeSessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdTask.prototype, "opencodeProjectPath", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], RdTask.prototype, "opencodeConfig", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: Object }] }),
    __metadata("design:type", Array)
], RdTask.prototype, "opencodeMessages", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdTask.prototype, "lastOpencodeResponse", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], RdTask.prototype, "result", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], RdTask.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], RdTask.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RdTask.prototype, "estimatedHours", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RdTask.prototype, "actualHours", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String] }),
    __metadata("design:type", Array)
], RdTask.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], RdTask.prototype, "metadata", void 0);
exports.RdTask = RdTask = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'ei_tasks' })
], RdTask);
exports.RdTaskSchema = mongoose_1.SchemaFactory.createForClass(RdTask);
//# sourceMappingURL=ei-task.schema.js.map