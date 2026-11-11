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
var AgentOpenCodePolicyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOpenCodePolicyService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const agent_message_schema_1 = require("../../schemas/agent-message.schema");
const runtime_orchestrator_service_1 = require("../runtime/runtime-orchestrator.service");
const OPENCODE_ALLOWED_ROLE_CODES = new Set(['devops-engineer', 'fullstack-engineer', 'technical-architect']);
const OPENCODE_BUDGET_PERIOD_SET = new Set(['day', 'week', 'month']);
const OPENCODE_BUDGET_UNIT_SET = new Set(['runCount', 'dailyCost']);
const OPENCODE_MODEL_BINDING_CHECK_ENABLED = 'OPENCODE_MODEL_BINDING_CHECK_ENABLED';
let AgentOpenCodePolicyService = AgentOpenCodePolicyService_1 = class AgentOpenCodePolicyService {
    constructor(agentRunModel, agentMessageModel, runtimeOrchestrator, messageBus) {
        this.agentRunModel = agentRunModel;
        this.agentMessageModel = agentMessageModel;
        this.runtimeOrchestrator = runtimeOrchestrator;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(AgentOpenCodePolicyService_1.name);
    }
    assertOpenCodeExecutionGate(agent, roleCode, executionConfig) {
        const normalizedRoleCode = String(roleCode || '').trim();
        if (!OPENCODE_ALLOWED_ROLE_CODES.has(normalizedRoleCode)) {
            throw new common_1.BadRequestException(`OpenCode execution role not allowed: ${normalizedRoleCode || 'unknown'}. Allowed roles: devops-engineer, fullstack-engineer, technical-architect`);
        }
        const boundModel = executionConfig.modelPolicy.bound;
        if (!boundModel) {
            return;
        }
        if (!this.isModelBindingCheckEnabled()) {
            return;
        }
        const currentProvider = String(agent.model?.provider || '').trim();
        const currentModel = String(agent.model?.model || '').trim();
        if (!this.matchesModelBinding(boundModel, currentProvider, currentModel)) {
            throw new common_1.BadRequestException(`OpenCode model binding mismatch: expected ${boundModel.provider}/${boundModel.model}, got ${currentProvider}/${currentModel}`);
        }
    }
    parseOpenCodeExecutionConfig(config) {
        if (!this.isPlainObject(config)) {
            return null;
        }
        const execution = config.execution;
        if (!this.isPlainObject(execution)) {
            return null;
        }
        const provider = String(execution.provider || '')
            .trim()
            .toLowerCase();
        if (provider !== 'opencode') {
            return null;
        }
        const endpointRaw = execution.endpoint;
        if (endpointRaw !== undefined && endpointRaw !== null && typeof endpointRaw !== 'string') {
            throw new common_1.BadRequestException('agent.config.execution.endpoint must be a string');
        }
        const endpoint = typeof endpointRaw === 'string' && endpointRaw.trim().length > 0 ? endpointRaw.trim() : undefined;
        const endpointRefRaw = execution.endpointRef;
        if (endpointRefRaw !== undefined && endpointRefRaw !== null && typeof endpointRefRaw !== 'string') {
            throw new common_1.BadRequestException('agent.config.execution.endpointRef must be a string');
        }
        const endpointRef = typeof endpointRefRaw === 'string' && endpointRefRaw.trim().length > 0 ? endpointRefRaw.trim() : undefined;
        const authEnableRaw = execution.auth_enable;
        if (authEnableRaw !== undefined && typeof authEnableRaw !== 'boolean') {
            throw new common_1.BadRequestException('agent.config.execution.auth_enable must be a boolean');
        }
        const authEnable = authEnableRaw === true;
        const requestTimeoutMsRaw = execution.request_timeout_ms;
        if (requestTimeoutMsRaw !== undefined && requestTimeoutMsRaw !== null) {
            const parsedTimeout = Number(requestTimeoutMsRaw);
            if (!Number.isFinite(parsedTimeout) || parsedTimeout < 1000) {
                throw new common_1.BadRequestException('agent.config.execution.request_timeout_ms must be a number >= 1000');
            }
        }
        const requestTimeoutMs = requestTimeoutMsRaw !== undefined && requestTimeoutMsRaw !== null
            ? Math.floor(Number(requestTimeoutMsRaw))
            : undefined;
        const taskRouting = this.parseTaskRoutingConfig(execution);
        const modelPolicyRaw = execution.modelPolicy;
        if (modelPolicyRaw !== undefined && !this.isPlainObject(modelPolicyRaw)) {
            throw new common_1.BadRequestException('agent.config.execution.modelPolicy must be a JSON object');
        }
        const modelPolicy = this.isPlainObject(modelPolicyRaw) ? modelPolicyRaw : {};
        const bound = this.parseModelBinding(modelPolicy.bound, 'agent.config.execution.modelPolicy.bound');
        const fallbackRaw = modelPolicy.fallback;
        const fallback = [];
        if (fallbackRaw !== undefined) {
            if (!Array.isArray(fallbackRaw)) {
                throw new common_1.BadRequestException('agent.config.execution.modelPolicy.fallback must be an array');
            }
            for (let i = 0; i < fallbackRaw.length; i += 1) {
                const binding = this.parseModelBinding(fallbackRaw[i], `agent.config.execution.modelPolicy.fallback[${i}]`);
                if (binding) {
                    fallback.push(binding);
                }
            }
        }
        return {
            provider: 'opencode',
            endpoint,
            endpointRef,
            authEnable,
            requestTimeoutMs,
            taskRouting,
            modelPolicy: {
                bound,
                fallback,
            },
        };
    }
    parseTaskRoutingConfig(execution) {
        const raw = execution.taskRouting ?? execution.task_type_routing;
        if (raw === undefined || raw === null) {
            return undefined;
        }
        if (!this.isPlainObject(raw)) {
            throw new common_1.BadRequestException('agent.config.execution.taskRouting must be a JSON object');
        }
        const parseTaskTypes = (value, fieldPath) => {
            if (value === undefined || value === null) {
                return [];
            }
            if (!Array.isArray(value)) {
                throw new common_1.BadRequestException(`${fieldPath} must be an array of strings`);
            }
            const normalized = value
                .map((item, index) => {
                if (typeof item !== 'string') {
                    throw new common_1.BadRequestException(`${fieldPath}[${index}] must be a string`);
                }
                return item.trim().toLowerCase();
            })
                .filter(Boolean);
            return Array.from(new Set(normalized));
        };
        const opencodeTaskTypes = parseTaskTypes(raw.opencodeTaskTypes ?? raw.opencode_task_types, 'agent.config.execution.taskRouting.opencodeTaskTypes');
        const nativeTaskTypes = parseTaskTypes(raw.nativeTaskTypes ?? raw.native_task_types, 'agent.config.execution.taskRouting.nativeTaskTypes');
        const defaultChannelRaw = raw.defaultChannel ?? raw.default_channel;
        let defaultChannel = 'native';
        if (defaultChannelRaw !== undefined && defaultChannelRaw !== null) {
            if (typeof defaultChannelRaw !== 'string') {
                throw new common_1.BadRequestException('agent.config.execution.taskRouting.defaultChannel must be a string');
            }
            const normalized = defaultChannelRaw.trim().toLowerCase();
            if (normalized !== 'native' && normalized !== 'opencode') {
                throw new common_1.BadRequestException('agent.config.execution.taskRouting.defaultChannel must be native or opencode');
            }
            defaultChannel = normalized;
        }
        return {
            opencodeTaskTypes,
            nativeTaskTypes,
            defaultChannel,
        };
    }
    async applyAgentBudgetGate(agent, runtimeAgentId, task, runtimeContext, context) {
        const budgetConfig = this.parseAgentBudgetConfig(agent.config);
        if (!budgetConfig) {
            return;
        }
        const usage = await this.evaluateAgentBudgetUsage(runtimeAgentId, budgetConfig, runtimeContext.resumed);
        if (!usage.exceeded) {
            return;
        }
        const approval = context?.approval;
        const approved = approval?.approved === true;
        const quotaPayload = {
            gate: 'agent_budget',
            period: budgetConfig.period,
            unit: budgetConfig.unit,
            limit: budgetConfig.limit,
            usedBefore: usage.usedBefore,
            usedAfter: usage.usedAfter,
            periodStart: usage.periodStart.toISOString(),
            periodEnd: usage.periodEnd.toISOString(),
        };
        if (budgetConfig.unit === 'dailyCost') {
            if (approved) {
                const approverId = approval?.approverId || context?.actor?.employeeId;
                await this.runtimeOrchestrator.recordPermissionDecision({
                    runId: runtimeContext.runId,
                    agentId: runtimeAgentId,
                    sessionId: runtimeContext.sessionId,
                    taskId: task.id,
                    traceId: runtimeContext.traceId,
                    approved: true,
                    payload: {
                        ...quotaPayload,
                        approvalId: approval?.approvalId,
                        approverId,
                        reason: approval?.reason || 'daily cost quota approval granted',
                    },
                });
                return;
            }
            await this.publishAgentDailyCostExceededEvent({
                agent,
                runtimeAgentId,
                task,
                runtimeContext,
                context,
                budgetConfig,
                usage,
            });
            throw new common_1.BadRequestException(`Agent daily cost quota exceeded and execution blocked. period=${budgetConfig.period}, limit=${budgetConfig.limit}, used=${usage.usedAfter}. Please check Message Center system alerts for details.`);
        }
        if (approved) {
            const approverId = approval?.approverId || context?.actor?.employeeId;
            await this.runtimeOrchestrator.resumeRunWithActor(runtimeContext.runId, {
                actorId: approverId || 'approval-system',
                actorType: approverId ? 'employee' : 'system',
                reason: approval?.reason || 'quota approval granted',
            });
            await this.runtimeOrchestrator.recordPermissionDecision({
                runId: runtimeContext.runId,
                agentId: runtimeAgentId,
                sessionId: runtimeContext.sessionId,
                taskId: task.id,
                traceId: runtimeContext.traceId,
                approved: true,
                payload: {
                    ...quotaPayload,
                    approvalId: approval?.approvalId,
                    approverId,
                    reason: approval?.reason || 'quota approval granted',
                },
            });
            return;
        }
        await this.runtimeOrchestrator.pauseRunWithActor(runtimeContext.runId, {
            actorId: context?.actor?.employeeId || 'system',
            actorType: context?.actor?.employeeId ? 'employee' : 'system',
            reason: 'quota exceeded, approval required',
        });
        await this.runtimeOrchestrator.recordPermissionAsked({
            runId: runtimeContext.runId,
            agentId: runtimeAgentId,
            sessionId: runtimeContext.sessionId,
            taskId: task.id,
            traceId: runtimeContext.traceId,
            payload: {
                ...quotaPayload,
                requestType: 'quota.exceeded',
                message: 'Agent quota exceeded and approval is required to continue execution',
            },
        });
        throw new common_1.BadRequestException(`Agent quota exceeded and run paused for approval. period=${budgetConfig.period}, limit=${budgetConfig.limit}, used=${usage.usedAfter}`);
    }
    parseModelBinding(value, fieldPath) {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (typeof value === 'string') {
            const raw = value.trim();
            if (!raw) {
                return undefined;
            }
            const separator = raw.includes('/') ? '/' : ':';
            const [provider, model] = raw.split(separator);
            if (!provider || !model) {
                throw new common_1.BadRequestException(`${fieldPath} must be "provider/model" or an object`);
            }
            return {
                provider: provider.trim(),
                model: model.trim(),
            };
        }
        if (!this.isPlainObject(value)) {
            throw new common_1.BadRequestException(`${fieldPath} must be a JSON object`);
        }
        const provider = String(value.provider || '').trim();
        const model = String(value.model || '').trim();
        if (!provider || !model) {
            throw new common_1.BadRequestException(`${fieldPath} must include provider and model`);
        }
        return { provider, model };
    }
    matchesModelBinding(binding, provider, model) {
        return binding.provider === provider && binding.model === model;
    }
    isModelBindingCheckEnabled() {
        const raw = String(process.env[OPENCODE_MODEL_BINDING_CHECK_ENABLED] || 'false')
            .trim()
            .toLowerCase();
        return raw === 'true';
    }
    isPlainObject(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    parseAgentBudgetConfig(config) {
        if (!this.isPlainObject(config)) {
            return null;
        }
        const budget = config.budget;
        if (budget === undefined || budget === null) {
            return null;
        }
        if (!this.isPlainObject(budget)) {
            throw new common_1.BadRequestException('agent.config.budget must be a JSON object');
        }
        const periodRaw = String(budget.period || '')
            .trim()
            .toLowerCase();
        const limitRaw = Number(budget.limit);
        const unitRaw = String(budget.unit || 'runCount').trim();
        if (!periodRaw || !OPENCODE_BUDGET_PERIOD_SET.has(periodRaw)) {
            throw new common_1.BadRequestException('agent.config.budget.period must be one of day/week/month');
        }
        if (!Number.isFinite(limitRaw) || limitRaw < 0) {
            throw new common_1.BadRequestException('agent.config.budget.limit must be a non-negative number');
        }
        if (!OPENCODE_BUDGET_UNIT_SET.has(unitRaw)) {
            throw new common_1.BadRequestException('agent.config.budget.unit must be runCount or dailyCost');
        }
        if (unitRaw === 'dailyCost' && periodRaw !== 'day') {
            throw new common_1.BadRequestException('agent.config.budget.period must be day when unit=dailyCost');
        }
        return {
            period: periodRaw,
            limit: unitRaw === 'runCount' ? Math.floor(limitRaw) : limitRaw,
            unit: unitRaw,
        };
    }
    async evaluateAgentBudgetUsage(agentId, budgetConfig, resumedRun) {
        if (budgetConfig.unit === 'dailyCost') {
            return this.evaluateAgentDailyCostUsage(agentId, budgetConfig, resumedRun);
        }
        const periodStart = this.resolveBudgetPeriodStart(budgetConfig.period);
        const periodEnd = new Date();
        const usedAfter = await this.agentRunModel
            .countDocuments({
            agentId,
            startedAt: {
                $gte: periodStart,
                $lte: periodEnd,
            },
        })
            .exec();
        const usedBefore = resumedRun ? usedAfter : Math.max(0, usedAfter - 1);
        return {
            usedBefore,
            usedAfter,
            exceeded: usedAfter > budgetConfig.limit,
            periodStart,
            periodEnd,
        };
    }
    async evaluateAgentDailyCostUsage(agentId, budgetConfig, resumedRun) {
        const periodStart = this.resolveBudgetPeriodStart('day');
        const periodEnd = new Date();
        const aggregate = await this.agentMessageModel
            .aggregate([
            {
                $match: {
                    agentId,
                    role: 'assistant',
                    createdAt: {
                        $gte: periodStart,
                        $lte: periodEnd,
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalCost: {
                        $sum: {
                            $ifNull: ['$cost', 0],
                        },
                    },
                },
            },
        ])
            .exec();
        const usedAfter = Number(aggregate[0]?.totalCost || 0);
        const usedBefore = resumedRun ? usedAfter : Number(Math.max(0, usedAfter));
        return {
            usedBefore,
            usedAfter,
            exceeded: usedAfter > budgetConfig.limit,
            periodStart,
            periodEnd,
        };
    }
    async publishAgentDailyCostExceededEvent(input) {
        const receiverId = this.resolveAlertReceiverId(input.context);
        const taskTitle = String(input.task.title || '').trim() || input.task.id || '未命名任务';
        const occurredAt = new Date().toISOString();
        const event = (0, infra_1.buildMessageCenterEvent)({
            eventType: 'agent.cost.exceeded',
            source: infra_1.MESSAGE_CENTER_EVENT_SOURCE_AGENTS,
            occurredAt,
            traceId: input.runtimeContext.traceId,
            data: {
                receiverId,
                messageType: 'system_alert',
                title: 'Agent 每日 Cost 额度已超限',
                content: `Agent「${input.agent.name}」今日已消耗 $${input.usage.usedAfter.toFixed(6)}，超出额度 $${input.budgetConfig.limit.toFixed(6)}，任务「${taskTitle}」已被拦截。`,
                bizKey: `agent-cost-exceeded:${input.runtimeAgentId}:${input.runtimeContext.runId}`,
                priority: 'high',
                extra: {
                    agentId: input.runtimeAgentId,
                    agentName: input.agent.name,
                    runId: input.runtimeContext.runId,
                    sessionId: input.runtimeContext.sessionId,
                    taskId: input.task.id,
                    taskTitle,
                    traceId: input.runtimeContext.traceId,
                    period: input.budgetConfig.period,
                    unit: input.budgetConfig.unit,
                    limit: input.budgetConfig.limit,
                    usedAfter: input.usage.usedAfter,
                    periodStart: input.usage.periodStart.toISOString(),
                    periodEnd: input.usage.periodEnd.toISOString(),
                },
            },
        });
        try {
            await this.messageBus.publish('message-center.events', { payload: event });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Publish agent cost exceeded message-center event failed: agentId=${input.runtimeAgentId} runId=${input.runtimeContext.runId} reason=${reason}`);
        }
    }
    resolveAlertReceiverId(context) {
        const actorId = String(context?.actor?.employeeId || '').trim();
        const collaboration = this.toRecord(context?.collaborationContext);
        const initiatorId = String(collaboration?.initiatorId || '').trim();
        const initiator = this.toRecord(collaboration?.initiator);
        const initiatorUserId = String(initiator?.id || '').trim();
        if (actorId && !this.isSystemActorId(actorId)) {
            return actorId;
        }
        return initiatorId || initiatorUserId || (actorId || undefined);
    }
    isSystemActorId(actorId) {
        const normalized = String(actorId || '').trim().toLowerCase();
        if (!normalized) {
            return false;
        }
        if (normalized === 'legacy-service'
            || normalized === 'system'
            || normalized === 'approval-system'
            || normalized === 'agents-service') {
            return true;
        }
        return normalized.endsWith('-service');
    }
    toRecord(value) {
        return this.isPlainObject(value) ? value : undefined;
    }
    resolveBudgetPeriodStart(period) {
        const now = new Date();
        if (period === 'day') {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        if (period === 'week') {
            const day = now.getDay();
            const diffToMonday = (day + 6) % 7;
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
        }
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
};
exports.AgentOpenCodePolicyService = AgentOpenCodePolicyService;
exports.AgentOpenCodePolicyService = AgentOpenCodePolicyService = AgentOpenCodePolicyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_run_schema_1.AgentRun.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_message_schema_1.AgentMessage.name)),
    __param(3, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        runtime_orchestrator_service_1.RuntimeOrchestratorService, Object])
], AgentOpenCodePolicyService);
//# sourceMappingURL=agent-opencode-policy.service.js.map