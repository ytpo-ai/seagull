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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const mongoose_2 = require("mongoose");
const cron_1 = require("cron");
const axios_1 = __importDefault(require("axios"));
const infra_1 = require("../../../libs/infra/src/index");
const schedule_schema_1 = require("../../shared/schemas/schedule.schema");
const agent_client_service_1 = require("../agents-client/agent-client.service");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(scheduleModel, schedulerRegistry, agentClientService, redisService, messageBus) {
        this.scheduleModel = scheduleModel;
        this.schedulerRegistry = schedulerRegistry;
        this.agentClientService = agentClientService;
        this.redisService = redisService;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(SchedulerService_1.name);
        this.runLocks = new Set();
        this.lifecycleMonitorTimers = new Map();
        this.scheduleMonitorKeys = new Map();
        this.schedulerAlertWebhookUrl = String(process.env.SCHEDULER_ALERT_WEBHOOK_URL || '').trim();
        this.monitorIntervalMs = Math.max(1000, Number(process.env.SCHEDULER_MESSAGE_MONITOR_INTERVAL_MS || 3000));
        this.monitorMaxAttempts = Math.max(1, Number(process.env.SCHEDULER_MESSAGE_MONITOR_MAX_ATTEMPTS || 20));
        this.dispatchMaxAttempts = Math.max(1, Number(process.env.SCHEDULER_DISPATCH_MAX_ATTEMPTS || 3));
        this.systemScheduleNames = [
            'system-meeting-monitor',
            'system-cto-daily-requirement-triage',
            'system-memo-event-flush',
            'system-memo-full-aggregation',
        ];
    }
    async onModuleInit() {
        const enabledSchedules = await this.scheduleModel.find({ enabled: true }).exec();
        await Promise.all(enabledSchedules.map((schedule) => this.registerSchedule(schedule)));
        await this.recoverUnfinishedLifecycleRuns();
        await this.logMissingSystemSchedules();
    }
    onModuleDestroy() {
        for (const key of this.schedulerRegistry.getCronJobs().keys()) {
            if (key.startsWith('schedule-cron:')) {
                this.schedulerRegistry.deleteCronJob(key);
            }
        }
        for (const key of this.schedulerRegistry.getIntervals()) {
            if (key.startsWith('schedule-interval:')) {
                this.schedulerRegistry.deleteInterval(key);
            }
        }
        for (const timer of this.lifecycleMonitorTimers.values()) {
            clearTimeout(timer);
        }
        this.lifecycleMonitorTimers.clear();
        this.scheduleMonitorKeys.clear();
    }
    async createSchedule(createdBy, dto) {
        await this.validateScheduleDto(dto.schedule);
        this.assertScheduleTarget(dto.target?.executorId);
        const now = new Date();
        const projectId = String(dto.projectId || '').trim() || undefined;
        const schedule = await new this.scheduleModel({
            name: dto.name.trim(),
            description: dto.description?.trim(),
            schedule: {
                ...dto.schedule,
                timezone: dto.schedule.timezone || 'Asia/Shanghai',
            },
            target: {
                executorType: 'agent',
                executorId: dto.target.executorId.trim(),
                executorName: dto.target.executorName?.trim() || undefined,
            },
            input: dto.input || {},
            message: this.resolveMessageConfig(dto.message, dto.name),
            enabled: dto.enabled ?? true,
            status: dto.enabled === false ? 'paused' : 'idle',
            nextRunAt: this.computeNextRunAt(dto.schedule, now),
            stats: {
                totalRuns: 0,
                successRuns: 0,
                failedRuns: 0,
                skippedRuns: 0,
            },
            ...(projectId ? { projectId } : {}),
            createdBy,
        }).save();
        if (schedule.enabled) {
            await this.registerSchedule(schedule);
        }
        return schedule;
    }
    async listSchedules(filters) {
        const query = {};
        if (filters?.projectId !== undefined) {
            query.projectId = filters.projectId || { $in: [null, '', undefined] };
        }
        return this.scheduleModel.find(query).sort({ createdAt: -1 }).exec();
    }
    async getScheduleById(scheduleId) {
        const schedule = await this.scheduleModel.findOne({ _id: scheduleId }).exec();
        if (!schedule) {
            throw new common_1.NotFoundException('Schedule not found');
        }
        return schedule;
    }
    async updateSchedule(scheduleId, dto) {
        const existing = await this.getScheduleById(scheduleId);
        const nextScheduleConfig = dto.schedule || existing.schedule;
        await this.validateScheduleDto(nextScheduleConfig);
        if (dto.target?.executorId !== undefined) {
            this.assertScheduleTarget(dto.target.executorId);
        }
        const updated = await this.scheduleModel
            .findOneAndUpdate({ _id: scheduleId }, {
            $set: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.description !== undefined ? { description: dto.description.trim() || undefined } : {}),
                ...(dto.schedule
                    ? {
                        schedule: {
                            ...dto.schedule,
                            timezone: dto.schedule.timezone || existing.schedule.timezone || 'Asia/Shanghai',
                        },
                    }
                    : {}),
                ...(dto.target
                    ? {
                        target: {
                            executorType: 'agent',
                            executorId: dto.target.executorId?.trim() || existing.target.executorId,
                            executorName: dto.target.executorName?.trim() || undefined,
                        },
                    }
                    : {}),
                ...(dto.input !== undefined ? { input: dto.input } : {}),
                ...(dto.message !== undefined
                    ? {
                        message: this.resolveMessageConfig(dto.message, dto.name || existing.name),
                    }
                    : {}),
                ...(dto.enabled !== undefined
                    ? {
                        enabled: dto.enabled,
                        status: dto.enabled ? 'idle' : 'paused',
                    }
                    : {}),
                ...(dto.projectId !== undefined ? { projectId: dto.projectId.trim() || undefined } : {}),
                nextRunAt: this.computeNextRunAt(nextScheduleConfig),
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Schedule not found');
        }
        this.unregisterSchedule(scheduleId);
        if (updated.enabled) {
            await this.registerSchedule(updated);
        }
        return updated;
    }
    async enableSchedule(scheduleId) {
        const existing = await this.getScheduleById(scheduleId);
        const updated = await this.scheduleModel
            .findOneAndUpdate({ _id: scheduleId }, {
            $set: {
                enabled: true,
                status: 'idle',
                nextRunAt: this.computeNextRunAt(existing.schedule),
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Schedule not found');
        }
        await this.registerSchedule(updated);
        return updated;
    }
    async disableSchedule(scheduleId) {
        const updated = await this.scheduleModel
            .findOneAndUpdate({ _id: scheduleId }, {
            $set: {
                enabled: false,
                status: 'paused',
            },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Schedule not found');
        }
        this.unregisterSchedule(scheduleId);
        return updated;
    }
    async deleteSchedule(scheduleId) {
        const deleted = await this.scheduleModel.deleteOne({ _id: scheduleId }).exec();
        this.unregisterSchedule(scheduleId);
        return { success: (deleted.deletedCount || 0) > 0 };
    }
    async triggerSchedule(scheduleId) {
        const schedule = await this.getScheduleById(scheduleId);
        await this.dispatchSchedule(schedule, 'manual');
        return { accepted: true, status: 'triggered' };
    }
    async getScheduleHistory(scheduleId, limit = 20) {
        const schedule = await this.getScheduleById(scheduleId);
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        try {
            const data = await this.agentClientService.listInnerMessages({
                page: 1,
                pageSize: safeLimit,
                source: 'scheduler',
                scheduleId,
            });
            return data.items.map((item) => {
                const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
                const status = String(item?.status || '').trim();
                const createdAt = item?.createdAt || item?.sentAt || new Date().toISOString();
                const updatedAt = item?.updatedAt || item?.processedAt || item?.failedAt || createdAt;
                return {
                    _id: String(item?._id || item?.messageId || `${scheduleId}-${createdAt}`),
                    messageId: item?.messageId,
                    status,
                    summary: String(item?.title || '').trim() || String(payload?.prompt || '').trim() || 'scheduler dispatch',
                    error: status === 'failed' ? String(item?.error || '').trim() : '',
                    eventType: item?.eventType,
                    receiverAgentId: item?.receiverAgentId,
                    triggerType: payload?.triggerType,
                    createdAt,
                    updatedAt,
                };
            });
        }
        catch (error) {
            this.logger.warn(`Failed to query inner-message history for schedule ${scheduleId}: ${error instanceof Error ? error.message : String(error)}`);
            const history = [];
            if (schedule.lastRun?.startedAt || schedule.lastRun?.completedAt) {
                const scheduleMeta = schedule;
                const createdAt = (schedule.lastRun?.startedAt || scheduleMeta.updatedAt || new Date()).toISOString();
                const updatedAt = (schedule.lastRun?.completedAt || scheduleMeta.updatedAt || new Date()).toISOString();
                history.push({
                    _id: `last-run-${scheduleId}`,
                    status: schedule.lastRun?.success ? 'completed' : 'failed',
                    summary: schedule.lastRun?.result || '',
                    error: schedule.lastRun?.error || '',
                    createdAt,
                    updatedAt,
                });
            }
            return history.slice(0, safeLimit);
        }
    }
    async registerSchedule(schedule) {
        const scheduleId = this.getEntityId(schedule);
        if (!scheduleId || !schedule.enabled) {
            return;
        }
        this.unregisterSchedule(scheduleId);
        if (schedule.schedule.type === 'interval') {
            const intervalMs = schedule.schedule.intervalMs || 0;
            if (intervalMs < 60000) {
                this.logger.warn(`Skip schedule ${scheduleId}: interval too short`);
                return;
            }
            const key = this.getIntervalKey(scheduleId);
            const timer = setInterval(() => {
                this.dispatchById(scheduleId).catch((error) => {
                    this.logger.error(`Failed to execute interval schedule ${scheduleId}`, error?.stack || String(error));
                });
            }, intervalMs);
            this.schedulerRegistry.addInterval(key, timer);
            return;
        }
        const expression = schedule.schedule.expression;
        if (!expression) {
            this.logger.warn(`Skip schedule ${scheduleId}: cron expression missing`);
            return;
        }
        try {
            const job = new cron_1.CronJob(expression, () => {
                this.dispatchById(scheduleId).catch((error) => {
                    this.logger.error(`Failed to execute cron schedule ${scheduleId}`, error?.stack || String(error));
                });
            }, null, false, schedule.schedule.timezone || 'Asia/Shanghai');
            this.schedulerRegistry.addCronJob(this.getCronKey(scheduleId), job);
            job.start();
        }
        catch (error) {
            this.logger.error(`Invalid cron schedule ${scheduleId}`, error instanceof Error ? error.stack : String(error));
        }
    }
    unregisterSchedule(scheduleId) {
        const cronKey = this.getCronKey(scheduleId);
        const intervalKey = this.getIntervalKey(scheduleId);
        if (this.schedulerRegistry.doesExist('cron', cronKey)) {
            const cron = this.schedulerRegistry.getCronJob(cronKey);
            cron.stop();
            this.schedulerRegistry.deleteCronJob(cronKey);
        }
        if (this.schedulerRegistry.doesExist('interval', intervalKey)) {
            this.schedulerRegistry.deleteInterval(intervalKey);
        }
    }
    async dispatchById(scheduleId) {
        const schedule = await this.scheduleModel.findOne({ _id: scheduleId }).exec();
        if (!schedule || !schedule.enabled) {
            return;
        }
        await this.dispatchSchedule(schedule, 'auto');
    }
    async dispatchSchedule(schedule, triggerType, options) {
        const scheduleId = this.getEntityId(schedule);
        if (!scheduleId) {
            return;
        }
        if (this.runLocks.has(scheduleId)) {
            await this.scheduleModel.updateOne({ _id: scheduleId }, { $inc: { 'stats.skippedRuns': 1 } }).exec();
            this.logger.warn(`Schedule ${scheduleId} skipped: already running`);
            return;
        }
        this.runLocks.add(scheduleId);
        const startedAt = new Date();
        try {
            const effectiveInput = this.mergeInput(schedule.input, options?.inputOverride);
            await this.scheduleModel
                .updateOne({ _id: scheduleId }, {
                $set: {
                    status: 'running',
                    'lastRun.startedAt': startedAt,
                },
            })
                .exec();
            const dispatched = await this.dispatchToAgent(schedule, effectiveInput, triggerType);
            const completedAt = new Date();
            const success = dispatched.accepted;
            if (!success) {
                await this.scheduleModel
                    .updateOne({ _id: scheduleId }, {
                    $set: {
                        status: 'error',
                        nextRunAt: this.computeNextRunAt(schedule.schedule, completedAt),
                        lastRun: {
                            startedAt,
                            completedAt,
                            success: false,
                            result: undefined,
                            error: 'inner-message dispatch rejected',
                            taskId: dispatched.messageId || undefined,
                            attempts: 1,
                        },
                    },
                    $inc: {
                        'stats.totalRuns': 1,
                        'stats.failedRuns': 1,
                    },
                })
                    .exec();
                await this.recordDeadLetter({
                    scheduleId,
                    taskId: dispatched.messageId,
                    triggerType,
                    reason: 'inner-message dispatch rejected',
                    attempts: 1,
                });
                await this.notifyScheduleFailure(scheduleId, schedule.name, 'inner-message dispatch rejected');
                return;
            }
            await this.scheduleModel
                .updateOne({ _id: scheduleId }, {
                $set: {
                    status: 'running',
                    nextRunAt: this.computeNextRunAt(schedule.schedule, completedAt),
                    lastRun: {
                        startedAt,
                        completedAt,
                        success: true,
                        result: `inner-message dispatched: ${dispatched.messageId}`,
                        error: undefined,
                        taskId: dispatched.messageId || undefined,
                        attempts: 1,
                    },
                },
                $inc: {
                    'stats.totalRuns': 1,
                },
            })
                .exec();
            this.monitorDispatchedMessageLifecycle({
                scheduleId,
                scheduleName: schedule.name,
                messageId: dispatched.messageId,
                triggerType,
            });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : 'Dispatch failed';
            this.logger.error(`Schedule ${scheduleId} dispatch failed: ${reason}`);
            await this.scheduleModel
                .updateOne({ _id: scheduleId }, {
                $set: {
                    status: 'error',
                    'lastRun.completedAt': new Date(),
                    'lastRun.success': false,
                    'lastRun.error': reason,
                },
                $inc: {
                    'stats.totalRuns': 1,
                    'stats.failedRuns': 1,
                },
            })
                .exec();
            await this.recordDeadLetter({
                scheduleId,
                triggerType,
                reason,
                attempts: 1,
            });
            await this.notifyScheduleFailure(scheduleId, schedule.name, reason);
        }
        finally {
            this.runLocks.delete(scheduleId);
        }
    }
    async dispatchToAgent(schedule, effectiveInput, triggerType) {
        const scheduleId = this.getEntityId(schedule);
        const eventType = String(schedule.message?.eventType || '').trim() || 'schedule.trigger';
        const title = String(schedule.message?.title || '').trim() || `定时任务: ${schedule.name}`;
        const payload = {
            scheduleId,
            scheduleName: schedule.name,
            triggerType,
            prompt: effectiveInput.prompt,
            ...(effectiveInput.payload || {}),
        };
        return this.agentClientService.sendDirectInnerMessage({
            senderAgentId: 'scheduler-system',
            receiverAgentId: schedule.target.executorId,
            eventType,
            title,
            content: this.buildMessageContent(schedule, effectiveInput, triggerType),
            payload,
            source: 'scheduler',
            dedupKey: `schedule:${scheduleId}:${Date.now()}`,
            maxAttempts: this.dispatchMaxAttempts,
        });
    }
    monitorDispatchedMessageLifecycle(input) {
        const monitorKey = this.getLifecycleMonitorKey(input.scheduleId, input.messageId);
        const previousKey = this.scheduleMonitorKeys.get(input.scheduleId);
        if (previousKey && previousKey !== monitorKey) {
            this.stopLifecycleMonitor(previousKey);
        }
        this.scheduleMonitorKeys.set(input.scheduleId, monitorKey);
        const poll = async (attempt) => {
            try {
                const data = await this.agentClientService.listInnerMessages({
                    page: 1,
                    pageSize: 1,
                    source: 'scheduler',
                    scheduleId: input.scheduleId,
                    messageId: input.messageId,
                });
                const message = Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
                if (!message) {
                    if (attempt >= this.monitorMaxAttempts) {
                        await this.markScheduleLifecycleFailure({
                            scheduleId: input.scheduleId,
                            scheduleName: input.scheduleName,
                            messageId: input.messageId,
                            triggerType: input.triggerType,
                            reason: 'inner-message not found while monitoring lifecycle',
                        });
                        this.stopLifecycleMonitor(monitorKey);
                        return;
                    }
                    this.scheduleNextLifecycleMonitorPoll(monitorKey, attempt + 1, poll);
                    return;
                }
                const status = String(message.status || '').trim().toLowerCase();
                if (status === 'processed') {
                    const completedAt = message.processedAt ||
                        message.updatedAt ||
                        message.deliveredAt ||
                        message.sentAt ||
                        new Date().toISOString();
                    await this.scheduleModel
                        .updateOne({ _id: input.scheduleId, 'lastRun.taskId': input.messageId }, {
                        $set: {
                            status: 'idle',
                            'lastRun.completedAt': new Date(completedAt),
                            'lastRun.success': true,
                            'lastRun.result': `inner-message processed: ${input.messageId}`,
                            'lastRun.error': undefined,
                        },
                        $inc: {
                            'stats.successRuns': 1,
                        },
                    })
                        .exec();
                    await this.publishScheduleReportGeneratedEvent({
                        scheduleId: input.scheduleId,
                        scheduleName: input.scheduleName,
                        messageId: input.messageId,
                        executionTime: completedAt,
                        processingResult: message.payload?.processingResult,
                    });
                    this.stopLifecycleMonitor(monitorKey);
                    return;
                }
                if (status === 'failed') {
                    const reason = String(message.error || '').trim() || 'inner-message processing failed';
                    await this.markScheduleLifecycleFailure({
                        scheduleId: input.scheduleId,
                        scheduleName: input.scheduleName,
                        messageId: input.messageId,
                        triggerType: input.triggerType,
                        reason,
                    });
                    this.stopLifecycleMonitor(monitorKey);
                    return;
                }
                if (attempt >= this.monitorMaxAttempts) {
                    await this.markScheduleLifecycleFailure({
                        scheduleId: input.scheduleId,
                        scheduleName: input.scheduleName,
                        messageId: input.messageId,
                        triggerType: input.triggerType,
                        reason: `inner-message lifecycle monitor timeout after ${this.monitorMaxAttempts} polls`,
                    });
                    this.stopLifecycleMonitor(monitorKey);
                    return;
                }
                this.scheduleNextLifecycleMonitorPoll(monitorKey, attempt + 1, poll);
            }
            catch (error) {
                this.logger.warn(`Scheduler lifecycle monitor error scheduleId=${input.scheduleId} messageId=${input.messageId}: ${error instanceof Error ? error.message : String(error)}`);
                if (attempt >= this.monitorMaxAttempts) {
                    await this.markScheduleLifecycleFailure({
                        scheduleId: input.scheduleId,
                        scheduleName: input.scheduleName,
                        messageId: input.messageId,
                        triggerType: input.triggerType,
                        reason: 'inner-message lifecycle monitor request failed repeatedly',
                    });
                    this.stopLifecycleMonitor(monitorKey);
                    return;
                }
                this.scheduleNextLifecycleMonitorPoll(monitorKey, attempt + 1, poll);
            }
        };
        this.scheduleNextLifecycleMonitorPoll(monitorKey, 1, poll);
    }
    scheduleNextLifecycleMonitorPoll(monitorKey, attempt, poll) {
        this.stopLifecycleMonitor(monitorKey);
        const timer = setTimeout(() => {
            poll(attempt).catch((error) => {
                this.logger.warn(`Scheduler lifecycle monitor poll failure key=${monitorKey}: ${error instanceof Error ? error.message : String(error)}`);
            });
        }, this.monitorIntervalMs);
        this.lifecycleMonitorTimers.set(monitorKey, timer);
    }
    stopLifecycleMonitor(monitorKey) {
        const timer = this.lifecycleMonitorTimers.get(monitorKey);
        if (timer) {
            clearTimeout(timer);
            this.lifecycleMonitorTimers.delete(monitorKey);
        }
        for (const [scheduleId, key] of this.scheduleMonitorKeys.entries()) {
            if (key === monitorKey) {
                this.scheduleMonitorKeys.delete(scheduleId);
            }
        }
    }
    async recoverUnfinishedLifecycleRuns() {
        const runningSchedules = await this.scheduleModel
            .find({ status: 'running', enabled: true })
            .select({ _id: 1, name: 1, lastRun: 1 })
            .lean()
            .exec();
        if (!runningSchedules.length) {
            return;
        }
        for (const raw of runningSchedules) {
            const schedule = raw;
            const scheduleId = this.getEntityId(schedule);
            const messageId = String(schedule?.lastRun?.taskId || '').trim();
            const scheduleName = String(schedule?.name || '').trim() || scheduleId;
            if (!scheduleId) {
                continue;
            }
            if (!messageId) {
                await this.markScheduleLifecycleFailure({
                    scheduleId,
                    scheduleName,
                    triggerType: 'auto',
                    messageId: '',
                    reason: 'scheduler restarted while lifecycle monitor was in-flight',
                });
                continue;
            }
            try {
                const data = await this.agentClientService.listInnerMessages({
                    page: 1,
                    pageSize: 1,
                    source: 'scheduler',
                    scheduleId,
                    messageId,
                });
                const message = Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
                const status = String(message?.status || '').trim().toLowerCase();
                if (status === 'processed') {
                    await this.scheduleModel
                        .updateOne({ _id: scheduleId, 'lastRun.taskId': messageId }, {
                        $set: {
                            status: 'idle',
                            'lastRun.success': true,
                            'lastRun.completedAt': new Date(),
                            'lastRun.result': `inner-message processed: ${messageId}`,
                            'lastRun.error': undefined,
                        },
                        $inc: {
                            'stats.successRuns': 1,
                        },
                    })
                        .exec();
                    await this.publishScheduleReportGeneratedEvent({
                        scheduleId,
                        scheduleName,
                        messageId,
                        executionTime: new Date(),
                        processingResult: message?.payload?.processingResult,
                    });
                    continue;
                }
                if (status === 'failed') {
                    await this.markScheduleLifecycleFailure({
                        scheduleId,
                        scheduleName,
                        triggerType: 'auto',
                        messageId,
                        reason: String(message?.error || '').trim() || 'inner-message processing failed',
                    });
                    continue;
                }
                await this.markScheduleLifecycleFailure({
                    scheduleId,
                    scheduleName,
                    triggerType: 'auto',
                    messageId,
                    reason: 'scheduler restarted before lifecycle monitor completed',
                });
            }
            catch (error) {
                this.logger.warn(`Failed to recover running schedule lifecycle scheduleId=${scheduleId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    async markScheduleLifecycleFailure(input) {
        const query = { _id: input.scheduleId };
        if (input.messageId) {
            query['lastRun.taskId'] = input.messageId;
        }
        await this.scheduleModel
            .updateOne(query, {
            $set: {
                status: 'error',
                'lastRun.completedAt': new Date(),
                'lastRun.success': false,
                'lastRun.error': input.reason,
                'lastRun.result': undefined,
            },
            $inc: {
                'stats.failedRuns': 1,
            },
        })
            .exec();
        await this.recordDeadLetter({
            scheduleId: input.scheduleId,
            taskId: input.messageId,
            triggerType: input.triggerType,
            reason: input.reason,
            attempts: this.dispatchMaxAttempts,
        });
        await this.notifyScheduleFailure(input.scheduleId, input.scheduleName, input.reason);
    }
    buildMessageContent(schedule, effectiveInput, triggerType) {
        const parts = [
            '你收到一条来自定时调度器的任务消息。',
            `调度名称: ${schedule.name}`,
            `触发方式: ${triggerType === 'auto' ? '自动触发（定时）' : '手动触发'}`,
        ];
        if (schedule.description) {
            parts.push(`任务描述: ${schedule.description}`);
        }
        if (effectiveInput.prompt) {
            parts.push('', '任务指令:', effectiveInput.prompt);
        }
        if (effectiveInput.payload && Object.keys(effectiveInput.payload).length > 0) {
            parts.push('', '结构化参数:', JSON.stringify(effectiveInput.payload, null, 2));
        }
        parts.push('', '要求:', '1) 根据上述信息，使用你的已授权工具自主完成任务。', '2) 如果信息不足，做最小可行响应并说明缺失信息。', '3) 完成后请简要总结执行结果。');
        return parts.join('\n');
    }
    mergeInput(base, override) {
        return {
            prompt: override?.prompt ?? base?.prompt,
            payload: {
                ...(base?.payload || {}),
                ...(override?.payload || {}),
            },
        };
    }
    resolveMessageConfig(message, fallbackName) {
        const eventType = String(message?.eventType || '').trim() || 'schedule.trigger';
        const title = String(message?.title || '').trim() || fallbackName.trim();
        return {
            eventType,
            title,
        };
    }
    assertScheduleTarget(executorId) {
        const normalized = String(executorId || '').trim();
        if (!normalized) {
            throw new common_1.BadRequestException('target.executorId is required');
        }
    }
    async recordDeadLetter(options) {
        await this.scheduleModel
            .updateOne({ _id: options.scheduleId }, {
            $push: {
                deadLetters: {
                    $each: [
                        {
                            failedAt: new Date(),
                            taskId: options.taskId || undefined,
                            triggerType: options.triggerType,
                            reason: options.reason,
                            attempts: options.attempts,
                        },
                    ],
                    $slice: -50,
                },
            },
        })
            .exec();
    }
    async notifyScheduleFailure(scheduleId, scheduleName, reason) {
        const payload = {
            event: 'scheduler.dead_letter',
            scheduleId,
            scheduleName,
            reason,
            timestamp: new Date().toISOString(),
        };
        this.logger.error(`Schedule moved to dead letter: ${JSON.stringify(payload)}`);
        if (!this.schedulerAlertWebhookUrl) {
            await this.publishSchedulerAlertEvent(scheduleId, scheduleName, reason);
            return;
        }
        try {
            await axios_1.default.post(this.schedulerAlertWebhookUrl, payload, {
                timeout: Number(process.env.SCHEDULER_ALERT_TIMEOUT_MS || 5000),
            });
        }
        catch (error) {
            this.logger.warn(`Failed to send scheduler dead-letter webhook: ${error instanceof Error ? error.message : String(error)}`);
        }
        await this.publishSchedulerAlertEvent(scheduleId, scheduleName, reason);
    }
    async publishSchedulerAlertEvent(scheduleId, scheduleName, reason) {
        const occurredAt = new Date().toISOString();
        const event = (0, infra_1.buildMessageCenterEvent)({
            eventType: 'system.alert.scheduler',
            source: infra_1.MESSAGE_CENTER_EVENT_SOURCE_SCHEDULER,
            occurredAt,
            data: {
                messageType: 'system_alert',
                title: '调度告警',
                content: `调度任务「${scheduleName}」执行失败：${reason}`,
                bizKey: `scheduler:${scheduleId}:dead_letter:${occurredAt}`,
                priority: 'high',
                extra: {
                    scheduleId,
                    scheduleName,
                    reason,
                    occurredAt,
                },
            },
        });
        try {
            await this.messageBus.publish('message-center.events', { payload: event });
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Publish scheduler alert message-center event failed: scheduleId=${scheduleId} reason=${detail}`);
        }
    }
    async publishScheduleReportGeneratedEvent(input) {
        const preview = String(input.processingResult?.responsePreview || '').trim();
        const outputSummary = preview || '定时任务已完成';
        const occurredAt = input.executionTime.toISOString();
        const event = (0, infra_1.buildMessageCenterEvent)({
            eventType: 'scheduler.report.generated',
            source: infra_1.MESSAGE_CENTER_EVENT_SOURCE_SCHEDULER,
            occurredAt,
            data: {
                messageType: 'orchestration',
                title: `${input.scheduleName} 执行完成`,
                content: outputSummary.slice(0, 500),
                actionUrl: `/scheduler/${encodeURIComponent(input.scheduleId)}`,
                bizKey: `scheduler:${input.scheduleId}:report:${input.messageId}`,
                priority: 'normal',
                extra: {
                    scheduleId: input.scheduleId,
                    scheduleName: input.scheduleName,
                    executionTime: occurredAt,
                    outputSummary: outputSummary.slice(0, 1000),
                },
            },
        });
        try {
            await this.messageBus.publish('message-center.events', { payload: event });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`Publish scheduler report message-center event failed: scheduleId=${input.scheduleId} messageId=${input.messageId} reason=${reason}`);
        }
    }
    async validateScheduleDto(schedule) {
        if (schedule.type === 'cron') {
            if (!schedule.expression?.trim()) {
                throw new common_1.BadRequestException('schedule.expression is required when type=cron');
            }
            try {
                const job = new cron_1.CronJob(schedule.expression, () => undefined, null, false, schedule.timezone || 'Asia/Shanghai');
                job.nextDate();
            }
            catch {
                throw new common_1.BadRequestException('Invalid cron expression');
            }
            return;
        }
        if (!schedule.intervalMs || schedule.intervalMs < 60000) {
            throw new common_1.BadRequestException('schedule.intervalMs must be at least 60000 when type=interval');
        }
    }
    computeNextRunAt(schedule, baseTime = new Date()) {
        if (schedule.type === 'interval') {
            if (!schedule.intervalMs) {
                return undefined;
            }
            return new Date(baseTime.getTime() + schedule.intervalMs);
        }
        if (!schedule.expression) {
            return undefined;
        }
        try {
            const job = new cron_1.CronJob(schedule.expression, () => undefined, null, false, schedule.timezone || 'Asia/Shanghai');
            const next = job.nextDate();
            if (next && typeof next === 'object' && 'toJSDate' in next) {
                return next.toJSDate();
            }
            return new Date(String(next));
        }
        catch {
            return undefined;
        }
    }
    async logMissingSystemSchedules() {
        const existing = await this.scheduleModel
            .find({ name: { $in: this.systemScheduleNames } })
            .select({ name: 1 })
            .lean()
            .exec();
        const existingNames = new Set(existing.map((item) => String(item.name || '')));
        const missing = this.systemScheduleNames.filter((name) => !existingNames.has(name));
        if (missing.length) {
            this.logger.warn(`System schedules missing: ${missing.join(', ')}. Run manual seed to initialize.`);
        }
    }
    getEntityId(entity) {
        if (typeof entity.id === 'string') {
            return entity.id;
        }
        if (entity._id && typeof entity._id === 'object' && 'toString' in entity._id) {
            return entity._id.toString();
        }
        if (typeof entity._id === 'string') {
            return entity._id;
        }
        return '';
    }
    getCronKey(scheduleId) {
        return `schedule-cron:${scheduleId}`;
    }
    getIntervalKey(scheduleId) {
        return `schedule-interval:${scheduleId}`;
    }
    getLifecycleMonitorKey(scheduleId, messageId) {
        return `schedule-monitor:${scheduleId}:${messageId}`;
    }
};
exports.SchedulerService = SchedulerService;
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(schedule_schema_1.Schedule.name)),
    __param(4, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        schedule_1.SchedulerRegistry,
        agent_client_service_1.AgentClientService,
        infra_1.RedisService, Object])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map