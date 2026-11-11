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
exports.RdIntelligenceToolHandler = void 0;
const common_1 = require("@nestjs/common");
const internal_api_client_service_1 = require("../internal-api-client.service");
let RdIntelligenceToolHandler = class RdIntelligenceToolHandler {
    constructor(internalApiClient) {
        this.internalApiClient = internalApiClient;
    }
    async runEngineeringStatistics(params) {
        const payload = {
            receiverId: params?.receiverId || undefined,
            scope: params?.scope || 'all',
            tokenMode: params?.tokenMode || 'estimate',
            projectIds: Array.isArray(params?.projectIds)
                ? params.projectIds.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
            triggeredBy: params?.triggeredBy || 'agent-mcp',
        };
        const response = await this.internalApiClient.postEngineeringStatistics(payload);
        return {
            action: 'engineering_statistics_run',
            snapshot: response,
            fetchedAt: new Date().toISOString(),
        };
    }
    async runDocsHeat(params) {
        const payload = {
            ...(Number.isFinite(Number(params?.topN)) && Number(params?.topN) > 0
                ? { topN: Math.floor(Number(params?.topN)) }
                : {}),
            triggeredBy: params?.triggeredBy || 'agent-mcp',
        };
        const response = await this.internalApiClient.postDocsHeatRefresh(payload);
        return {
            action: 'docs_heat_run',
            result: response,
            fetchedAt: new Date().toISOString(),
        };
    }
};
exports.RdIntelligenceToolHandler = RdIntelligenceToolHandler;
exports.RdIntelligenceToolHandler = RdIntelligenceToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [internal_api_client_service_1.InternalApiClient])
], RdIntelligenceToolHandler);
//# sourceMappingURL=engineering-statistics-tool-handler.service.js.map