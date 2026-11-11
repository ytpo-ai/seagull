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
exports.DiscussionThreadSchema = exports.DiscussionThread = exports.DiscussionThreadStatus = exports.DiscussionThreadBranchOrigin = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
var DiscussionThreadBranchOrigin;
(function (DiscussionThreadBranchOrigin) {
    DiscussionThreadBranchOrigin["USER"] = "user";
    DiscussionThreadBranchOrigin["AI_SUGGESTION"] = "ai_suggestion";
})(DiscussionThreadBranchOrigin || (exports.DiscussionThreadBranchOrigin = DiscussionThreadBranchOrigin = {}));
var DiscussionThreadStatus;
(function (DiscussionThreadStatus) {
    DiscussionThreadStatus["ACTIVE"] = "active";
    DiscussionThreadStatus["CONCLUDED"] = "concluded";
    DiscussionThreadStatus["ARCHIVED"] = "archived";
})(DiscussionThreadStatus || (exports.DiscussionThreadStatus = DiscussionThreadStatus = {}));
let DiscussionThread = class DiscussionThread {
};
exports.DiscussionThread = DiscussionThread;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], DiscussionThread.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionThread.prototype, "spaceId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionThread.prototype, "parentThreadId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionThread.prototype, "branchFromMessageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionThreadBranchOrigin, default: DiscussionThreadBranchOrigin.USER }),
    __metadata("design:type", String)
], DiscussionThread.prototype, "branchOrigin", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionThread.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionThread.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionThread.prototype, "contextSummary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionThread.prototype, "outlineSectionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionThreadStatus, default: DiscussionThreadStatus.ACTIVE }),
    __metadata("design:type", String)
], DiscussionThread.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], DiscussionThread.prototype, "depth", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionThread.prototype, "childThreadIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], DiscussionThread.prototype, "messageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionThread.prototype, "activeParticipantIds", void 0);
exports.DiscussionThread = DiscussionThread = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'discussion_threads' })
], DiscussionThread);
exports.DiscussionThreadSchema = mongoose_1.SchemaFactory.createForClass(DiscussionThread);
exports.DiscussionThreadSchema.index({ spaceId: 1, parentThreadId: 1 });
exports.DiscussionThreadSchema.index({ spaceId: 1, depth: 1 });
exports.DiscussionThreadSchema.index({ spaceId: 1, outlineSectionId: 1 });
exports.DiscussionThreadSchema.index({ branchFromMessageId: 1 });
//# sourceMappingURL=discussion-thread.schema.js.map