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
exports.MeetingSchema = exports.Meeting = exports.MeetingMessage = exports.MeetingParticipant = exports.ParticipantRole = exports.MeetingStatus = exports.MeetingType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
var MeetingType;
(function (MeetingType) {
    MeetingType["WEEKLY"] = "weekly";
    MeetingType["BOARD"] = "board";
    MeetingType["DAILY"] = "daily";
    MeetingType["DEPARTMENT"] = "department";
    MeetingType["AD_HOC"] = "ad_hoc";
    MeetingType["ONE_ON_ONE"] = "one_on_one";
    MeetingType["PROJECT"] = "project";
    MeetingType["EMERGENCY"] = "emergency";
})(MeetingType || (exports.MeetingType = MeetingType = {}));
var MeetingStatus;
(function (MeetingStatus) {
    MeetingStatus["PENDING"] = "pending";
    MeetingStatus["ACTIVE"] = "active";
    MeetingStatus["PAUSED"] = "paused";
    MeetingStatus["ENDED"] = "ended";
    MeetingStatus["ARCHIVED"] = "archived";
})(MeetingStatus || (exports.MeetingStatus = MeetingStatus = {}));
var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["HOST"] = "host";
    ParticipantRole["PARTICIPANT"] = "participant";
    ParticipantRole["OBSERVER"] = "observer";
})(ParticipantRole || (exports.ParticipantRole = ParticipantRole = {}));
let MeetingParticipant = class MeetingParticipant {
};
exports.MeetingParticipant = MeetingParticipant;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], MeetingParticipant.prototype, "participantId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['employee', 'agent'], required: true }),
    __metadata("design:type", String)
], MeetingParticipant.prototype, "participantType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ParticipantRole, default: ParticipantRole.PARTICIPANT }),
    __metadata("design:type", String)
], MeetingParticipant.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], MeetingParticipant.prototype, "isPresent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], MeetingParticipant.prototype, "hasSpoken", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], MeetingParticipant.prototype, "messageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], MeetingParticipant.prototype, "joinedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], MeetingParticipant.prototype, "leftAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], MeetingParticipant.prototype, "isExclusiveAssistant", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], MeetingParticipant.prototype, "assistantForEmployeeId", void 0);
exports.MeetingParticipant = MeetingParticipant = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], MeetingParticipant);
let MeetingMessage = class MeetingMessage {
};
exports.MeetingMessage = MeetingMessage;
__decorate([
    (0, mongoose_1.Prop)({ default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], MeetingMessage.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], MeetingMessage.prototype, "senderId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['employee', 'agent', 'system'], required: true }),
    __metadata("design:type", String)
], MeetingMessage.prototype, "senderType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], MeetingMessage.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['opinion', 'question', 'agreement', 'disagreement', 'suggestion', 'conclusion', 'introduction', 'action_item'],
        default: 'opinion'
    }),
    __metadata("design:type", String)
], MeetingMessage.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], MeetingMessage.prototype, "timestamp", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], MeetingMessage.prototype, "metadata", void 0);
exports.MeetingMessage = MeetingMessage = __decorate([
    (0, mongoose_1.Schema)()
], MeetingMessage);
let Meeting = class Meeting {
};
exports.Meeting = Meeting;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Meeting.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Meeting.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Meeting.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: MeetingType, required: true }),
    __metadata("design:type", String)
], Meeting.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: MeetingStatus, default: MeetingStatus.PENDING }),
    __metadata("design:type", String)
], Meeting.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Meeting.prototype, "hostId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['employee', 'agent'], required: true }),
    __metadata("design:type", String)
], Meeting.prototype, "hostType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ participantId: String, participantType: String, role: String, isPresent: Boolean, hasSpoken: Boolean, messageCount: Number, joinedAt: Date, leftAt: Date, isExclusiveAssistant: Boolean, assistantForEmployeeId: String }], default: [] }),
    __metadata("design:type", Array)
], Meeting.prototype, "participants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], Meeting.prototype, "messages", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Meeting.prototype, "agenda", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Meeting.prototype, "scheduledStartTime", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Meeting.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Meeting.prototype, "endedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ participantId: String, participantType: String }], default: [] }),
    __metadata("design:type", Array)
], Meeting.prototype, "invitedParticipants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Meeting.prototype, "settings", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Meeting.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Meeting.prototype, "messageCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], Meeting.prototype, "projectId", void 0);
exports.Meeting = Meeting = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'meetings' })
], Meeting);
exports.MeetingSchema = mongoose_1.SchemaFactory.createForClass(Meeting);
exports.MeetingSchema.index({ status: 1 });
exports.MeetingSchema.index({ type: 1 });
exports.MeetingSchema.index({ hostId: 1 });
exports.MeetingSchema.index({ 'participants.participantId': 1 });
exports.MeetingSchema.index({ createdAt: -1 });
exports.MeetingSchema.index({ projectId: 1, createdAt: -1 });
//# sourceMappingURL=meeting.schema.js.map