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
exports.DiscussionSpaceSchema = exports.DiscussionSpace = exports.DiscussionSpaceCategory = exports.DiscussionSedimentMode = exports.DiscussionSpaceStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
var DiscussionSpaceStatus;
(function (DiscussionSpaceStatus) {
    DiscussionSpaceStatus["ACTIVE"] = "active";
    DiscussionSpaceStatus["PAUSED"] = "paused";
    DiscussionSpaceStatus["ARCHIVED"] = "archived";
})(DiscussionSpaceStatus || (exports.DiscussionSpaceStatus = DiscussionSpaceStatus = {}));
var DiscussionSedimentMode;
(function (DiscussionSedimentMode) {
    DiscussionSedimentMode["MANUAL"] = "manual";
    DiscussionSedimentMode["REALTIME"] = "realtime";
})(DiscussionSedimentMode || (exports.DiscussionSedimentMode = DiscussionSedimentMode = {}));
var DiscussionSpaceCategory;
(function (DiscussionSpaceCategory) {
    DiscussionSpaceCategory["GENERAL"] = "general";
    DiscussionSpaceCategory["INDUSTRY_OBSERVATION"] = "industry_observation";
    DiscussionSpaceCategory["PRODUCT_DISCUSSION"] = "product_discussion";
    DiscussionSpaceCategory["TECHNICAL_DESIGN"] = "technical_design";
})(DiscussionSpaceCategory || (exports.DiscussionSpaceCategory = DiscussionSpaceCategory = {}));
let DiscussionSpace = class DiscussionSpace {
};
exports.DiscussionSpace = DiscussionSpace;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "creatorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionSpaceStatus, default: DiscussionSpaceStatus.ACTIVE }),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], DiscussionSpace.prototype, "archivedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "archivedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionSedimentMode, default: DiscussionSedimentMode.MANUAL }),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "sedimentMode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionSpaceCategory, default: DiscussionSpaceCategory.GENERAL }),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionSpace.prototype, "tags", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "rootThreadId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionSpace.prototype, "documentOutline", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DiscussionSpace.prototype, "sedimentHistory", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "latestSedimentedDocument", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "latestSedimentTitle", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionSpace.prototype, "projectId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionSpace.prototype, "settings", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionSpace.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: { totalThreads: 1, totalMessages: 0, totalKnowledgeEntries: 0, totalTokensConsumed: 0, totalCost: 0 } }),
    __metadata("design:type", Object)
], DiscussionSpace.prototype, "statistics", void 0);
exports.DiscussionSpace = DiscussionSpace = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'discussion_spaces' })
], DiscussionSpace);
exports.DiscussionSpaceSchema = mongoose_1.SchemaFactory.createForClass(DiscussionSpace);
exports.DiscussionSpaceSchema.index({ creatorId: 1, status: 1 });
exports.DiscussionSpaceSchema.index({ projectId: 1 });
exports.DiscussionSpaceSchema.index({ tags: 1 });
exports.DiscussionSpaceSchema.index({ category: 1, status: 1 });
//# sourceMappingURL=discussion-space.schema.js.map