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
var EvaluationAggregationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationAggregationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const agent_part_schema_1 = require("../../schemas/agent-part.schema");
const agent_memo_schema_1 = require("../../schemas/agent-memo.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
let EvaluationAggregationService = EvaluationAggregationService_1 = class EvaluationAggregationService {
    constructor(runModel, partModel, memoModel, agentModel, skillModel) {
        this.runModel = runModel;
        this.partModel = partModel;
        this.memoModel = memoModel;
        this.agentModel = agentModel;
        this.skillModel = skillModel;
        this.logger = new common_1.Logger(EvaluationAggregationService_1.name);
    }
    async aggregateEvaluation(agentId, period) {
        this.logger.log(`Starting evaluation aggregation for agent: ${agentId}`);
        try {
            const { start, end } = period || this.getCurrentMonth();
            const [skillStats, toolStats, slaMetrics] = await Promise.all([
                this.getSkillStatistics(agentId),
                this.getToolUsageStats(agentId, start, end),
                this.getSlaMetrics(agentId, start, end),
            ]);
            const content = this.buildEvaluationContent({ skillStats, toolStats, slaMetrics }, start, end);
            await this.updateEvaluationMemo(agentId, content, {
                lastAggregatedAt: new Date().toISOString(),
                period: {
                    start: start.toISOString(),
                    end: end.toISOString(),
                },
            });
            this.logger.log(`Evaluation aggregation completed for agent: ${agentId}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Evaluation aggregation failed for agent ${agentId}: ${message}`);
            throw error;
        }
    }
    getCurrentMonth() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return { start, end };
    }
    async getSkillStatistics(agentId) {
        const agent = await this.getAgentDocument(agentId);
        const skillIds = Array.from(new Set((agent?.skills || []).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!skillIds.length) {
            return {
                skills: [],
                proficiencyCount: { expert: 0, advanced: 0, intermediate: 0, beginner: 0 },
            };
        }
        const skills = await this.skillModel.find({ id: { $in: skillIds } }).exec();
        const skillMap = new Map(skills.map((item) => [item.id, item]));
        const skillsWithCategory = skillIds.map((skillId) => {
            const skill = skillMap.get(skillId);
            return {
                name: skill?.name || skillId,
                proficiencyLevel: 'beginner',
                category: skill?.category || 'general',
            };
        });
        const proficiencyCount = {
            expert: skillsWithCategory.filter((s) => s.proficiencyLevel === 'expert').length,
            advanced: skillsWithCategory.filter((s) => s.proficiencyLevel === 'advanced').length,
            intermediate: skillsWithCategory.filter((s) => s.proficiencyLevel === 'intermediate').length,
            beginner: skillsWithCategory.filter((s) => s.proficiencyLevel === 'beginner').length,
        };
        return { skills: skillsWithCategory, proficiencyCount };
    }
    async getToolUsageStats(agentId, start, end) {
        const runs = await this.runModel
            .find({
            agentId,
            createdAt: { $gte: start, $lte: end },
            status: { $in: ['completed', 'failed'] },
        })
            .exec();
        const runIds = runs.map((r) => r.id);
        if (runIds.length === 0) {
            return [];
        }
        const toolResults = await this.partModel
            .find({
            runId: { $in: runIds },
            type: 'tool_result',
        })
            .exec();
        const toolMap = new Map();
        for (const part of toolResults) {
            const toolId = part.toolId || 'unknown';
            const existing = toolMap.get(toolId) || { total: 0, success: 0 };
            existing.total += 1;
            if (part.status === 'completed' && !part.error) {
                existing.success += 1;
            }
            toolMap.set(toolId, existing);
        }
        return Array.from(toolMap.entries())
            .map(([toolId, stats]) => ({
            toolId,
            usageCount: stats.total,
            successCount: stats.success,
            successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
        }))
            .sort((a, b) => b.usageCount - a.usageCount);
    }
    async getSlaMetrics(agentId, start, end) {
        const runs = await this.runModel
            .find({
            agentId,
            createdAt: { $gte: start, $lte: end },
        })
            .exec();
        const totalTasks = runs.length;
        const completedTasks = runs.filter((r) => r.status === 'completed').length;
        const failedTasks = runs.filter((r) => r.status === 'failed').length;
        const runsWithDuration = runs.filter((r) => r.startedAt && r.finishedAt);
        const totalDuration = runsWithDuration.reduce((sum, r) => {
            const duration = new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime();
            return sum + duration;
        }, 0);
        const avgResponseTimeSeconds = runsWithDuration.length > 0 ? Math.round(totalDuration / runsWithDuration.length / 1000) : undefined;
        return {
            totalTasks,
            completedTasks,
            failedTasks,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            avgResponseTimeSeconds,
        };
    }
    buildEvaluationContent(data, start, end) {
        const { skillStats, toolStats, slaMetrics } = data;
        const lines = [];
        lines.push('# 工作评估', '');
        const periodStr = `${start.toLocaleDateString('zh-CN')} ~ ${end.toLocaleDateString('zh-CN')}`;
        lines.push(`**评估周期**：${periodStr}`, '');
        lines.push('## 技能统计', '');
        if (skillStats.skills.length > 0) {
            lines.push('### 技能分布', '');
            lines.push('| 技能名称 | 熟练度 | 类别 |');
            lines.push('|---------|--------|------|');
            for (const skill of skillStats.skills) {
                const levelMap = {
                    beginner: '初级',
                    intermediate: '中级',
                    advanced: '高级',
                    expert: '专家',
                };
                const level = levelMap[skill.proficiencyLevel] || skill.proficiencyLevel;
                lines.push(`| ${skill.name} | ${level} | ${skill.category} |`);
            }
            lines.push('');
            lines.push('### 技能统计', '');
            lines.push(`- **总技能数**：${skillStats.skills.length}`);
            lines.push(`- 专家级：${skillStats.proficiencyCount.expert}`);
            lines.push(`- 高级：${skillStats.proficiencyCount.advanced}`);
            lines.push(`- 中级：${skillStats.proficiencyCount.intermediate}`);
            lines.push(`- 初级：${skillStats.proficiencyCount.beginner}`, '');
        }
        else {
            lines.push('暂无绑定技能', '');
        }
        lines.push('## 工具使用统计', '');
        if (toolStats.length > 0) {
            lines.push('| 工具 | 使用次数 | 成功次数 | 成功率 |');
            lines.push('|-----|---------|---------|--------|');
            for (const stat of toolStats) {
                lines.push(`| ${stat.toolId} | ${stat.usageCount} | ${stat.successCount} | ${stat.successRate}% |`);
            }
            lines.push('');
        }
        else {
            lines.push('暂无工具使用记录', '');
        }
        lines.push('## SLA 响应指标', '');
        lines.push(`- **总任务数**：${slaMetrics.totalTasks}`);
        lines.push(`- **完成数**：${slaMetrics.completedTasks}`);
        lines.push(`- **失败数**：${slaMetrics.failedTasks}`);
        lines.push(`- **完成率**：${slaMetrics.completionRate}%`);
        if (slaMetrics.avgResponseTimeSeconds !== undefined) {
            lines.push(`- **平均响应时间**：${slaMetrics.avgResponseTimeSeconds} 秒`);
        }
        lines.push('');
        lines.push('## 元信息', '');
        lines.push(`- version: ${Date.now()}`);
        lines.push(`- lastAggregatedAt: ${new Date().toISOString()}`);
        lines.push(`- period: ${periodStr}`);
        lines.push(`- sources: [agent.skills, agent_runs, agent_parts]`);
        return lines.join('\n');
    }
    compact(text, maxLength) {
        if (!text)
            return '';
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength)
            return normalized;
        return normalized.slice(0, Math.max(0, maxLength - 3)) + '...';
    }
    async getAgentDocument(agentId) {
        let agent = await this.agentModel.findById(agentId).exec();
        if (!agent) {
            agent = await this.agentModel.findOne({ id: agentId }).exec();
        }
        return agent;
    }
    async updateEvaluationMemo(agentId, content, metadata) {
        const period = metadata.period;
        const periodKey = period ? `${period.start.slice(0, 7)}` : new Date().toISOString().slice(0, 7);
        const slug = `evaluation-${periodKey}`;
        const existing = await this.memoModel.findOne({ agentId, slug }).exec();
        const now = new Date();
        if (existing) {
            const nextVersion = Math.max(1, Number(existing.version || 1)) + 1;
            await this.memoModel
                .findOneAndUpdate({ id: existing.id }, {
                $set: {
                    content,
                    version: nextVersion,
                    payload: {
                        topic: 'evaluation',
                        ...metadata,
                    },
                    tags: ['evaluation', 'metrics'],
                    contextKeywords: ['evaluation', 'tool', 'sla', 'metric', 'task', 'skill'],
                    source: 'evaluation-aggregator',
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
                title: `工作评估 ${periodKey}`,
                slug,
                content,
                version: 1,
                memoKind: 'evaluation',
                memoType: 'standard',
                payload: {
                    topic: 'evaluation',
                    ...metadata,
                },
                tags: ['evaluation', 'metrics'],
                contextKeywords: ['evaluation', 'tool', 'sla', 'metric', 'task', 'skill'],
                source: 'evaluation-aggregator',
                createdAt: now,
                updatedAt: now,
            })
                .catch((err) => {
                if (err.code === 11000) {
                    this.logger.warn(`Evaluation memo already exists for agent ${agentId} period ${periodKey}, skipping`);
                }
                else {
                    throw err;
                }
            });
        }
    }
};
exports.EvaluationAggregationService = EvaluationAggregationService;
exports.EvaluationAggregationService = EvaluationAggregationService = EvaluationAggregationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_run_schema_1.AgentRun.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_part_schema_1.AgentPart.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_memo_schema_1.AgentMemo.name)),
    __param(3, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(4, (0, mongoose_1.InjectModel)(agent_skill_schema_1.Skill.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], EvaluationAggregationService);
//# sourceMappingURL=evaluation-aggregation.service.js.map