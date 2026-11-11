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
exports.DiscussionMessageSchema = exports.DiscussionMessage = exports.DiscussionMessageType = exports.DiscussionMessageSenderType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
var DiscussionMessageSenderType;
(function (DiscussionMessageSenderType) {
    DiscussionMessageSenderType["USER"] = "user";
    DiscussionMessageSenderType["AI"] = "ai";
    DiscussionMessageSenderType["SYSTEM"] = "system";
})(DiscussionMessageSenderType || (exports.DiscussionMessageSenderType = DiscussionMessageSenderType = {}));
var DiscussionMessageType;
(function (DiscussionMessageType) {
    DiscussionMessageType["TEXT"] = "text";
    DiscussionMessageType["BRANCH_CONTEXT"] = "branch_context";
    DiscussionMessageType["SEDIMENT_SNAPSHOT"] = "sediment_snapshot";
    DiscussionMessageType["CROSS_REFERENCE"] = "cross_reference";
})(DiscussionMessageType || (exports.DiscussionMessageType = DiscussionMessageType = {}));
let DiscussionMessage = class DiscussionMessage {
};
exports.DiscussionMessage = DiscussionMessage;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "spaceId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "threadId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "participantId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionMessageSenderType, required: true }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "senderType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionMessageType, default: DiscussionMessageType.TEXT }),
    __metadata("design:type", String)
], DiscussionMessage.prototype, "messageType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true }),
    __metadata("design:type", Number)
], DiscussionMessage.prototype, "sequence", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DiscussionMessage.prototype, "branchSuggestions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DiscussionMessage.prototype, "mentions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DiscussionMessage.prototype, "crossReferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], DiscussionMessage.prototype, "dataReferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionMessage.prototype, "knowledgeEntryIds", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DiscussionMessage.prototype, "metadata", void 0);
exports.DiscussionMessage = DiscussionMessage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'discussion_messages' })
], DiscussionMessage);
exports.DiscussionMessageSchema = mongoose_1.SchemaFactory.createForClass(DiscussionMessage);
exports.DiscussionMessageSchema.index({ threadId: 1, sequence: 1 });
exports.DiscussionMessageSchema.index({ spaceId: 1, createdAt: -1 });
exports.DiscussionMessageSchema.index({ participantId: 1 });
exports.DiscussionMessageSchema.index({ 'mentions.participantId': 1 });
//# sourceMappingURL=discussion-message.schema.js.map