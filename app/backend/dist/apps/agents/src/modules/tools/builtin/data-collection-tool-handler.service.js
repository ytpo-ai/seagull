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
exports.DataCollectionToolHandler = void 0;
const common_1 = require("@nestjs/common");
const internal_api_client_service_1 = require("../internal-api-client.service");
let DataCollectionToolHandler = class DataCollectionToolHandler {
    constructor(internalApiClient) {
        this.internalApiClient = internalApiClient;
    }
    resolveSourceId(params) {
        const sourceId = String(params?.sourceId || params?.dataSourceId || '').trim();
        if (!sourceId) {
            throw new Error('data-collection tool requires sourceId');
        }
        return sourceId;
    }
    async getSourceConfig(params, agentId, _executionContext) {
        const sourceId = this.resolveSourceId(params || {});
        const source = await this.internalApiClient.callEiApi('GET', `/data-sources/${encodeURIComponent(sourceId)}`);
        return {
            action: 'data_collection_get_source_config',
            initiatorAgentId: agentId,
            source,
            fetchedAt: new Date().toISOString(),
        };
    }
    async writeRecord(params, agentId, _executionContext) {
        const sourceId = this.resolveSourceId(params || {});
        const payload = {
            data: params?.data,
            rawData: String(params?.rawData || '').trim() || undefined,
            tags: Array.isArray(params?.tags) ? params?.tags : undefined,
            status: params?.status,
            error: String(params?.error || '').trim() || undefined,
            dataCategory: params?.dataCategory,
        };
        const result = await this.internalApiClient.callEiApi('POST', `/data-sources/${encodeURIComponent(sourceId)}/collect`, payload);
        return {
            action: 'data_collection_write_record',
            initiatorAgentId: agentId,
            sourceId,
            result,
            writtenAt: new Date().toISOString(),
        };
    }
};
exports.DataCollectionToolHandler = DataCollectionToolHandler;
exports.DataCollectionToolHandler = DataCollectionToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [internal_api_client_service_1.InternalApiClient])
], DataCollectionToolHandler);
//# sourceMappingURL=data-collection-tool-handler.service.js.map