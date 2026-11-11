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
exports.ModelRegistrySchema = exports.ModelRegistry = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let ModelRegistry = class ModelRegistry {
};
exports.ModelRegistry = ModelRegistry;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, trim: true }),
    __metadata("design:type", String)
], ModelRegistry.prototype, "id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], ModelRegistry.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ModelRegistry.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], ModelRegistry.prototype, "availability", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ModelRegistry.prototype, "deprecated", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], ModelRegistry.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], ModelRegistry.prototype, "model", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 4096 }),
    __metadata("design:type", Number)
], ModelRegistry.prototype, "maxTokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0.7 }),
    __metadata("design:type", Number)
], ModelRegistry.prototype, "temperature", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 1 }),
    __metadata("design:type", Number)
], ModelRegistry.prototype, "topP", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            input: { type: Number },
            output: { type: Number },
            cache_read: { type: Number },
            cache_write: { type: Number },
            reasoning: { type: Number },
        },
        _id: false,
        default: undefined,
    }),
    __metadata("design:type", Object)
], ModelRegistry.prototype, "cost", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            enabled: { type: Boolean, default: false },
            effort: { type: String, enum: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] },
            verbosity: { type: String, enum: ['low', 'medium', 'high'] },
        },
        default: undefined,
    }),
    __metadata("design:type", Object)
], ModelRegistry.prototype, "reasoning", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ModelRegistry.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], ModelRegistry.prototype, "updatedAt", void 0);
exports.ModelRegistry = ModelRegistry = __decorate([
    (0, mongoose_1.Schema)({ collection: 'agent_model_registry', timestamps: true })
], ModelRegistry);
exports.ModelRegistrySchema = mongoose_1.SchemaFactory.createForClass(ModelRegistry);
exports.ModelRegistrySchema.index({ provider: 1, model: 1 }, { unique: true });
//# sourceMappingURL=model-registry.schema.js.map