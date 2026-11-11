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
var RuntimeOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const runtime_run_contract_1 = require("./contracts/runtime-run.contract");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const hook_dispatcher_service_1 = require("./hook-dispatcher.service");
const hook_pipeline_service_1 = require("./hooks/hook-pipeline.service");
const memo_service_1 = require("../memos/memo.service");
const runtime_memo_snapshot_queue_service_1 = require("./runtime-memo-snapshot-queue.service");
const common_2 = require("../../../../../libs/common/src/index");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_task_runtime_status_util_1 = require("../agent-tasks/agent-task-runtime-status.util");
let RuntimeOrchestratorService = RuntimeOrchestratorService_1 = class RuntimeOrchestratorService {
    debugTiming(runOrTaskId, stage, startedAt, extras) {
        this.debugTimingProvider.log({
            traceId: runOrTaskId,
            stage,
            startedAt,
            extras,
            traceFieldName: 'runOrTaskId',
        });
    }
    constructor(persistence, hookDispatcher, hookPipeline, memoService, memoSnapshotQueue, debugTimingProvider, redisService) {
        this.persistence = persistence;
        this.hookDispatcher = hookDispatcher;
        this.hookPipeline = hookPipeline;
        this.memoService = memoService;
        this.memoSnapshotQueue = memoSnapshotQueue;
        this.debugTimingProvider = debugTimingProvider;
        this.redisService = redisService;
        this.logger = new common_1.Logger(RuntimeOrchestratorService_1.name);
        this.lockTails = new Map();
        this.memoSnapshotRefreshMs = Number(process.env.AGENT_SESSION_MEMO_REFRESH_MS || 60000);
    }
    async startRun(rawInput) {
        const startRunAt = Date.now();
        const input = runtime_run_contract_1.RuntimeStartRunInputSchema.parse(rawInput);
        const runOrTaskId = input.taskId || input.sessionId || `ephemeral-${input.agentId}`;
        const metadataRecord = { ...(input.metadata || {}) };
        let ensuredSession;
        const meetingContext = metadataRecord?.meetingContext;
        const planId = typeof metadataRecord?.planId === 'string' ? metadataRecord.planId : undefined;
        const domainContext = (metadataRecord?.domainContext && typeof metadataRecord.domainContext === 'object')
            ? metadataRecord.domainContext
            : undefined;
        const collaborationContext = (metadataRecord?.collaborationContext && typeof metadataRecord.collaborationContext === 'object')
            ? metadataRecord.collaborationContext
            : undefined;
        const ensureSessionAt = Date.now();
        if (meetingContext?.meetingId) {
            ensuredSession = await this.persistence.getOrCreateMeetingSession(meetingContext.meetingId, input.agentId, input.taskTitle, {
                meetingId: meetingContext.meetingId,
                agendaId: meetingContext.agendaId,
                meetingType: meetingContext.meetingType,
                latestSummary: meetingContext.latestSummary,
            });
        }
        else if (input.sessionId && planId) {
            ensuredSession = await this.persistence.ensureSession({
                sessionId: input.sessionId,
                sessionType: 'plan',
                ownerType: 'agent',
                ownerId: input.agentId,
                title: input.taskTitle,
                planContext: {
                    linkedPlanId: planId,
                    currentTaskId: input.taskId,
                },
                domainContext: domainContext,
                collaborationContext,
            });
        }
        else if (planId) {
            const orchestrationRunId = typeof collaborationContext?.orchestrationRunId === 'string'
                ? collaborationContext.orchestrationRunId
                : undefined;
            ensuredSession = await this.persistence.getOrCreatePlanSession(planId, input.agentId, input.taskTitle, {
                currentTaskId: input.taskId,
                orchestrationRunId,
                domainContext: domainContext,
                collaborationContext,
            });
        }
        else if (input.taskId) {
            ensuredSession = await this.persistence.getOrCreateTaskSession(input.taskId, input.agentId, input.taskTitle, {
                linkedPlanId: planId,
                linkedTaskId: input.taskId,
                currentTaskId: input.taskId,
                latestTaskInput: input.taskDescription,
            });
        }
        else {
            ensuredSession = await this.persistence.ensureSession({
                sessionId: input.sessionId,
                sessionType: 'chat',
                ownerType: 'agent',
                ownerId: input.agentId,
                title: input.taskTitle,
                planContext: {
                    linkedPlanId: planId,
                    linkedTaskId: input.taskId,
                    currentTaskId: input.taskId,
                    latestTaskInput: input.taskDescription,
                },
                domainContext: domainContext,
                collaborationContext,
            });
        }
        this.debugTiming(runOrTaskId, 'start_run.ensure_session', ensureSessionAt, { sessionId: ensuredSession.id });
        const sessionId = ensuredSession.id;
        const initialSystemMessageCount = Array.isArray(ensuredSession.initialSystemMessages)
            ? ensuredSession.initialSystemMessages.length
            : 0;
        const refreshMemoSnapshotAt = Date.now();
        await this.refreshSessionMemoSnapshot(ensuredSession, input.agentId);
        this.debugTiming(runOrTaskId, 'start_run.refresh_session_memo_snapshot', refreshMemoSnapshotAt, { sessionId });
        const traceId = `trace-${(0, uuid_1.v4)()}`;
        const lockKey = this.getLockKey(input.agentId, sessionId, input.taskId);
        const acquireLockAt = Date.now();
        const release = await this.acquireLock(lockKey);
        this.debugTiming(runOrTaskId, 'start_run.acquire_lock', acquireLockAt, { lockKey });
        let resumed = false;
        const loadOrCreateRunAt = Date.now();
        let run = await this.persistence.findLatestActiveRun(input.agentId, sessionId, input.taskId);
        if (!run) {
            run = await this.persistence.createRun({
                agentId: input.agentId,
                agentName: input.agentName,
                sessionId,
                taskId: input.taskId,
                taskTitle: input.taskTitle,
                taskDescription: input.taskDescription,
                metadata: metadataRecord,
            });
        }
        else {
            resumed = true;
            this.logger.log(`Resuming active run runId=${run.id} lockKey=${lockKey}`);
        }
        this.debugTiming(runOrTaskId, 'start_run.load_or_create_run', loadOrCreateRunAt, {
            runId: run.id,
            resumed,
        });
        const seedMessageAt = Date.now();
        let userMessage = await this.persistence.findLatestMessageByRunAndRole(run.id, 'user');
        if (!userMessage) {
            userMessage = await this.persistence.createMessage({
                runId: run.id,
                agentId: input.agentId,
                sessionId,
                taskId: input.taskId,
                role: 'user',
                sequence: initialSystemMessageCount + 1,
                content: input.userContent || input.taskDescription,
                status: 'completed',
                metadata: { source: 'runtime.startRun' },
            });
            await this.persistence.createPart({
                runId: run.id,
                messageId: userMessage.id,
                sequence: 1,
                type: 'text',
                status: 'completed',
                content: input.userContent || input.taskDescription,
                startedAt: new Date(),
                endedAt: new Date(),
            });
        }
        this.debugTiming(runOrTaskId, 'start_run.seed_initial_messages', seedMessageAt, {
            runId: run.id,
            hasUserMessage: Boolean(userMessage),
        });
        const emitLifecycleEventsAt = Date.now();
        if (resumed) {
            await this.emitEvent({
                eventType: 'run.resumed',
                agentId: input.agentId,
                sessionId,
                runId: run.id,
                taskId: input.taskId,
                traceId,
                sequence: run.currentStep,
                payload: {
                    taskTitle: input.taskTitle,
                    resumed: true,
                },
            });
        }
        else {
            await this.emitEvent({
                eventType: 'run.started',
                agentId: input.agentId,
                sessionId,
                runId: run.id,
                taskId: input.taskId,
                traceId,
                sequence: 0,
                payload: {
                    taskTitle: input.taskTitle,
                },
            });
        }
        this.debugTiming(runOrTaskId, 'start_run.emit_lifecycle_events', emitLifecycleEventsAt, {
            runId: run.id,
            resumed,
        });
        const stepStartedEventAt = Date.now();
        const currentStep = await this.persistence.incrementRunStep(run.id);
        await this.emitEvent({
            eventType: 'run.step.started',
            agentId: input.agentId,
            sessionId,
            runId: run.id,
            taskId: input.taskId,
            traceId,
            sequence: currentStep,
            payload: {
                step: currentStep,
            },
        });
        this.debugTiming(runOrTaskId, 'start_run.emit_step_started', stepStartedEventAt, {
            runId: run.id,
            step: currentStep,
        });
        const appendRunToSessionAt = Date.now();
        await this.persistence.appendRunToSession(sessionId, run.id, { taskId: input.taskId });
        this.debugTiming(runOrTaskId, 'start_run.append_run_to_session', appendRunToSessionAt, {
            runId: run.id,
            sessionId,
        });
        this.debugTiming(runOrTaskId, 'start_run.total', startRunAt, {
            runId: run.id,
            sessionId,
        });
        return {
            runId: run.id,
            sessionId,
            userMessageId: userMessage.id,
            traceId,
            lockKey,
            release,
            resumed,
        };
    }
    async releaseRun(context) {
        context.release();
    }
    async getRun(runId) {
        const run = await this.persistence.getRun(runId);
        if (!run)
            return null;
        return {
            id: run.id,
            status: run.status,
            currentStep: run.currentStep,
            taskTitle: run.taskTitle,
            taskDescription: run.taskDescription,
            agentName: run.agentName,
            taskId: run.taskId,
            sessionId: run.sessionId,
            roleCode: run.roleCode,
            executionChannel: run.executionChannel,
            executionData: run.executionData,
            sync: run.sync,
            metadata: run.metadata,
            score: run.score,
            agentId: run.agentId,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            error: run.error,
        };
    }
    async listRuns(agentId, options) {
        const result = await this.persistence.listRunsByAgent(agentId, options);
        return {
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            items: result.runs.map((run) => ({
                id: run.id,
                agentId: run.agentId,
                agentName: run.agentName,
                taskTitle: run.taskTitle,
                taskDescription: run.taskDescription,
                status: run.status,
                currentStep: run.currentStep,
                startedAt: run.startedAt,
                finishedAt: run.finishedAt,
                error: run.error,
                sessionId: run.sessionId,
                taskId: run.taskId,
                roleCode: run.roleCode,
                executionChannel: run.executionChannel,
                metadata: run.metadata,
                score: run.score,
            })),
        };
    }
    async assertRunnable(runId) {
        const run = await this.persistence.getRun(runId);
        if (!run) {
            throw new Error(`Runtime run not found: ${runId}`);
        }
        if (run.status === 'cancelled') {
            throw new Error(`Runtime run is cancelled: ${runId}`);
        }
        if (run.status === 'failed') {
            throw new Error(`Runtime run is failed: ${runId}`);
        }
        if (run.status === 'completed') {
            throw new Error(`Runtime run already completed: ${runId}`);
        }
        if (run.status === 'paused') {
            throw new Error(`Runtime run is paused: ${runId}`);
        }
    }
    async pauseRun(runId, reason) {
        await this.pauseRunWithActor(runId, { reason });
    }
    async pauseRunWithActor(runId, actor) {
        const run = await this.persistence.getRun(runId);
        if (!run) {
            throw new Error(`Runtime run not found: ${runId}`);
        }
        if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
            throw new Error(`Runtime run cannot be paused in status ${run.status}`);
        }
        if (run.status === 'paused')
            return;
        await this.persistence.updateRun(runId, { status: 'paused' });
        const sequence = await this.persistence.incrementRunStep(runId);
        await this.emitEvent({
            eventType: 'run.paused',
            agentId: run.agentId,
            sessionId: run.sessionId,
            runId: run.id,
            taskId: run.taskId,
            sequence,
            traceId: `trace-${(0, uuid_1.v4)()}`,
            payload: {
                reason: actor?.reason || 'paused_by_api',
                actorId: actor?.actorId || 'system',
                actorType: actor?.actorType || 'system',
            },
        });
    }
    async resumeRun(runId, reason) {
        await this.resumeRunWithActor(runId, { reason });
    }
    async resumeRunWithActor(runId, actor) {
        const run = await this.persistence.getRun(runId);
        if (!run) {
            throw new Error(`Runtime run not found: ${runId}`);
        }
        if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
            throw new Error(`Runtime run cannot be resumed in status ${run.status}`);
        }
        if (run.status !== 'paused')
            return;
        await this.persistence.updateRun(runId, { status: 'running' });
        const sequence = await this.persistence.incrementRunStep(runId);
        await this.emitEvent({
            eventType: 'run.resumed',
            agentId: run.agentId,
            sessionId: run.sessionId,
            runId: run.id,
            taskId: run.taskId,
            sequence,
            traceId: `trace-${(0, uuid_1.v4)()}`,
            payload: {
                reason: actor?.reason || 'resumed_by_api',
                actorId: actor?.actorId || 'system',
                actorType: actor?.actorType || 'system',
            },
        });
    }
    async cancelRun(runId, reason) {
        await this.cancelRunWithActor(runId, { reason });
    }
    async cancelRunWithActor(runId, actor) {
        const run = await this.persistence.getRun(runId);
        if (!run) {
            throw new Error(`Runtime run not found: ${runId}`);
        }
        if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
            return;
        }
        await this.persistence.updateRun(runId, {
            status: 'cancelled',
            finishedAt: new Date(),
            error: actor?.reason || 'cancelled_by_api',
        });
        const sequence = await this.persistence.incrementRunStep(runId);
        await this.emitEvent({
            eventType: 'run.cancelled',
            agentId: run.agentId,
            sessionId: run.sessionId,
            runId: run.id,
            taskId: run.taskId,
            sequence,
            traceId: `trace-${(0, uuid_1.v4)()}`,
            payload: {
                reason: actor?.reason || 'cancelled_by_api',
                actorId: actor?.actorId || 'system',
                actorType: actor?.actorType || 'system',
            },
        });
    }
    async recordPermissionAsked(input) {
        const run = await this.persistence.getRun(input.runId);
        if (!run) {
            throw new Error(`Runtime run not found: ${input.runId}`);
        }
        await this.runPermissionPipeline('permission.asked', input);
        const sequence = await this.persistence.incrementRunStep(input.runId);
        await this.emitEvent({
            eventType: 'permission.asked',
            agentId: input.agentId,
            sessionId: input.sessionId,
            runId: input.runId,
            taskId: input.taskId,
            sequence,
            traceId: input.traceId,
            payload: input.payload,
        });
    }
    async recordPermissionDecision(input) {
        const run = await this.persistence.getRun(input.runId);
        if (!run) {
            throw new Error(`Runtime run not found: ${input.runId}`);
        }
        const phase = input.approved ? 'permission.replied' : 'permission.denied';
        await this.runPermissionPipeline(phase, input);
        const sequence = await this.persistence.incrementRunStep(input.runId);
        await this.emitEvent({
            eventType: input.approved ? 'permission.replied' : 'permission.denied',
            agentId: input.agentId,
            sessionId: input.sessionId,
            runId: input.runId,
            taskId: input.taskId,
            sequence,
            traceId: input.traceId,
            payload: input.payload,
        });
    }
    async replayRun(runId, options) {
        const records = await this.persistence.findEventsByRun(runId, {
            limit: options?.limit || 500,
            eventTypes: options?.eventTypes,
            fromSequence: options?.fromSequence,
            toSequence: options?.toSequence,
        });
        let dispatched = 0;
        for (const record of records) {
            const event = {
                eventId: record.eventId,
                eventType: record.eventType,
                agentId: record.agentId,
                sessionId: record.sessionId,
                runId: record.runId,
                taskId: record.taskId,
                messageId: record.messageId,
                partId: record.partId,
                toolCallId: record.toolCallId,
                sequence: record.sequence,
                timestamp: record.timestamp.getTime(),
                traceId: record.payload?.traceId || `trace-replay-${record.eventId}`,
                payload: record.payload || {},
            };
            await this.hookDispatcher.dispatch(event, {
                channel: options?.channel,
                updateOutboxStatus: false,
                replay: true,
            });
            dispatched += 1;
        }
        return dispatched;
    }
    async completeRun(rawInput) {
        const input = runtime_run_contract_1.RuntimeCompleteRunInputSchema.parse(rawInput);
        const latestAssistantMessage = await this.persistence.findLatestMessageByRunAndRole(input.runId, 'assistant');
        if (!latestAssistantMessage) {
            const latestUserMessage = await this.persistence.findLatestMessageByRunAndRole(input.runId, 'user');
            await this.persistence.bulkCreateMessageWithParts({
                runId: input.runId,
                agentId: input.agentId,
                sessionId: input.sessionId,
                taskId: input.taskId,
                role: 'assistant',
                sequence: (latestUserMessage?.sequence || 1) + 1,
                content: input.assistantContent,
                status: 'completed',
                parentMessageId: latestUserMessage?.id,
                finish: 'stop',
                metadata: {
                    source: 'runtime.completeRun.fallback',
                },
            }, [
                {
                    sequence: 1,
                    type: 'step_start',
                    status: 'completed',
                    metadata: { source: 'runtime.completeRun.fallback' },
                    startedAt: new Date(),
                    endedAt: new Date(),
                },
                {
                    sequence: 2,
                    type: 'text',
                    status: 'completed',
                    content: input.assistantContent,
                    startedAt: new Date(),
                    endedAt: new Date(),
                },
                {
                    sequence: 3,
                    type: 'step_finish',
                    status: 'completed',
                    metadata: { finish: 'stop' },
                    startedAt: new Date(),
                    endedAt: new Date(),
                },
            ]);
        }
        await this.persistence.updateRun(input.runId, {
            status: 'completed',
            finishedAt: new Date(),
        });
        if (input.sessionId) {
            await this.persistence.appendRunToSession(input.sessionId, input.runId, {
                latestTaskOutput: input.assistantContent,
                taskId: input.taskId,
            });
            await this.persistence.appendRunSummary(input.sessionId, {
                runId: input.runId,
                taskId: input.taskId,
                taskTitle: input.metadata?.taskTitle ? String(input.metadata.taskTitle) : undefined,
                objective: input.metadata?.taskObjective ? String(input.metadata.taskObjective) : undefined,
                outcome: this.buildOutcomeSummary(input.assistantContent),
                keyOutputs: this.buildKeyOutputs(input.assistantContent),
                openIssues: this.extractOpenIssues(input.assistantContent),
                completedAt: new Date(),
            });
        }
        await this.emitEvent({
            eventType: 'run.completed',
            agentId: input.agentId,
            sessionId: input.sessionId,
            runId: input.runId,
            taskId: input.taskId,
            traceId: rawInput.traceId,
            sequence: 999999,
            payload: {
                contentLength: input.assistantContent.length,
            },
        });
    }
    async failRun(rawInput) {
        const input = runtime_run_contract_1.RuntimeFailRunInputSchema.parse(rawInput);
        await this.persistence.updateRun(input.runId, {
            status: 'failed',
            error: input.error,
            finishedAt: new Date(),
        });
        if (input.sessionId) {
            await this.persistence.appendRunToSession(input.sessionId, input.runId, { taskId: input.taskId });
        }
        await this.emitEvent({
            eventType: 'run.failed',
            agentId: input.agentId,
            sessionId: input.sessionId,
            runId: input.runId,
            taskId: input.taskId,
            traceId: rawInput.traceId,
            sequence: 999999,
            payload: {
                error: input.error,
                ...(input.metadata || {}),
            },
        });
    }
    async recordLlmDelta(input) {
        await this.persistence.createPart({
            runId: input.runId,
            messageId: input.messageId,
            sequence: input.sequence,
            type: 'text',
            status: 'running',
            content: input.delta,
            startedAt: new Date(),
        });
        await this.emitEvent({
            eventType: 'llm.delta',
            agentId: input.agentId,
            sessionId: input.sessionId,
            runId: input.runId,
            taskId: input.taskId,
            messageId: input.messageId,
            traceId: input.traceId,
            sequence: input.sequence,
            payload: {
                delta: input.delta,
            },
        });
    }
    async recordToolPending(rawInput) {
        const input = runtime_run_contract_1.RuntimeToolEventInputSchema.parse(rawInput);
        const pipelineResult = await this.runToolCallPipeline('toolcall.pending', input, rawInput);
        if (pipelineResult.aborted) {
            throw new Error(`ToolCall pending blocked by hook: ${pipelineResult.abortedBy}`);
        }
        if (pipelineResult.cancelRequested) {
            await this.cancelRunWithActor(input.runId, {
                actorId: 'lifecycle-hook',
                actorType: 'system',
                reason: pipelineResult.cancelReason || 'cancelled_by_toolcall_hook',
            });
            throw new Error(`Runtime run cancelled by toolcall hook: ${pipelineResult.cancelReason || pipelineResult.cancelRequestedBy}`);
        }
        if (pipelineResult.pauseRequested) {
            await this.pauseRunWithActor(input.runId, {
                actorId: 'lifecycle-hook',
                actorType: 'system',
                reason: pipelineResult.pauseReason || 'paused_by_toolcall_hook',
            });
            throw new Error(`Runtime run paused by toolcall hook: ${pipelineResult.pauseReason || pipelineResult.pauseRequestedBy}`);
        }
        const part = await this.persistence.createPart({
            runId: input.runId,
            messageId: rawInput.messageId,
            sequence: rawInput.sequence,
            type: 'tool_call',
            status: 'pending',
            toolId: input.toolId,
            toolCallId: input.toolCallId,
            input: input.input,
            startedAt: new Date(),
            metadata: input.metadata,
        });
        await this.emitToolEventWithRuntimeStatus({
            eventType: 'tool.pending',
            status: 'pending',
            runtimeInput: input,
            messageId: rawInput.messageId,
            partId: part.id,
            traceId: rawInput.traceId,
            sequence: rawInput.sequence,
            payload: this.buildToolEventPayload({
                toolId: input.toolId,
                toolName: input.toolName,
                params: input.input,
                includeInputAlias: true,
            }),
        });
        return part.id;
    }
    async recordToolRunning(rawInput) {
        const input = runtime_run_contract_1.RuntimeToolEventInputSchema.parse(rawInput);
        await this.runToolCallPipeline('toolcall.running', input, rawInput);
        const transitioned = await this.persistence.transitionPartStatus(rawInput.partId, 'pending', 'running', {
            startedAt: new Date(),
            metadata: {
                stateNote: `Tool ${input.toolId} is running`,
            },
        });
        if (!transitioned) {
            throw new Error(`Invalid tool part transition pending->running for partId=${rawInput.partId}`);
        }
        await this.emitToolEventWithRuntimeStatus({
            eventType: 'tool.running',
            status: 'running',
            runtimeInput: input,
            messageId: rawInput.messageId,
            partId: rawInput.partId,
            traceId: rawInput.traceId,
            sequence: rawInput.sequence,
            payload: this.buildToolEventPayload({
                toolId: input.toolId,
                toolName: input.toolName,
                params: input.input,
                includeInputAlias: true,
            }),
        });
    }
    async recordToolCompleted(rawInput) {
        const input = runtime_run_contract_1.RuntimeToolEventInputSchema.parse(rawInput);
        await this.runToolCallPipeline('toolcall.completed', input, rawInput);
        const partId = rawInput.partId;
        if (partId) {
            const transitioned = await this.persistence.transitionPartStatus(partId, 'running', 'completed', {
                output: input.output,
                endedAt: new Date(),
                metadata: input.metadata,
            });
            if (!transitioned) {
                throw new Error(`Invalid tool part transition running->completed for partId=${partId}`);
            }
        }
        await this.emitToolEventWithRuntimeStatus({
            eventType: 'tool.completed',
            status: 'completed',
            runtimeInput: input,
            messageId: rawInput.messageId,
            partId,
            traceId: rawInput.traceId,
            sequence: rawInput.sequence,
            payload: {
                ...this.buildToolEventPayload({
                    toolId: input.toolId,
                    toolName: input.toolName,
                    params: input.input,
                    includeInputAlias: true,
                }),
                output: input.output,
            },
        });
    }
    async recordToolFailed(rawInput) {
        const input = runtime_run_contract_1.RuntimeToolEventInputSchema.parse(rawInput);
        await this.runToolCallPipeline('toolcall.failed', input, rawInput);
        const partId = rawInput.partId;
        if (partId) {
            const fromStatuses = ['running', 'pending'];
            let transitioned = false;
            for (const fromStatus of fromStatuses) {
                transitioned = await this.persistence.transitionPartStatus(partId, fromStatus, 'error', {
                    error: input.error,
                    endedAt: new Date(),
                    metadata: input.metadata,
                });
                if (transitioned)
                    break;
            }
            if (!transitioned) {
                throw new Error(`Invalid tool part transition to error for partId=${partId}`);
            }
        }
        await this.emitToolEventWithRuntimeStatus({
            eventType: 'tool.failed',
            status: 'failed',
            runtimeInput: input,
            messageId: rawInput.messageId,
            partId,
            traceId: rawInput.traceId,
            sequence: rawInput.sequence,
            payload: {
                ...this.buildToolEventPayload({
                    toolId: input.toolId,
                    toolName: input.toolName,
                    params: input.input,
                    includeInputAlias: true,
                }),
                error: input.error,
            },
        });
    }
    async emitToolEventWithRuntimeStatus(input) {
        const runtimeInput = input.runtimeInput;
        await this.emitEvent({
            eventType: input.eventType,
            agentId: runtimeInput.agentId,
            sessionId: runtimeInput.sessionId,
            runId: runtimeInput.runId,
            taskId: runtimeInput.taskId,
            messageId: input.messageId,
            partId: input.partId,
            toolCallId: runtimeInput.toolCallId,
            traceId: input.traceId,
            sequence: input.sequence,
            payload: input.payload,
        });
        await this.recordAgentToolRuntimeStatus(runtimeInput, input.status);
    }
    async recordAgentToolRuntimeStatus(input, status) {
        const agentId = String(input.agentId || '').trim();
        if (!agentId || !this.redisService?.isReady?.()) {
            return;
        }
        const payload = {
            agentId,
            taskId: input.taskId ? String(input.taskId).trim() : undefined,
            toolId: String(input.toolId || '').trim(),
            toolName: String(input.toolName || input.toolId || '').trim(),
            status,
            updatedAt: new Date().toISOString(),
            source: 'agent_task_tool',
        };
        try {
            await this.redisService.set((0, agent_task_runtime_status_util_1.buildAgentRuntimeStatusKey)(agentId), JSON.stringify(payload), agent_task_runtime_status_util_1.AGENT_TASK_RUNTIME_STATUS_TTL_SECONDS);
            await this.redisService.sadd(agent_task_runtime_status_util_1.AGENT_TASK_RUNTIME_STATUS_INDEX_KEY, [agentId]);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[agent_runtime_status] failed to write status agentId=${agentId} status=${status}: ${message}`);
        }
    }
    buildToolEventPayload(input) {
        const safeParams = this.sanitizeToolParams(input.params);
        const payload = {
            toolId: input.toolId,
            toolName: input.toolName || input.toolId,
            params: safeParams,
        };
        if (input.includeInputAlias) {
            payload.input = safeParams;
        }
        return payload;
    }
    sanitizeToolParams(value) {
        return this.sanitizeToolParamsInner(value, 0);
    }
    sanitizeToolParamsInner(value, depth) {
        if (depth > 6) {
            return '[Truncated]';
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeToolParamsInner(item, depth + 1));
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        const rawObject = value;
        const sanitized = {};
        for (const [key, nested] of Object.entries(rawObject)) {
            if (this.shouldMaskParamKey(key)) {
                sanitized[key] = '[REDACTED]';
                continue;
            }
            sanitized[key] = this.sanitizeToolParamsInner(nested, depth + 1);
        }
        return sanitized;
    }
    shouldMaskParamKey(key) {
        const normalized = String(key || '').toLowerCase();
        if (!normalized)
            return false;
        return (normalized.includes('password') ||
            normalized.includes('secret') ||
            normalized.includes('token') ||
            normalized.includes('apikey') ||
            normalized.includes('api_key') ||
            normalized.includes('authorization') ||
            normalized.includes('cookie') ||
            normalized.includes('credential'));
    }
    getLockKey(agentId, sessionId, taskId) {
        if (sessionId && sessionId.trim()) {
            return `agent:${agentId}:session:${sessionId.trim()}`;
        }
        if (taskId && taskId.trim()) {
            return `agent:${agentId}:task:${taskId.trim()}`;
        }
        return `agent:${agentId}:ephemeral`;
    }
    async acquireLock(lockKey) {
        const previous = this.lockTails.get(lockKey) || Promise.resolve();
        let resolveCurrent;
        const current = new Promise((resolve) => {
            resolveCurrent = resolve;
        });
        const nextTail = previous
            .catch(() => undefined)
            .then(() => current);
        this.lockTails.set(lockKey, nextTail);
        await previous.catch(() => undefined);
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            resolveCurrent();
            const tail = this.lockTails.get(lockKey);
            if (tail === nextTail) {
                this.lockTails.delete(lockKey);
            }
        };
    }
    async runToolCallPipeline(phase, input, rawInput) {
        const context = {
            phase,
            runId: input.runId,
            agentId: input.agentId,
            taskId: input.taskId,
            sessionId: input.sessionId,
            traceId: rawInput.traceId,
            timestamp: Date.now(),
            payload: {
                toolId: input.toolId,
                toolCallId: input.toolCallId,
                toolName: input.toolName,
                input: input.input,
                output: input.output,
                error: input.error,
                partId: rawInput.partId,
                messageId: rawInput.messageId,
            },
        };
        return this.hookPipeline.run(context);
    }
    async runPermissionPipeline(phase, input) {
        const context = {
            phase,
            runId: input.runId,
            agentId: input.agentId,
            taskId: input.taskId,
            sessionId: input.sessionId,
            traceId: input.traceId,
            timestamp: Date.now(),
            payload: {
                ...input.payload,
                approved: input.approved,
            },
        };
        return this.hookPipeline.run(context);
    }
    async emitEvent(input) {
        const payload = {
            ...(input.payload || {}),
            traceId: input.traceId,
        };
        const event = {
            eventId: `evt-${(0, uuid_1.v4)()}`,
            eventType: input.eventType,
            agentId: input.agentId,
            sessionId: input.sessionId,
            runId: input.runId,
            taskId: input.taskId,
            messageId: input.messageId,
            partId: input.partId,
            toolCallId: input.toolCallId,
            sequence: input.sequence,
            timestamp: Date.now(),
            traceId: input.traceId,
            payload,
        };
        await this.persistence.enqueueEvent(event);
        await this.hookDispatcher.dispatch(event);
    }
    async appendSystemMessagesToSession(sessionId, messages) {
        await this.persistence.appendSystemMessagesToSession(sessionId, messages);
    }
    async refreshSessionMemoSnapshot(session, agentId) {
        const refreshStartAt = Date.now();
        const ownerId = session.ownerId || agentId;
        if (!ownerId || session.ownerType !== 'agent')
            return;
        const loadExistingAt = Date.now();
        const existing = await this.persistence.getSessionMemoSnapshot(session.id || '');
        this.debugTiming(session.id || ownerId, 'memo_snapshot.load_existing', loadExistingAt, {
            hasExisting: Boolean(existing),
        });
        const existingRefreshedAt = existing?.refreshedAt ? Date.parse(existing.refreshedAt) : 0;
        if (Number.isFinite(existingRefreshedAt) && Date.now() - existingRefreshedAt <= this.memoSnapshotRefreshMs) {
            this.debugTiming(session.id || ownerId, 'memo_snapshot.skip_recent', refreshStartAt, {
                refreshedAt: existing?.refreshedAt || 'unknown',
            });
            return;
        }
        try {
            const loadMemoDataAt = Date.now();
            const [identityResult, todoResult, topicResult] = await Promise.all([
                this.memoService.getIdentityMemos(ownerId),
                this.memoService.listMemos({ agentId: ownerId, memoKind: 'todo', page: 1, pageSize: 2 }),
                this.memoService.listMemos({ agentId: ownerId, memoKind: 'topic', page: 1, pageSize: 5 }),
            ]);
            this.debugTiming(session.id || ownerId, 'memo_snapshot.fetch_memo_data', loadMemoDataAt, {
                identityCount: identityResult.length,
                todoCount: todoResult.items.length,
                topicCount: topicResult.items.length,
            });
            const snapshot = {
                agentId: ownerId,
                refreshedAt: new Date().toISOString(),
                identity: identityResult.slice(0, 2).map((m) => ({
                    id: String(m.id || ''),
                    memoKind: 'identity',
                    title: String(m.title || ''),
                    slug: m.slug ? String(m.slug) : undefined,
                    content: String(m.content || '').slice(0, 3000),
                    updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : undefined,
                })),
                todo: todoResult.items.slice(0, 2).map((m) => ({
                    id: String(m.id || ''),
                    memoKind: 'todo',
                    title: String(m.title || ''),
                    slug: m.slug ? String(m.slug) : undefined,
                    content: String(m.content || '').slice(0, 3000),
                    updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : undefined,
                })),
                topic: topicResult.items.slice(0, 5).map((m) => ({
                    id: String(m.id || ''),
                    memoKind: 'topic',
                    title: String(m.title || ''),
                    slug: m.slug ? String(m.slug) : undefined,
                    content: String(m.content || '').slice(0, 3000),
                    updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : undefined,
                })),
            };
            const enqueueSnapshotAt = Date.now();
            const queued = await this.memoSnapshotQueue.enqueueSnapshotUpdate(session.id || '', snapshot);
            this.debugTiming(session.id || ownerId, 'memo_snapshot.enqueue_update', enqueueSnapshotAt, {
                requestId: queued.requestId,
            });
            this.logger.log(`[memoSnapshot] session=${session.id} agent=${ownerId} queued requestId=${queued.requestId}`);
            this.debugTiming(session.id || ownerId, 'memo_snapshot.total', refreshStartAt, {
                ownerId,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`[memoSnapshot] session=${session.id} failed: ${message}`);
            this.debugTiming(session.id || ownerId, 'memo_snapshot.failed', refreshStartAt, {
                ownerId,
            });
        }
    }
    buildOutcomeSummary(content) {
        const raw = String(content || '').trim();
        if (!raw) {
            return 'No assistant output';
        }
        const parsed = this.tryParseSummaryJson(raw);
        const structuredOutcome = String(parsed?.outcome || parsed?.summary || parsed?.result || '').trim();
        if (structuredOutcome) {
            return structuredOutcome.length > 420 ? `${structuredOutcome.slice(0, 420)}...` : structuredOutcome;
        }
        const sections = this.extractTextSections(raw);
        const preferred = sections.find((section) => section.type === 'paragraph') || sections[0];
        const normalized = String(preferred?.content || raw).replace(/\s+/g, ' ').trim();
        return normalized.length > 420 ? `${normalized.slice(0, 420)}...` : normalized;
    }
    buildKeyOutputs(content) {
        const raw = String(content || '').trim();
        if (!raw)
            return [];
        const parsed = this.tryParseSummaryJson(raw);
        if (Array.isArray(parsed?.keyOutputs) && parsed.keyOutputs.length > 0) {
            return parsed.keyOutputs.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
        }
        const sections = this.extractTextSections(raw);
        const candidates = sections
            .filter((section) => section.type === 'bullet' || section.type === 'numbered' || section.type === 'checklist')
            .map((section) => section.content.trim())
            .filter(Boolean);
        if (candidates.length > 0) {
            return Array.from(new Set(candidates)).slice(0, 8);
        }
        return sections
            .filter((section) => section.type === 'heading')
            .map((section) => section.content.trim())
            .filter(Boolean)
            .slice(0, 6);
    }
    extractOpenIssues(content) {
        const raw = String(content || '').trim();
        if (!raw)
            return [];
        const parsed = this.tryParseSummaryJson(raw);
        if (Array.isArray(parsed?.openIssues) && parsed.openIssues.length > 0) {
            return parsed.openIssues.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
        }
        const signals = ['TODO', '待办', '后续', '风险', '问题', 'blocked', 'pending', 'follow-up'];
        return this.extractTextSections(raw)
            .map((section) => section.content.trim())
            .filter((line) => {
            if (!line)
                return false;
            if (/^- \[ \]/.test(line))
                return true;
            const lower = line.toLowerCase();
            return signals.some((signal) => lower.includes(signal.toLowerCase()));
        })
            .slice(0, 8);
    }
    tryParseSummaryJson(content) {
        const trimmed = String(content || '').trim();
        if (!trimmed)
            return null;
        try {
            const parsed = JSON.parse(trimmed);
            return parsed && typeof parsed === 'object' ? parsed : null;
        }
        catch {
            const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i)?.[1] || trimmed.match(/```\s*([\s\S]*?)```/i)?.[1];
            if (!fenced)
                return null;
            try {
                const parsed = JSON.parse(fenced.trim());
                return parsed && typeof parsed === 'object' ? parsed : null;
            }
            catch {
                return null;
            }
        }
    }
    extractTextSections(content) {
        const lines = String(content || '').split('\n');
        const sections = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('```'))
                continue;
            if (/^#{1,6}\s+/.test(trimmed)) {
                sections.push({ type: 'heading', content: trimmed.replace(/^#{1,6}\s+/, '').trim() });
                continue;
            }
            if (/^- \[.?\]\s+/.test(trimmed)) {
                sections.push({ type: 'checklist', content: trimmed.replace(/^- \[.?\]\s+/, '').trim() });
                continue;
            }
            if (/^[-*]\s+/.test(trimmed)) {
                sections.push({ type: 'bullet', content: trimmed.replace(/^[-*]\s+/, '').trim() });
                continue;
            }
            if (/^\d+\.\s+/.test(trimmed)) {
                sections.push({ type: 'numbered', content: trimmed.replace(/^\d+\.\s+/, '').trim() });
                continue;
            }
            sections.push({ type: 'paragraph', content: trimmed });
        }
        return sections;
    }
};
exports.RuntimeOrchestratorService = RuntimeOrchestratorService;
exports.RuntimeOrchestratorService = RuntimeOrchestratorService = RuntimeOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [runtime_persistence_service_1.RuntimePersistenceService,
        hook_dispatcher_service_1.HookDispatcherService,
        hook_pipeline_service_1.HookPipelineService,
        memo_service_1.MemoService,
        runtime_memo_snapshot_queue_service_1.RuntimeMemoSnapshotQueueService,
        common_2.DebugTimingProvider,
        infra_1.RedisService])
], RuntimeOrchestratorService);
//# sourceMappingURL=runtime-orchestrator.service.js.map