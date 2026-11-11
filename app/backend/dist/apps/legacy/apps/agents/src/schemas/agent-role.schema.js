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
exports.AgentRoleSchema = exports.AgentRole = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const uuid_1 = require("uuid");
const role_tier_1 = require("../../../../src/shared/role-tier");
let AgentRole = class AgentRole {
};
exports.AgentRole = AgentRole;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], AgentRole.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, trim: true }),
    __metadata("design:type", String)
], AgentRole.prototype, "code", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], AgentRole.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: role_tier_1.AGENT_ROLE_TIERS, default: 'operations', index: true }),
    __metadata("design:type", String)
], AgentRole.prototype, "tier", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], AgentRole.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentRole.prototype, "capabilities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentRole.prototype, "tools", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentRole.prototype, "permissions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentRole.prototype, "permissionsManual", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentRole.prototype, "permissionsDerived", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], AgentRole.prototype, "exposed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '', trim: true }),
    __metadata("design:type", String)
], AgentRole.prototype, "promptTemplate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'inactive'], default: 'active' }),
    __metadata("design:type", String)
], AgentRole.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentRole.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentRole.prototype, "updatedAt", void 0);
exports.AgentRole = AgentRole = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_roles' })
], AgentRole);
exports.AgentRoleSchema = mongoose_1.SchemaFactory.createForClass(AgentRole);
exports.AgentRoleSchema.index({ code: 1 }, { unique: true });
exports.AgentRoleSchema.index({ status: 1 });
//# sourceMappingURL=agent-role.schema.js.map