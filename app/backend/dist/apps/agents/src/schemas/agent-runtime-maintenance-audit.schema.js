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
exports.AgentRuntimeMaintenanceAuditSchema = exports.AgentRuntimeMaintenanceAudit = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentRuntimeMaintenanceAudit = class AgentRuntimeMaintenanceAudit {
};
exports.AgentRuntimeMaintenanceAudit = AgentRuntimeMaintenanceAudit;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentRuntimeMaintenanceAudit.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['dead_letter_requeue', 'purge_legacy'] }),
    __metadata("design:type", String)
], AgentRuntimeMaintenanceAudit.prototype, "action", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRuntimeMaintenanceAudit.prototype, "batchId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRuntimeMaintenanceAudit.prototype, "actorId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentRuntimeMaintenanceAudit.prototype, "actorRole", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: false }),
    __metadata("design:type", Boolean)
], AgentRuntimeMaintenanceAudit.prototype, "dryRun", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentRuntimeMaintenanceAudit.prototype, "matched", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 0 }),
    __metadata("design:type", Number)
], AgentRuntimeMaintenanceAudit.prototype, "affected", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentRuntimeMaintenanceAudit.prototype, "scope", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], AgentRuntimeMaintenanceAudit.prototype, "result", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentRuntimeMaintenanceAudit.prototype, "summary", void 0);
exports.AgentRuntimeMaintenanceAudit = AgentRuntimeMaintenanceAudit = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_runtime_maintenance_audits' })
], AgentRuntimeMaintenanceAudit);
exports.AgentRuntimeMaintenanceAuditSchema = mongoose_1.SchemaFactory.createForClass(AgentRuntimeMaintenanceAudit);
exports.AgentRuntimeMaintenanceAuditSchema.index({ createdAt: -1 });
exports.AgentRuntimeMaintenanceAuditSchema.index({ action: 1, createdAt: -1 });
exports.AgentRuntimeMaintenanceAuditSchema.index({ batchId: 1, createdAt: -1 });
//# sourceMappingURL=agent-runtime-maintenance-audit.schema.js.map