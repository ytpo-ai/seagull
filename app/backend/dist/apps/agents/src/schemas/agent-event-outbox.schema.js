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
exports.AgentEventOutboxSchema = exports.AgentEventOutbox = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentEventOutbox = class AgentEventOutbox {
};
exports.AgentEventOutbox = AgentEventOutbox;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "eventId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "eventType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "runId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "taskId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "messageId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "partId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "toolCallId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentEventOutbox.prototype, "sequence", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, required: true }),
    __metadata("design:type", Object)
], AgentEventOutbox.prototype, "payload", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ['pending', 'dispatched', 'failed'],
        default: 'pending',
    }),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentEventOutbox.prototype, "attempts", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentEventOutbox.prototype, "nextRetryAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentEventOutbox.prototype, "dispatchedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentEventOutbox.prototype, "lastError", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: Date.now }),
    __metadata("design:type", Date)
], AgentEventOutbox.prototype, "timestamp", void 0);
exports.AgentEventOutbox = AgentEventOutbox = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_events_outbox' })
], AgentEventOutbox);
exports.AgentEventOutboxSchema = mongoose_1.SchemaFactory.createForClass(AgentEventOutbox);
exports.AgentEventOutboxSchema.index({ status: 1, nextRetryAt: 1, createdAt: 1 });
exports.AgentEventOutboxSchema.index({ runId: 1, sequence: 1 });
exports.AgentEventOutboxSchema.index({ sessionId: 1, sequence: 1 });
//# sourceMappingURL=agent-event-outbox.schema.js.map