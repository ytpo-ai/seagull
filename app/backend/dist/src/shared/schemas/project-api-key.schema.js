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
exports.ProjectApiKeySchema = exports.ProjectApiKey = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ProjectApiKey = class ProjectApiKey {
};
exports.ProjectApiKey = ProjectApiKey;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], ProjectApiKey.prototype, "projectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ProjectApiKey.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ProjectApiKey.prototype, "keyHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ProjectApiKey.prototype, "keyPrefix", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ProjectApiKey.prototype, "agentIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ProjectApiKey.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ProjectApiKey.prototype, "lastUsedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ProjectApiKey.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ProjectApiKey.prototype, "updatedAt", void 0);
exports.ProjectApiKey = ProjectApiKey = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'project_api_keys' })
], ProjectApiKey);
exports.ProjectApiKeySchema = mongoose_1.SchemaFactory.createForClass(ProjectApiKey);
exports.ProjectApiKeySchema.index({ projectId: 1, isActive: 1 });
exports.ProjectApiKeySchema.index({ keyHash: 1 }, { unique: true });
//# sourceMappingURL=project-api-key.schema.js.map