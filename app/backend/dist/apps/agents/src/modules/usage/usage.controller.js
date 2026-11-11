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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageController = void 0;
const common_1 = require("@nestjs/common");
const usage_aggregation_service_1 = require("./usage-aggregation.service");
const model_pricing_service_1 = require("../models/model-pricing.service");
let UsageController = class UsageController {
    constructor(usageAggregationService, modelPricingService) {
        this.usageAggregationService = usageAggregationService;
        this.modelPricingService = modelPricingService;
    }
    async getOverview(period) {
        return this.usageAggregationService.getOverview(period === 'week' ? 'week' : 'month');
    }
    async getDailyTrend(from, to) {
        return this.usageAggregationService.getDailyTrend(from, to);
    }
    async getByAgent(from, to, limit) {
        return this.usageAggregationService.getByAgent(from, to, Number(limit || 10));
    }
    async getByModel(from, to, limit) {
        return this.usageAggregationService.getByModel(from, to, Number(limit || 10));
    }
    async getPricingStatus() {
        return this.modelPricingService.getPricingStatus();
    }
    async refreshPricing() {
        return this.modelPricingService.manualRefresh();
    }
};
exports.UsageController = UsageController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('daily-trend'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "getDailyTrend", null);
__decorate([
    (0, common_1.Get)('by-agent'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "getByAgent", null);
__decorate([
    (0, common_1.Get)('by-model'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "getByModel", null);
__decorate([
    (0, common_1.Get)('pricing/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "getPricingStatus", null);
__decorate([
    (0, common_1.Post)('pricing/refresh'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "refreshPricing", null);
exports.UsageController = UsageController = __decorate([
    (0, common_1.Controller)('usage'),
    __metadata("design:paramtypes", [usage_aggregation_service_1.UsageAggregationService,
        model_pricing_service_1.ModelPricingService])
], UsageController);
//# sourceMappingURL=usage.controller.js.map