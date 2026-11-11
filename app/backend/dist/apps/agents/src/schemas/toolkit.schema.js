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
exports.ToolkitSchema = exports.Toolkit = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Toolkit = class Toolkit {
};
exports.Toolkit = Toolkit;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], Toolkit.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], Toolkit.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], Toolkit.prototype, "executionChannel", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], Toolkit.prototype, "namespace", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Toolkit.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: '' }),
    __metadata("design:type", String)
], Toolkit.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'v1' }),
    __metadata("design:type", String)
], Toolkit.prototype, "version", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['oauth2', 'apiKey', 'none'], default: 'none' }),
    __metadata("design:type", String)
], Toolkit.prototype, "authStrategy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['active', 'disabled', 'deprecated'], default: 'active', index: true }),
    __metadata("design:type", String)
], Toolkit.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Toolkit.prototype, "rateLimitPolicyId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Toolkit.prototype, "defaultTimeoutMs", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Toolkit.prototype, "metadata", void 0);
exports.Toolkit = Toolkit = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'agent_toolkits' })
], Toolkit);
exports.ToolkitSchema = mongoose_1.SchemaFactory.createForClass(Toolkit);
//# sourceMappingURL=toolkit.schema.js.map