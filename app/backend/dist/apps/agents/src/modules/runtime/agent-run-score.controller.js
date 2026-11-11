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
exports.AgentRunScoreController = void 0;
const common_1 = require("@nestjs/common");
const agent_run_score_service_1 = require("./agent-run-score.service");
let AgentRunScoreController = class AgentRunScoreController {
    constructor(runScoreService) {
        this.runScoreService = runScoreService;
    }
    getUserContext(req) {
        const context = req.userContext;
        if (!context) {
            throw new common_1.ForbiddenException('Missing user context');
        }
        return context;
    }
    assertRuntimeControlPermission(context) {
    }
    async getRunScore(runId, req) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const score = await this.runScoreService.getScoreByRunId(runId);
        if (!score) {
            throw new common_1.NotFoundException('Runtime run score not found');
        }
        return {
            success: true,
            runId,
            score,
        };
    }
    async getScoreStats(req, agentId, from, to, topN) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const stats = await this.runScoreService.getAgentScoreStats(agentId?.trim() || undefined, {
            from: this.toDateOrUndefined(from),
            to: this.toDateOrUndefined(to),
            topN: this.toPositiveNumberOrUndefined(topN),
        });
        return {
            success: true,
            agentId: agentId?.trim() || undefined,
            from: this.toDateOrUndefined(from),
            to: this.toDateOrUndefined(to),
            stats,
        };
    }
    async listScores(req, agentId, from, to, minScore, maxScore, page, pageSize) {
        const context = this.getUserContext(req);
        this.assertRuntimeControlPermission(context);
        const result = await this.runScoreService.getScoresByAgent(agentId?.trim() || undefined, {
            from: this.toDateOrUndefined(from),
            to: this.toDateOrUndefined(to),
            minScore: this.toNumberOrUndefined(minScore),
            maxScore: this.toNumberOrUndefined(maxScore),
            page: this.toPositiveNumberOrUndefined(page),
            pageSize: this.toPositiveNumberOrUndefined(pageSize),
        });
        return {
            success: true,
            agentId: agentId?.trim() || undefined,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
            items: result.items,
        };
    }
    toDateOrUndefined(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return undefined;
        }
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed;
    }
    toNumberOrUndefined(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return undefined;
        }
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) {
            return undefined;
        }
        return parsed;
    }
    toPositiveNumberOrUndefined(value) {
        const parsed = this.toNumberOrUndefined(value);
        if (typeof parsed !== 'number' || parsed <= 0) {
            return undefined;
        }
        return Math.floor(parsed);
    }
};
exports.AgentRunScoreController = AgentRunScoreController;
__decorate([
    (0, common_1.Get)('runs/:runId/score'),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentRunScoreController.prototype, "getRunScore", null);
__decorate([
    (0, common_1.Get)('scores/stats'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('topN')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AgentRunScoreController.prototype, "getScoreStats", null);
__decorate([
    (0, common_1.Get)('scores'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('minScore')),
    __param(5, (0, common_1.Query)('maxScore')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AgentRunScoreController.prototype, "listScores", null);
exports.AgentRunScoreController = AgentRunScoreController = __decorate([
    (0, common_1.Controller)('agents/runtime'),
    __metadata("design:paramtypes", [agent_run_score_service_1.AgentRunScoreService])
], AgentRunScoreController);
//# sourceMappingURL=agent-run-score.controller.js.map