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
exports.PromptTemplateSchema = exports.PromptTemplate = exports.PromptTemplateSourceSchema = exports.PromptTemplateSource = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let PromptTemplateSource = class PromptTemplateSource {
};
exports.PromptTemplateSource = PromptTemplateSource;
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['github', 'manual', 'internal'] }),
    __metadata("design:type", String)
], PromptTemplateSource.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplateSource.prototype, "repo", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplateSource.prototype, "path", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], PromptTemplateSource.prototype, "importedAt", void 0);
exports.PromptTemplateSource = PromptTemplateSource = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PromptTemplateSource);
exports.PromptTemplateSourceSchema = mongoose_1.SchemaFactory.createForClass(PromptTemplateSource);
let PromptTemplate = class PromptTemplate {
};
exports.PromptTemplate = PromptTemplate;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "scene", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], PromptTemplate.prototype, "version", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['draft', 'published', 'archived'], default: 'draft' }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: undefined }),
    __metadata("design:type", Array)
], PromptTemplate.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.PromptTemplateSourceSchema, required: false }),
    __metadata("design:type", PromptTemplateSource)
], PromptTemplate.prototype, "source", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplate.prototype, "updatedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: () => new Date() }),
    __metadata("design:type", Date)
], PromptTemplate.prototype, "updatedAt", void 0);
exports.PromptTemplate = PromptTemplate = __decorate([
    (0, mongoose_1.Schema)({ collection: 'prompt_templates', timestamps: false })
], PromptTemplate);
exports.PromptTemplateSchema = mongoose_1.SchemaFactory.createForClass(PromptTemplate);
exports.PromptTemplateSchema.index({ scene: 1, role: 1, status: 1, version: -1 });
exports.PromptTemplateSchema.index({ scene: 1, role: 1, version: 1 }, { unique: true });
//# sourceMappingURL=prompt-template.schema.js.map