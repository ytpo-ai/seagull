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
exports.DiscussionParticipantSchema = exports.DiscussionParticipant = exports.DiscussionParticipantPresence = exports.DiscussionParticipantRole = exports.DiscussionParticipantType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
var DiscussionParticipantType;
(function (DiscussionParticipantType) {
    DiscussionParticipantType["HUMAN"] = "human";
    DiscussionParticipantType["AI_AGENT"] = "ai_agent";
})(DiscussionParticipantType || (exports.DiscussionParticipantType = DiscussionParticipantType = {}));
var DiscussionParticipantRole;
(function (DiscussionParticipantRole) {
    DiscussionParticipantRole["PRIMARY"] = "primary";
    DiscussionParticipantRole["ON_DEMAND"] = "on_demand";
})(DiscussionParticipantRole || (exports.DiscussionParticipantRole = DiscussionParticipantRole = {}));
var DiscussionParticipantPresence;
(function (DiscussionParticipantPresence) {
    DiscussionParticipantPresence["ONLINE"] = "online";
    DiscussionParticipantPresence["OFFLINE"] = "offline";
    DiscussionParticipantPresence["IDLE"] = "idle";
})(DiscussionParticipantPresence || (exports.DiscussionParticipantPresence = DiscussionParticipantPresence = {}));
let DiscussionParticipant = class DiscussionParticipant {
};
exports.DiscussionParticipant = DiscussionParticipant;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "spaceId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionParticipantType, required: true }),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "displayName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "avatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionParticipantRole, required: true }),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "expertise", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], DiscussionParticipant.prototype, "expertiseTags", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: DiscussionParticipantPresence, default: DiscussionParticipantPresence.OFFLINE }),
    __metadata("design:type", String)
], DiscussionParticipant.prototype, "presence", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], DiscussionParticipant.prototype, "lastActiveAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], DiscussionParticipant.prototype, "messageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], DiscussionParticipant.prototype, "knowledgeContribution", void 0);
exports.DiscussionParticipant = DiscussionParticipant = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'discussion_participants' })
], DiscussionParticipant);
exports.DiscussionParticipantSchema = mongoose_1.SchemaFactory.createForClass(DiscussionParticipant);
exports.DiscussionParticipantSchema.index({ spaceId: 1, role: 1 });
exports.DiscussionParticipantSchema.index({ userId: 1 });
exports.DiscussionParticipantSchema.index({ agentId: 1 });
exports.DiscussionParticipantSchema.index({ spaceId: 1, displayName: 1 }, { unique: true });
//# sourceMappingURL=discussion-participant.schema.js.map