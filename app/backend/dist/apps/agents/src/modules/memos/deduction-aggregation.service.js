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
var DeductionAggregationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeductionAggregationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_run_score_schema_1 = require("../../schemas/agent-run-score.schema");
const agent_memo_schema_1 = require("../../schemas/agent-memo.schema");
const SCORE_RULE_LABEL = {
    D1: '工具参数预检失败',
    D2: '多 tool_call 批量输出',
    D3: '连续两轮调用相同工具',
    D4: '工具执行失败（非参数类）',
    D5: '工具执行失败（参数类）',
    D6: '调用未授权工具',
    D7: 'tool_call JSON 解析失败',
    D8: '文本意图未执行',
    D9: 'Planner 纯文本重试触发',
    D10: '空/无意义响应',
    D11: '达到最大轮次上限',
    D12: 'LLM 调用超时/网络错误',
};
let DeductionAggregationService = DeductionAggregationService_1 = class DeductionAggregationService {
    constructor(scoreModel, memoModel, redisService) {
        this.scoreModel = scoreModel;
        this.memoModel = memoModel;
        this.redisService = redisService;
        this.logger = new common_1.Logger(DeductionAggregationService_1.name);
    }
    async aggregateDeductions(agentId) {
        this.logger.log(`Starting deduction aggregation for agent: ${agentId}`);
        try {
            const existingMemo = await this.memoModel.findOne({ agentId, memoKind: 'deduction' }).exec();
            const previousPayload = existingMemo?.payload || {};
            const previousHistory = previousPayload.historySummary || {
                totalRuns: 0,
                totalScoreSum: 0,
                ruleFrequency: {},
                lastAggregatedAt: '',
                recentDeductions: [],
            };
            const [recentRuns, twoDayStats, incrementalScores] = await Promise.all([
                this.getRecentRunScores(agentId, 10),
                this.getTwoDayRuleStats(agentId),
                this.getIncrementalScores(agentId, previousHistory.lastAggregatedAt),
            ]);
            const updatedHistory = this.mergeHistorySummary(previousHistory, incrementalScores);
            updatedHistory.recentDeductions = this.buildRecentDeductions(recentRuns);
            const content = this.buildDeductionContent(recentRuns, twoDayStats, updatedHistory);
            await this.updateDeductionMemo(agentId, content, updatedHistory, existingMemo);
            await this.refreshDeductionCache(agentId);
            this.logger.log(`Deduction aggregation completed for agent: ${agentId}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Deduction aggregation failed for agent ${agentId}: ${message}`);
        }
    }
    async getRecentRunScores(agentId, limit) {
        return this.scoreModel
            .find({ agentId, totalDeductions: { $gt: 0 } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .exec();
    }
    async getTwoDayRuleStats(agentId) {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
        return this.scoreModel
            .aggregate([
            { $match: { agentId, createdAt: { $gte: twoDaysAgo } } },
            { $unwind: '$deductions' },
            {
                $group: {
                    _id: '$deductions.ruleId',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$deductions.points' },
                },
            },
            { $sort: { count: -1, _id: 1 } },
        ])
            .exec()
            .then((rows) => rows.map((row) => ({
            ruleId: row._id,
            count: row.count,
            totalPoints: row.totalPoints,
        })));
    }
    async getIncrementalScores(agentId, lastAggregatedAt) {
        const query = { agentId };
        if (lastAggregatedAt) {
            query.createdAt = { $gt: new Date(lastAggregatedAt) };
        }
        return this.scoreModel.find(query).lean().exec();
    }
    mergeHistorySummary(previous, incrementalScores) {
        let totalRuns = previous.totalRuns;
        let totalScoreSum = previous.totalScoreSum;
        const ruleFrequency = { ...previous.ruleFrequency };
        for (const score of incrementalScores) {
            totalRuns += 1;
            totalScoreSum += score.score;
            for (const deduction of score.deductions || []) {
                const ruleId = deduction.ruleId;
                if (!ruleFrequency[ruleId]) {
                    ruleFrequency[ruleId] = { count: 0, totalPoints: 0 };
                }
                ruleFrequency[ruleId].count += 1;
                ruleFrequency[ruleId].totalPoints += deduction.points;
            }
        }
        return {
            totalRuns,
            totalScoreSum,
            ruleFrequency,
            lastAggregatedAt: new Date().toISOString(),
            recentDeductions: [],
        };
    }
    buildDeductionContent(recentRuns, twoDayStats, history) {
        const lines = [];
        lines.push('# 执行扣分记录', '');
        lines.push('## 近期扣分明细（最近有扣分的 Run）', '');
        if (recentRuns.length > 0) {
            lines.push('| 时间 | 得分 | 扣分项 | 关键扣分详情 |');
            lines.push('|------|------|--------|-------------|');
            for (const run of recentRuns) {
                const runCreatedAt = run.createdAt;
                const time = runCreatedAt
                    ? new Date(runCreatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                    : 'N/A';
                const deductionItems = this.summarizeDeductionsByRule(run.deductionsByRule);
                const keyDetails = this.extractKeyDetails(run.deductions || [], 2);
                lines.push(`| ${time} | ${run.score} | ${deductionItems} | ${keyDetails} |`);
            }
        }
        else {
            lines.push('暂无扣分记录。');
        }
        lines.push('');
        lines.push('## 近 2 天扣分统计（按规则汇总）', '');
        if (twoDayStats.length > 0) {
            lines.push('| 规则 | 描述 | 触发次数 | 累计扣分 |');
            lines.push('|------|------|---------|---------|');
            for (const stat of twoDayStats) {
                const label = SCORE_RULE_LABEL[stat.ruleId] || stat.ruleId;
                lines.push(`| ${stat.ruleId} | ${label} | ${stat.count} | ${stat.totalPoints} |`);
            }
        }
        else {
            lines.push('近 2 天无扣分记录。');
        }
        lines.push('');
        lines.push('## 历史扣分统计', '');
        const avgScore = history.totalRuns > 0
            ? Math.round((history.totalScoreSum / history.totalRuns) * 10) / 10
            : 0;
        lines.push(`- **总评分次数**：${history.totalRuns}`);
        lines.push(`- **历史平均得分**：${avgScore}`);
        lines.push('');
        const sortedRules = Object.entries(history.ruleFrequency)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 8);
        if (sortedRules.length > 0) {
            lines.push('### 最常触发规则 (Top 8)', '');
            lines.push('| 规则 | 描述 | 历史触发次数 | 历史累计扣分 |');
            lines.push('|------|------|-------------|-------------|');
            for (const [ruleId, stat] of sortedRules) {
                const label = SCORE_RULE_LABEL[ruleId] || ruleId;
                lines.push(`| ${ruleId} | ${label} | ${stat.count} | ${stat.totalPoints} |`);
            }
        }
        lines.push('');
        lines.push('## 元信息', '');
        lines.push(`- lastAggregatedAt: ${history.lastAggregatedAt}`);
        lines.push(`- sources: [agent_run_scores]`);
        return lines.join('\n');
    }
    summarizeDeductionsByRule(deductionsByRule) {
        if (!deductionsByRule || Object.keys(deductionsByRule).length === 0)
            return '-';
        return Object.entries(deductionsByRule)
            .map(([ruleId, stat]) => `${ruleId}(${stat.totalPoints})`)
            .join(' ');
    }
    extractKeyDetails(deductions, limit) {
        const withDetail = deductions.filter((d) => d.detail || d.toolId);
        if (withDetail.length === 0)
            return '-';
        return withDetail
            .slice(0, limit)
            .map((d) => {
            const label = SCORE_RULE_LABEL[d.ruleId] || d.ruleId;
            const info = d.detail || d.toolId || '';
            return `${label}: ${this.compact(info, 40)}`;
        })
            .join('; ');
    }
    buildRecentDeductions(recentRuns) {
        const snapshots = [];
        for (const run of recentRuns.slice(0, 5)) {
            const runCreatedAt = run.createdAt
                ? new Date(run.createdAt).toISOString()
                : '';
            for (const deduction of run.deductions || []) {
                if (!deduction.detail && !deduction.toolId)
                    continue;
                snapshots.push({
                    ruleId: deduction.ruleId,
                    toolId: deduction.toolId,
                    detail: deduction.detail ? this.compact(deduction.detail, 120) : undefined,
                    round: deduction.round,
                    score: run.score,
                    runCreatedAt,
                });
                if (snapshots.length >= 20)
                    break;
            }
            if (snapshots.length >= 20)
                break;
        }
        return snapshots;
    }
    compact(text, maxLength) {
        if (!text)
            return '';
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength)
            return normalized;
        return normalized.slice(0, Math.max(0, maxLength - 3)) + '...';
    }
    async updateDeductionMemo(agentId, content, historySummary, existingMemo) {
        const now = new Date();
        const slug = 'deduction-history';
        if (existingMemo) {
            const nextVersion = Math.max(1, Number(existingMemo.version || 1)) + 1;
            await this.memoModel
                .findOneAndUpdate({ id: existingMemo.id }, {
                $set: {
                    content,
                    version: nextVersion,
                    payload: {
                        topic: 'deduction',
                        historySummary,
                    },
                    tags: ['deduction', 'scoring', 'penalty'],
                    contextKeywords: ['deduction', 'scoring', 'penalty', 'error', 'mistake'],
                    source: 'deduction-aggregator',
                    updatedAt: now,
                },
            }, { new: true })
                .exec();
        }
        else {
            await this.memoModel
                .create({
                id: (0, uuid_1.v4)(),
                agentId,
                title: '执行扣分记录',
                slug,
                content,
                version: 1,
                memoKind: 'deduction',
                memoType: 'standard',
                payload: {
                    topic: 'deduction',
                    historySummary,
                },
                tags: ['deduction', 'scoring', 'penalty'],
                contextKeywords: ['deduction', 'scoring', 'penalty', 'error', 'mistake'],
                source: 'deduction-aggregator',
                createdAt: now,
                updatedAt: now,
            })
                .catch((err) => {
                if (err.code === 11000) {
                    this.logger.warn(`Deduction memo already exists for agent ${agentId}, skipping`);
                }
                else {
                    throw err;
                }
            });
        }
    }
    async refreshDeductionCache(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            return;
        const items = await this.memoModel
            .find({ agentId: normalizedAgentId, memoKind: 'deduction' })
            .sort({ updatedAt: -1 })
            .limit(200)
            .exec();
        const payload = {
            agentId: normalizedAgentId,
            memoKind: 'deduction',
            items,
            updatedAt: new Date().toISOString(),
        };
        await this.redisService.set(`memo:${normalizedAgentId}:deduction`, JSON.stringify(payload));
    }
};
exports.DeductionAggregationService = DeductionAggregationService;
exports.DeductionAggregationService = DeductionAggregationService = DeductionAggregationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_run_score_schema_1.AgentRunScore.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_memo_schema_1.AgentMemo.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        infra_1.RedisService])
], DeductionAggregationService);
//# sourceMappingURL=deduction-aggregation.service.js.map