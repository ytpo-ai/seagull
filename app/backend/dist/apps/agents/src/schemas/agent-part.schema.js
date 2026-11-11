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
exports.AgentPartSchema = exports.AgentPart = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentPart = class AgentPart {
};
exports.AgentPart = AgentPart;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentPart.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentPart.prototype, "runId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentPart.prototype, "messageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentPart.prototype, "sequence", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ['text', 'reasoning', 'tool_call', 'tool_result', 'system_event', 'step_start', 'step_finish'],
    }),
    __metadata("design:type", String)
], AgentPart.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: ['pending', 'running', 'completed', 'error', 'cancelled'],
        required: true,
        default: 'completed',
    }),
    __metadata("design:type", String)
], AgentPart.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentPart.prototype, "toolId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentPart.prototype, "toolCallId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentPart.prototype, "input", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentPart.prototype, "output", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], AgentPart.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentPart.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentPart.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentPart.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], AgentPart.prototype, "endedAt", void 0);
exports.AgentPart = AgentPart = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_parts' })
], AgentPart);
exports.AgentPartSchema = mongoose_1.SchemaFactory.createForClass(AgentPart);
exports.AgentPartSchema.index({ runId: 1, messageId: 1, sequence: 1 });
exports.AgentPartSchema.index({ runId: 1, toolCallId: 1 });
exports.AgentPartSchema.index({ status: 1, updatedAt: -1 });
//# sourceMappingURL=agent-part.schema.js.map