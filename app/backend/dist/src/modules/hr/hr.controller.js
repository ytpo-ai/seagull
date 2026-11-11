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
exports.HRController = void 0;
const common_1 = require("@nestjs/common");
const hr_service_1 = require("./hr.service");
let HRController = class HRController {
    constructor(hrService) {
        this.hrService = hrService;
    }
    generatePerformanceReport(agentId) {
        return this.hrService.generatePerformanceReport(agentId);
    }
    identifyLowPerformers() {
        return this.hrService.identifyLowPerformers();
    }
    recommendHiring() {
        return this.hrService.recommendHiring();
    }
    calculateTeamHealth() {
        return this.hrService.calculateTeamHealth();
    }
    async batchEvaluation(body) {
        const reports = await Promise.all(body.agentIds.map(agentId => this.hrService.generatePerformanceReport(agentId)));
        return {
            totalEvaluated: reports.length,
            reports,
            summary: {
                avgScore: reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length,
                highPerformers: reports.filter(r => r.overallScore >= 85).length,
                averagePerformers: reports.filter(r => r.overallScore >= 65 && r.overallScore < 85).length,
                lowPerformers: reports.filter(r => r.overallScore < 65).length
            }
        };
    }
};
exports.HRController = HRController;
__decorate([
    (0, common_1.Get)('performance/:agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HRController.prototype, "generatePerformanceReport", null);
__decorate([
    (0, common_1.Get)('low-performers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HRController.prototype, "identifyLowPerformers", null);
__decorate([
    (0, common_1.Get)('hiring-recommendations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HRController.prototype, "recommendHiring", null);
__decorate([
    (0, common_1.Get)('team-health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HRController.prototype, "calculateTeamHealth", null);
__decorate([
    (0, common_1.Post)('batch-evaluation'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HRController.prototype, "batchEvaluation", null);
exports.HRController = HRController = __decorate([
    (0, common_1.Controller)('hr'),
    __metadata("design:paramtypes", [hr_service_1.HRService])
], HRController);
//# sourceMappingURL=hr.controller.js.map