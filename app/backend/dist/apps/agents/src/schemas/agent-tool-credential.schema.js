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
exports.AgentToolCredentialSchema = exports.AgentToolCredential = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let AgentToolCredential = class AgentToolCredential {
};
exports.AgentToolCredential = AgentToolCredential;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "keyId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "secretHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'revoked', 'expired'], default: 'active', index: true }),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], AgentToolCredential.prototype, "scopeTemplate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "label", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], AgentToolCredential.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentToolCredential.prototype, "rotatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], AgentToolCredential.prototype, "lastUsedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", Date)
], AgentToolCredential.prototype, "expiresAt", void 0);
exports.AgentToolCredential = AgentToolCredential = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_tool_credentials' })
], AgentToolCredential);
exports.AgentToolCredentialSchema = mongoose_1.SchemaFactory.createForClass(AgentToolCredential);
exports.AgentToolCredentialSchema.index({ agentId: 1, status: 1 });
//# sourceMappingURL=agent-tool-credential.schema.js.map