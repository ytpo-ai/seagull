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
exports.AgentMessageSchema = exports.AgentMessage = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentMessage = class AgentMessage {
};
exports.AgentMessage = AgentMessage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentMessage.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentMessage.prototype, "runId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentMessage.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentMessage.prototype, "sessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentMessage.prototype, "taskId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentMessage.prototype, "parentMessageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['system', 'user', 'assistant', 'tool'] }),
    __metadata("design:type", String)
], AgentMessage.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentMessage.prototype, "sequence", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        default: '',
        set: (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            return typeof value === 'string' ? value : String(value);
        },
    }),
    __metadata("design:type", String)
], AgentMessage.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ['pending', 'streaming', 'completed', 'error'],
        default: 'completed',
    }),
    __metadata("design:type", String)
], AgentMessage.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentMessage.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentMessage.prototype, "modelID", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentMessage.prototype, "providerID", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['stop', 'tool-calls', 'error', 'cancelled', 'paused', 'max-rounds'],
    }),
    __metadata("design:type", String)
], AgentMessage.prototype, "finish", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            input: { type: Number },
            output: { type: Number },
            reasoning: { type: Number },
            cacheRead: { type: Number },
            cacheWrite: { type: Number },
            total: { type: Number },
        },
        _id: false,
    }),
    __metadata("design:type", Object)
], AgentMessage.prototype, "tokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], AgentMessage.prototype, "cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], AgentMessage.prototype, "stepIndex", void 0);
exports.AgentMessage = AgentMessage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_messages' })
], AgentMessage);
exports.AgentMessageSchema = mongoose_1.SchemaFactory.createForClass(AgentMessage);
exports.AgentMessageSchema.pre('validate', function ensureContent(next) {
    if (this.content === null || this.content === undefined) {
        this.content = '';
    }
    next();
});
exports.AgentMessageSchema.index({ runId: 1, sequence: 1 });
exports.AgentMessageSchema.index({ sessionId: 1, sequence: 1 });
exports.AgentMessageSchema.index({ taskId: 1, sequence: 1 });
exports.AgentMessageSchema.index({ runId: 1, stepIndex: 1 });
exports.AgentMessageSchema.index({ parentMessageId: 1 });
//# sourceMappingURL=agent-message.schema.js.map