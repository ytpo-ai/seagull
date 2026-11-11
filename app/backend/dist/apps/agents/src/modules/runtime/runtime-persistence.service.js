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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimePersistenceService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("@nestjs/mongoose");
const mongoose_3 = require("mongoose");
const uuid_1 = require("uuid");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const agent_message_schema_1 = require("../../schemas/agent-message.schema");
const agent_part_schema_1 = require("../../schemas/agent-part.schema");
const agent_event_outbox_schema_1 = require("../../schemas/agent-event-outbox.schema");
const agent_runtime_maintenance_audit_schema_1 = require("../../schemas/agent-runtime-maintenance-audit.schema");
const runtime_event_contract_1 = require("./contracts/runtime-event.contract");
const agent_session_schema_1 = require("../../schemas/agent-session.schema");
const context_fingerprint_util_1 = require("../agents/context/context-fingerprint.util");
let RuntimePersistenceService = class RuntimePersistenceService {
    normalizeSessionInitialSystemMessages(input) {
        if (!Array.isArray(input)) {
            return [];
        }
        const normalized = [];
        for (const item of input) {
            if (!item || typeof item !== 'object') {
                continue;
            }
            const id = String(item.id || '').trim();
            const content = String(item.content || '').trim();
            if (!id || !content) {
                continue;
            }
            const metadata = item.metadata;
            const normalizedMetadata = metadata && typeof metadata === 'object'
                ? { ...metadata }
                : undefined;
            normalized.push({
                id,
                content,
                ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
            });
        }
        return normalized;
    }
    normalizeMessageContent(content) {
        if (content === null || content === undefined) {
            return '';
        }
        return typeof content === 'string' ? content : String(content);
    }
    constructor(connection, runModel, messageModel, partModel, outboxModel, maintenanceAuditModel, sessionModel) {
        this.connection = connection;
        this.runModel = runModel;
        this.messageModel = messageModel;
        this.partModel = partModel;
        this.outboxModel = outboxModel;
        this.maintenanceAuditModel = maintenanceAuditModel;
        this.sessionModel = sessionModel;
        this.maxSessionMessages = Number(process.env.AGENT_SESSION_MAX_MESSAGES || 1200);
    }
    normalizeTokenValue(value) {
        return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    }
    buildSessionUsageIncUpdate(input) {
        const inc = {};
        const normalizedCost = this.normalizeTokenValue(input.cost);
        if (normalizedCost !== undefined) {
            inc.totalCost = normalizedCost;
        }
        if (!input.tokens) {
            return inc;
        }
        const tokenFieldMap = [
            ['input', 'totalTokens.input'],
            ['output', 'totalTokens.output'],
            ['reasoning', 'totalTokens.reasoning'],
            ['cacheRead', 'totalTokens.cacheRead'],
            ['cacheWrite', 'totalTokens.cacheWrite'],
            ['total', 'totalTokens.total'],
        ];
        for (const [tokenField, targetField] of tokenFieldMap) {
            const normalizedValue = this.normalizeTokenValue(input.tokens[tokenField]);
            if (normalizedValue !== undefined) {
                inc[targetField] = normalizedValue;
            }
        }
        return inc;
    }
    async ensureSession(input) {
        const sessionId = input.sessionId?.trim() || `session-${(0, uuid_1.v4)()}`;
        const now = new Date();
        const sessionType = input.sessionType || 'task';
        const updated = await this.sessionModel
            .findOneAndUpdate({ id: sessionId }, {
            $setOnInsert: {
                id: sessionId,
                sessionType,
                ownerType: input.ownerType || 'agent',
                ownerId: input.ownerId,
                title: input.title,
                status: 'active',
                runIds: [],
                memoIds: [],
                messageIds: [],
                ...(input.initialSystemMessages !== undefined ? { initialSystemMessages: input.initialSystemMessages } : {}),
                metadata: input.metadata || {},
            },
            $set: {
                lastActiveAt: now,
                planContext: input.planContext,
                meetingContext: input.meetingContext,
                domainContext: input.domainContext,
                collaborationContext: input.collaborationContext,
            },
        }, { upsert: true, new: true })
            .exec();
        return updated;
    }
    async appendRunToSession(sessionId, runId, options) {
        const now = new Date();
        const taskId = options?.taskId;
        const addToSet = { runIds: runId };
        if (taskId) {
            addToSet['planContext.completedTaskIds'] = taskId;
        }
        await this.sessionModel
            .updateOne({ id: sessionId }, {
            $addToSet: addToSet,
            $set: {
                lastActiveAt: now,
                'planContext.lastRunId': runId,
                ...(options?.latestTaskOutput ? { 'planContext.latestTaskOutput': options.latestTaskOutput } : {}),
                ...(taskId ? { 'planContext.currentTaskId': taskId } : {}),
            },
        })
            .exec();
    }
    async getOrCreateMeetingSession(meetingId, agentId, title, meetingContext, initialSystemMessages) {
        const existing = await this.sessionModel
            .findOne({
            'meetingContext.meetingId': meetingId,
            ownerId: agentId,
            sessionType: 'meeting',
        })
            .sort({ createdAt: -1 })
            .exec();
        if (existing) {
            await this.sessionModel.updateOne({ _id: existing._id }, { $set: { lastActiveAt: new Date(), title, meetingContext } });
            if (initialSystemMessages) {
                await this.setSessionInitialSystemMessages(existing.id, initialSystemMessages);
            }
            return this.sessionModel.findById(existing._id).exec();
        }
        const sessionId = `meeting-${meetingId}-${agentId}`;
        return this.ensureSession({
            sessionId,
            sessionType: 'meeting',
            ownerId: agentId,
            title,
            meetingContext,
            initialSystemMessages,
        });
    }
    async getOrCreateTaskSession(taskId, agentId, title, planContext) {
        const existing = await this.sessionModel
            .findOne({
            'planContext.linkedTaskId': taskId,
            ownerId: agentId,
            sessionType: 'task',
        })
            .sort({ createdAt: -1 })
            .exec();
        if (existing) {
            await this.sessionModel.updateOne({ _id: existing._id }, { $set: { lastActiveAt: new Date(), title, planContext } });
            return this.sessionModel.findById(existing._id).exec();
        }
        const sessionId = `task-${taskId}`;
        return this.ensureSession({
            sessionId,
            sessionType: 'task',
            ownerId: agentId,
            title,
            planContext,
        });
    }
    async getOrCreatePlanSession(planId, agentId, title, options) {
        const orchRunId = options?.orchestrationRunId;
        const lookupFilter = {
            'planContext.linkedPlanId': planId,
            ownerId: agentId,
            sessionType: 'plan',
        };
        if (orchRunId) {
            lookupFilter['planContext.orchestrationRunId'] = orchRunId;
        }
        const existing = await this.sessionModel
            .findOne(lookupFilter)
            .sort({ createdAt: -1 })
            .exec();
        const planContext = {
            linkedPlanId: planId,
            currentTaskId: options?.currentTaskId,
            ...(orchRunId ? { orchestrationRunId: orchRunId } : {}),
        };
        if (existing) {
            await this.sessionModel.updateOne({ _id: existing._id }, {
                $set: {
                    lastActiveAt: new Date(),
                    title,
                    planContext,
                    ...(options?.domainContext ? { domainContext: options.domainContext } : {}),
                    ...(options?.collaborationContext ? { collaborationContext: options.collaborationContext } : {}),
                },
            });
            if (options?.initialSystemMessages) {
                await this.setSessionInitialSystemMessages(existing.id, options.initialSystemMessages);
            }
            return this.sessionModel.findById(existing._id).exec();
        }
        const sessionId = orchRunId
            ? `plan-${planId}-${agentId}-run-${orchRunId}`
            : `plan-${planId}-${agentId}`;
        return this.ensureSession({
            sessionId,
            sessionType: 'plan',
            ownerId: agentId,
            title,
            planContext,
            domainContext: options?.domainContext,
            collaborationContext: options?.collaborationContext,
            initialSystemMessages: options?.initialSystemMessages,
        });
    }
    async appendRunSummary(sessionId, summary) {
        await this.sessionModel
            .updateOne({ id: sessionId }, {
            $push: {
                runSummaries: {
                    runId: summary.runId,
                    taskId: summary.taskId,
                    taskTitle: summary.taskTitle,
                    objective: summary.objective,
                    outcome: summary.outcome,
                    keyOutputs: summary.keyOutputs || [],
                    openIssues: summary.openIssues || [],
                    completedAt: summary.completedAt || new Date(),
                },
            },
            $set: { lastActiveAt: new Date() },
        })
            .exec();
    }
    async createRun(input) {
        const metadata = input.metadata || {};
        const roleCodeFromMetadata = typeof metadata.roleCode === 'string' ? metadata.roleCode.trim() : undefined;
        const executionChannelFromMetadata = metadata.executionChannel === 'opencode' || metadata.executionChannel === 'native'
            ? metadata.executionChannel
            : undefined;
        const executionDataFromMetadata = metadata.executionData && typeof metadata.executionData === 'object' && !Array.isArray(metadata.executionData)
            ? metadata.executionData
            : undefined;
        const run = new this.runModel({
            id: `run-${(0, uuid_1.v4)()}`,
            ...input,
            roleCode: input.roleCode || roleCodeFromMetadata,
            executionChannel: input.executionChannel || executionChannelFromMetadata || 'native',
            executionData: input.executionData || executionDataFromMetadata,
            sync: {
                state: 'pending',
                retryCount: 0,
            },
            status: 'running',
            currentStep: 0,
            startedAt: new Date(),
        });
        return run.save();
    }
    async updateRun(runId, updates) {
        await this.runModel.updateOne({ id: runId }, { $set: updates }).exec();
    }
    async getRun(runId) {
        return this.runModel.findOne({ id: runId }).exec();
    }
    async listRunsByAgent(agentId, options) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId) {
            return {
                total: 0,
                page: 1,
                pageSize: 20,
                runs: [],
            };
        }
        const page = Math.max(1, Number(options?.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(options?.pageSize || 20)));
        const filter = {
            agentId: normalizedAgentId,
        };
        const status = String(options?.status || '').trim();
        if (status) {
            filter.status = status;
        }
        if (options?.from || options?.to) {
            const range = {};
            if (options.from) {
                range.$gte = options.from;
            }
            if (options.to) {
                range.$lte = options.to;
            }
            filter.startedAt = range;
        }
        const [total, runs] = await Promise.all([
            this.runModel.countDocuments(filter).exec(),
            this.runModel
                .find(filter)
                .sort({ startedAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .exec(),
        ]);
        return {
            total,
            page,
            pageSize,
            runs,
        };
    }
    async findLatestActiveRun(agentId, sessionId, taskId) {
        const filter = {
            agentId,
            status: { $in: ['pending', 'running', 'paused'] },
        };
        if (sessionId) {
            filter.sessionId = sessionId;
        }
        if (taskId) {
            filter.taskId = taskId;
        }
        return this.runModel.findOne(filter).sort({ createdAt: -1 }).exec();
    }
    async incrementRunStep(runId) {
        const updated = await this.runModel
            .findOneAndUpdate({ id: runId }, { $inc: { currentStep: 1 } }, { new: true })
            .exec();
        return updated?.currentStep ?? 0;
    }
    async createMessage(input) {
        const messageContent = this.normalizeMessageContent(input.content);
        const message = new this.messageModel({
            id: input.id || `msg-${(0, uuid_1.v4)()}`,
            ...input,
            content: messageContent,
            status: input.status || 'completed',
        });
        const saved = await message.save();
        if (input.sessionId) {
            await this.appendMessageIdToSession(input.sessionId, saved.id);
            const inc = this.buildSessionUsageIncUpdate({
                tokens: input.tokens,
                cost: input.cost,
            });
            if (Object.keys(inc).length > 0) {
                await this.sessionModel
                    .updateOne({ id: input.sessionId }, { $inc: inc })
                    .exec();
            }
        }
        return saved;
    }
    async bulkCreateMessageWithParts(message, parts) {
        const createdMessage = await this.createMessage(message);
        const createdParts = await Promise.all(parts.map((part) => this.createPart({
            runId: message.runId,
            messageId: createdMessage.id,
            sequence: part.sequence,
            type: part.type,
            status: part.status,
            toolId: part.toolId,
            toolCallId: part.toolCallId,
            input: part.input,
            output: part.output,
            content: part.content,
            metadata: part.metadata,
            error: part.error,
            startedAt: part.startedAt,
            endedAt: part.endedAt,
        })));
        return {
            message: createdMessage,
            parts: createdParts,
        };
    }
    async appendMessageIdToSession(sessionId, messageId) {
        const normalizedMessageId = String(messageId || '').trim();
        if (!normalizedMessageId) {
            return;
        }
        const now = new Date();
        await this.sessionModel
            .updateOne({ id: sessionId }, {
            $push: {
                messageIds: this.maxSessionMessages > 0
                    ? {
                        $each: [normalizedMessageId],
                        $slice: -this.maxSessionMessages,
                    }
                    : normalizedMessageId,
            },
            $set: {
                lastActiveAt: now,
            },
        })
            .exec();
    }
    async appendSystemMessagesToSession(sessionId, messages) {
        if (!messages.length)
            return;
        const normalized = messages
            .map((msg) => ({
            role: msg.role,
            content: (0, context_fingerprint_util_1.normalizeSystemContent)(msg.content),
            metadata: msg.metadata,
        }))
            .filter((msg) => msg.content.length > 0)
            .slice(0, 10);
        if (!normalized.length)
            return;
        const runId = `system-run-${sessionId}`;
        await Promise.all(normalized.map((msg, index) => this.createMessage({
            runId,
            agentId: 'system',
            sessionId,
            role: 'system',
            sequence: index + 1,
            content: msg.content,
            status: 'completed',
            metadata: {
                ...(msg.metadata || {}),
                source: 'runtime.appendSystemMessagesToSession',
                contextKey: (0, context_fingerprint_util_1.buildSystemContextKey)(msg.content),
            },
        })));
    }
    async getSessionMemoSnapshot(sessionId) {
        if (!sessionId)
            return null;
        const session = await this.sessionModel.findOne({ id: sessionId }).select('memoSnapshot').exec();
        return session?.memoSnapshot || null;
    }
    async updateSessionMemoSnapshot(sessionId, snapshot) {
        if (!sessionId)
            return;
        await this.sessionModel.updateOne({ id: sessionId }, { $set: { memoSnapshot: snapshot } }).exec();
    }
    async getSessionInitialSystemMessages(sessionId) {
        if (!sessionId) {
            return undefined;
        }
        const session = await this.sessionModel
            .findOne({ id: sessionId }, { initialSystemMessages: 1 })
            .lean()
            .exec();
        if (!session) {
            return undefined;
        }
        if (!Object.prototype.hasOwnProperty.call(session, 'initialSystemMessages')) {
            return undefined;
        }
        return this.normalizeSessionInitialSystemMessages(session.initialSystemMessages);
    }
    async setSessionInitialSystemMessages(sessionId, messages) {
        if (!sessionId) {
            return false;
        }
        const normalizedMessages = this.normalizeSessionInitialSystemMessages(messages);
        const result = await this.sessionModel
            .updateOne({ id: sessionId, initialSystemMessages: { $exists: false } }, { $set: { initialSystemMessages: normalizedMessages } })
            .exec();
        return (result.modifiedCount || 0) > 0;
    }
    async getSessionById(sessionId) {
        return this.sessionModel.findOne({ id: sessionId }).exec();
    }
    async getSessionDetailById(sessionId) {
        const session = await this.sessionModel.findOne({ id: sessionId }).lean().exec();
        if (!session)
            return null;
        const runTaskMap = new Map();
        const runIds = Array.isArray(session.runIds)
            ? session.runIds.filter((runId) => typeof runId === 'string' && runId.trim().length > 0)
            : [];
        if (runIds.length > 0) {
            const runs = await this.runModel
                .find({ id: { $in: runIds } })
                .select({ id: 1, taskId: 1 })
                .lean()
                .exec();
            for (const run of runs) {
                runTaskMap.set(run.id, run.taskId);
            }
        }
        const messageIds = (Array.isArray(session.messageIds) ? session.messageIds : [])
            .filter((messageId) => typeof messageId === 'string' && messageId.trim().length > 0);
        const messages = messageIds.length
            ? await this.messageModel
                .find({ id: { $in: messageIds } })
                .sort({ sequence: 1, createdAt: 1 })
                .lean()
                .exec()
            : [];
        const supplementalMessages = runIds.length
            ? await this.messageModel
                .find({
                runId: { $in: runIds },
                id: { $nin: messageIds },
                role: { $in: ['system', 'user'] },
            })
                .sort({ sequence: 1, createdAt: 1 })
                .lean()
                .exec()
            : [];
        const mergedMessageMap = new Map();
        for (const message of messages) {
            mergedMessageMap.set(message.id, message);
        }
        for (const message of supplementalMessages) {
            mergedMessageMap.set(message.id, message);
        }
        const mergedMessages = Array.from(mergedMessageMap.values()).sort((a, b) => {
            const seqDelta = (a.sequence ?? 0) - (b.sequence ?? 0);
            if (seqDelta !== 0)
                return seqDelta;
            const at = (a.updatedAt || a.createdAt || new Date(0)).getTime();
            const bt = (b.updatedAt || b.createdAt || new Date(0)).getTime();
            return at - bt;
        });
        const projectedMessages = mergedMessages.map((message) => ({
            id: message.id,
            runId: message.runId,
            taskId: message.taskId,
            parentMessageId: message.parentMessageId,
            role: message.role,
            sequence: message.sequence,
            content: message.content,
            status: message.status,
            metadata: message.metadata,
            modelID: message.modelID,
            providerID: message.providerID,
            finish: message.finish,
            tokens: message.tokens
                ? {
                    input: this.normalizeTokenValue(message.tokens.input),
                    output: this.normalizeTokenValue(message.tokens.output),
                    reasoning: this.normalizeTokenValue(message.tokens.reasoning),
                    cacheRead: this.normalizeTokenValue(message.tokens.cacheRead),
                    cacheWrite: this.normalizeTokenValue(message.tokens.cacheWrite),
                    total: this.normalizeTokenValue(message.tokens.total),
                }
                : undefined,
            cost: this.normalizeTokenValue(message.cost),
            stepIndex: this.normalizeTokenValue(message.stepIndex),
            timestamp: message.updatedAt || message.createdAt || new Date(),
        }));
        projectedMessages.sort((a, b) => {
            const seqDelta = (a.sequence ?? 0) - (b.sequence ?? 0);
            if (seqDelta !== 0)
                return seqDelta;
            const at = (a.timestamp || new Date(0)).getTime();
            const bt = (b.timestamp || new Date(0)).getTime();
            return at - bt;
        });
        const partMessageIds = mergedMessages.map((message) => message.id);
        const parts = partMessageIds.length
            ? await this.partModel
                .find({ messageId: { $in: partMessageIds } })
                .sort({ sequence: 1, createdAt: 1 })
                .lean()
                .exec()
            : [];
        const projectedParts = parts.map((part) => ({
            id: part.id,
            runId: part.runId,
            taskId: runTaskMap.get(part.runId),
            messageId: part.messageId,
            sequence: part.sequence,
            type: part.type,
            status: part.status,
            toolId: part.toolId,
            toolCallId: part.toolCallId,
            input: part.input,
            output: part.output,
            content: part.content,
            error: part.error,
            startedAt: part.startedAt,
            endedAt: part.endedAt,
            timestamp: part.updatedAt || part.endedAt || part.startedAt || part.createdAt || new Date(),
        }));
        return {
            ...session,
            messages: projectedMessages,
            parts: projectedParts,
        };
    }
    async listSessionMessagesById(sessionId) {
        const session = await this.sessionModel.findOne({ id: sessionId }).lean().exec();
        if (!session) {
            return [];
        }
        const messageIds = Array.isArray(session.messageIds)
            ? session.messageIds.filter((messageId) => typeof messageId === 'string' && messageId.trim().length > 0)
            : [];
        if (!messageIds.length) {
            return [];
        }
        const messages = await this.messageModel
            .find({ id: { $in: messageIds } })
            .sort({ sequence: 1, createdAt: 1 })
            .lean()
            .exec();
        return messages.map((message) => ({
            id: message.id,
            runId: message.runId,
            taskId: message.taskId,
            parentMessageId: message.parentMessageId,
            role: message.role,
            sequence: message.sequence,
            content: message.content,
            status: message.status,
            metadata: message.metadata,
            modelID: message.modelID,
            providerID: message.providerID,
            finish: message.finish,
            tokens: message.tokens,
            cost: message.cost,
            stepIndex: message.stepIndex,
            timestamp: message.updatedAt || message.createdAt || new Date(),
        }));
    }
    async listMessageParts(messageId) {
        return this.partModel.find({ messageId }).sort({ sequence: 1, createdAt: 1 }).exec();
    }
    async listRunMessagesWithParts(runId) {
        const messages = await this.messageModel
            .find({ runId })
            .sort({ sequence: 1, createdAt: 1 })
            .lean()
            .exec();
        if (!messages.length) {
            return [];
        }
        const messageIds = messages.map((message) => message.id);
        const parts = await this.partModel
            .find({ messageId: { $in: messageIds } })
            .sort({ sequence: 1, createdAt: 1 })
            .lean()
            .exec();
        const partMap = new Map();
        for (const part of parts) {
            const list = partMap.get(part.messageId) || [];
            list.push(part);
            partMap.set(part.messageId, list);
        }
        return messages.map((message) => ({
            id: message.id,
            runId: message.runId,
            taskId: message.taskId,
            parentMessageId: message.parentMessageId,
            role: message.role,
            sequence: message.sequence,
            content: message.content,
            status: message.status,
            metadata: message.metadata,
            modelID: message.modelID,
            providerID: message.providerID,
            finish: message.finish,
            tokens: message.tokens
                ? {
                    input: this.normalizeTokenValue(message.tokens.input),
                    output: this.normalizeTokenValue(message.tokens.output),
                    reasoning: this.normalizeTokenValue(message.tokens.reasoning),
                    cacheRead: this.normalizeTokenValue(message.tokens.cacheRead),
                    cacheWrite: this.normalizeTokenValue(message.tokens.cacheWrite),
                    total: this.normalizeTokenValue(message.tokens.total),
                }
                : undefined,
            cost: this.normalizeTokenValue(message.cost),
            stepIndex: this.normalizeTokenValue(message.stepIndex),
            timestamp: message.updatedAt || message.createdAt || new Date(),
            parts: partMap.get(message.id) || [],
        }));
    }
    async listSessions(options) {
        const page = Math.max(1, Number(options?.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(options?.pageSize || 20)));
        const filter = {};
        if (options?.ownerType) {
            filter.ownerType = options.ownerType;
        }
        if (options?.ownerId) {
            filter.ownerId = options.ownerId;
        }
        if (options?.status) {
            filter.status = options.status;
        }
        if (options?.sessionType) {
            filter.sessionType = options.sessionType;
        }
        if (options?.keyword) {
            const keyword = options.keyword.trim();
            if (keyword) {
                filter.$or = [
                    { id: { $regex: keyword, $options: 'i' } },
                    { title: { $regex: keyword, $options: 'i' } },
                    { 'planContext.linkedPlanId': { $regex: keyword, $options: 'i' } },
                    { 'planContext.linkedTaskId': { $regex: keyword, $options: 'i' } },
                    { 'meetingContext.meetingId': { $regex: keyword, $options: 'i' } },
                ];
            }
        }
        return this.sessionModel
            .find(filter)
            .sort({ lastActiveAt: -1, createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .exec();
    }
    async countSessions(options) {
        const filter = {};
        if (options?.ownerType) {
            filter.ownerType = options.ownerType;
        }
        if (options?.ownerId) {
            filter.ownerId = options.ownerId;
        }
        if (options?.status) {
            filter.status = options.status;
        }
        if (options?.sessionType) {
            filter.sessionType = options.sessionType;
        }
        if (options?.keyword) {
            const keyword = options.keyword.trim();
            if (keyword) {
                filter.$or = [
                    { id: { $regex: keyword, $options: 'i' } },
                    { title: { $regex: keyword, $options: 'i' } },
                    { 'planContext.linkedPlanId': { $regex: keyword, $options: 'i' } },
                    { 'planContext.linkedTaskId': { $regex: keyword, $options: 'i' } },
                    { 'meetingContext.meetingId': { $regex: keyword, $options: 'i' } },
                ];
            }
        }
        return this.sessionModel.countDocuments(filter).exec();
    }
    async archiveSession(sessionId, summary) {
        await this.sessionModel.updateOne({ id: sessionId }, {
            $set: {
                status: 'archived',
                contextSummary: summary,
                lastActiveAt: new Date(),
            },
        }).exec();
    }
    async resumeSession(sessionId) {
        await this.sessionModel.updateOne({ id: sessionId }, {
            $set: {
                status: 'active',
                lastActiveAt: new Date(),
            },
        }).exec();
    }
    async findLatestMessageByRunAndRole(runId, role) {
        return this.messageModel.findOne({ runId, role }).sort({ createdAt: -1 }).exec();
    }
    async createPart(input) {
        const part = new this.partModel({
            id: `part-${(0, uuid_1.v4)()}`,
            ...input,
        });
        return part.save();
    }
    async updatePart(partId, updates) {
        await this.partModel.updateOne({ id: partId }, { $set: updates }).exec();
    }
    async transitionPartStatus(partId, fromStatus, toStatus, updates) {
        const result = await this.partModel
            .updateOne({ id: partId, status: fromStatus }, {
            $set: {
                status: toStatus,
                ...(updates || {}),
            },
        })
            .exec();
        return (result.modifiedCount || 0) > 0;
    }
    async getPart(partId) {
        return this.partModel.findOne({ id: partId }).exec();
    }
    async enqueueEvent(event) {
        const parsed = runtime_event_contract_1.RuntimeEventSchema.parse(event);
        const outbox = new this.outboxModel({
            id: `outbox-${(0, uuid_1.v4)()}`,
            eventId: parsed.eventId,
            eventType: parsed.eventType,
            runId: parsed.runId,
            agentId: parsed.agentId,
            sessionId: parsed.sessionId,
            taskId: parsed.taskId,
            messageId: parsed.messageId,
            partId: parsed.partId,
            toolCallId: parsed.toolCallId,
            sequence: parsed.sequence,
            payload: parsed.payload,
            status: 'pending',
            attempts: 0,
            timestamp: new Date(parsed.timestamp),
        });
        await outbox.save();
    }
    async markEventDispatched(eventId) {
        await this.outboxModel
            .updateOne({ eventId }, {
            $set: {
                status: 'dispatched',
                dispatchedAt: new Date(),
                lastError: undefined,
            },
            $inc: { attempts: 1 },
        })
            .exec();
    }
    async markEventFailed(eventId, error) {
        const current = await this.outboxModel.findOne({ eventId }).exec();
        const attempts = (current?.attempts || 0) + 1;
        const delayMs = Math.min(60000, Math.max(2000, 2000 * Math.pow(2, Math.min(attempts, 5))));
        await this.outboxModel
            .updateOne({ eventId }, {
            $set: {
                status: 'failed',
                lastError: error,
                nextRetryAt: new Date(Date.now() + delayMs),
            },
            $inc: { attempts: 1 },
        })
            .exec();
    }
    async findDispatchableEvents(limit = 100) {
        return this.outboxModel
            .find({
            $or: [
                { status: 'pending' },
                {
                    status: 'failed',
                    nextRetryAt: { $lte: new Date() },
                },
            ],
        })
            .sort({ createdAt: 1 })
            .limit(limit)
            .exec();
    }
    async countOutboxByStatus() {
        const [pending, failed, dispatched] = await Promise.all([
            this.outboxModel.countDocuments({ status: 'pending' }).exec(),
            this.outboxModel.countDocuments({ status: 'failed' }).exec(),
            this.outboxModel.countDocuments({ status: 'dispatched' }).exec(),
        ]);
        return { pending, failed, dispatched };
    }
    async getDeadLetterSummary() {
        const totalFailed = await this.outboxModel.countDocuments({ status: 'failed' }).exec();
        const oldest = await this.outboxModel
            .findOne({ status: 'failed' })
            .sort({ createdAt: 1 })
            .select({ createdAt: 1 })
            .exec();
        return {
            totalFailed,
            oldestFailedAt: oldest?.createdAt,
        };
    }
    async findEventsByRun(runId, options) {
        const limit = options?.limit || 200;
        const filter = { runId };
        if (options?.eventTypes?.length) {
            filter.eventType = { $in: options.eventTypes };
        }
        if (typeof options?.fromSequence === 'number' || typeof options?.toSequence === 'number') {
            const range = {};
            if (typeof options?.fromSequence === 'number') {
                range.$gte = options.fromSequence;
            }
            if (typeof options?.toSequence === 'number') {
                range.$lte = options.toSequence;
            }
            filter.sequence = range;
        }
        return this.outboxModel
            .find(filter)
            .sort({ sequence: 1, createdAt: 1 })
            .limit(limit)
            .exec();
    }
    async findDeadLetterEvents(options) {
        const limit = options?.limit || 200;
        const filter = { status: 'failed' };
        if (options?.runId) {
            filter.runId = options.runId;
        }
        if (options?.eventType) {
            filter.eventType = options.eventType;
        }
        return this.outboxModel
            .find(filter)
            .sort({ updatedAt: -1 })
            .limit(limit)
            .exec();
    }
    async countDeadLetterEvents(options) {
        const filter = { status: 'failed' };
        if (options?.runId) {
            filter.runId = options.runId;
        }
        if (options?.eventType) {
            filter.eventType = options.eventType;
        }
        return this.outboxModel.countDocuments(filter).exec();
    }
    async findDeadLetterEventsByEventIds(eventIds) {
        if (!eventIds.length)
            return [];
        const filter = {
            status: 'failed',
            eventId: { $in: eventIds },
        };
        return this.outboxModel.find(filter).exec();
    }
    async findEventByEventId(eventId) {
        if (!eventId)
            return null;
        return this.outboxModel.findOne({ eventId }).exec();
    }
    async requeueDeadLetterByEventIds(eventIds) {
        if (!eventIds.length)
            return 0;
        const result = await this.outboxModel
            .updateMany({ eventId: { $in: eventIds }, status: 'failed' }, {
            $set: {
                status: 'pending',
                nextRetryAt: new Date(),
                lastError: undefined,
            },
        })
            .exec();
        return result.modifiedCount || 0;
    }
    async requeueDeadLetterByFilter(options) {
        const rows = await this.findDeadLetterEvents(options);
        const eventIds = rows.map((row) => row.eventId);
        return this.requeueDeadLetterByEventIds(eventIds);
    }
    async purgeCollections(collectionNames) {
        const existing = await this.connection.db.listCollections({}, { nameOnly: true }).toArray();
        const existingNames = new Set(existing.map((item) => item.name));
        const results = [];
        for (const name of collectionNames) {
            if (!existingNames.has(name)) {
                results.push({ collection: name, deletedCount: 0 });
                continue;
            }
            const deleteResult = await this.connection.db.collection(name).deleteMany({});
            results.push({
                collection: name,
                deletedCount: deleteResult.deletedCount || 0,
            });
        }
        return results;
    }
    async createMaintenanceAudit(input) {
        const audit = new this.maintenanceAuditModel({
            id: `maint-${(0, uuid_1.v4)()}`,
            ...input,
        });
        return audit.save();
    }
    async listMaintenanceAudits(options) {
        const limit = options?.limit || 50;
        const filter = {};
        if (options?.action) {
            filter.action = options.action;
        }
        if (options?.batchId) {
            filter.batchId = options.batchId;
        }
        return this.maintenanceAuditModel.find(filter).sort({ createdAt: -1 }).limit(limit).exec();
    }
};
exports.RuntimePersistenceService = RuntimePersistenceService;
exports.RuntimePersistenceService = RuntimePersistenceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_2.InjectConnection)()),
    __param(1, (0, mongoose_1.InjectModel)(agent_run_schema_1.AgentRun.name)),
    __param(2, (0, mongoose_1.InjectModel)(agent_message_schema_1.AgentMessage.name)),
    __param(3, (0, mongoose_1.InjectModel)(agent_part_schema_1.AgentPart.name)),
    __param(4, (0, mongoose_1.InjectModel)(agent_event_outbox_schema_1.AgentEventOutbox.name)),
    __param(5, (0, mongoose_1.InjectModel)(agent_runtime_maintenance_audit_schema_1.AgentRuntimeMaintenanceAudit.name)),
    __param(6, (0, mongoose_1.InjectModel)(agent_session_schema_1.AgentSession.name)),
    __metadata("design:paramtypes", [mongoose_3.Connection,
        mongoose_3.Model,
        mongoose_3.Model,
        mongoose_3.Model,
        mongoose_3.Model,
        mongoose_3.Model,
        mongoose_3.Model])
], RuntimePersistenceService);
//# sourceMappingURL=runtime-persistence.service.js.map