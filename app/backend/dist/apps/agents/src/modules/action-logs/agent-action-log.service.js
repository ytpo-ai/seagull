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
var AgentActionLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentActionLogService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_action_log_schema_1 = require("../../schemas/agent-action-log.schema");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
let AgentActionLogService = AgentActionLogService_1 = class AgentActionLogService {
    constructor(agentActionLogModel, agentRunModel, redisService, messageBus) {
        this.agentActionLogModel = agentActionLogModel;
        this.agentRunModel = agentRunModel;
        this.redisService = redisService;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(AgentActionLogService_1.name);
        this.runtimeStatusMap = {
            'run.started': 'started',
            'run.step.started': 'step_started',
            'run.completed': 'completed',
            'run.failed': 'failed',
            'run.paused': 'paused',
            'run.resumed': 'resumed',
            'run.cancelled': 'cancelled',
            'tool.pending': 'pending',
            'tool.running': 'running',
            'tool.completed': 'completed',
            'tool.failed': 'failed',
            'permission.asked': 'asked',
            'permission.replied': 'replied',
            'permission.denied': 'denied',
        };
    }
    async record(input) {
        const normalizedStatus = String(input.status || '').trim().toLowerCase();
        const normalizedDetails = (input.details || {});
        try {
            await this.agentActionLogModel.create({
                agentId: input.agentId,
                contextType: input.contextType,
                contextId: input.contextId,
                action: input.action,
                sourceEventId: input.sourceEventId,
                details: {
                    ...normalizedDetails,
                    status: input.status,
                    durationMs: Number.isFinite(input.durationMs) ? input.durationMs : 0,
                },
                timestamp: new Date(),
            });
        }
        catch (error) {
            if (this.isDuplicateKeyError(error)) {
                return;
            }
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to record agent action log: ${message}`);
        }
    }
    async recordRuntimeHookEvent(event) {
        const status = this.runtimeStatusMap[event.eventType] || 'unknown';
        const context = this.resolveRuntimeContext(event);
        const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
        const toolId = this.extractString(payload, 'toolId');
        const toolName = this.extractString(payload, 'toolName');
        const params = this.extractUnknown(payload, 'params') ?? this.extractUnknown(payload, 'input');
        await this.record({
            agentId: event.agentId,
            contextType: context.contextType,
            contextId: context.contextId,
            action: `runtime:${event.eventType}`,
            status,
            sourceEventId: event.eventId,
            details: {
                eventType: event.eventType,
                agentSessionId: event.sessionId,
                runId: event.runId,
                sessionId: event.sessionId,
                taskId: event.taskId,
                messageId: event.messageId,
                partId: event.partId,
                toolCallId: event.toolCallId,
                toolId,
                toolName,
                params,
                sequence: event.sequence,
                traceId: event.traceId,
                eventTimestamp: event.timestamp,
                payload,
            },
        });
    }
    resolveRuntimeContext(event) {
        const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
        const meetingId = this.extractString(payload, 'meetingId');
        if (meetingId) {
            return { contextType: 'chat', contextId: meetingId };
        }
        const planId = this.extractString(payload, 'planId');
        if (planId) {
            return { contextType: 'orchestration', contextId: planId };
        }
        const sessionMeetingId = this.resolveMeetingIdFromSession(event.sessionId);
        if (sessionMeetingId) {
            return { contextType: 'chat', contextId: sessionMeetingId };
        }
        if (event.taskId) {
            return { contextType: 'orchestration', contextId: event.taskId };
        }
        const sessionTaskId = this.resolveTaskIdFromSession(event.sessionId);
        if (sessionTaskId) {
            return { contextType: 'orchestration', contextId: sessionTaskId };
        }
        return { contextType: 'chat', contextId: event.runId };
    }
    resolveMeetingIdFromSession(sessionId) {
        if (!sessionId || !sessionId.startsWith('meeting-'))
            return undefined;
        const parts = sessionId.split('-');
        if (parts.length < 3)
            return undefined;
        return parts.slice(1, -1).join('-') || undefined;
    }
    resolveTaskIdFromSession(sessionId) {
        if (!sessionId || !sessionId.startsWith('task-'))
            return undefined;
        return sessionId.slice('task-'.length) || undefined;
    }
    extractString(payload, key) {
        const value = payload[key];
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    }
    extractUnknown(payload, key) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) {
            return undefined;
        }
        return payload[key];
    }
    isDuplicateKeyError(error) {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const code = error.code;
        return code === 11000;
    }
    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    parseDate(value) {
        if (!value)
            return undefined;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed;
    }
    readString(value) {
        if (typeof value !== 'string') {
            return undefined;
        }
        const normalized = value.trim();
        return normalized ? normalized : undefined;
    }
    readObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return undefined;
        }
        return value;
    }
    resolveMetadataString(metadata, keys) {
        const direct = keys.map((key) => this.readString(metadata[key])).find(Boolean);
        if (direct) {
            return direct;
        }
        const firstLayer = this.readObject(metadata.collaborationContext);
        if (firstLayer) {
            const firstLayerValue = keys.map((key) => this.readString(firstLayer[key])).find(Boolean);
            if (firstLayerValue) {
                return firstLayerValue;
            }
            const secondLayer = this.readObject(firstLayer.collaborationContext);
            if (secondLayer) {
                const secondLayerValue = keys.map((key) => this.readString(secondLayer[key])).find(Boolean);
                if (secondLayerValue) {
                    return secondLayerValue;
                }
            }
        }
        return undefined;
    }
    async buildRuntimeRunContextSnapshotMap(runIds) {
        if (!runIds.length) {
            return new Map();
        }
        const runs = await this.agentRunModel
            .find({ id: { $in: runIds } })
            .select({ id: 1, taskTitle: 1, metadata: 1 })
            .lean()
            .exec();
        const result = new Map();
        for (const run of runs) {
            const runId = this.readString(run.id);
            if (!runId) {
                continue;
            }
            const metadata = this.readObject(run.metadata) || {};
            const meetingContext = this.readObject(metadata.meetingContext);
            const planTitle = this.resolveMetadataString(metadata, ['planTitle', 'planName', 'title']);
            const meetingTitle = this.resolveMetadataString(metadata, ['meetingTitle'])
                || this.readString(meetingContext?.meetingTitle)
                || this.resolveMetadataString(metadata, ['title']);
            result.set(runId, {
                runId,
                taskTitle: this.readString(run.taskTitle),
                taskType: this.resolveMetadataString(metadata, ['taskType']),
                planId: this.resolveMetadataString(metadata, ['planId']),
                planTitle,
                meetingId: this.resolveMetadataString(metadata, ['meetingId'])
                    || this.readString(meetingContext?.meetingId),
                meetingTitle,
            });
        }
        return result;
    }
    enrichLogDetails(details, runContext, contextType, contextId) {
        const normalizedDetails = details ? { ...details } : {};
        const taskId = this.readString(normalizedDetails.taskId);
        const explicitTaskType = this.readString(normalizedDetails.taskType);
        const runTaskType = runContext?.taskType;
        const taskType = explicitTaskType || runTaskType;
        const taskTitle = this.readString(normalizedDetails.taskTitle) || runContext?.taskTitle;
        const meetingTitle = this.readString(normalizedDetails.meetingTitle) || runContext?.meetingTitle;
        const meetingId = this.readString(normalizedDetails.meetingId) || runContext?.meetingId;
        const planId = this.readString(normalizedDetails.planId) || runContext?.planId || contextId;
        const planTitle = this.readString(normalizedDetails.planTitle) || runContext?.planTitle;
        let environmentType = this.readString(normalizedDetails.environmentType);
        if (!environmentType) {
            if (taskType === 'internal_message' || (taskId && taskId.startsWith('inner-message:'))) {
                environmentType = 'internal_message';
            }
            else if (contextType === 'chat' && (meetingTitle || meetingId || contextId)) {
                environmentType = 'meeting_chat';
            }
            else if (contextType === 'orchestration') {
                environmentType = 'orchestration_plan';
            }
            else {
                environmentType = 'chat';
            }
        }
        return {
            ...normalizedDetails,
            ...(taskTitle ? { taskTitle } : {}),
            ...(taskType ? { taskType } : {}),
            ...(meetingTitle ? { meetingTitle } : {}),
            ...(meetingId ? { meetingId } : {}),
            ...(planId ? { planId } : {}),
            ...(planTitle ? { planTitle } : {}),
            ...(environmentType ? { environmentType } : {}),
        };
    }
    async queryAgentActionLogs(params) {
        const from = this.parseDate(params.from);
        const to = this.parseDate(params.to);
        if (from && to && from.getTime() > to.getTime()) {
            return {
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0,
                logs: [],
                fetchedAt: new Date().toISOString(),
            };
        }
        const page = Math.max(1, Math.min(Number(params.page || 1), 10000));
        const pageSize = Math.max(1, Math.min(Number(params.pageSize || 20), 200));
        const skip = (page - 1) * pageSize;
        const filter = {};
        if (params.agentId?.trim()) {
            filter.agentId = params.agentId.trim();
        }
        if (params.contextType?.trim()) {
            filter.contextType = params.contextType.trim();
        }
        if (params.contextId?.trim()) {
            filter.contextId = params.contextId.trim();
        }
        if (params.action?.trim()) {
            filter.action = { $regex: this.escapeRegex(params.action.trim()), $options: 'i' };
        }
        if (params.status?.trim()) {
            const status = params.status.trim();
            filter.$or = [{ 'details.status': status }, { status }];
        }
        if (from || to) {
            filter.timestamp = {};
            if (from)
                filter.timestamp.$gte = from;
            if (to)
                filter.timestamp.$lte = to;
        }
        const [total, logs] = await Promise.all([
            this.agentActionLogModel.countDocuments(filter).exec(),
            this.agentActionLogModel
                .find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean()
                .exec(),
        ]);
        const runIds = Array.from(new Set(logs
            .map((item) => {
            const details = this.readObject(item.details);
            return this.readString(details?.runId);
        })
            .filter((runId) => Boolean(runId))));
        const runContextMap = await this.buildRuntimeRunContextSnapshotMap(runIds);
        return {
            total,
            page,
            pageSize,
            totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
            logs: logs.map((item) => ({
                id: item.id,
                agentId: item.agentId,
                contextType: item.contextType,
                contextId: item.contextId,
                action: item.action,
                details: this.enrichLogDetails(this.readObject(item.details), runContextMap.get(this.readString(this.readObject(item.details)?.runId) || ''), item.contextType, item.contextId),
                timestamp: item.timestamp,
            })),
            fetchedAt: new Date().toISOString(),
        };
    }
};
exports.AgentActionLogService = AgentActionLogService;
exports.AgentActionLogService = AgentActionLogService = AgentActionLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_action_log_schema_1.AgentActionLog.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_run_schema_1.AgentRun.name)),
    __param(3, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        infra_1.RedisService, Object])
], AgentActionLogService);
//# sourceMappingURL=agent-action-log.service.js.map