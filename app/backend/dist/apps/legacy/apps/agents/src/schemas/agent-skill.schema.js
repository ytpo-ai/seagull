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
exports.SkillSchema = exports.Skill = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Skill = class Skill {
};
exports.Skill = Skill;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Skill.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Skill.prototype, "updatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Skill.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Skill.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], Skill.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Skill.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'general' }),
    __metadata("design:type", String)
], Skill.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Skill.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['manual', 'github', 'web', 'internal'], default: 'manual' }),
    __metadata("design:type", String)
], Skill.prototype, "sourceType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Skill.prototype, "sourceUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], Skill.prototype, "repoId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'system' }),
    __metadata("design:type", String)
], Skill.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '1.0.0' }),
    __metadata("design:type", String)
], Skill.prototype, "version", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'experimental', 'deprecated', 'disabled'], default: 'active' }),
    __metadata("design:type", String)
], Skill.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 50 }),
    __metadata("design:type", Number)
], Skill.prototype, "confidenceScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Skill.prototype, "usageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'AgentSkillManager' }),
    __metadata("design:type", String)
], Skill.prototype, "discoveredBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Skill.prototype, "lastVerifiedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Skill.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Skill.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'text/markdown' }),
    __metadata("design:type", String)
], Skill.prototype, "contentType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Skill.prototype, "contentHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Skill.prototype, "contentSize", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Skill.prototype, "contentUpdatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Skill.prototype, "metadataUpdatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            scene: { type: String, required: true, trim: true },
            role: { type: String, required: true, trim: true },
        },
        required: false,
    }),
    __metadata("design:type", Object)
], Skill.prototype, "promptTemplateRef", void 0);
exports.Skill = Skill = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_skills' })
], Skill);
exports.SkillSchema = mongoose_1.SchemaFactory.createForClass(Skill);
exports.SkillSchema.index({ slug: 1, provider: 1, version: 1 }, { unique: true });
exports.SkillSchema.index({ status: 1, category: 1 });
//# sourceMappingURL=agent-skill.schema.js.map