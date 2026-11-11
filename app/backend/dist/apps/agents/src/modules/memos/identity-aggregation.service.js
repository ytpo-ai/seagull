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
var IdentityAggregationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityAggregationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const agent_memo_schema_1 = require("../../schemas/agent-memo.schema");
let IdentityAggregationService = IdentityAggregationService_1 = class IdentityAggregationService {
    constructor(agentModel, skillModel, memoModel) {
        this.agentModel = agentModel;
        this.skillModel = skillModel;
        this.memoModel = memoModel;
        this.logger = new common_1.Logger(IdentityAggregationService_1.name);
    }
    async aggregateIdentity(agentId) {
        this.logger.log(`Starting identity aggregation for agent: ${agentId}`);
        try {
            const [agentBasic, skills, tools] = await Promise.all([
                this.getAgentBasicInfo(agentId),
                this.getAgentSkills(agentId),
                this.getTools(agentId),
            ]);
            const content = this.buildIdentityContent({
                agent: agentBasic,
                skills,
                tools,
            });
            await this.updateIdentityMemo(agentId, content, {
                lastAggregatedAt: new Date().toISOString(),
                sources: ['agent', 'agent.skills', 'tool_registry'],
            });
            this.logger.log(`Identity aggregation completed for agent: ${agentId}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Identity aggregation failed for agent ${agentId}: ${message}`);
            throw error;
        }
    }
    async getAgentBasicInfo(agentId) {
        const agent = await this.getAgentDocument(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        return {
            name: agent.name,
            roleId: agent.roleId,
            description: agent.description,
            systemPromptSummary: agent.systemPrompt?.slice(0, 200) || '',
            tools: agent.tools || [],
            capabilities: agent.capabilities || [],
            personality: agent.personality || {
                workEthic: 80,
                creativity: 75,
                leadership: 70,
                teamwork: 80,
            },
            learningAbility: agent.learningAbility || 80,
            isActive: agent.isActive !== false,
            createdAt: agent.createdAt || new Date(),
        };
    }
    async getAgentDocument(agentId) {
        let agent = await this.agentModel.findById(agentId).exec();
        if (!agent) {
            agent = await this.agentModel.findOne({ id: agentId }).exec();
        }
        return agent;
    }
    async getAgentSkills(agentId) {
        const agent = await this.getAgentDocument(agentId);
        const skillIds = Array.from(new Set((agent?.skills || []).map((item) => String(item || '').trim()).filter(Boolean)));
        if (!skillIds.length) {
            return [];
        }
        const skills = await this.skillModel.find({ id: { $in: skillIds } }).exec();
        const skillMap = new Map(skills.map((item) => [item.id, item]));
        return skillIds.map((skillId) => {
            const skill = skillMap.get(skillId);
            return {
                name: skill?.name || skillId,
                proficiencyLevel: 'beginner',
                assignedBy: 'system',
                assignedAt: new Date(),
                category: skill?.category || 'general',
            };
        });
    }
    normalizeToolId(toolId) {
        return String(toolId || '').trim();
    }
    uniqueToolIds(...groups) {
        const merged = groups
            .flat()
            .map((item) => this.normalizeToolId(item))
            .filter(Boolean);
        return Array.from(new Set(merged));
    }
    async getTools(agentId) {
        const agent = await this.getAgentDocument(agentId);
        if (!agent) {
            return [];
        }
        const toolIds = this.uniqueToolIds(agent.tools || []);
        return toolIds.map((toolId) => ({ id: toolId }));
    }
    buildIdentityContent(data) {
        const { agent, skills, tools } = data;
        const lines = [];
        lines.push('# 身份与职责', '');
        lines.push('## Agent Profile', '');
        lines.push(`- **Agent 名称**：${agent.name || '待补充'}`);
        lines.push(`- **角色ID**：${agent.roleId || '待补充'}`);
        lines.push(`- **描述**：${agent.description || '待补充'}`);
        lines.push(`- **系统提示词摘要**：${agent.systemPromptSummary || '待补充'}`);
        lines.push(`- **创建时间**：${agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('zh-CN') : '待补充'}`);
        lines.push(`- **激活状态**：${agent.isActive ? '是' : '否'}`, '');
        lines.push('', '## 技能矩阵', '');
        if (skills.length > 0) {
            lines.push('### 已绑定技能', '');
            lines.push('| 技能名称 | 熟练度 | 绑定时间 | 来源 | 领域 |');
            lines.push('|---------|--------|---------|------|------|');
            for (const skill of skills) {
                const levelMap = {
                    beginner: '初级',
                    intermediate: '中级',
                    advanced: '高级',
                    expert: '专家',
                };
                const level = levelMap[skill.proficiencyLevel] || skill.proficiencyLevel;
                const date = skill.assignedAt ? new Date(skill.assignedAt).toLocaleDateString('zh-CN') : 'N/A';
                lines.push(`| ${skill.name} | ${level} | ${date} | ${skill.assignedBy} | ${skill.category} |`);
            }
            lines.push('');
        }
        else {
            lines.push('暂无绑定技能', '');
        }
        lines.push('## 能力域', '');
        lines.push(`- **主要领域**：${this.extractDomains(skills)}`);
        lines.push('- **工具集（ID 列表）**：');
        if (tools.length > 0) {
            for (const tool of tools) {
                lines.push(`  - ${tool.id}`);
            }
        }
        else {
            lines.push('  - 待补充');
        }
        lines.push(`- **模型能力**：${agent.capabilities.length > 0 ? agent.capabilities.join(', ') : '待补充'}`, '');
        lines.push('## 工作风格', '');
        lines.push(`- 工作伦理：${agent.personality.workEthic}/100`);
        lines.push(`- 创造力：${agent.personality.creativity}/100`);
        lines.push(`- 领导力：${agent.personality.leadership}/100`);
        lines.push(`- 团队协作：${agent.personality.teamwork}/100`);
        lines.push(`- 学习能力：${agent.learningAbility}/100`, '');
        lines.push('## 元信息', '');
        lines.push(`- version: ${Date.now()}`);
        lines.push(`- lastAggregatedAt: ${new Date().toISOString()}`);
        lines.push(`- sources: [agent, agent.skills, tool_registry]`);
        return lines.join('\n');
    }
    extractDomains(skills) {
        const categories = [...new Set(skills.map((s) => s.category).filter(Boolean))];
        return categories.length > 0 ? categories.join(', ') : '待补充';
    }
    async updateIdentityMemo(agentId, content, metadata) {
        const existing = await this.memoModel.findOne({ agentId, memoKind: 'identity' }).exec();
        const now = new Date();
        if (existing) {
            const nextVersion = Math.max(1, Number(existing.version || 1)) + 1;
            await this.memoModel
                .findOneAndUpdate({ id: existing.id }, {
                $set: {
                    content,
                    memoType: 'standard',
                    version: nextVersion,
                    payload: {
                        topic: 'identity',
                        ...metadata,
                    },
                    tags: ['identity', 'responsibility', 'profile'],
                    contextKeywords: ['identity', 'role', 'responsibility', 'skill'],
                    source: 'identity-aggregator',
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
                title: '身份与职责',
                slug: 'identity-and-responsibilities',
                content,
                version: 1,
                memoKind: 'identity',
                memoType: 'standard',
                payload: {
                    topic: 'identity',
                    ...metadata,
                },
                tags: ['identity', 'responsibility', 'profile'],
                contextKeywords: ['identity', 'role', 'responsibility', 'skill'],
                source: 'identity-aggregator',
                createdAt: now,
                updatedAt: now,
            })
                .catch((err) => {
                if (err.code === 11000) {
                    this.logger.warn(`Identity memo already exists for agent ${agentId}, skipping create`);
                }
                else {
                    throw err;
                }
            });
        }
    }
};
exports.IdentityAggregationService = IdentityAggregationService;
exports.IdentityAggregationService = IdentityAggregationService = IdentityAggregationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_skill_schema_1.Skill.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_memo_schema_1.AgentMemo.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], IdentityAggregationService);
//# sourceMappingURL=identity-aggregation.service.js.map