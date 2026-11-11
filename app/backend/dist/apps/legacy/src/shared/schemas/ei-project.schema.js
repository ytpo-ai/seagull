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
exports.RdProjectSchema = exports.RdProject = exports.RdProjectSourceType = exports.RdProjectStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var RdProjectStatus;
(function (RdProjectStatus) {
    RdProjectStatus["ACTIVE"] = "active";
    RdProjectStatus["PAUSED"] = "paused";
    RdProjectStatus["COMPLETED"] = "completed";
    RdProjectStatus["ARCHIVED"] = "archived";
})(RdProjectStatus || (exports.RdProjectStatus = RdProjectStatus = {}));
var RdProjectSourceType;
(function (RdProjectSourceType) {
    RdProjectSourceType["LOCAL"] = "local";
    RdProjectSourceType["OPENCODE"] = "opencode";
    RdProjectSourceType["GITHUB"] = "github";
})(RdProjectSourceType || (exports.RdProjectSourceType = RdProjectSourceType = {}));
let RdProject = class RdProject {
};
exports.RdProject = RdProject;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], RdProject.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: RdProjectStatus, default: RdProjectStatus.ACTIVE }),
    __metadata("design:type", String)
], RdProject.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: RdProjectSourceType, default: RdProjectSourceType.OPENCODE }),
    __metadata("design:type", String)
], RdProject.prototype, "sourceType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Employee' }] }),
    __metadata("design:type", Array)
], RdProject.prototype, "members", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Employee' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RdProject.prototype, "manager", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "opencodeProjectPath", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "opencodeSessionId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "opencodeProjectId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "opencodeEndpointRef", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "syncedFromAgentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], RdProject.prototype, "createdBySync", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "localPath", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'RdProject' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RdProject.prototype, "bindingLocalProjectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'RdProject' }], default: [] }),
    __metadata("design:type", Array)
], RdProject.prototype, "opencodeBindingIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'RdProject' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RdProject.prototype, "githubBindingId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'IncubationProject' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], RdProject.prototype, "incubationProjectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], RdProject.prototype, "opencodeConfig", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "repositoryUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "githubOwner", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "githubRepo", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "githubApiKeyId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RdProject.prototype, "branch", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], RdProject.prototype, "startDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], RdProject.prototype, "endDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], RdProject.prototype, "metadata", void 0);
exports.RdProject = RdProject = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'ei_projects' })
], RdProject);
exports.RdProjectSchema = mongoose_1.SchemaFactory.createForClass(RdProject);
exports.RdProjectSchema.index({ syncedFromAgentId: 1, opencodeProjectPath: 1 }, { unique: true, sparse: true });
exports.RdProjectSchema.index({ syncedFromAgentId: 1, opencodeProjectId: 1 }, { unique: true, sparse: true });
exports.RdProjectSchema.index({ bindingLocalProjectId: 1, sourceType: 1 }, { unique: true, partialFilterExpression: { sourceType: RdProjectSourceType.GITHUB, bindingLocalProjectId: { $exists: true } } });
exports.RdProjectSchema.index({ incubationProjectId: 1 }, { sparse: true });
//# sourceMappingURL=ei-project.schema.js.map