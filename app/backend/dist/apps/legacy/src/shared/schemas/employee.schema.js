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
exports.EmployeeSchema = exports.Employee = exports.EmployeeRole = exports.EmployeeStatus = exports.EmployeeType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const role_tier_1 = require("../role-tier");
var EmployeeType;
(function (EmployeeType) {
    EmployeeType["HUMAN"] = "human";
    EmployeeType["AGENT"] = "agent";
})(EmployeeType || (exports.EmployeeType = EmployeeType = {}));
var EmployeeStatus;
(function (EmployeeStatus) {
    EmployeeStatus["ACTIVE"] = "active";
    EmployeeStatus["PROBATION"] = "probation";
    EmployeeStatus["TERMINATED"] = "terminated";
    EmployeeStatus["ON_LEAVE"] = "on_leave";
    EmployeeStatus["SUSPENDED"] = "suspended";
})(EmployeeStatus || (exports.EmployeeStatus = EmployeeStatus = {}));
var EmployeeRole;
(function (EmployeeRole) {
    EmployeeRole["FOUNDER"] = "founder";
    EmployeeRole["CO_FOUNDER"] = "co_founder";
    EmployeeRole["CEO"] = "ceo";
    EmployeeRole["CTO"] = "cto";
    EmployeeRole["MANAGER"] = "manager";
    EmployeeRole["SENIOR"] = "senior";
    EmployeeRole["JUNIOR"] = "junior";
    EmployeeRole["INTERN"] = "intern";
})(EmployeeRole || (exports.EmployeeRole = EmployeeRole = {}));
let Employee = class Employee {
};
exports.Employee = Employee;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Employee.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: EmployeeType, required: true }),
    __metadata("design:type", String)
], Employee.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true }),
    __metadata("design:type", String)
], Employee.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true }),
    __metadata("design:type", String)
], Employee.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "passwordHash", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "avatar", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: EmployeeRole, required: true }),
    __metadata("design:type", String)
], Employee.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: role_tier_1.AGENT_ROLE_TIERS, default: 'operations', index: true }),
    __metadata("design:type", String)
], Employee.prototype, "tier", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "departmentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Employee.prototype, "joinDate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Employee.prototype, "probationEndDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: EmployeeStatus, default: EmployeeStatus.PROBATION }),
    __metadata("design:type", String)
], Employee.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Employee.prototype, "shares", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Employee.prototype, "stockOptions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Employee.prototype, "salary", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Employee.prototype, "performance", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Employee.prototype, "statistics", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Employee.prototype, "capabilities", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Employee.prototype, "permissions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], Employee.prototype, "toolAccess", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Employee.prototype, "allowAIProxy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "aiProxyAgentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Employee.prototype, "exclusiveAssistantAgentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Employee.prototype, "meetingPreferences", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Employee.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Employee.prototype, "updatedAt", void 0);
exports.Employee = Employee = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'employees' })
], Employee);
exports.EmployeeSchema = mongoose_1.SchemaFactory.createForClass(Employee);
exports.EmployeeSchema.index({ type: 1 });
exports.EmployeeSchema.index({ status: 1 });
exports.EmployeeSchema.index({ departmentId: 1 });
exports.EmployeeSchema.index({ agentId: 1 });
//# sourceMappingURL=employee.schema.js.map