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
exports.UsageDailySnapshotSchema = exports.UsageDailySnapshot = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let UsageDailySnapshot = class UsageDailySnapshot {
};
exports.UsageDailySnapshot = UsageDailySnapshot;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], UsageDailySnapshot.prototype, "date", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null, index: true }),
    __metadata("design:type", String)
], UsageDailySnapshot.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null, index: true }),
    __metadata("design:type", String)
], UsageDailySnapshot.prototype, "modelId", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            input: { type: Number, default: 0 },
            output: { type: Number, default: 0 },
            reasoning: { type: Number, default: 0 },
            cacheRead: { type: Number, default: 0 },
            cacheWrite: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },
        _id: false,
        default: {},
    }),
    __metadata("design:type", Object)
], UsageDailySnapshot.prototype, "tokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], UsageDailySnapshot.prototype, "totalCost", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], UsageDailySnapshot.prototype, "requestCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], UsageDailySnapshot.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], UsageDailySnapshot.prototype, "updatedAt", void 0);
exports.UsageDailySnapshot = UsageDailySnapshot = __decorate([
    (0, mongoose_1.Schema)({ collection: 'agent_usage_daily_snapshots', timestamps: true })
], UsageDailySnapshot);
exports.UsageDailySnapshotSchema = mongoose_1.SchemaFactory.createForClass(UsageDailySnapshot);
exports.UsageDailySnapshotSchema.index({ date: 1, agentId: 1, modelId: 1 }, { unique: true });
//# sourceMappingURL=usage-daily-snapshot.schema.js.map