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
exports.AgentSchema = exports.Agent = exports.AGENT_ROLE_TIERS = void 0;
const mongoose_1 = require("@nestjs/mongoose");
exports.AGENT_ROLE_TIERS = ['leadership', 'operations', 'temporary'];
let Agent = class Agent {
};
exports.Agent = Agent;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Agent.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Agent.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Agent.prototype, "updatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Agent.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Agent.prototype, "roleId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: exports.AGENT_ROLE_TIERS, default: 'operations', index: true }),
    __metadata("design:type", String)
], Agent.prototype, "tier", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Agent.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        id: { type: String, required: true },
        name: { type: String, required: true },
        provider: { type: String, required: true },
        model: { type: String, required: true },
        maxTokens: { type: Number, required: true },
        temperature: { type: Number },
        topP: { type: Number },
        reasoning: {
            type: {
                enabled: { type: Boolean, default: false },
                effort: { type: String, enum: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] },
                verbosity: { type: String, enum: ['low', 'medium', 'high'] },
            },
        },
    })),
    __metadata("design:type", Object)
], Agent.prototype, "model", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "capabilities", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Agent.prototype, "systemPrompt", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        scene: { type: String, trim: true },
        role: { type: String, trim: true },
    })),
    __metadata("design:type", Object)
], Agent.prototype, "promptTemplateRef", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Agent.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], Agent.prototype, "config", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "tools", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "skills", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Agent.prototype, "permissions", void 0);
__decorate([
    (0, mongoose_1.Prop)((0, mongoose_1.raw)({
        workEthic: { type: Number, default: 80 },
        creativity: { type: Number, default: 75 },
        leadership: { type: Number, default: 70 },
        teamwork: { type: Number, default: 80 }
    })),
    __metadata("design:type", Object)
], Agent.prototype, "personality", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 80 }),
    __metadata("design:type", Number)
], Agent.prototype, "learningAbility", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Agent.prototype, "salary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Agent.prototype, "performanceScore", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Agent.prototype, "apiKeyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], Agent.prototype, "projectId", void 0);
exports.Agent = Agent = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agents' })
], Agent);
exports.AgentSchema = mongoose_1.SchemaFactory.createForClass(Agent);
exports.AgentSchema.index({ apiKeyId: 1 });
exports.AgentSchema.index({ projectId: 1, isActive: 1 });
//# sourceMappingURL=agent.schema.js.map