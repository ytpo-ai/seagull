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
var OrchestrationToolHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationToolHandler = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("mongoose");
const internal_api_client_service_1 = require("../internal-api-client.service");
let OrchestrationToolHandler = OrchestrationToolHandler_1 = class OrchestrationToolHandler {
    constructor(internalApiClient) {
        this.internalApiClient = internalApiClient;
    }
    resolveMeetingContext(executionContext) {
        const collaborationContext = executionContext?.collaborationContext || {};
        return {
            meetingId: (typeof collaborationContext.meetingId === 'string' && collaborationContext.meetingId) ||
                (typeof executionContext?.teamId === 'string' && executionContext.teamId) ||
                undefined,
            initiatorId: (typeof collaborationContext.initiatorId === 'string' && collaborationContext.initiatorId) ||
                (typeof collaborationContext.triggeredBy === 'string' && collaborationContext.triggeredBy) ||
                undefined,
            taskType: executionContext?.taskType ||
                (typeof collaborationContext.meetingType === 'string' ? 'meeting' : undefined),
            organizationId: (typeof collaborationContext.organizationId === 'string' && collaborationContext.organizationId) ||
                (typeof collaborationContext.orgId === 'string' && collaborationContext.orgId) ||
                undefined,
            executionAgentId: (typeof collaborationContext.agentId === 'string' && collaborationContext.agentId) ||
                undefined,
        };
    }
    assertExecutionContext(executionContext, options) {
        const context = this.resolveMeetingContext(executionContext);
        const meetingLike = context.taskType === 'meeting' || Boolean(context.meetingId);
        if (meetingLike && options.allowMeeting) {
            return {
                mode: 'meeting',
                meetingId: context.meetingId || 'unknown-meeting',
                initiatorId: context.initiatorId,
            };
        }
        const agentId = context.executionAgentId || options.fallbackAgentId;
        if (options.allowAutonomous && context.organizationId && agentId) {
            return {
                mode: 'autonomous',
                organizationId: context.organizationId,
                agentId,
                initiatorId: context.initiatorId,
            };
        }
        if (options.allowMeeting && options.allowAutonomous) {
            throw new Error('This tool requires meeting context OR autonomous context (organizationId + agentId)');
        }
        if (options.allowMeeting) {
            throw new Error('This tool is only available in meeting context');
        }
        throw new Error('This tool requires autonomous context (organizationId + agentId)');
    }
    requireConfirm(params, action) {
        if (params?.confirm === true) {
            return;
        }
        throw new Error(`${action} requires confirm=true`);
    }
    buildScheduleConfig(params) {
        const scheduleType = params?.scheduleType;
        if (scheduleType !== 'cron' && scheduleType !== 'interval') {
            throw new Error('scheduleType must be cron or interval');
        }
        if (scheduleType === 'cron' && !String(params?.expression || '').trim()) {
            throw new Error('expression is required when scheduleType=cron');
        }
        if (scheduleType === 'interval') {
            const intervalMs = Number(params?.intervalMs || 0);
            if (!Number.isFinite(intervalMs) || intervalMs < 60000) {
                throw new Error('intervalMs must be >= 60000 when scheduleType=interval');
            }
        }
        return {
            type: scheduleType,
            expression: scheduleType === 'cron' ? String(params?.expression || '').trim() : undefined,
            intervalMs: scheduleType === 'interval' ? Number(params?.intervalMs) : undefined,
            timezone: String(params?.timezone || '').trim() || undefined,
        };
    }
    buildScheduleUpdateConfig(params) {
        const hasSchedulePatch = params?.scheduleType !== undefined ||
            params?.expression !== undefined ||
            params?.intervalMs !== undefined ||
            params?.timezone !== undefined;
        if (!hasSchedulePatch) {
            return {};
        }
        return {
            schedule: this.buildScheduleConfig({
                scheduleType: params.scheduleType,
                expression: params.expression,
                intervalMs: params.intervalMs,
                timezone: params.timezone,
            }),
        };
    }
    async createOrchestrationPlan(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        if (!params?.prompt?.trim()) {
            throw new Error('orchestration_create_plan requires prompt');
        }
        const prompt = params.prompt.trim();
        const promptMaxLength = 4000;
        if (prompt.length > promptMaxLength) {
            throw new Error(`orchestration_create_plan prompt too long: ${prompt.length} characters (max ${promptMaxLength})`);
        }
        const title = params.title?.trim();
        const titleMaxLength = 200;
        if (title && title.length > titleMaxLength) {
            throw new Error(`orchestration_create_plan title too long: ${title.length} characters (max ${titleMaxLength})`);
        }
        const validModes = ['sequential', 'parallel', 'hybrid'];
        if (params.mode && !validModes.includes(params.mode)) {
            throw new Error(`orchestration_create_plan invalid mode: ${params.mode}. allowed=${validModes.join('|')}`);
        }
        const validDomainTypes = ['general', 'development', 'research'];
        const domainType = params.domainType && validDomainTypes.includes(params.domainType)
            ? params.domainType
            : undefined;
        const validExecutionModes = ['standard', 'easy'];
        const executionMode = params.executionMode && validExecutionModes.includes(params.executionMode)
            ? params.executionMode
            : undefined;
        const contextProjectId = String(executionContext?.collaborationContext?.projectId || '').trim() || undefined;
        const projectId = String(params.projectId || '').trim() || contextProjectId;
        const payload = {
            prompt,
            title,
            mode: params.mode,
            plannerAgentId: params.plannerAgentId,
            autoRun: params.autoRun === true,
            requirementId: params.requirementId,
            ...(domainType ? { domainType } : {}),
            ...(executionMode ? { executionMode } : {}),
            ...(projectId ? { projectId } : {}),
        };
        const result = await this.internalApiClient.callOrchestrationApi('POST', '/plans/from-prompt', payload);
        return {
            action: 'create_plan',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async runOrchestrationPlan(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        if (!params?.planId?.trim()) {
            throw new Error('orchestration_run_plan requires planId');
        }
        this.requireConfirm(params, 'orchestration_run_plan');
        const result = await this.internalApiClient.callOrchestrationApi('POST', `/plans/${params.planId.trim()}/run`, { continueOnFailure: params.continueOnFailure === true });
        return {
            action: 'run_plan',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async updateOrchestrationPlan(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        const planId = String(params?.planId || '').trim();
        if (!planId) {
            throw new Error('orchestration_update_plan requires planId');
        }
        const payload = {};
        const title = params?.title?.trim();
        if (title !== undefined && title.length > 0) {
            if (title.length > 200) {
                throw new Error('orchestration_update_plan title too long: max 200 characters');
            }
            payload.title = title;
        }
        const sourcePrompt = params?.prompt?.trim();
        if (sourcePrompt !== undefined && sourcePrompt.length > 0) {
            if (sourcePrompt.length > 4000) {
                throw new Error('orchestration_update_plan prompt too long: max 4000 characters');
            }
            payload.sourcePrompt = sourcePrompt;
        }
        const validModes = ['sequential', 'parallel', 'hybrid'];
        if (params?.mode !== undefined) {
            if (!validModes.includes(params.mode)) {
                throw new Error(`orchestration_update_plan invalid mode: ${params.mode}. allowed=${validModes.join('|')}`);
            }
            payload.mode = params.mode;
        }
        if (params?.plannerAgentId !== undefined) {
            payload.plannerAgentId = String(params.plannerAgentId || '').trim();
        }
        if (params?.metadata !== undefined) {
            if (!params.metadata || typeof params.metadata !== 'object' || Array.isArray(params.metadata)) {
                throw new Error('orchestration_update_plan metadata must be an object');
            }
            payload.metadata = params.metadata;
        }
        if (!Object.keys(payload).length) {
            throw new Error('orchestration_update_plan requires at least one field to update');
        }
        const result = await this.internalApiClient.callOrchestrationApi('PATCH', `/plans/${planId}`, payload);
        return {
            action: 'update_plan',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async getOrchestrationPlan(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        if (!params?.planId?.trim()) {
            throw new Error('orchestration_get_plan requires planId');
        }
        const result = await this.internalApiClient.callOrchestrationApi('GET', `/plans/${params.planId.trim()}`, undefined);
        return {
            action: 'get_plan',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async listOrchestrationPlans(agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        const result = await this.internalApiClient.callOrchestrationApi('GET', '/plans', undefined);
        return {
            action: 'list_plans',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    validateOutlineData(data) {
        if (!Array.isArray(data)) {
            return { valid: false, reason: 'plan-initialize mode=outline requires an array' };
        }
        if (data.length === 0) {
            return { valid: true };
        }
        for (let index = 0; index < data.length; index += 1) {
            const row = data[index];
            if (!row || typeof row !== 'object' || Array.isArray(row)) {
                return { valid: false, reason: `outline[${index}] must be an object` };
            }
            if (!Number.isInteger(row.step) || Number(row.step) < 1) {
                return { valid: false, reason: `outline[${index}].step must be an integer >= 1` };
            }
            const title = String(row.title || '').trim();
            if (!title) {
                return { valid: false, reason: `outline[${index}].title is required` };
            }
            const taskType = String(row.taskType || '').trim();
            if (!OrchestrationToolHandler_1.VALID_RUNTIME_TASK_TYPES.has(taskType)) {
                return {
                    valid: false,
                    reason: `outline[${index}].taskType is invalid, allowed=${Array.from(OrchestrationToolHandler_1.VALID_RUNTIME_TASK_TYPES).join('|')}`,
                };
            }
            const phasePrompts = row.phasePrompts;
            if (!phasePrompts || typeof phasePrompts !== 'object' || Array.isArray(phasePrompts)) {
                return { valid: false, reason: `outline[${index}].phasePrompts is required` };
            }
            const promptFields = ['generating', 'pre_execute', 'execute', 'post_execute'];
            const requiredPromptFields = new Set(['generating', 'post_execute']);
            for (const field of promptFields) {
                const value = phasePrompts[field];
                const normalized = String(value || '').trim();
                if (requiredPromptFields.has(field) && !normalized) {
                    return { valid: false, reason: `outline[${index}].phasePrompts.${field} is required` };
                }
                if (normalized && normalized.length > 2000) {
                    return { valid: false, reason: `outline[${index}].phasePrompts.${field} exceeds 2000 characters` };
                }
            }
        }
        return { valid: true };
    }
    async planInitialize(params, executionContext) {
        const contextPlanId = String(executionContext?.collaborationContext?.planId || '').trim();
        const paramPlanId = String(params?.planId || '').trim();
        const planId = contextPlanId || paramPlanId;
        if (!planId || !mongoose_1.Types.ObjectId.isValid(planId)) {
            throw new Error('orchestration_plan_initialize requires valid planId');
        }
        const mode = String(params?.mode || '').trim();
        if (!mode || !OrchestrationToolHandler_1.PLAN_INITIALIZE_ALLOWED_MODES.has(mode)) {
            throw new Error('orchestration_plan_initialize mode must be outline|taskContext');
        }
        if (mode === 'outline') {
            let outlineData = params?.data;
            if (outlineData && typeof outlineData === 'object' && !Array.isArray(outlineData)) {
                const wrapped = outlineData;
                const innerArray = wrapped.items ?? wrapped.data ?? wrapped.outline;
                if (Array.isArray(innerArray) && innerArray.length > 0) {
                    outlineData = innerArray;
                    params = { ...params, data: outlineData };
                }
            }
            const validation = this.validateOutlineData(outlineData);
            if (!validation.valid) {
                throw new Error(validation.reason || 'orchestration_plan_initialize outline validation failed');
            }
        }
        if (mode === 'taskContext') {
            if (!params?.data || typeof params.data !== 'object' || Array.isArray(params.data)) {
                throw new Error('orchestration_plan_initialize mode=taskContext requires object data');
            }
            await this.internalApiClient.callOrchestrationApi('PATCH', `/plans/${planId}/metadata`, {
                $set: Object.fromEntries(Object.entries(params.data).map(([key, value]) => [`taskContext.${key}`, value])),
            });
            return {
                action: 'plan_initialize',
                mode,
                planId,
                writtenKeys: Object.keys(params.data),
            };
        }
        await this.internalApiClient.callOrchestrationApi('PATCH', `/plans/${planId}/metadata`, {
            $set: {
                [mode]: params?.data,
            },
        });
        return {
            action: 'plan_initialize',
            mode,
            planId,
            writtenKeys: ['outline'],
        };
    }
    async submitOrchestrationTask(params, executionContext) {
        const contextPlanId = String(executionContext?.collaborationContext?.planId || '').trim();
        const paramPlanId = String(params?.planId || '').trim();
        const planId = contextPlanId || paramPlanId;
        if (!planId) {
            throw new Error('orchestration_submit_task requires planId');
        }
        if (params?.isGoalReached === true) {
            const result = await this.internalApiClient.callOrchestrationApi('POST', '/planner/submit-task', {
                planId,
                action: params.action,
                isGoalReached: true,
                reasoning: params.reasoning,
            });
            return {
                action: 'submit_task',
                ...result,
            };
        }
        const action = params?.action;
        if (action !== 'new' && action !== 'redesign') {
            throw new Error('orchestration_submit_task action must be new or redesign');
        }
        const title = String(params?.title || '').trim();
        const description = String(params?.description || '').trim();
        if (!title) {
            throw new Error('orchestration_submit_task requires title');
        }
        if (!description) {
            throw new Error('orchestration_submit_task requires description');
        }
        if (action === 'redesign' && !String(params?.redesignTaskId || '').trim()) {
            throw new Error('orchestration_submit_task requires redesignTaskId when action=redesign');
        }
        const result = await this.internalApiClient.callOrchestrationApi('POST', '/planner/submit-task', {
            planId,
            action,
            title,
            description,
            priority: params?.priority,
            taskType: params?.taskType,
            agentId: String(params?.agentId || params?.executorId || '').trim() || undefined,
            requiredTools: Array.isArray(params?.requiredTools)
                ? params.requiredTools.map((toolId) => String(toolId || '').trim()).filter(Boolean)
                : undefined,
            reasoning: String(params?.reasoning || '').trim() || undefined,
            redesignTaskId: String(params?.redesignTaskId || '').trim() || undefined,
            isGoalReached: false,
        });
        return {
            action: 'submit_task',
            ...result,
        };
    }
    async reportOrchestrationTaskRunResult(params, executionContext) {
        const contextPlanId = String(executionContext?.collaborationContext?.planId || '').trim();
        const paramPlanId = String(params?.planId || '').trim();
        const planId = contextPlanId || paramPlanId;
        if (!planId) {
            throw new Error('orchestration_report_task_run_result requires planId');
        }
        const action = String(params?.action || '').trim().toLowerCase();
        if (!['generate_next', 'stop', 'redesign', 'retry'].includes(action)) {
            throw new Error('orchestration_report_task_run_result action must be generate_next|stop|redesign|retry');
        }
        const reason = String(params?.reason || '').trim();
        if (!reason) {
            throw new Error('orchestration_report_task_run_result requires reason');
        }
        if (action === 'redesign' && !String(params?.redesignTaskId || '').trim()) {
            throw new Error('orchestration_report_task_run_result requires redesignTaskId when action=redesign');
        }
        const result = await this.internalApiClient.callOrchestrationApi('POST', '/planner/report-task-run-result', {
            planId,
            action,
            reason,
            redesignTaskId: String(params?.redesignTaskId || '').trim() || undefined,
            nextTaskHints: Array.isArray(params?.nextTaskHints)
                ? params.nextTaskHints.map((item) => String(item || '').trim()).filter(Boolean)
                : undefined,
        });
        return {
            action: 'report_task_run_result',
            ...result,
        };
    }
    async reassignOrchestrationTask(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        if (!params?.taskId?.trim()) {
            throw new Error('orchestration_reassign_task requires taskId');
        }
        if (!params?.executorType) {
            throw new Error('orchestration_reassign_task requires executorType');
        }
        this.requireConfirm(params, 'orchestration_reassign_task');
        const result = await this.internalApiClient.callOrchestrationApi('POST', `/tasks/${params.taskId.trim()}/reassign`, {
            executorType: params.executorType,
            executorId: params.executorId,
            reason: params.reason,
            sourceAgentId: agentId,
        });
        return {
            action: 'reassign_task',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async completeOrchestrationHumanTask(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        if (!params?.taskId?.trim()) {
            throw new Error('orchestration_complete_human_task requires taskId');
        }
        this.requireConfirm(params, 'orchestration_complete_human_task');
        const result = await this.internalApiClient.callOrchestrationApi('POST', `/tasks/${params.taskId.trim()}/complete-human`, {
            summary: params.summary,
            output: params.output,
        });
        return {
            action: 'complete_human_task',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async createOrchestrationSchedule(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        const targetAgentId = String(params?.targetAgentId || '').trim();
        if (!targetAgentId) {
            throw new Error('orchestration_create_schedule requires targetAgentId');
        }
        const name = String(params?.name || '').trim() || `agent-schedule:${targetAgentId}`;
        const payload = {
            name,
            description: String(params?.description || '').trim() || undefined,
            schedule: this.buildScheduleConfig({
                scheduleType: params.scheduleType,
                expression: params.expression,
                intervalMs: params.intervalMs,
                timezone: params.timezone,
            }),
            target: {
                executorId: targetAgentId,
                executorName: String(params?.targetAgentName || '').trim() || undefined,
            },
            input: {
                prompt: String(params?.prompt || '').trim() || undefined,
                payload: params?.payload,
            },
            message: {
                eventType: String(params?.messageEventType || '').trim() || 'schedule.trigger',
                title: String(params?.messageTitle || '').trim() || undefined,
            },
            enabled: params?.enabled,
        };
        const result = await this.internalApiClient.callOrchestrationApi('POST', '/schedules', payload);
        return {
            action: 'create_schedule',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            targetAgentId,
            result,
        };
    }
    async updateOrchestrationSchedule(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        const scheduleId = String(params?.scheduleId || '').trim();
        if (!scheduleId) {
            throw new Error('orchestration_update_schedule requires scheduleId');
        }
        const schedulePatch = this.buildScheduleUpdateConfig({
            scheduleType: params.scheduleType,
            expression: params.expression,
            intervalMs: params.intervalMs,
            timezone: params.timezone,
        });
        const payload = {
            ...schedulePatch,
        };
        if (params?.enabled !== undefined) {
            payload.enabled = params.enabled === true;
        }
        if (!Object.keys(payload).length) {
            throw new Error('orchestration_update_schedule requires at least one field to update');
        }
        const result = await this.internalApiClient.callOrchestrationApi('PUT', `/schedules/${scheduleId}`, payload);
        return {
            action: 'update_schedule',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            result,
        };
    }
    async debugOrchestrationTask(params, agentId, executionContext) {
        const executionInfo = this.assertExecutionContext(executionContext, {
            allowMeeting: true,
            allowAutonomous: true,
            fallbackAgentId: agentId,
        });
        const taskId = String(params?.taskId || '').trim();
        if (!taskId) {
            throw new Error('orchestration_debug_task requires taskId');
        }
        const payload = {};
        if (params?.title !== undefined) {
            const title = String(params.title || '').trim();
            if (title.length > 200) {
                throw new Error('orchestration_debug_task title too long: max 200 characters');
            }
            payload.title = title;
        }
        if (params?.description !== undefined) {
            const description = String(params.description || '').trim();
            if (description.length > 4000) {
                throw new Error('orchestration_debug_task description too long: max 4000 characters');
            }
            payload.description = description;
        }
        if (params?.resetResult !== undefined) {
            payload.resetResult = params.resetResult === true;
        }
        const result = await this.internalApiClient.callOrchestrationApi('POST', `/tasks/${taskId}/debug-run`, payload);
        const execution = result?.execution || {};
        const task = result?.task || {};
        const recentLogs = Array.isArray(task?.runLogs) ? task.runLogs.slice(-5) : [];
        const debug = {
            status: execution?.status || task?.status || 'unknown',
            error: execution?.error || null,
            resultSnippet: typeof execution?.result === 'string' ? execution.result.slice(0, 800) : execution?.result ? JSON.stringify(execution.result).slice(0, 800) : null,
            recentLogs,
            suggestedNextAction: execution?.status === 'failed'
                ? 'Inspect error and dependency context, then retry debug with updated draft'
                : execution?.status === 'waiting_human'
                    ? 'Hand off to human or complete manually via complete-human-task'
                    : execution?.status === 'completed'
                        ? 'Continue with downstream dependent tasks'
                        : 'Review task status and decide next operation',
        };
        return {
            action: 'debug_task',
            contextMode: executionInfo.mode,
            meetingId: executionInfo.meetingId,
            organizationId: executionInfo.organizationId,
            initiatorAgentId: agentId,
            taskId,
            debug,
            result,
        };
    }
};
exports.OrchestrationToolHandler = OrchestrationToolHandler;
OrchestrationToolHandler.PLAN_INITIALIZE_ALLOWED_MODES = new Set(['outline', 'taskContext']);
OrchestrationToolHandler.VALID_RUNTIME_TASK_TYPES = new Set([
    'general',
    'research',
    'development.plan',
    'development.exec',
    'development.review',
]);
exports.OrchestrationToolHandler = OrchestrationToolHandler = OrchestrationToolHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [internal_api_client_service_1.InternalApiClient])
], OrchestrationToolHandler);
//# sourceMappingURL=orchestration-tool-handler.service.js.map