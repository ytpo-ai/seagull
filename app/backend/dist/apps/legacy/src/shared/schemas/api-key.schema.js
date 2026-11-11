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
exports.ApiKeySchema = exports.ApiKey = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const encryption_util_1 = require("../utils/encryption.util");
let ApiKey = class ApiKey {
    get key() {
        try {
            return encryption_util_1.EncryptionUtil.decrypt(this.keyEncrypted);
        }
        catch (error) {
            console.error('Failed to decrypt API key:', error.message);
            return '';
        }
    }
};
exports.ApiKey = ApiKey;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], ApiKey.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ApiKey.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ApiKey.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], ApiKey.prototype, "keyEncrypted", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ApiKey.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], ApiKey.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiKey.prototype, "lastUsedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], ApiKey.prototype, "useCount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiKey.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], ApiKey.prototype, "isDefault", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], ApiKey.prototype, "isDeprecated", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'LLM', enum: ['LLM', 'OTHER'] }),
    __metadata("design:type", String)
], ApiKey.prototype, "category", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiKey.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ApiKey.prototype, "updatedAt", void 0);
exports.ApiKey = ApiKey = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'api_keys' })
], ApiKey);
exports.ApiKeySchema = mongoose_1.SchemaFactory.createForClass(ApiKey);
exports.ApiKeySchema.statics.createEncrypted = function (data) {
    if (data.keyEncrypted) {
        return this.create(data);
    }
    const plainKey = data._plainKey;
    if (!plainKey) {
        throw new Error('API key is required');
    }
    const encrypted = encryption_util_1.EncryptionUtil.encrypt(plainKey);
    return this.create({
        ...data,
        keyEncrypted: encrypted
    });
};
exports.ApiKeySchema.methods.getDecryptedKey = function () {
    try {
        return encryption_util_1.EncryptionUtil.decrypt(this.keyEncrypted);
    }
    catch (error) {
        console.error('Failed to decrypt API key:', error.message);
        return '';
    }
};
exports.ApiKeySchema.index({ provider: 1 });
exports.ApiKeySchema.index({ isActive: 1 });
exports.ApiKeySchema.index({ id: 1 });
exports.ApiKeySchema.index({ provider: 1, isDefault: 1 });
//# sourceMappingURL=api-key.schema.js.map