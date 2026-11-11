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
exports.PromptTemplateAuditSchema = exports.PromptTemplateAudit = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let PromptTemplateAudit = class PromptTemplateAudit {
};
exports.PromptTemplateAudit = PromptTemplateAudit;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], PromptTemplateAudit.prototype, "scene", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], PromptTemplateAudit.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['create_draft', 'publish', 'unpublish', 'rollback'] }),
    __metadata("design:type", String)
], PromptTemplateAudit.prototype, "action", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], PromptTemplateAudit.prototype, "version", void 0);
__decorate([
    (0, mongoose_1.Prop)({ min: 1 }),
    __metadata("design:type", Number)
], PromptTemplateAudit.prototype, "fromVersion", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplateAudit.prototype, "operatorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], PromptTemplateAudit.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: () => new Date() }),
    __metadata("design:type", Date)
], PromptTemplateAudit.prototype, "createdAt", void 0);
exports.PromptTemplateAudit = PromptTemplateAudit = __decorate([
    (0, mongoose_1.Schema)({ collection: 'prompt_template_audits', timestamps: false })
], PromptTemplateAudit);
exports.PromptTemplateAuditSchema = mongoose_1.SchemaFactory.createForClass(PromptTemplateAudit);
exports.PromptTemplateAuditSchema.index({ scene: 1, role: 1, createdAt: -1 });
//# sourceMappingURL=prompt-template-audit.schema.js.map