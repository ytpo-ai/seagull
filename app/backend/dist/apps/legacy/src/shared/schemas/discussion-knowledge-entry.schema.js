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
exports.DiscussionKnowledgeEntrySchema = exports.DiscussionKnowledgeEntry = exports.DiscussionKnowledgeEntryType = exports.DiscussionKnowledgeCredibility = exports.DiscussionKnowledgeSourceType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
var DiscussionKnowledgeSourceType;
(function (DiscussionKnowledgeSourceType) {
    DiscussionKnowledgeSourceType["WEB_SEARCH"] = "web_search";
    DiscussionKnowledgeSourceType["API"] = "api";
    DiscussionKnowledgeSourceType["DOCUMENT"] = "document";
    DiscussionKnowledgeSourceType["USER_INPUT"] = "user_input";
    DiscussionKnowledgeSourceType["DISCUSSION_DERIVED"] = "discussion_derived";
})(DiscussionKnowledgeSourceType || (exports.DiscussionKnowledgeSourceType = DiscussionKnowledgeSourceType = {}));
var DiscussionKnowledgeCredibility;
(function (DiscussionKnowledgeCredibility) {
    DiscussionKnowledgeCredibility["HIGH"] = "high";
    DiscussionKnowledgeCredibility["MEDIUM"] = "medium";
    DiscussionKnowledgeCredibility["LOW"] = "low";
    DiscussionKnowledgeCredibility["UNVERIFIED"] = "unverified";
})(DiscussionKnowledgeCredibility || (exports.DiscussionKnowledgeCredibility = DiscussionKnowledgeCredibility = {}));
var DiscussionKnowledgeEntryType;
(function (DiscussionKnowledgeEntryType) {
    DiscussionKnowledgeEntryType["FACT"] = "fact";
    DiscussionKnowledgeEntryType["DATA_POINT"] = "data_point";
    DiscussionKnowledgeEntryType["OPINION"] = "opinion";
    DiscussionKnowledgeEntryType["SOURCE_REFERENCE"] = "source_reference";
    DiscussionKnowledgeEntryType["ANALYSIS"] = "analysis";
    DiscussionKnowledgeEntryType["ACTION_ITEM"] = "action_item";
})(DiscussionKnowledgeEntryType || (exports.DiscussionKnowledgeEntryType = DiscussionKnowledgeEntryType = {}));
let DiscussionKnowledgeEntry = class DiscussionKnowledgeEntry {
};
exports.DiscussionKnowledgeEntry = DiscussionKnowledgeEntry;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "spaceId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "participantId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "outlineSectionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionKnowledgeEntryType, default: DiscussionKnowledgeEntryType.FACT }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "entryType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionKnowledgeEntry.prototype, "structuredData", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionKnowledgeEntry.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "sourceUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionKnowledgeSourceType, required: true }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "sourceType", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "sourceName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionKnowledgeEntry.prototype, "domainTags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionKnowledgeEntry.prototype, "topicTags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionKnowledgeEntry.prototype, "keywordTags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionKnowledgeCredibility, default: DiscussionKnowledgeCredibility.UNVERIFIED }),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "credibility", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionKnowledgeEntry.prototype, "credibilityDetail", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "threadId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionKnowledgeEntry.prototype, "messageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], DiscussionKnowledgeEntry.prototype, "referenceCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], DiscussionKnowledgeEntry.prototype, "contentDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], DiscussionKnowledgeEntry.prototype, "isActive", void 0);
exports.DiscussionKnowledgeEntry = DiscussionKnowledgeEntry = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'discussion_knowledge_entries' })
], DiscussionKnowledgeEntry);
exports.DiscussionKnowledgeEntrySchema = mongoose_1.SchemaFactory.createForClass(DiscussionKnowledgeEntry);
exports.DiscussionKnowledgeEntrySchema.index({ spaceId: 1, isActive: 1 });
exports.DiscussionKnowledgeEntrySchema.index({ participantId: 1 });
exports.DiscussionKnowledgeEntrySchema.index({ spaceId: 1, outlineSectionId: 1 });
exports.DiscussionKnowledgeEntrySchema.index({ domainTags: 1 });
exports.DiscussionKnowledgeEntrySchema.index({ topicTags: 1 });
exports.DiscussionKnowledgeEntrySchema.index({ keywordTags: 1 });
exports.DiscussionKnowledgeEntrySchema.index({ credibility: 1, referenceCount: -1 });
exports.DiscussionKnowledgeEntrySchema.index({ spaceId: 1, '$**': 'text' }, { name: 'knowledge_text_search' });
//# sourceMappingURL=discussion-knowledge-entry.schema.js.map