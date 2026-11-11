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
var ExecutorSelectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutorSelectionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../../../apps/agents/src/schemas/agent.schema");
const tool_schema_1 = require("../../../../apps/agents/src/schemas/tool.schema");
const employee_schema_1 = require("../../../shared/schemas/employee.schema");
const agent_role_schema_1 = require("../../../../apps/agents/src/schemas/agent-role.schema");
const role_tier_1 = require("../../../shared/role-tier");
const TIER_TASK_COMPATIBILITY = {
    leadership: ['general', 'research', 'development.plan', 'development.exec', 'development.review'],
    operations: ['general', 'research', 'development.plan', 'development.exec', 'development.review'],
    temporary: ['general', 'research', 'development.plan', 'development.exec', 'development.review'],
};
const TASK_TOOL_HINTS = {
    research: ['web-search', 'web-fetch', 'websearch', 'webfetch', 'exa', 'serp'],
};
const TEXT_TOOL_HINTS = [
    {
        keywords: ['save-prompt-template', 'prompt template', '提示词模板', '发布模板'],
        toolHints: ['save-prompt-template', 'prompt'],
    },
    {
        keywords: ['websearch', 'webfetch', 'search', 'research', '调研', '检索'],
        toolHints: ['web-search', 'web-fetch', 'websearch', 'webfetch'],
    },
];
const W_ROLE = parseInt(process.env.EXECUTOR_WEIGHT_ROLE || '40', 10);
const W_TOOL = parseInt(process.env.EXECUTOR_WEIGHT_TOOL || '30', 10);
const W_CAPABILITY = parseInt(process.env.EXECUTOR_WEIGHT_CAPABILITY || '20', 10);
const W_KEYWORD = parseInt(process.env.EXECUTOR_WEIGHT_KEYWORD || '10', 10);
const W_PROJECT_AFFINITY = parseInt(process.env.EXECUTOR_WEIGHT_PROJECT_AFFINITY || '15', 10);
const MIN_SCORE_THRESHOLD = parseInt(process.env.EXECUTOR_MIN_SCORE_THRESHOLD || '10', 10);
const OPENCODE_REQUIRED_TASK_TYPES = new Set(['development.plan', 'development.exec', 'development.review']);
let ExecutorSelectionService = ExecutorSelectionService_1 = class ExecutorSelectionService {
    constructor(agentModel, toolModel, employeeModel, agentRoleModel) {
        this.agentModel = agentModel;
        this.toolModel = toolModel;
        this.employeeModel = employeeModel;
        this.agentRoleModel = agentRoleModel;
        this.logger = new common_1.Logger(ExecutorSelectionService_1.name);
    }
    async selectExecutor(titleOrCtx, description) {
        const ctx = typeof titleOrCtx === 'string'
            ? { title: titleOrCtx, description: description || '' }
            : titleOrCtx;
        return this.routeExecutor(ctx);
    }
    async validateAgentToolFit(input) {
        const normalizedAgentId = String(input.agentId || '').trim();
        const normalizedTaskType = this.normalizeExternalTaskType(input.taskType);
        const explicitRequiredTools = (input.requiredTools || [])
            .map((item) => String(item || '').trim())
            .filter(Boolean);
        const requiredTools = explicitRequiredTools.length > 0
            ? explicitRequiredTools
            : this.resolveRequiredToolHints(normalizedTaskType, input.taskTitle, input.taskDescription);
        if (!normalizedAgentId) {
            return {
                fit: true,
                requiredTools,
                missingTools: [],
            };
        }
        const agentLookup = { id: normalizedAgentId, isActive: true };
        if (mongoose_2.Types.ObjectId.isValid(normalizedAgentId)) {
            agentLookup.$or = [{ id: normalizedAgentId }, { _id: new mongoose_2.Types.ObjectId(normalizedAgentId) }];
            delete agentLookup.id;
        }
        const scopedProjectId = String(input.projectId || '').trim() || undefined;
        const agent = await this.agentModel.findOne(agentLookup).select({ tools: 1, config: 1, projectId: 1 }).lean().exec();
        if (!agent) {
            return {
                fit: false,
                requiredTools,
                missingTools: [...requiredTools],
                suggestion: await this.selectExecutor({
                    title: input.taskTitle,
                    description: input.taskDescription,
                    projectId: input.projectId,
                    taskType: normalizedTaskType,
                }),
            };
        }
        if (scopedProjectId) {
            const candidateProjectId = String(agent.projectId || '').trim();
            const inScope = !candidateProjectId || candidateProjectId === scopedProjectId;
            if (!inScope) {
                return {
                    fit: false,
                    requiredTools,
                    missingTools: [],
                    rejectionReason: 'project_scope_mismatch',
                    suggestion: await this.selectExecutor({
                        title: input.taskTitle,
                        description: input.taskDescription,
                        projectId: scopedProjectId,
                        taskType: normalizedTaskType,
                    }),
                };
            }
        }
        const executorTaskType = normalizedTaskType;
        if (OPENCODE_REQUIRED_TASK_TYPES.has(executorTaskType) && !this.isOpenCodeCapable(agent)) {
            this.logger.warn(`[validate_opencode_gate] agent=${normalizedAgentId} taskType=${executorTaskType} — agent lacks opencode capability, rejecting`);
            return {
                fit: false,
                requiredTools,
                missingTools: ['opencode_capability'],
                rejectionReason: 'opencode_capability',
                suggestion: await this.selectExecutor({
                    title: input.taskTitle,
                    description: input.taskDescription,
                    projectId: input.projectId,
                    taskType: normalizedTaskType,
                }),
            };
        }
        if (requiredTools.length === 0) {
            return {
                fit: true,
                requiredTools,
                missingTools: [],
            };
        }
        const toolIds = agent.tools || [];
        const tools = toolIds.length
            ? await this.toolModel.find({ id: { $in: toolIds }, enabled: true }).select({ id: 1, name: 1, description: 1, category: 1 }).lean().exec()
            : [];
        const toolText = [
            ...toolIds.map((id) => String(id || '').toLowerCase()),
            ...tools.map((tool) => `${tool.id || ''} ${tool.name || ''} ${tool.description || ''} ${tool.category || ''}`.toLowerCase()),
        ].join(' ');
        const missingTools = requiredTools.filter((hint) => !toolText.includes(hint.toLowerCase()));
        if (missingTools.length === 0) {
            return {
                fit: true,
                requiredTools,
                missingTools: [],
            };
        }
        return {
            fit: false,
            requiredTools,
            missingTools,
            suggestion: await this.selectExecutor({
                title: input.taskTitle,
                description: input.taskDescription,
                projectId: input.projectId,
                taskType: normalizedTaskType,
            }),
        };
    }
    async routeExecutor(ctx) {
        if (ctx.assignmentPolicy === 'lock_to_planner' && ctx.plannerAgentId) {
            this.logger.log(`[executor_lock] Locked to planner=${ctx.plannerAgentId} title="${ctx.title.slice(0, 60)}"`);
            return {
                executorType: 'agent',
                executorId: ctx.plannerAgentId,
                reason: 'Locked to planner by assignment policy',
            };
        }
        const taskType = ctx.taskType || 'general';
        const projectId = String(ctx.projectId || '').trim() || undefined;
        const requiredCapabilities = this.resolveRequiredCapabilities(taskType, ctx.requiredCapabilities);
        const agentQuery = { isActive: true };
        if (projectId) {
            agentQuery.$or = [
                { projectId },
                { projectId: { $in: [null, ''] } },
                { projectId: { $exists: false } },
            ];
        }
        const [agents, employees, roles] = await Promise.all([
            this.agentModel.find(agentQuery).exec(),
            this.employeeModel
                .find({ status: { $in: [employee_schema_1.EmployeeStatus.ACTIVE, employee_schema_1.EmployeeStatus.PROBATION] } })
                .exec(),
            this.agentRoleModel.find({ status: 'active' }).exec(),
        ]);
        const roleMap = new Map();
        for (const role of roles) {
            const roleCode = String(role.code || '').trim();
            const roleId = String(role.id || '').trim();
            if (roleCode) {
                roleMap.set(roleCode, role);
            }
            if (roleId) {
                roleMap.set(roleId, role);
            }
        }
        const plannerTier = await this.resolvePlannerTier(ctx.plannerAgentId, roleMap);
        if (ctx.plannerAgentId && !plannerTier) {
            return {
                executorType: 'unassigned',
                reason: 'tier_resolution_required: cannot resolve planner tier',
            };
        }
        const scored = agents.map((agent) => {
            const agentId = this.getEntityId(agent);
            const role = roleMap.get(agent.roleId);
            const tier = this.resolveAgentTier(agent, role);
            const agentToolSet = new Set((agent.tools || []).map((t) => t.toLowerCase()));
            const agentCaps = new Set([...(agent.capabilities || []), ...(role?.capabilities || [])].map((c) => c.toLowerCase()));
            const breakdown = {};
            if (ctx.preferredRoleCode && agent.roleId === ctx.preferredRoleCode) {
                breakdown.roleMatch = W_ROLE;
            }
            else if (this.isTierCompatible(tier, taskType)) {
                breakdown.roleMatch = Math.round(W_ROLE * 0.6);
            }
            else {
                breakdown.roleMatch = 0;
            }
            breakdown.toolCoverage = ctx.requiredTools?.length
                ? this.computeExplicitToolScore(agentToolSet, ctx.requiredTools)
                : this.computeInferredToolScore(agentToolSet, taskType);
            if (requiredCapabilities.length > 0) {
                const covered = requiredCapabilities.filter((c) => agentCaps.has(c.toLowerCase()));
                breakdown.capabilityMatch = Math.round((covered.length / requiredCapabilities.length) * W_CAPABILITY);
            }
            else {
                breakdown.capabilityMatch = 0;
            }
            breakdown.keywordRelevance = this.computeKeywordScore(ctx.title, ctx.description, agent, role);
            if (projectId) {
                const agentProjectId = String(agent.projectId || '').trim();
                breakdown.projectAffinity = agentProjectId === projectId ? W_PROJECT_AFFINITY : 0;
            }
            else {
                breakdown.projectAffinity = 0;
            }
            if (plannerTier && !(0, role_tier_1.canDelegateAcrossTier)(plannerTier, tier)) {
                breakdown.roleMatch = 0;
                breakdown.toolCoverage = 0;
                breakdown.capabilityMatch = 0;
                breakdown.keywordRelevance = 0;
                breakdown.projectAffinity = 0;
            }
            if (requiredCapabilities.length > 0) {
                const missing = requiredCapabilities
                    .map((cap) => cap.toLowerCase())
                    .filter((cap) => !agentCaps.has(cap));
                if (missing.length > 0) {
                    breakdown.roleMatch = 0;
                    breakdown.toolCoverage = 0;
                    breakdown.capabilityMatch = 0;
                    breakdown.keywordRelevance = 0;
                    breakdown.projectAffinity = 0;
                }
            }
            if (OPENCODE_REQUIRED_TASK_TYPES.has(taskType) && !this.isOpenCodeCapable(agent)) {
                breakdown.roleMatch = 0;
                breakdown.toolCoverage = 0;
                breakdown.capabilityMatch = 0;
                breakdown.keywordRelevance = 0;
                breakdown.projectAffinity = 0;
            }
            const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
            return { agentId, score, breakdown, agentToolSet, tier };
        });
        scored.sort((a, b) => b.score - a.score);
        if (OPENCODE_REQUIRED_TASK_TYPES.has(taskType)) {
            const eligible = scored.filter((s) => s.score > 0).length;
            this.logger.log(`[executor_opencode_gate] taskType=${taskType} totalAgents=${scored.length} eligibleAfterGate=${eligible}`);
        }
        const employeeCandidates = plannerTier
            ? employees.filter((employee) => {
                const targetTier = (0, role_tier_1.normalizeAgentRoleTier)(employee.tier) || 'operations';
                return (0, role_tier_1.canDelegateAcrossTier)(plannerTier, targetTier);
            })
            : employees;
        const employeeScored = this.scoreEmployees(employeeCandidates, ctx.title, ctx.description);
        const bestAgent = scored[0];
        const bestEmployee = employeeScored[0];
        if (ctx.requiredTools?.length && bestAgent) {
            const missing = ctx.requiredTools.filter((t) => !bestAgent.agentToolSet.has(t.toLowerCase()));
            if (missing.length > 0) {
                this.logger.warn(`[executor_tool_gap] Best agent=${bestAgent.agentId} missing tools: ${missing.join(',')}`);
                return {
                    executorType: 'unassigned',
                    reason: `Best candidate missing required tools: ${missing.join(', ')}`,
                    capabilityMatch: {
                        toolsCovered: ctx.requiredTools.filter((t) => bestAgent.agentToolSet.has(t.toLowerCase())),
                        toolsMissing: missing,
                        capabilitiesCovered: [],
                        capabilitiesMissing: [],
                    },
                };
            }
        }
        if (bestAgent && bestAgent.score >= MIN_SCORE_THRESHOLD) {
            this.logger.log(`[executor_selected] agent=${bestAgent.agentId} score=${bestAgent.score} breakdown=${JSON.stringify(bestAgent.breakdown)}`);
            return {
                executorType: 'agent',
                executorId: bestAgent.agentId,
                reason: `Capability-routed: score=${bestAgent.score} breakdown=${JSON.stringify(bestAgent.breakdown)}`,
                score: bestAgent.score,
            };
        }
        if (bestEmployee && bestEmployee.score > 0) {
            return {
                executorType: 'employee',
                executorId: bestEmployee.id,
                reason: `Best human assignment score=${bestEmployee.score}`,
                score: bestEmployee.score,
            };
        }
        const requiresOpenCode = OPENCODE_REQUIRED_TASK_TYPES.has(taskType);
        const fallbackAgent = agents.find((agent) => {
            if (requiresOpenCode && !this.isOpenCodeCapable(agent)) {
                return false;
            }
            if (plannerTier) {
                const role = roleMap.get(agent.roleId);
                const targetTier = this.resolveAgentTier(agent, role);
                return (0, role_tier_1.canDelegateAcrossTier)(plannerTier, targetTier);
            }
            return true;
        });
        if (fallbackAgent?._id) {
            return {
                executorType: 'agent',
                executorId: fallbackAgent._id.toString(),
                reason: 'Fallback assignment to first active agent (no candidate met threshold)',
            };
        }
        return { executorType: 'unassigned', reason: 'No matching capability found' };
    }
    isTierCompatible(tier, taskType) {
        const compatible = TIER_TASK_COMPATIBILITY[tier];
        return compatible ? compatible.includes(taskType) : false;
    }
    resolveAgentTier(agent, role) {
        return ((0, role_tier_1.normalizeAgentRoleTier)(agent.tier) ||
            (0, role_tier_1.normalizeAgentRoleTier)(role?.tier) ||
            (0, role_tier_1.getTierByAgentRoleCode)(role?.code) ||
            'operations');
    }
    isOpenCodeCapable(agent) {
        const config = agent.config;
        if (!config || typeof config !== 'object') {
            return false;
        }
        const execution = config.execution;
        if (!execution || typeof execution !== 'object') {
            return false;
        }
        const provider = String(execution.provider || '').trim().toLowerCase();
        return provider === 'opencode';
    }
    async resolvePlannerTier(plannerAgentId, roleMap) {
        const normalizedPlannerAgentId = String(plannerAgentId || '').trim();
        if (!normalizedPlannerAgentId) {
            return undefined;
        }
        const plannerLookup = { id: normalizedPlannerAgentId };
        if (mongoose_2.Types.ObjectId.isValid(normalizedPlannerAgentId)) {
            plannerLookup.$or = [{ id: normalizedPlannerAgentId }, { _id: new mongoose_2.Types.ObjectId(normalizedPlannerAgentId) }];
            delete plannerLookup.id;
        }
        const planner = await this.agentModel.findOne(plannerLookup).select({ roleId: 1, tier: 1 }).lean().exec();
        if (!planner) {
            return undefined;
        }
        const role = roleMap.get(String(planner.roleId || '').trim());
        return this.resolveAgentTier(planner, role);
    }
    computeExplicitToolScore(agentToolSet, requiredTools) {
        const covered = requiredTools.filter((t) => agentToolSet.has(t.toLowerCase()));
        return Math.round((covered.length / requiredTools.length) * W_TOOL);
    }
    computeInferredToolScore(agentToolSet, taskType) {
        const hints = TASK_TOOL_HINTS[taskType];
        if (!hints?.length)
            return Math.round(W_TOOL * 0.15);
        const toolStr = [...agentToolSet].join(' ');
        const matched = hints.filter((h) => toolStr.includes(h));
        return Math.round((matched.length / hints.length) * W_TOOL);
    }
    computeKeywordScore(title, description, agent, role) {
        const text = `${title} ${description}`.toLowerCase();
        const keywords = text
            .split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/)
            .filter((w) => w.length >= 2)
            .slice(0, 20);
        if (!keywords.length)
            return 0;
        const context = `${agent.name} ${agent.description} ${(agent.capabilities || []).join(' ')} ${role?.description || ''} ${(role?.capabilities || []).join(' ')}`.toLowerCase();
        const hits = keywords.filter((kw) => context.includes(kw)).length;
        return Math.min(W_KEYWORD, Math.round((hits / Math.min(keywords.length, 3)) * W_KEYWORD));
    }
    scoreEmployees(employees, title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const keywords = text
            .split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/)
            .filter((w) => w.length >= 2)
            .slice(0, 20);
        return employees
            .map((emp) => {
            const ctx = `${emp.name || ''} ${emp.title || ''} ${emp.description || ''} ${(emp.capabilities || []).join(' ')}`.toLowerCase();
            const score = keywords.reduce((acc, kw) => (ctx.includes(kw) ? acc + 1 : acc), 0);
            return { id: emp.id, score, type: emp.type };
        })
            .sort((a, b) => b.score - a.score);
    }
    resolveRequiredToolHints(taskType, title, description) {
        const hints = new Set(TASK_TOOL_HINTS[taskType] || []);
        if (hints.size > 0) {
            return Array.from(hints);
        }
        const text = `${title} ${description}`.toLowerCase();
        for (const item of TEXT_TOOL_HINTS) {
            if (item.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
                for (const hint of item.toolHints) {
                    hints.add(hint);
                }
            }
        }
        return Array.from(hints);
    }
    normalizeExternalTaskType(taskType) {
        if (taskType === 'development.plan'
            || taskType === 'development.exec'
            || taskType === 'development.review'
            || taskType === 'research'
            || taskType === 'general') {
            return taskType;
        }
        return 'general';
    }
    resolveRequiredCapabilities(taskType, requiredCapabilities) {
        const explicit = (requiredCapabilities || [])
            .map((capability) => String(capability || '').trim())
            .filter(Boolean);
        if (explicit.length > 0) {
            return explicit;
        }
        if (taskType && taskType !== 'general') {
            return [taskType];
        }
        return [];
    }
    getEntityId(entity) {
        if (entity.id)
            return String(entity.id);
        if (entity._id)
            return entity._id.toString();
        return '';
    }
};
exports.ExecutorSelectionService = ExecutorSelectionService;
exports.ExecutorSelectionService = ExecutorSelectionService = ExecutorSelectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(1, (0, mongoose_1.InjectModel)(tool_schema_1.Tool.name)),
    __param(2, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __param(3, (0, mongoose_1.InjectModel)(agent_role_schema_1.AgentRole.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ExecutorSelectionService);
//# sourceMappingURL=executor-selection.service.js.map