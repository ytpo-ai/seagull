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
var PlanManagementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanManagementService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const contracts_1 = require("../../../../libs/contracts/src/index");
const orchestration_plan_schema_1 = require("../../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../../shared/schemas/orchestration-task.schema");
const orchestration_plan_session_schema_1 = require("../../../shared/schemas/orchestration-plan-session.schema");
const orchestration_run_schema_1 = require("../../../shared/schemas/orchestration-run.schema");
const plan_stats_service_1 = require("./plan-stats.service");
const orchestration_context_service_1 = require("./orchestration-context.service");
const plan_event_stream_service_1 = require("./plan-event-stream.service");
const incremental_planning_service_1 = require("./incremental-planning.service");
const orchestration_step_dispatcher_service_1 = require("./orchestration-step-dispatcher.service");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
let PlanManagementService = PlanManagementService_1 = class PlanManagementService {
    constructor(orchestrationPlanModel, orchestrationTaskModel, planSessionModel, orchestrationRunModel, planStatsService, contextService, planEventStreamService, incrementalPlanningService, stepDispatcher, agentClientService) {
        this.orchestrationPlanModel = orchestrationPlanModel;
        this.orchestrationTaskModel = orchestrationTaskModel;
        this.planSessionModel = planSessionModel;
        this.orchestrationRunModel = orchestrationRunModel;
        this.planStatsService = planStatsService;
        this.contextService = contextService;
        this.planEventStreamService = planEventStreamService;
        this.incrementalPlanningService = incrementalPlanningService;
        this.stepDispatcher = stepDispatcher;
        this.agentClientService = agentClientService;
        this.logger = new common_1.Logger(PlanManagementService_1.name);
        this.runningPlans = new Set();
    }
    async createPlanFromPrompt(createdBy, dto) {
        const prompt = String(dto.prompt || '').trim();
        if (!prompt) {
            throw new common_1.BadRequestException('prompt is required');
        }
        const domainType = this.normalizeDomainType(dto.domainType);
        const requirementId = String(dto.requirementId || '').trim() || undefined;
        let projectId = String(dto.projectId || '').trim() || undefined;
        if (!projectId && dto.plannerAgentId) {
            const plannerAgent = await this.agentClientService.getAgent(dto.plannerAgentId);
            const agentProjectId = String(plannerAgent?.projectId || '').trim() || undefined;
            if (agentProjectId) {
                this.logger.log(`[createPlanFromPrompt] auto-inferred projectId=${agentProjectId} from plannerAgent=${dto.plannerAgentId}`);
                projectId = agentProjectId;
            }
        }
        const plan = await new this.orchestrationPlanModel({
            title: dto.title || this.derivePlanTitle(prompt),
            sourcePrompt: prompt,
            domainType,
            status: 'draft',
            strategy: {
                plannerAgentId: dto.plannerAgentId,
                mode: dto.mode || 'hybrid',
                runMode: dto.runMode || 'multi',
                ...(dto.executionMode ? { executionMode: dto.executionMode } : {}),
                ...(dto.skillActivation ? { skillActivation: dto.skillActivation } : {}),
            },
            generationMode: 'incremental',
            generationConfig: {
                maxRetries: 3,
                maxTotalFailures: 6,
                maxCostTokens: 500000,
                maxTasks: 15,
            },
            generationState: {
                currentStep: 0,
                totalGenerated: 0,
                totalRetries: 0,
                consecutiveFailures: 0,
                totalFailures: 0,
                totalCost: 0,
                isComplete: false,
                currentPhase: 'idle',
            },
            stats: {
                totalTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                waitingHumanTasks: 0,
            },
            taskIds: [],
            metadata: {
                ...(dto.plannerAgentId ? { requestedPlannerAgentId: dto.plannerAgentId } : {}),
                ...(requirementId ? { requirementId } : {}),
            },
            ...(projectId ? { projectId } : {}),
            createdBy,
        }).save();
        const planId = plan._id.toString();
        await this.planSessionModel
            .updateOne({ planId }, {
            $set: {
                planId,
                title: plan.title,
                status: 'active',
                tasks: [],
            },
        }, { upsert: true })
            .exec();
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.status.changed', {
            status: 'draft',
            phase: 'created',
            planId,
            title: plan.title,
        });
        if (dto.autoGenerate || dto.autoRun) {
            this.startGeneration(planId).catch((err) => {
                this.logger.error(`Incremental planning start failed: ${err.message}`);
            });
        }
        return this.getPlanById(planId);
    }
    async listPlans(filters) {
        const query = {};
        if (filters?.projectId !== undefined) {
            query.projectId = filters.projectId || { $in: [null, '', undefined] };
        }
        const plans = await this.orchestrationPlanModel.find(query).sort({ createdAt: -1 }).exec();
        return plans.map((plan) => {
            const normalizedStatus = this.planStatsService.normalizePlanStatus(plan.status, plan.taskIds?.length);
            if (normalizedStatus === plan.status) {
                return plan;
            }
            return {
                ...plan.toObject(),
                status: normalizedStatus,
            };
        });
    }
    async getPlanById(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const tasks = await this.orchestrationTaskModel
            .find({ planId: plan._id.toString() })
            .sort({ order: 1 })
            .exec();
        const planSession = await this.planSessionModel
            .findOne({ planId: plan._id.toString() })
            .exec();
        const lastRunId = String(plan.lastRunId || '').trim();
        const lastRun = lastRunId
            ? await this.orchestrationRunModel.findOne({ _id: lastRunId }).exec()
            : await this.orchestrationRunModel
                .findOne({ planId: plan._id.toString() })
                .sort({ startedAt: -1 })
                .exec();
        const normalizedStatus = this.planStatsService.normalizePlanStatus(plan.status, tasks.length);
        return {
            ...plan.toObject(),
            status: normalizedStatus,
            tasks,
            planSession,
            lastRun,
        };
    }
    async updatePlan(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (await this.isPlanRunActive(planId)) {
            throw new common_1.BadRequestException('Plan is running and cannot be edited');
        }
        this.assertPlanUnlocked(plan);
        const title = dto.title?.trim();
        const sourcePrompt = dto.sourcePrompt?.trim();
        const plannerAgentId = dto.plannerAgentId?.trim();
        const updatePayload = {};
        const unsetPayload = {};
        if (title) {
            updatePayload.title = title;
        }
        if (sourcePrompt) {
            updatePayload.sourcePrompt = sourcePrompt;
        }
        if (dto.domainType) {
            updatePayload.domainType = this.normalizeDomainType(dto.domainType);
        }
        if (dto.mode) {
            updatePayload['strategy.mode'] = dto.mode;
        }
        if (dto.runMode) {
            updatePayload['strategy.runMode'] = dto.runMode;
        }
        if (dto.plannerAgentId !== undefined) {
            if (plannerAgentId) {
                updatePayload['strategy.plannerAgentId'] = plannerAgentId;
            }
            else {
                unsetPayload['strategy.plannerAgentId'] = 1;
            }
        }
        if (dto.projectId !== undefined) {
            const trimmedProjectId = dto.projectId.trim();
            if (trimmedProjectId) {
                updatePayload.projectId = trimmedProjectId;
            }
            else {
                unsetPayload.projectId = 1;
            }
        }
        if (dto.metadata && typeof dto.metadata === 'object' && !Array.isArray(dto.metadata)) {
            updatePayload.metadata = {
                ...(plan.metadata || {}),
                ...dto.metadata,
            };
        }
        if (!Object.keys(updatePayload).length && !Object.keys(unsetPayload).length) {
            throw new common_1.BadRequestException('At least one updatable field is required');
        }
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            ...(Object.keys(updatePayload).length ? { $set: updatePayload } : {}),
            ...(Object.keys(unsetPayload).length ? { $unset: unsetPayload } : {}),
        })
            .exec();
        if (updatePayload.title) {
            await this.planSessionModel
                .updateOne({ planId }, {
                $set: {
                    title: updatePayload.title,
                },
            })
                .exec();
        }
        return this.getPlanById(planId);
    }
    async updatePlanMetadata(planId, patch) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).select({ _id: 1 }).lean().exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const setPayload = {};
        const unsetPayload = {};
        const rawSet = patch?.$set;
        if (rawSet && typeof rawSet === 'object' && !Array.isArray(rawSet)) {
            for (const [key, value] of Object.entries(rawSet)) {
                const normalizedKey = String(key || '').trim();
                if (!normalizedKey) {
                    continue;
                }
                setPayload[`metadata.${normalizedKey}`] = value;
            }
        }
        const rawUnset = patch?.$unset;
        if (rawUnset && typeof rawUnset === 'object' && !Array.isArray(rawUnset)) {
            for (const key of Object.keys(rawUnset)) {
                const normalizedKey = String(key || '').trim();
                if (!normalizedKey) {
                    continue;
                }
                unsetPayload[`metadata.${normalizedKey}`] = 1;
            }
        }
        if (!Object.keys(setPayload).length && !Object.keys(unsetPayload).length) {
            throw new common_1.BadRequestException('At least one metadata patch operation is required');
        }
        await this.orchestrationPlanModel
            .updateOne({ _id: planId }, {
            ...(Object.keys(setPayload).length ? { $set: setPayload } : {}),
            ...(Object.keys(unsetPayload).length ? { $unset: unsetPayload } : {}),
        })
            .exec();
        return {
            success: true,
            planId,
            setKeys: Object.keys(setPayload),
            unsetKeys: Object.keys(unsetPayload),
        };
    }
    async deletePlan(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const taskDeleteResult = await this.orchestrationTaskModel
            .deleteMany({ planId: plan._id.toString() })
            .exec();
        await this.planSessionModel.deleteOne({ planId: plan._id.toString() }).exec();
        await this.orchestrationPlanModel.deleteOne({ _id: plan._id }).exec();
        return {
            success: true,
            deletedTasks: taskDeleteResult.deletedCount || 0,
        };
    }
    async startGeneration(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const generationMode = plan.generationMode || 'batch';
        if (generationMode !== 'incremental') {
            throw new common_1.BadRequestException('Only incremental plans support generation start');
        }
        if (plan.generationState?.isComplete) {
            throw new common_1.BadRequestException('Planning already completed');
        }
        setTimeout(() => {
            if (this.isStepDispatcherEnabled()) {
                this.stepDispatcher
                    .advanceOnce(planId, { source: 'internal' })
                    .catch((error) => {
                    const message = error instanceof Error ? error.message : 'Step dispatcher failed';
                    this.logger.error(`Step dispatcher failed for plan ${planId}: ${message}`);
                });
            }
            else {
                this.incrementalPlanningService
                    .executeIncrementalPlanning(planId)
                    .catch((error) => {
                    const message = error instanceof Error ? error.message : 'Incremental planning failed';
                    this.logger.error(`Incremental planning failed for plan ${planId}: ${message}`);
                });
            }
        }, 0);
        return { accepted: true };
    }
    async generateNext(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if ((plan.generationMode || 'batch') !== 'incremental') {
            throw new common_1.BadRequestException('Only incremental plans support generate-next');
        }
        const currentState = plan.generationState;
        const needsReset = currentState?.isComplete ||
            Number(currentState?.consecutiveFailures || 0) > 0 ||
            currentState?.currentPhase === 'initialize';
        if (needsReset) {
            await this.orchestrationPlanModel
                .updateOne({ _id: planId }, {
                $set: {
                    'generationState.isComplete': false,
                    'generationState.consecutiveFailures': 0,
                    'generationState.lastError': undefined,
                    'generationState.currentPhase': 'idle',
                    'generationState.lastDecision': undefined,
                    status: 'planned',
                },
            })
                .exec();
        }
        setTimeout(() => {
            if (this.isStepDispatcherEnabled()) {
                this.stepDispatcher
                    .advanceOnce(planId, { source: 'api' })
                    .catch((error) => {
                    const message = error instanceof Error ? error.message : 'Step dispatcher step failed';
                    this.logger.error(`Step dispatcher step failed for plan ${planId}: ${message}`);
                });
            }
            else {
                this.incrementalPlanningService
                    .executeSinglePlanningStep(planId)
                    .catch((error) => {
                    const message = error instanceof Error ? error.message : 'Incremental step failed';
                    this.logger.error(`Incremental step failed for plan ${planId}: ${message}`);
                });
            }
        }, 0);
        return { accepted: true };
    }
    async stopGeneration(planId, reason) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if ((plan.generationMode || 'batch') !== 'incremental') {
            throw new common_1.BadRequestException('Only incremental plans support stop-generation');
        }
        const stopResult = await this.stepDispatcher.stopGeneration(planId);
        const normalizedReason = String(reason || '').trim() || 'manually stopped by user';
        if (stopResult.stopped) {
            await this.orchestrationPlanModel
                .updateOne({ _id: planId }, {
                $set: {
                    status: 'draft',
                    'generationState.isComplete': true,
                    'generationState.currentPhase': 'idle',
                    'generationState.currentTaskId': undefined,
                    'generationState.lastDecision': 'stop',
                    'generationState.lastError': undefined,
                    'metadata.planningStoppedAt': new Date().toISOString(),
                    'metadata.planningStoppedReason': normalizedReason,
                },
            })
                .exec();
            await this.planStatsService.setPlanStatus(planId, 'draft');
            await this.planStatsService.setPlanSessionStatus(planId, 'draft');
            this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.status.changed', {
                planId,
                status: 'draft',
                phase: 'generation_stopped',
                reason: normalizedReason,
            });
            return {
                success: true,
                planId,
                stopped: true,
            };
        }
        return {
            success: true,
            planId,
            stopped: false,
            alreadyStopped: stopResult.alreadyStopped,
        };
    }
    async replanPlan(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (await this.isPlanRunActive(planId)) {
            throw new common_1.BadRequestException('Plan is running and cannot be replanned');
        }
        this.assertPlanUnlocked(plan);
        const prompt = dto.prompt?.trim();
        if (!prompt) {
            throw new common_1.BadRequestException('prompt is required');
        }
        const plannerAgentId = dto.plannerAgentId?.trim();
        const resolvedPlannerAgentId = plannerAgentId || String(plan.strategy?.plannerAgentId || '').trim() || undefined;
        const title = dto.title?.trim() || plan.title || this.derivePlanTitle(prompt);
        const fallbackMode = dto.mode || plan.strategy?.mode || 'hybrid';
        const fallbackRunMode = dto.runMode || plan.strategy?.runMode || 'multi';
        const domainType = this.normalizeDomainType(dto.domainType || plan.domainType);
        const requirementId = this.contextService.resolveRequirementIdFromPlan(plan);
        const shouldStartGeneration = dto.autoGenerate ?? dto.autoRun ?? false;
        try {
            await this.orchestrationTaskModel.deleteMany({ planId }).exec();
            await this.archivePlannerSessionForReplan(plan.generationState?.plannerSessionId);
            const replannedPlannerSessionId = await this.createPlannerSessionForReplan(planId, title, resolvedPlannerAgentId);
            await this.planSessionModel
                .updateOne({ planId }, {
                $set: {
                    planId,
                    title,
                    status: 'active',
                    tasks: [],
                },
            }, { upsert: true })
                .exec();
            await this.orchestrationPlanModel
                .updateOne({ _id: planId }, {
                $set: {
                    title,
                    sourcePrompt: prompt,
                    domainType,
                    status: 'draft',
                    strategy: {
                        plannerAgentId: plannerAgentId || plan.strategy?.plannerAgentId,
                        mode: fallbackMode,
                        runMode: fallbackRunMode,
                    },
                    generationMode: 'incremental',
                    generationConfig: {
                        maxRetries: plan.generationConfig?.maxRetries || 3,
                        maxTotalFailures: plan.generationConfig?.maxTotalFailures || 6,
                        maxCostTokens: plan.generationConfig?.maxCostTokens || 500000,
                        maxTasks: plan.generationConfig?.maxTasks || 15,
                    },
                    generationState: {
                        currentStep: 0,
                        totalGenerated: 0,
                        totalRetries: 0,
                        consecutiveFailures: 0,
                        totalFailures: 0,
                        totalCost: 0,
                        isComplete: false,
                        currentPhase: 'idle',
                        plannerSessionId: replannedPlannerSessionId,
                    },
                    stats: {
                        totalTasks: 0,
                        completedTasks: 0,
                        failedTasks: 0,
                        waitingHumanTasks: 0,
                    },
                    taskIds: [],
                    'metadata.replanStartedAt': new Date().toISOString(),
                    ...(requirementId ? { 'metadata.requirementId': requirementId } : {}),
                },
                $unset: {
                    'metadata.asyncReplanError': 1,
                    'metadata.replannedAt': 1,
                    'metadata.replanFailedAt': 1,
                    'metadata.planningFailedAt': 1,
                    'metadata.planningCompletedAt': 1,
                },
            })
                .exec();
            await this.planStatsService.setPlanStatus(planId, 'draft');
            await this.planStatsService.setPlanSessionStatus(planId, 'draft');
            await this.planStatsService.syncPlanSessionTasks(planId);
            this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.status.changed', {
                planId,
                status: 'draft',
                phase: 'replan_reset',
            });
            if (shouldStartGeneration) {
                await this.startGeneration(planId);
            }
            else {
                this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.replan.ready', {
                    planId,
                    status: 'draft',
                });
            }
            return this.getPlanById(planId);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Async replan failed';
            await this.planStatsService.setPlanStatus(planId, 'draft');
            await this.planStatsService.setPlanSessionStatus(planId, 'draft');
            await this.orchestrationPlanModel
                .updateOne({ _id: planId }, {
                $set: {
                    'metadata.asyncReplanError': message,
                    'metadata.replanFailedAt': new Date().toISOString(),
                },
            })
                .exec();
            this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.failed', {
                planId,
                status: 'failed',
                error: message,
            });
            throw error;
        }
    }
    async replanPlanAsync(planId, dto) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        const prompt = String(dto.prompt || '').trim();
        if (!prompt) {
            throw new common_1.BadRequestException('prompt is required');
        }
        if (await this.isPlanRunActive(planId)) {
            throw new common_1.BadRequestException('Plan is running and cannot be replanned');
        }
        this.assertPlanUnlocked(plan);
        const runKey = `replan:${planId}`;
        if (this.runningPlans.has(runKey)) {
            return {
                accepted: true,
                planId,
                status: 'running',
                alreadyRunning: true,
            };
        }
        this.runningPlans.add(runKey);
        setTimeout(() => {
            this.replanPlan(planId, dto)
                .catch((error) => {
                const message = error instanceof Error ? error.message : 'Async replan failed';
                this.logger.error(`Async replan failed for plan ${planId}: ${message}`);
            })
                .finally(() => {
                this.runningPlans.delete(runKey);
            });
        }, 0);
        return {
            accepted: true,
            planId,
            status: 'accepted',
            alreadyRunning: false,
        };
    }
    async publishPlan(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (await this.isPlanRunActive(planId)) {
            throw new common_1.BadRequestException('Plan is running and cannot be published');
        }
        const normalizedStatus = this.planStatsService.normalizePlanStatus(plan.status, plan.taskIds?.length);
        if (normalizedStatus !== 'planned') {
            throw new common_1.BadRequestException(`Plan in "${normalizedStatus}" status cannot be published`);
        }
        await this.planStatsService.setPlanStatus(planId, 'production');
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: 'production',
            phase: 'published',
        });
        const updated = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!updated) {
            throw new common_1.NotFoundException('Plan not found');
        }
        return updated;
    }
    async unlockPlan(planId) {
        const plan = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!plan) {
            throw new common_1.NotFoundException('Plan not found');
        }
        if (await this.isPlanRunActive(planId)) {
            throw new common_1.BadRequestException('Plan is running and cannot be unlocked');
        }
        const normalizedStatus = this.planStatsService.normalizePlanStatus(plan.status, plan.taskIds?.length);
        if (normalizedStatus !== 'production') {
            throw new common_1.BadRequestException(`Plan in "${normalizedStatus}" status cannot be unlocked`);
        }
        await this.planStatsService.setPlanStatus(planId, 'planned');
        this.planEventStreamService.emitPlanStreamEvent(planId, 'plan.status.changed', {
            planId,
            status: 'planned',
            phase: 'unlocked',
        });
        const updated = await this.orchestrationPlanModel.findOne({ _id: planId }).exec();
        if (!updated) {
            throw new common_1.NotFoundException('Plan not found');
        }
        return updated;
    }
    derivePlanTitle(prompt) {
        return prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;
    }
    normalizeDomainType(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'development' || normalized === 'research') {
            return normalized;
        }
        return 'general';
    }
    async isPlanRunActive(planId) {
        const runningRun = await this.orchestrationRunModel
            .findOne({ planId, status: 'running' })
            .select({ _id: 1 })
            .lean()
            .exec();
        return Boolean(runningRun);
    }
    assertPlanUnlocked(plan) {
        const normalizedStatus = this.planStatsService.normalizePlanStatus(plan.status, plan.taskIds?.length);
        if (normalizedStatus === 'production') {
            throw new common_1.BadRequestException('Plan is in production and cannot be edited. Please unlock first.');
        }
    }
    isStepDispatcherEnabled() {
        const value = String(process.env.ORCH_STEP_DISPATCHER_ENABLED || '').trim().toLowerCase();
        return value === '1' || value === 'true' || value === 'yes' || value === 'on';
    }
    async archivePlannerSessionForReplan(existingPlannerSessionId) {
        const sessionId = String(existingPlannerSessionId || '').trim();
        if (!sessionId) {
            return;
        }
        try {
            await this.agentClientService.archiveSession(sessionId);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Archive old planner session failed: sessionId=${sessionId}, error=${message}`);
        }
    }
    async createPlannerSessionForReplan(planId, planTitle, plannerAgentId) {
        const normalizedPlannerAgentId = String(plannerAgentId || '').trim();
        if (!normalizedPlannerAgentId) {
            return undefined;
        }
        const session = await this.agentClientService.getOrCreatePlanSession(planId, normalizedPlannerAgentId, `Planner Session: ${planTitle}`, {
            orchestrationRunId: `replan-${Date.now()}`,
            collaborationContext: contracts_1.CollaborationContextFactory.orchestration({
                planId,
                roleInPlan: 'planner',
            }),
        });
        const sessionId = String(session?.id || session?.sessionId || '').trim();
        return sessionId || undefined;
    }
};
exports.PlanManagementService = PlanManagementService;
exports.PlanManagementService = PlanManagementService = PlanManagementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(orchestration_plan_schema_1.OrchestrationPlan.name)),
    __param(1, (0, mongoose_1.InjectModel)(orchestration_task_schema_1.OrchestrationTask.name)),
    __param(2, (0, mongoose_1.InjectModel)(orchestration_plan_session_schema_1.PlanSession.name)),
    __param(3, (0, mongoose_1.InjectModel)(orchestration_run_schema_1.OrchestrationRun.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        plan_stats_service_1.PlanStatsService,
        orchestration_context_service_1.OrchestrationContextService,
        plan_event_stream_service_1.PlanEventStreamService,
        incremental_planning_service_1.IncrementalPlanningService,
        orchestration_step_dispatcher_service_1.OrchestrationStepDispatcherService,
        agent_client_service_1.AgentClientService])
], PlanManagementService);
//# sourceMappingURL=plan-management.service.js.map