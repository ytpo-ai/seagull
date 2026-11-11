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
var PlannerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_schema_1 = require("../../../apps/agents/src/schemas/agent.schema");
const agent_client_service_1 = require("../agents-client/agent-client.service");
const contracts_1 = require("../../../libs/contracts/src/index");
const orchestration_plan_schema_1 = require("../../shared/schemas/orchestration-plan.schema");
const ei_project_schema_1 = require("../../shared/schemas/ei-project.schema");
const scene_optimization_service_1 = require("./services/scene-optimization.service");
const orchestration_context_service_1 = require("./services/orchestration-context.service");
let PlannerService = PlannerService_1 = class PlannerService {
    constructor(agentModel, planModel, rdProjectModel, agentClientService, contextService) {
        this.agentModel = agentModel;
        this.planModel = planModel;
        this.rdProjectModel = rdProjectModel;
        this.agentClientService = agentClientService;
        this.contextService = contextService;
        this.logger = new common_1.Logger(PlannerService_1.name);
        this.projectBindingCache = new Map();
    }
    async resolveProjectBindingForPlan(plan) {
        const projectId = String(plan.projectId || '').trim();
        if (!projectId) {
            return null;
        }
        if (this.projectBindingCache.has(projectId)) {
            return this.projectBindingCache.get(projectId) ?? null;
        }
        try {
            let project = await this.rdProjectModel
                .findOne({ _id: projectId })
                .select({ _id: 1, localPath: 1, opencodeProjectPath: 1, opencodeBindingIds: 1, sourceType: 1 })
                .lean()
                .exec();
            if (!project) {
                project = await this.rdProjectModel
                    .findOne({ incubationProjectId: new mongoose_2.Types.ObjectId(projectId), sourceType: 'local' })
                    .select({ _id: 1, localPath: 1, opencodeProjectPath: 1, opencodeBindingIds: 1, sourceType: 1 })
                    .lean()
                    .exec();
            }
            if (!project) {
                this.projectBindingCache.set(projectId, null);
                return null;
            }
            const binding = {
                localPath: project.localPath || undefined,
                opencodeProjectPath: project.opencodeProjectPath || undefined,
                localProjectId: project.sourceType === 'local' && project._id ? String(project._id) : undefined,
            };
            if (project.sourceType === 'local' && !binding.opencodeProjectPath && Array.isArray(project.opencodeBindingIds) && project.opencodeBindingIds.length > 0) {
                const linkedProject = await this.rdProjectModel
                    .findOne({ _id: project.opencodeBindingIds[0] })
                    .select({ opencodeProjectPath: 1 })
                    .lean()
                    .exec();
                if (linkedProject?.opencodeProjectPath) {
                    binding.opencodeProjectPath = linkedProject.opencodeProjectPath;
                }
            }
            if (!binding.localPath && !binding.opencodeProjectPath) {
                this.projectBindingCache.set(projectId, null);
                return null;
            }
            this.logger.log(`[resolveProjectBindingForPlan] projectId=${projectId} localProjectId=${binding.localProjectId || '-'} localPath=${binding.localPath || '-'} opencodePath=${binding.opencodeProjectPath || '-'}`);
            this.projectBindingCache.set(projectId, binding);
            return binding;
        }
        catch (err) {
            this.logger.warn(`[resolveProjectBindingForPlan] failed: ${err.message}`);
            this.projectBindingCache.set(projectId, null);
            return null;
        }
    }
    async planFromPrompt(input) {
        const mode = input.mode || 'hybrid';
        if (input.plannerAgentId) {
            const result = await this.planByAgent(input.prompt, input.plannerAgentId, mode, input.requirementId);
            if (result) {
                return result;
            }
        }
        const defaultPlanner = await this.agentModel.findOne({ isActive: true }).sort({ createdAt: 1 }).exec();
        if (defaultPlanner?._id) {
            const result = await this.planByAgent(input.prompt, defaultPlanner._id.toString(), mode, input.requirementId);
            if (result) {
                return result;
            }
        }
        return this.planByHeuristic(input.prompt, mode);
    }
    async generateNextTask(planId, context, options) {
        const plan = await this.planModel.findById(planId).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const plannerAgentId = String(plan.strategy?.plannerAgentId || '').trim();
        if (!plannerAgentId) {
            throw new common_1.BadRequestException('Plan has no planner agent configured');
        }
        const planDomainType = String(plan.domainType || 'general').trim();
        const projectBinding = await this.resolveProjectBindingForPlan(plan);
        const prompt = await this.contextService.buildGeneratingPrompt(context, {
            domainType: planDomainType,
            planId,
            plan,
        });
        const stepn = Number(context.totalSteps || 0) + 1;
        const task = {
            title: `[Incremental Planning] ${plan.title} 任务#${stepn} generating`,
            description: prompt,
            type: 'planning',
            priority: 'high',
            status: 'pending',
            assignedAgents: [plannerAgentId],
            teamId: 'orchestration',
            messages: [{ role: 'user', content: prompt, timestamp: new Date() }],
        };
        const response = await this.agentClientService.executeTask(plannerAgentId, task, {
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                ...(String(plan.createdBy || '').trim() ? { initiatorId: String(plan.createdBy || '').trim() } : {}),
                roleInPlan: 'planner',
                responseDirective: 'text',
                domainType: planDomainType,
                phase: 'generating',
                taskType: 'planning',
                ...(plan.strategy?.skillActivation ? { skillActivation: plan.strategy.skillActivation } : {}),
                ...(projectBinding ? { projectBinding } : {}),
                ...(String(plan.projectId || '').trim() ? { projectId: String(plan.projectId || '').trim() } : {}),
            }),
            sessionContext: {
                ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
                preactivatedToolIds: ['builtin.sys-mg.mcp.orchestration.submit-task'],
            },
        });
        this.logger.log(`[planner_raw_response] planId=${planId} step=${context.totalSteps} responseLen=${(response || '').length} preview=${JSON.stringify((response || '').slice(0, 500))}`);
        const parsed = this.tryParseJson(response);
        if (!parsed) {
            this.logger.warn(`[planner_parse_fail] planId=${planId} step=${context.totalSteps} response=${JSON.stringify((response || '').slice(0, 800))}`);
            return {
                isGoalReached: false,
                reasoning: 'Failed to parse planner response',
            };
        }
        const submittedTask = this.resolveSubmittedTaskFromToolPayload(parsed);
        if (submittedTask) {
            return {
                action: submittedTask.action,
                redesignTaskId: submittedTask.action === 'redesign' ? submittedTask.redesignTaskId : undefined,
                createdTaskId: submittedTask.createdTaskId,
                task: submittedTask.task,
                isGoalReached: false,
                reasoning: submittedTask.reasoning,
            };
        }
        if (parsed.goalReached === true || parsed.isGoalReached === true) {
            return {
                isGoalReached: true,
                reasoning: this.resolvePlannerReasoning(parsed),
            };
        }
        const taskCandidate = this.resolvePlannerTaskCandidate(parsed);
        const parsedAgentId = String(taskCandidate?.agentId || '').trim();
        const parsedAction = this.normalizePlannerAction(parsed?.action);
        const parsedRedesignTaskId = String(parsed?.redesignTaskId || '').trim() || undefined;
        const parsedRequiredTools = Array.isArray(taskCandidate?.requiredTools)
            ? taskCandidate.requiredTools
                .map((item) => String(item || '').trim())
                .filter(Boolean)
            : undefined;
        const parsedTask = taskCandidate
            ? {
                title: String(taskCandidate.title || taskCandidate.name || '').trim().slice(0, scene_optimization_service_1.MAX_TITLE_LENGTH),
                description: String(taskCandidate.description || taskCandidate.goal || '').trim().slice(0, scene_optimization_service_1.MAX_DESCRIPTION_LENGTH),
                priority: this.normalizePriority(taskCandidate.priority),
                agentId: parsedAgentId || undefined,
                taskType: this.normalizeRuntimeTaskType(taskCandidate.taskType),
                requiredTools: parsedRequiredTools,
            }
            : undefined;
        const validatedTask = parsedTask && parsedTask.title && parsedTask.description ? parsedTask : undefined;
        const normalizedReasoning = this.resolvePlannerReasoning(parsed, validatedTask);
        return {
            action: parsedAction,
            redesignTaskId: parsedAction === 'redesign' ? parsedRedesignTaskId : undefined,
            createdTaskId: undefined,
            task: validatedTask,
            isGoalReached: Boolean(parsed.isGoalReached),
            reasoning: normalizedReasoning,
            costTokens: Number.isFinite(parsed.costTokens) ? Number(parsed.costTokens) : undefined,
        };
    }
    async executePreTask(planId, taskContext, sessionId, step, preactivatedToolIds) {
        const plan = await this.planModel.findById(planId).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const plannerAgentId = String(plan.strategy?.plannerAgentId || '').trim();
        if (!plannerAgentId) {
            throw new common_1.BadRequestException('Plan has no planner agent configured');
        }
        const projectBinding = await this.resolveProjectBindingForPlan(plan);
        const stepTag = Number.isFinite(step) && Number(step) > 0 ? ` 任务#${Number(step)}` : '';
        const task = {
            title: `[Incremental Planning] ${plan.title}${stepTag} pre-execution`,
            description: taskContext,
            type: 'planning',
            priority: 'high',
            status: 'pending',
            assignedAgents: [plannerAgentId],
            teamId: 'orchestration',
            messages: [{ role: 'user', content: taskContext, timestamp: new Date() }],
        };
        const response = await this.agentClientService.executeTask(plannerAgentId, task, {
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                ...(String(plan.createdBy || '').trim() ? { initiatorId: String(plan.createdBy || '').trim() } : {}),
                roleInPlan: 'planner_pre_execution',
                responseDirective: 'text',
                domainType: String(plan.domainType || 'general').trim().toLowerCase(),
                phase: 'pre_execute',
                taskType: 'planning',
                ...(plan.strategy?.skillActivation ? { skillActivation: plan.strategy.skillActivation } : {}),
                ...(projectBinding ? { projectBinding } : {}),
                ...(String(plan.projectId || '').trim() ? { projectId: String(plan.projectId || '').trim() } : {}),
            }),
            sessionContext: {
                sessionId,
                preactivatedToolIds: this.normalizePreactivatedToolIds(preactivatedToolIds),
            },
        });
        const parsed = this.tryParseJson(response);
        if (!parsed || typeof parsed !== 'object') {
            return { allowExecute: true };
        }
        return {
            allowExecute: parsed.allowExecute !== false,
            executionHints: Array.isArray(parsed.executionHints)
                ? parsed.executionHints.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
            riskFlags: Array.isArray(parsed.riskFlags)
                ? parsed.riskFlags.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
            notes: String(parsed.notes || '').trim() || undefined,
        };
    }
    async initializePlan(planId, input, options) {
        const plan = await this.planModel.findById(planId).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const plannerAgentId = String(plan.strategy?.plannerAgentId || '').trim();
        if (!plannerAgentId) {
            throw new common_1.BadRequestException('Plan has no planner agent configured');
        }
        const planDomainType = String(plan.domainType || input.domainType || 'general').trim().toLowerCase();
        const planProjectId = String(plan.projectId || '').trim() || undefined;
        const projectBinding = await this.resolveProjectBindingForPlan(plan);
        const prompt = await this.contextService.buildPhaseInitializePrompt({
            planId,
            sourcePrompt: input.sourcePrompt,
            domainType: planDomainType,
            existingTaskContext: input.existingTaskContext,
            projectId: planProjectId,
        });
        const task = {
            title: `[Incremental Planning] ${plan.title} initialize`,
            description: prompt,
            type: 'planning',
            priority: 'high',
            status: 'pending',
            assignedAgents: [plannerAgentId],
            teamId: 'orchestration',
            messages: [{ role: 'user', content: prompt, timestamp: new Date() }],
        };
        const response = await this.agentClientService.executeTask(plannerAgentId, task, {
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                ...(String(plan.createdBy || '').trim() ? { initiatorId: String(plan.createdBy || '').trim() } : {}),
                roleInPlan: 'planner_initialize',
                responseDirective: 'text',
                domainType: planDomainType,
                phase: 'initialize',
                taskType: 'planning',
                ...(plan.strategy?.skillActivation ? { skillActivation: plan.strategy.skillActivation } : {}),
                ...(projectBinding ? { projectBinding } : {}),
                ...(String(plan.projectId || '').trim() ? { projectId: String(plan.projectId || '').trim() } : {}),
            }),
            sessionContext: {
                ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
                preactivatedToolIds: [
                    'builtin.sys-mg.mcp.orchestration.initialize',
                    'builtin.sys-mg.mcp.agent.list',
                ],
            },
        });
        const refreshedPlan = await this.planModel.findById(planId).select({ metadata: 1 }).lean().exec();
        const metadata = (refreshedPlan?.metadata || {});
        const taskContext = this.resolveTaskContextFromMetadata(metadata);
        const outline = await this.normalizeOutline(metadata.outline, planDomainType);
        const parsed = this.tryParseJson(response);
        const parsedResult = parsed && typeof parsed === 'object' ? this.extractPostDecisionPayload(parsed) : {};
        return {
            outline,
            taskContext,
            reasoning: String(parsedResult.reasoning || parsedResult.reason || '').trim() || undefined,
        };
    }
    async executePostTask(planId, executionResult, sessionId, step, progressHint) {
        const plan = await this.planModel.findById(planId).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const plannerAgentId = String(plan.strategy?.plannerAgentId || '').trim();
        if (!plannerAgentId) {
            throw new common_1.BadRequestException('Plan has no planner agent configured');
        }
        const projectBinding = await this.resolveProjectBindingForPlan(plan);
        const stepTag = Number.isFinite(step) && Number(step) > 0 ? ` 任务#${Number(step)}` : '';
        const task = {
            title: `[Incremental Planning] ${plan.title}${stepTag} post-execution`,
            description: executionResult,
            type: 'planning',
            priority: 'high',
            status: 'pending',
            assignedAgents: [plannerAgentId],
            teamId: 'orchestration',
            messages: [{ role: 'user', content: executionResult, timestamp: new Date() }],
        };
        const response = await this.agentClientService.executeTask(plannerAgentId, task, {
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                ...(String(plan.createdBy || '').trim() ? { initiatorId: String(plan.createdBy || '').trim() } : {}),
                roleInPlan: 'planner_post_execution',
                responseDirective: 'text',
                domainType: String(plan.domainType || 'general').trim().toLowerCase(),
                phase: 'post_execute',
                taskType: 'planning',
                ...(plan.strategy?.skillActivation ? { skillActivation: plan.strategy.skillActivation } : {}),
                ...(projectBinding ? { projectBinding } : {}),
                ...(String(plan.projectId || '').trim() ? { projectId: String(plan.projectId || '').trim() } : {}),
            }),
            sessionContext: {
                sessionId,
                preactivatedToolIds: ['builtin.sys-mg.mcp.orchestration.submit-task-run-result'],
            },
        });
        const parsed = this.tryParseJson(response);
        if (!parsed || typeof parsed !== 'object') {
            const hasRemainingSteps = progressHint?.outlineStepCount
                && progressHint?.totalGenerated != null
                && progressHint.totalGenerated < progressHint.outlineStepCount;
            const fallbackAction = hasRemainingSteps ? 'generate_next' : 'stop';
            this.logger.warn(`[post_task_parse_fallback] planId=${planId} fallbackAction=${fallbackAction} totalGenerated=${progressHint?.totalGenerated} outlineStepCount=${progressHint?.outlineStepCount}`);
            return {
                action: fallbackAction,
                reason: `Failed to parse planner post-task response (fallback=${fallbackAction})`,
            };
        }
        const decisionCandidate = this.extractPostDecisionPayload(parsed);
        const action = this.normalizePostDecisionAction(decisionCandidate.action ?? decisionCandidate.nextAction);
        return {
            action,
            reason: String(decisionCandidate.reason || '').trim() || 'Planner post-task response missing reason',
            redesignTaskId: String(decisionCandidate.redesignTaskId || '').trim() || undefined,
            nextTaskHints: Array.isArray(decisionCandidate.nextTaskHints)
                ? decisionCandidate.nextTaskHints.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
            validation: this.normalizePostValidationResult(decisionCandidate.validation),
        };
    }
    async executeEasyRun(planId, easyRunPrompt, options) {
        const plan = await this.planModel.findById(planId).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const plannerAgentId = String(plan.strategy?.plannerAgentId || '').trim();
        if (!plannerAgentId) {
            throw new common_1.BadRequestException('Plan has no planner agent configured');
        }
        const domainType = String(plan.domainType || 'general').trim().toLowerCase();
        const projectBinding = await this.resolveProjectBindingForPlan(plan);
        const task = {
            title: `[Incremental Planning] ${plan.title} easy-run`,
            description: easyRunPrompt,
            type: 'planning',
            priority: 'high',
            status: 'pending',
            assignedAgents: [plannerAgentId],
            teamId: 'orchestration',
            messages: [{ role: 'user', content: easyRunPrompt, timestamp: new Date() }],
        };
        const response = await this.agentClientService.executeTask(plannerAgentId, task, {
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                ...(String(plan.createdBy || '').trim() ? { initiatorId: String(plan.createdBy || '').trim() } : {}),
                roleInPlan: 'planner_easy_run',
                responseDirective: 'text',
                domainType,
                phase: 'easy_run',
                taskType: 'planning',
                ...(plan.strategy?.skillActivation ? { skillActivation: plan.strategy.skillActivation } : {}),
                ...(projectBinding ? { projectBinding } : {}),
                ...(String(plan.projectId || '').trim() ? { projectId: String(plan.projectId || '').trim() } : {}),
            }),
            sessionContext: {
                ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
            },
        });
        const parsed = this.tryParseJson(response);
        if (parsed && typeof parsed === 'object') {
            const summary = String(parsed.summary || parsed.result || parsed.message || '').trim();
            if (summary) {
                return {
                    summary,
                    costTokens: Number.isFinite(parsed.costTokens) ? Number(parsed.costTokens) : undefined,
                };
            }
        }
        return {
            summary: String(response || '').trim() || 'Easy run completed',
        };
    }
    normalizePostValidationResult(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return undefined;
        }
        const candidate = input;
        const passed = candidate.passed;
        if (typeof passed !== 'boolean') {
            return undefined;
        }
        const rawVerdict = String(candidate.verdict || '').trim().toLowerCase();
        const verdict = rawVerdict === 'pass' || rawVerdict === 'needs_fix' || rawVerdict === 'blocked'
            ? rawVerdict
            : undefined;
        return {
            passed,
            verdict,
            missing: Array.isArray(candidate.missing)
                ? candidate.missing.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
            ruleVersion: String(candidate.ruleVersion || '').trim() || undefined,
        };
    }
    async planByAgent(prompt, plannerAgentId, mode, requirementId) {
        const plannerPrompt = await this.contextService.resolvePlannerTaskPrompt({
            prompt,
            mode,
            requirementId,
        });
        const task = {
            title: 'Planner agent task decomposition',
            description: plannerPrompt,
            type: 'planning',
            priority: 'high',
            status: 'pending',
            assignedAgents: [plannerAgentId],
            teamId: 'orchestration',
            messages: [],
        };
        try {
            const response = await this.agentClientService.executeTask(plannerAgentId, task, {
                collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                    planId: 'legacy-planning-session',
                    roleInPlan: 'planner',
                }),
            });
            const parsed = this.tryParseJson(response);
            if (!parsed?.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
                return null;
            }
            const tasks = parsed.tasks.slice(0, scene_optimization_service_1.MAX_TASKS).map((item, index) => ({
                title: String(item.title || `子任务 ${index + 1}`).slice(0, scene_optimization_service_1.MAX_TITLE_LENGTH),
                description: String(item.description || item.title || '').slice(0, scene_optimization_service_1.MAX_DESCRIPTION_LENGTH),
                priority: this.normalizePriority(item.priority),
                dependencies: Array.isArray(item.dependencies)
                    ? item.dependencies.filter((dep) => Number.isInteger(dep) && dep >= 0)
                    : index > 0
                        ? [index - 1]
                        : [],
            }));
            return {
                mode: this.normalizeMode(parsed.mode, mode),
                tasks,
                plannerAgentId,
                strategyNote: 'Generated by planner agent',
            };
        }
        catch (err) {
            this.logger.warn(`planByAgent failed for agent=${plannerAgentId}: ${err.message}`);
            return null;
        }
    }
    planByHeuristic(prompt, mode) {
        const blocks = prompt
            .split(/[\n。！？!?;；]+/)
            .map((item) => item.trim())
            .filter(Boolean);
        const taskDrafts = (blocks.length > 1 ? blocks : this.defaultBreakdown(prompt)).slice(0, scene_optimization_service_1.MAX_TASKS);
        const tasks = taskDrafts.map((item, index) => ({
            title: `步骤 ${index + 1}: ${item.slice(0, 30)}`,
            description: item,
            priority: index === 0 ? 'high' : 'medium',
            dependencies: index === 0 ? [] : [index - 1],
        }));
        return {
            mode,
            tasks,
            strategyNote: 'Generated by heuristic planner fallback',
        };
    }
    defaultBreakdown(prompt) {
        return [
            `分析需求与边界: ${prompt}`,
            '设计实现方案并明确任务依赖关系',
            '实现核心功能并补充必要接口',
            '验证结果并整理交付说明',
        ];
    }
    tryParseJson(content) {
        const trimmed = (content || '').trim();
        if (!trimmed) {
            return null;
        }
        try {
            return JSON.parse(trimmed);
        }
        catch {
            const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i)?.[1] || trimmed.match(/```\s*([\s\S]*?)```/i)?.[1];
            if (fenced) {
                try {
                    return JSON.parse(fenced.trim());
                }
                catch {
                    return null;
                }
            }
            const start = trimmed.indexOf('{');
            const end = trimmed.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    return JSON.parse(trimmed.slice(start, end + 1));
                }
                catch {
                    return null;
                }
            }
            return null;
        }
    }
    normalizePriority(input) {
        if (input === 'low' || input === 'medium' || input === 'high' || input === 'urgent') {
            return input;
        }
        return 'medium';
    }
    normalizePlannerAction(input) {
        const val = String(input || '').trim().toLowerCase();
        return val === 'redesign' ? 'redesign' : 'new';
    }
    normalizePostDecisionAction(input) {
        const normalized = String(input || '').trim().toLowerCase();
        if (normalized === 'generate_next'
            || normalized === 'stop'
            || normalized === 'redesign'
            || normalized === 'retry') {
            return normalized;
        }
        return 'stop';
    }
    resolveSubmittedTaskFromToolPayload(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        const candidate = this.extractToolResultPayload(parsed);
        if (!candidate) {
            return null;
        }
        const taskId = String(candidate.taskId || '').trim();
        if (!taskId) {
            return null;
        }
        const action = this.normalizePlannerAction(candidate.plannerAction || candidate.action);
        const title = String(candidate.title || '').trim();
        const description = String(candidate.description || '').trim();
        const runtimeTask = title && description
            ? {
                title,
                description,
                priority: this.normalizePriority(String(candidate.priority || 'medium')),
                agentId: String(candidate.assignment?.executorId || candidate.agentId || '').trim() || undefined,
                taskType: this.normalizeRuntimeTaskType(candidate.taskType),
                requiredTools: undefined,
            }
            : undefined;
        return {
            action,
            redesignTaskId: action === 'redesign' ? String(candidate.redesignTaskId || '').trim() || undefined : undefined,
            createdTaskId: taskId,
            task: runtimeTask,
            reasoning: String(candidate.reasoning || candidate.reason || candidate.message || '').trim() || 'Task submitted via tool',
        };
    }
    extractToolResultPayload(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        if (typeof parsed.taskId === 'string' && parsed.taskId.trim()) {
            return parsed;
        }
        if (parsed.result && typeof parsed.result === 'object' && !Array.isArray(parsed.result)) {
            const result = parsed.result;
            if (typeof result.taskId === 'string' && result.taskId.trim()) {
                return result;
            }
        }
        if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
            const data = parsed.data;
            if (typeof data.taskId === 'string' && data.taskId.trim()) {
                return data;
            }
        }
        return null;
    }
    extractPostDecisionPayload(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        if (parsed.result && typeof parsed.result === 'object' && !Array.isArray(parsed.result)) {
            return parsed.result;
        }
        return parsed;
    }
    resolvePlannerTaskCandidate(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        if (parsed.task && typeof parsed.task === 'object' && !Array.isArray(parsed.task)) {
            return parsed.task;
        }
        if (parsed.nextTask && typeof parsed.nextTask === 'object' && !Array.isArray(parsed.nextTask)) {
            return parsed.nextTask;
        }
        if (typeof parsed.title === 'string' && parsed.title.trim()
            && typeof parsed.description === 'string' && parsed.description.trim()) {
            return parsed;
        }
        return null;
    }
    resolvePlannerReasoning(parsed, validatedTask) {
        const reasoningCandidates = [
            parsed?.reasoning,
            parsed?.reason,
            parsed?.message,
            typeof parsed?.result === 'string' ? parsed.result : undefined,
            !validatedTask ? 'Planner did not provide a valid task payload' : undefined,
        ];
        for (const candidate of reasoningCandidates) {
            const normalized = String(candidate || '').trim();
            if (normalized) {
                return normalized;
            }
        }
        return '';
    }
    async normalizeOutline(outline, domainType) {
        if (!Array.isArray(outline)) {
            return this.contextService.buildDefaultOutline(domainType);
        }
        const normalized = outline
            .map((item, index) => {
            const row = (item && typeof item === 'object' && !Array.isArray(item))
                ? item
                : {};
            const taskType = this.normalizeRuntimeTaskType(row.taskType);
            const title = String(row.title || '').trim();
            const rawPrompts = row.phasePrompts;
            const promptObj = rawPrompts && typeof rawPrompts === 'object' && !Array.isArray(rawPrompts)
                ? rawPrompts
                : {};
            const generating = String(promptObj.generating || '').trim();
            const postExecute = String(promptObj.post_execute || '').trim();
            const preExecute = String(promptObj.pre_execute || '').trim() || undefined;
            const execute = String(promptObj.execute || '').trim() || undefined;
            const phaseToolsCandidate = row.phaseTools;
            const phaseTools = phaseToolsCandidate && typeof phaseToolsCandidate === 'object' && !Array.isArray(phaseToolsCandidate)
                ? {
                    pre_execute: Array.isArray(phaseToolsCandidate.pre_execute)
                        ? phaseToolsCandidate.pre_execute.map((v) => String(v || '').trim()).filter(Boolean)
                        : undefined,
                    execute: Array.isArray(phaseToolsCandidate.execute)
                        ? phaseToolsCandidate.execute.map((v) => String(v || '').trim()).filter(Boolean)
                        : undefined,
                    post_execute: Array.isArray(phaseToolsCandidate.post_execute)
                        ? phaseToolsCandidate.post_execute.map((v) => String(v || '').trim()).filter(Boolean)
                        : undefined,
                }
                : undefined;
            const recommendedAgentCandidate = row.recommendedAgent;
            const recommendedAgent = recommendedAgentCandidate
                && typeof recommendedAgentCandidate === 'object'
                && !Array.isArray(recommendedAgentCandidate)
                && String(recommendedAgentCandidate.agentId || '').trim()
                ? {
                    agentId: String(recommendedAgentCandidate.agentId || '').trim(),
                    agentName: String(recommendedAgentCandidate.agentName || '').trim() || '',
                    reason: String(recommendedAgentCandidate.reason || '').trim() || '',
                }
                : undefined;
            return {
                step: typeof row.step === 'number' && Number.isInteger(row.step) ? Number(row.step) : index + 1,
                title: title || `步骤 ${index + 1}`,
                taskType,
                phasePrompts: {
                    generating,
                    ...(preExecute ? { pre_execute: preExecute } : {}),
                    ...(execute ? { execute } : {}),
                    post_execute: postExecute,
                },
                ...(recommendedAgent ? { recommendedAgent } : {}),
                ...(phaseTools ? { phaseTools } : {}),
            };
        })
            .filter((item) => Boolean(item.title) && Boolean(item.phasePrompts.generating) && Boolean(item.phasePrompts.post_execute));
        if (normalized.length === 0) {
            return this.contextService.buildDefaultOutline(domainType);
        }
        return normalized;
    }
    normalizeRuntimeTaskType(input) {
        const normalized = String(input || '').trim().toLowerCase();
        if (normalized === 'research'
            || normalized === 'development.plan'
            || normalized === 'development.exec'
            || normalized === 'development.review'
            || normalized === 'general') {
            return normalized;
        }
        return 'general';
    }
    normalizeMode(input, fallback) {
        if (input === 'sequential' || input === 'parallel' || input === 'hybrid') {
            return input;
        }
        return fallback;
    }
    resolveTaskContextFromMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            return {};
        }
        const taskContext = metadata.taskContext;
        if (!taskContext || typeof taskContext !== 'object' || Array.isArray(taskContext)) {
            return {};
        }
        return taskContext;
    }
    normalizePreactivatedToolIds(toolIds) {
        if (!Array.isArray(toolIds) || toolIds.length === 0) {
            return undefined;
        }
        const normalized = Array.from(new Set(toolIds.map((item) => String(item || '').trim()).filter(Boolean)));
        return normalized.length > 0 ? normalized : undefined;
    }
};
exports.PlannerService = PlannerService;
exports.PlannerService = PlannerService = PlannerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(2, (0, mongoose_1.InjectModel)(ei_project_schema_1.RdProject.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        orchestration_context_service_1.OrchestrationContextService])
], PlannerService);
//# sourceMappingURL=planner.service.js.map