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
var AgentRunScoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunScoreService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const agent_run_score_schema_1 = require("../../schemas/agent-run-score.schema");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
let AgentRunScoreService = AgentRunScoreService_1 = class AgentRunScoreService {
    constructor(scoreModel, runModel) {
        this.scoreModel = scoreModel;
        this.runModel = runModel;
        this.logger = new common_1.Logger(AgentRunScoreService_1.name);
    }
    async saveScore(input) {
        try {
            await this.scoreModel
                .updateOne({ runId: input.runId }, {
                $setOnInsert: {
                    id: `run-score-${(0, uuid_1.v4)()}`,
                    runId: input.runId,
                },
                $set: {
                    agentId: input.agentId,
                    taskId: input.taskId,
                    sessionId: input.sessionId,
                    score: input.summary.score,
                    baseScore: input.summary.baseScore,
                    totalDeductions: input.summary.totalDeductions,
                    stats: input.summary.stats,
                    deductionsByRule: input.summary.deductionsByRule,
                    deductions: input.summary.deductions,
                    ruleVersion: input.summary.ruleVersion,
                },
            }, { upsert: true })
                .exec();
            await this.runModel
                .updateOne({ id: input.runId }, { $set: { score: input.summary.score } })
                .exec();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[save_run_score_failed] runId=${input.runId} agentId=${input.agentId} error=${message}`);
        }
    }
    async getScoreByRunId(runId) {
        return this.scoreModel.findOne({ runId }).lean().exec();
    }
    async getScoresByAgent(agentId, filter) {
        const page = Math.max(1, Number(filter?.page || 1));
        const pageSize = Math.max(1, Math.min(200, Number(filter?.pageSize || 20)));
        const query = this.buildFilterQuery(agentId, filter);
        const [total, items] = await Promise.all([
            this.scoreModel.countDocuments(query).exec(),
            this.scoreModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .lean()
                .exec(),
        ]);
        return {
            total,
            page,
            pageSize,
            items,
        };
    }
    async getAgentScoreStats(agentId, period) {
        const query = this.buildFilterQuery(agentId, {
            from: period?.from,
            to: period?.to,
        });
        const topN = Math.max(1, Math.min(20, Number(period?.topN || 5)));
        const [summaryRows, ruleRows] = await Promise.all([
            this.scoreModel
                .aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalRuns: { $sum: 1 },
                        averageScore: { $avg: '$score' },
                        minScore: { $min: '$score' },
                        maxScore: { $max: '$score' },
                    },
                },
            ])
                .exec(),
            this.scoreModel
                .aggregate([
                { $match: query },
                { $unwind: '$deductions' },
                {
                    $group: {
                        _id: '$deductions.ruleId',
                        count: { $sum: 1 },
                        totalPoints: { $sum: '$deductions.points' },
                    },
                },
                { $sort: { count: -1, _id: 1 } },
                { $limit: topN },
            ])
                .exec(),
        ]);
        const summary = summaryRows?.[0];
        return {
            totalRuns: Number(summary?.totalRuns || 0),
            averageScore: Number(summary?.averageScore || 0),
            minScore: Number(summary?.minScore || 0),
            maxScore: Number(summary?.maxScore || 0),
            ruleFrequencyTop: (ruleRows || []).map((row) => ({
                ruleId: row._id,
                count: row.count,
                totalPoints: row.totalPoints,
            })),
        };
    }
    buildFilterQuery(agentId, filter) {
        const query = {};
        if (agentId) {
            query.agentId = agentId;
        }
        const createdAtRange = {};
        if (filter?.from) {
            createdAtRange.$gte = filter.from;
        }
        if (filter?.to) {
            createdAtRange.$lte = filter.to;
        }
        if (Object.keys(createdAtRange).length > 0) {
            query.createdAt = createdAtRange;
        }
        const scoreRange = {};
        if (typeof filter?.minScore === 'number' && Number.isFinite(filter.minScore)) {
            scoreRange.$gte = filter.minScore;
        }
        if (typeof filter?.maxScore === 'number' && Number.isFinite(filter.maxScore)) {
            scoreRange.$lte = filter.maxScore;
        }
        if (Object.keys(scoreRange).length > 0) {
            query.score = scoreRange;
        }
        return query;
    }
};
exports.AgentRunScoreService = AgentRunScoreService;
exports.AgentRunScoreService = AgentRunScoreService = AgentRunScoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_run_score_schema_1.AgentRunScore.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_run_schema_1.AgentRun.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], AgentRunScoreService);
//# sourceMappingURL=agent-run-score.service.js.map