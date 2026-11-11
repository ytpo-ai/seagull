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
exports.AgentMemoSchema = exports.AgentMemo = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentMemo = class AgentMemo {
};
exports.AgentMemo = AgentMemo;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentMemo.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], AgentMemo.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentMemo.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], AgentMemo.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentMemo.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 1 }),
    __metadata("design:type", Number)
], AgentMemo.prototype, "version", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['identity', 'todo', 'topic', 'history', 'draft', 'custom', 'evaluation', 'achievement', 'criticism', 'deduction'],
        default: 'topic',
        index: true,
    }),
    __metadata("design:type", String)
], AgentMemo.prototype, "memoKind", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['knowledge', 'standard'], default: 'knowledge', index: true }),
    __metadata("design:type", String)
], AgentMemo.prototype, "memoType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], AgentMemo.prototype, "payload", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentMemo.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentMemo.prototype, "contextKeywords", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'agent' }),
    __metadata("design:type", String)
], AgentMemo.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentMemo.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentMemo.prototype, "updatedAt", void 0);
exports.AgentMemo = AgentMemo = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_memos' })
], AgentMemo);
exports.AgentMemoSchema = mongoose_1.SchemaFactory.createForClass(AgentMemo);
exports.AgentMemoSchema.index({ agentId: 1, memoType: 1, updatedAt: -1 });
exports.AgentMemoSchema.index({ agentId: 1, memoKind: 1, updatedAt: -1 });
exports.AgentMemoSchema.index({ agentId: 1, slug: 1 }, { unique: true });
exports.AgentMemoSchema.index({ agentId: 1, 'payload.topic': 1, updatedAt: -1 });
exports.AgentMemoSchema.index({ title: 'text', content: 'text', tags: 'text', contextKeywords: 'text' });
//# sourceMappingURL=agent-memo.schema.js.map