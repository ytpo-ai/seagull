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
exports.InvitationSchema = exports.Invitation = exports.InvitationRole = exports.InvitationStatus = void 0;
const mongoose_1 = require("@nestjs/mongoose");
var InvitationStatus;
(function (InvitationStatus) {
    InvitationStatus["PENDING"] = "pending";
    InvitationStatus["ACCEPTED"] = "accepted";
    InvitationStatus["EXPIRED"] = "expired";
    InvitationStatus["CANCELLED"] = "cancelled";
})(InvitationStatus || (exports.InvitationStatus = InvitationStatus = {}));
var InvitationRole;
(function (InvitationRole) {
    InvitationRole["FOUNDER"] = "founder";
    InvitationRole["CO_FOUNDER"] = "co_founder";
    InvitationRole["MANAGER"] = "manager";
    InvitationRole["SENIOR"] = "senior";
    InvitationRole["JUNIOR"] = "junior";
    InvitationRole["INTERN"] = "intern";
})(InvitationRole || (exports.InvitationRole = InvitationRole = {}));
let Invitation = class Invitation {
};
exports.Invitation = Invitation;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Invitation.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Invitation.prototype, "code", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Invitation.prototype, "invitedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Invitation.prototype, "invitedByName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Invitation.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Invitation.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: InvitationRole, required: true }),
    __metadata("design:type", String)
], Invitation.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Invitation.prototype, "departmentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Invitation.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Invitation.prototype, "message", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Invitation.prototype, "linkToken", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Invitation.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: InvitationStatus, default: InvitationStatus.PENDING }),
    __metadata("design:type", String)
], Invitation.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Invitation.prototype, "usedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Invitation.prototype, "usedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Invitation.prototype, "passwordSetAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1 }),
    __metadata("design:type", Number)
], Invitation.prototype, "maxUses", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Invitation.prototype, "usedCount", void 0);
exports.Invitation = Invitation = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'invitations' })
], Invitation);
exports.InvitationSchema = mongoose_1.SchemaFactory.createForClass(Invitation);
exports.InvitationSchema.index({ code: 1 });
exports.InvitationSchema.index({ linkToken: 1 });
exports.InvitationSchema.index({ expiresAt: 1 });
exports.InvitationSchema.index({ status: 1 });
//# sourceMappingURL=invitation.schema.js.map