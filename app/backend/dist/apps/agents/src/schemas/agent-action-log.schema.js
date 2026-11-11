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
exports.AgentActionLogSchema = exports.AgentActionLog = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
let AgentActionLog = class AgentActionLog {
};
exports.AgentActionLog = AgentActionLog;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: uuid_1.v4 }),
    __metadata("design:type", String)
], AgentActionLog.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentActionLog.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['chat', 'orchestration'] }),
    __metadata("design:type", String)
], AgentActionLog.prototype, "contextType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentActionLog.prototype, "contextId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentActionLog.prototype, "action", void 0);
__decorate([
    (0, mongoose_1.Prop)({ sparse: true }),
    __metadata("design:type", String)
], AgentActionLog.prototype, "sourceEventId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentActionLog.prototype, "details", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], AgentActionLog.prototype, "timestamp", void 0);
exports.AgentActionLog = AgentActionLog = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false }, collection: 'agent_action_logs' })
], AgentActionLog);
exports.AgentActionLogSchema = mongoose_1.SchemaFactory.createForClass(AgentActionLog);
exports.AgentActionLogSchema.index({ agentId: 1, timestamp: -1 });
exports.AgentActionLogSchema.index({ contextType: 1, contextId: 1, timestamp: -1 });
exports.AgentActionLogSchema.index({ action: 1, timestamp: -1 });
exports.AgentActionLogSchema.index({ 'details.status': 1, timestamp: -1 });
exports.AgentActionLogSchema.index({ sourceEventId: 1 }, { unique: true, sparse: true });
//# sourceMappingURL=agent-action-log.schema.js.map