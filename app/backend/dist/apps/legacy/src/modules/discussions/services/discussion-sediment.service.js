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
var DiscussionSedimentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionSedimentService = void 0;
exports.buildSedimentMarkdown = buildSedimentMarkdown;
exports.buildOutlineDrivenSedimentMarkdown = buildOutlineDrivenSedimentMarkdown;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const rxjs_1 = require("rxjs");
const discussion_message_schema_1 = require("../../../shared/schemas/discussion-message.schema");
const discussion_space_schema_1 = require("../../../shared/schemas/discussion-space.schema");
const discussion_thread_schema_1 = require("../../../shared/schemas/discussion-thread.schema");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const discussion_knowledge_service_1 = require("./discussion-knowledge.service");
const SEDIMENT_CONTEXT_MESSAGE_LIMIT = 60;
const MEETING_ASSISTANT_ROLE_CODE = 'meeting-assistant';
const SEDIMENT_TASK_RETENTION_MS = 30 * 60 * 1000;
const DEFAULT_SEDIMENT_TITLE = '未命名沉淀';
const buildSedimentTaskId = (spaceId) => {
    return `discussion-sediment-${spaceId}-${(0, crypto_1.randomUUID)()}`;
};
const resolveDiscussionMessageRole = (senderType) => {
    if (senderType === discussion_message_schema_1.DiscussionMessageSenderType.AI) {
        return 'assistant';
    }
    if (senderType === discussion_message_schema_1.DiscussionMessageSenderType.SYSTEM) {
        return 'system';
    }
    return 'user';
};
function buildSedimentMarkdown(input) {
    const lines = [];
    lines.push(`# ${input.sedimentTitle}`);
    lines.push('');
    lines.push(`> 讨论主题：${input.spaceTitle}`);
    lines.push('');
    lines.push('## 讨论沉淀摘要');
    const latestMessages = input.messages.slice(-3).map((message) => message.content.trim()).filter(Boolean);
    if (latestMessages.length) {
        lines.push(`最近讨论聚焦于：${latestMessages.join('；')}`);
    }
    else {
        lines.push('当前暂无有效讨论内容。');
    }
    lines.push('');
    lines.push('## 讨论线梳理');
    for (const thread of input.threads) {
        lines.push(`### ${'  '.repeat(Math.max(0, thread.depth))}${thread.title}`);
        const threadMessages = input.messages
            .filter((message) => message.threadId === thread.id)
            .slice(-5)
            .map((message) => {
            const sender = message.senderType === discussion_message_schema_1.DiscussionMessageSenderType.AI
                ? 'AI'
                : message.senderType === discussion_message_schema_1.DiscussionMessageSenderType.SYSTEM
                    ? '系统'
                    : '用户';
            return `- [${sender}] ${message.content.replace(/\s+/g, ' ').trim()}`;
        });
        if (!threadMessages.length) {
            lines.push('- 暂无消息');
        }
        else {
            lines.push(...threadMessages);
        }
        lines.push('');
    }
    lines.push('## 知识积累');
    if (!input.knowledge.length) {
        lines.push('- 暂无知识条目');
    }
    else {
        for (const item of input.knowledge.slice(0, 10)) {
            lines.push(`- ${item.title}（可信度：${item.credibility}）: ${item.summary}`);
        }
    }
    return lines.join('\n').trim();
}
const normalizeStructuredOutlineSections = (rawOutline) => {
    if (!rawOutline || typeof rawOutline !== 'object') {
        return [];
    }
    const candidate = rawOutline;
    if (!Array.isArray(candidate.sections)) {
        return [];
    }
    return candidate.sections
        .filter((section) => section && typeof section === 'object' && typeof section.title === 'string')
        .map((section, index) => ({
        id: String(section.id || (0, crypto_1.randomUUID)()),
        title: String(section.title || `章节 ${index + 1}`),
        description: section.description ? String(section.description) : undefined,
        parentSectionId: section.parentSectionId ? String(section.parentSectionId) : undefined,
        order: Number.isFinite(section.order) ? Number(section.order) : index,
        depth: Number.isFinite(section.depth) ? Number(section.depth) : 0,
        status: (section.status || 'draft'),
        knowledgeCount: Number(section.knowledgeCount || 0),
        childSectionIds: Array.isArray(section.childSectionIds)
            ? section.childSectionIds.map((item) => String(item)).filter(Boolean)
            : [],
        metadata: section.metadata,
    }));
};
function buildOutlineDrivenSedimentMarkdown(input) {
    const lines = [];
    lines.push(`# ${input.sedimentTitle}`);
    lines.push('');
    lines.push(`> 讨论主题：${input.spaceTitle}`);
    lines.push(`> 文档大纲：${input.outlineTitle}`);
    lines.push('');
    lines.push('## 关键结论概览');
    const keyConclusions = input.messages
        .slice(-5)
        .map((message) => message.content.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    if (!keyConclusions.length) {
        lines.push('- 暂无可提取的讨论结论。');
    }
    else {
        for (const item of keyConclusions) {
            lines.push(`- ${item}`);
        }
    }
    lines.push('');
    lines.push('## 大纲章节沉淀');
    const sectionKnowledgeMap = new Map();
    for (const item of input.knowledge) {
        const sectionId = String(item.outlineSectionId || '').trim();
        if (!sectionId) {
            continue;
        }
        if (!sectionKnowledgeMap.has(sectionId)) {
            sectionKnowledgeMap.set(sectionId, []);
        }
        sectionKnowledgeMap.get(sectionId)?.push(item);
    }
    const sortedSections = [...input.outlineSections].sort((left, right) => {
        if (left.depth !== right.depth) {
            return left.depth - right.depth;
        }
        return left.order - right.order;
    });
    if (!sortedSections.length) {
        lines.push('- 当前无结构化大纲章节。');
    }
    for (const section of sortedSections) {
        const headingLevel = Math.min(6, Math.max(3, section.depth + 3));
        lines.push(`${'#'.repeat(headingLevel)} ${section.title}`);
        if (section.description) {
            lines.push(section.description);
        }
        const sectionKnowledge = sectionKnowledgeMap.get(section.id) || [];
        if (!sectionKnowledge.length) {
            lines.push('- 待补充：当前章节暂无关联知识条目。');
        }
        else {
            for (const item of sectionKnowledge.slice(0, 5)) {
                lines.push(`- ${item.title}（可信度：${item.credibility}）: ${item.summary}`);
            }
        }
        lines.push('');
    }
    const dataCollectionHints = sortedSections
        .filter((section) => section.metadata?.isStructuredData)
        .map((section) => {
        const frequency = section.metadata?.collectFrequency ? `，建议频率：${section.metadata.collectFrequency}` : '';
        return `- ${section.title}${frequency}`;
    });
    lines.push('## 数据采集建议');
    if (!dataCollectionHints.length) {
        lines.push('- 暂无结构化采集建议。');
    }
    else {
        lines.push(...dataCollectionHints);
    }
    return lines.join('\n').trim();
}
let DiscussionSedimentService = DiscussionSedimentService_1 = class DiscussionSedimentService {
    constructor(discussionSpaceModel, discussionThreadModel, discussionMessageModel, agentClientService, discussionKnowledgeService) {
        this.discussionSpaceModel = discussionSpaceModel;
        this.discussionThreadModel = discussionThreadModel;
        this.discussionMessageModel = discussionMessageModel;
        this.agentClientService = agentClientService;
        this.discussionKnowledgeService = discussionKnowledgeService;
        this.logger = new common_1.Logger(DiscussionSedimentService_1.name);
        this.sedimentTaskStore = new Map();
        this.sedimentTaskChannels = new Map();
    }
    touchTask(task) {
        const next = {
            ...task,
            updatedAt: new Date().toISOString(),
        };
        this.sedimentTaskStore.set(task.taskId, next);
        return next;
    }
    emitTaskEvent(taskId, payload) {
        const channels = this.sedimentTaskChannels.get(taskId);
        if (!channels?.size) {
            return;
        }
        const event = {
            data: payload,
        };
        for (const channel of channels) {
            channel.next(event);
        }
    }
    scheduleTaskCleanup(taskId) {
        setTimeout(() => {
            this.sedimentTaskStore.delete(taskId);
            this.sedimentTaskChannels.delete(taskId);
        }, SEDIMENT_TASK_RETENTION_MS);
    }
    resolveSedimentHistoryId(item) {
        const rawId = typeof item.id === 'string' ? item.id.trim() : '';
        if (rawId) {
            return rawId;
        }
        return String(item.version || '0');
    }
    isSedimentHistoryDeleted(item) {
        return Boolean(item?.isDeleted);
    }
    listActiveSedimentHistory(space) {
        const history = Array.isArray(space.sedimentHistory) ? space.sedimentHistory : [];
        return history.filter((item) => !this.isSedimentHistoryDeleted(item));
    }
    extractAgentCandidateValue(candidate, key) {
        const value = candidate[key];
        return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }
    isMeetingAssistantAgent(candidate) {
        const roleCode = this.extractAgentCandidateValue(candidate, 'roleCode');
        const agentType = this.extractAgentCandidateValue(candidate, 'agentType');
        const roleName = this.extractAgentCandidateValue(candidate, 'roleName');
        const name = this.extractAgentCandidateValue(candidate, 'name');
        const description = this.extractAgentCandidateValue(candidate, 'description');
        if (roleCode === MEETING_ASSISTANT_ROLE_CODE) {
            return true;
        }
        if (agentType === 'ai-meeting-assistant') {
            return true;
        }
        const labels = `${roleName} ${name} ${description}`;
        return labels.includes('会议助理') || labels.includes('会议助手') || labels.includes('meeting assistant');
    }
    async resolveMeetingAssistantAgentId(projectId) {
        const projectAgents = await this.agentClientService.getActiveAgents(projectId ? { projectId } : undefined);
        const projectMatch = projectAgents.find((item) => this.isMeetingAssistantAgent(item));
        if (projectMatch?.id) {
            return String(projectMatch.id);
        }
        if (projectId) {
            const globalAgents = await this.agentClientService.getActiveAgents();
            const globalMatch = globalAgents.find((item) => this.isMeetingAssistantAgent(item));
            if (globalMatch?.id) {
                return String(globalMatch.id);
            }
        }
        return null;
    }
    buildSedimentRuntimeTask(input) {
        const threadLines = input.threads
            .map((thread) => `${'  '.repeat(Math.max(0, thread.depth))}- ${thread.title} (${thread.id})`)
            .join('\n');
        const knowledgeLines = input.knowledge.length
            ? input.knowledge.map((item) => `- ${item.title}（可信度：${item.credibility}）: ${item.summary}`).join('\n')
            : '- 暂无知识条目';
        const outlineLines = input.outlineSections?.length
            ? input.outlineSections
                .sort((left, right) => {
                if (left.depth !== right.depth) {
                    return left.depth - right.depth;
                }
                return left.order - right.order;
            })
                .map((section) => `${'  '.repeat(Math.max(0, section.depth))}- ${section.title}${section.description ? `：${section.description}` : ''}`)
                .join('\n')
            : '- 无结构化大纲';
        const description = [
            `请基于以下讨论上下文，输出一份可复用的结构化讨论沉淀文档（Markdown）。`,
            `沉淀标题：${input.sedimentTitle}`,
            `讨论主题：${input.spaceTitle}`,
            `讨论线范围：${input.threadScope.length ? input.threadScope.join(', ') : '全部讨论线'}`,
            `文档大纲标题：${input.outlineTitle || '未设置'}`,
            `\n【文档大纲】\n${outlineLines}`,
            `\n【讨论线结构】\n${threadLines || '- 暂无讨论线'}`,
            `\n【知识积累】\n${knowledgeLines}`,
            '输出要求：严格按文档大纲章节结构组织内容，并在每个章节引用相关知识；标注证据不足章节为“待补充”；文末输出“数据采集建议”和“待深入讨论的问题”。',
        ].join('\n\n');
        const messages = input.messages.slice(-SEDIMENT_CONTEXT_MESSAGE_LIMIT).map((message) => ({
            role: resolveDiscussionMessageRole(message.senderType),
            content: String(message.content || ''),
            timestamp: message?.createdAt ? new Date(message.createdAt) : new Date(),
            metadata: {
                discussionMessageId: message.id,
                threadId: message.threadId,
            },
        }));
        return {
            id: buildSedimentTaskId(input.spaceId),
            title: `Discussion sediment | ${input.sedimentTitle}`,
            description,
            type: 'discussion_sediment',
            priority: 'medium',
            status: 'pending',
            assignedAgents: [],
            teamId: input.spaceId,
            messages,
        };
    }
    async generateSedimentByMeetingAssistant(input) {
        const meetingAssistantAgentId = await this.resolveMeetingAssistantAgentId(input.projectId);
        if (!meetingAssistantAgentId) {
            throw new common_1.NotFoundException('未找到可用的会议助手 Agent，无法执行沉淀。');
        }
        const task = this.buildSedimentRuntimeTask({
            spaceId: input.spaceId,
            sedimentTitle: input.sedimentTitle,
            spaceTitle: input.spaceTitle,
            threadScope: input.threadScope,
            threads: input.threads,
            messages: input.messages,
            knowledge: input.knowledge,
            outlineTitle: input.outlineTitle,
            outlineSections: input.outlineSections,
        });
        task.assignedAgents = [meetingAssistantAgentId];
        const executionContext = {
            executionMode: 'chat',
            source: 'discussion_sediment_runtime',
            agentSessionId: buildSedimentTaskId(input.spaceId),
            collaborationContext: {
                scene: 'discussion',
                spaceId: input.spaceId,
                sedimentMode: input.mode,
                threadScope: input.threadScope,
            },
            requestMeta: {
                source: 'discussion-sediment-service',
            },
        };
        const result = await this.agentClientService.executeTaskDetailed(meetingAssistantAgentId, task, executionContext);
        const content = String(result.response || '').trim();
        if (!content) {
            throw new Error('会议助手未返回可展示的沉淀内容');
        }
        return {
            content,
            runId: result.runId,
            sessionId: result.sessionId,
            agentId: meetingAssistantAgentId,
        };
    }
    async createSedimentTask(input) {
        const taskId = buildSedimentTaskId(input.spaceId);
        const now = new Date().toISOString();
        const title = String(input.title || '').trim() || DEFAULT_SEDIMENT_TITLE;
        const task = {
            taskId,
            spaceId: input.spaceId,
            title,
            status: 'queued',
            mode: input.mode || discussion_space_schema_1.DiscussionSedimentMode.MANUAL,
            threadScope: Array.isArray(input.threadScope) ? input.threadScope : [],
            createdAt: now,
            updatedAt: now,
        };
        this.sedimentTaskStore.set(taskId, task);
        this.emitTaskEvent(taskId, {
            type: 'discussion.sediment.task.snapshot',
            data: { task },
        });
        void this.runSedimentTask(taskId, {
            spaceId: input.spaceId,
            mode: input.mode,
            title,
            threadScope: input.threadScope,
        });
        return task;
    }
    async streamSedimentTaskEvents(spaceId, taskId) {
        const task = this.sedimentTaskStore.get(taskId);
        if (!task || task.spaceId !== spaceId) {
            throw new common_1.NotFoundException(`沉淀任务不存在: ${taskId}`);
        }
        return new rxjs_1.Observable((subscriber) => {
            let channels = this.sedimentTaskChannels.get(taskId);
            if (!channels) {
                channels = new Set();
                this.sedimentTaskChannels.set(taskId, channels);
            }
            const channel = new rxjs_1.Subject();
            const subscription = channel.subscribe({
                next: (event) => subscriber.next(event),
                error: (error) => subscriber.error(error),
                complete: () => subscriber.complete(),
            });
            channels.add(channel);
            channel.next({
                data: {
                    type: 'discussion.sediment.task.snapshot',
                    data: {
                        task,
                    },
                },
            });
            if (task.status === 'succeeded') {
                channel.next({ data: { type: 'discussion.sediment.task.succeeded', data: { task } } });
            }
            if (task.status === 'failed') {
                channel.next({ data: { type: 'discussion.sediment.task.failed', data: { task } } });
            }
            return () => {
                subscription.unsubscribe();
                const target = this.sedimentTaskChannels.get(taskId);
                if (!target) {
                    return;
                }
                target.delete(channel);
                channel.complete();
                if (!target.size) {
                    this.sedimentTaskChannels.delete(taskId);
                }
            };
        });
    }
    async runSedimentTask(taskId, input) {
        const current = this.sedimentTaskStore.get(taskId);
        if (!current) {
            return;
        }
        const runningTask = this.touchTask({
            ...current,
            status: 'running',
            startedAt: new Date().toISOString(),
            error: undefined,
        });
        this.emitTaskEvent(taskId, {
            type: 'discussion.sediment.task.running',
            data: { task: runningTask },
        });
        try {
            const result = await this.generateSediment({
                spaceId: input.spaceId,
                mode: input.mode,
                title: input.title,
                threadScope: input.threadScope,
                trigger: 'manual',
            });
            const succeededTask = this.touchTask({
                ...runningTask,
                status: 'succeeded',
                finishedAt: new Date().toISOString(),
                result,
            });
            this.emitTaskEvent(taskId, {
                type: 'discussion.sediment.task.succeeded',
                data: { task: succeededTask },
            });
        }
        catch (error) {
            const failedTask = this.touchTask({
                ...runningTask,
                status: 'failed',
                finishedAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : '沉淀任务执行失败',
            });
            this.emitTaskEvent(taskId, {
                type: 'discussion.sediment.task.failed',
                data: { task: failedTask },
            });
        }
        finally {
            this.scheduleTaskCleanup(taskId);
        }
    }
    async updateSedimentMode(spaceId, mode) {
        const updated = await this.discussionSpaceModel
            .findOneAndUpdate({ id: spaceId }, { $set: { sedimentMode: mode } }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        return updated;
    }
    async generateSediment(input) {
        const space = await this.discussionSpaceModel.findOne({ id: input.spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${input.spaceId}`);
        }
        const threadFilter = { spaceId: input.spaceId };
        if (input.threadScope?.length) {
            threadFilter.id = { $in: input.threadScope };
        }
        const threads = (await this.discussionThreadModel
            .find(threadFilter)
            .sort({ depth: 1, createdAt: 1 })
            .lean()
            .exec());
        const threadIds = threads.map((thread) => thread.id);
        const messages = (await this.discussionMessageModel
            .find({ spaceId: input.spaceId, ...(threadIds.length ? { threadId: { $in: threadIds } } : {}) })
            .sort({ createdAt: 1 })
            .lean()
            .exec());
        const knowledgeEntries = await this.discussionKnowledgeService.listKnowledgeEntries(input.spaceId, {
            limit: 20,
        });
        const history = Array.isArray(space.sedimentHistory) ? space.sedimentHistory : [];
        const maxVersion = history.reduce((acc, item) => {
            const version = Number(item?.version || 0);
            return Number.isFinite(version) ? Math.max(acc, version) : acc;
        }, 0);
        const nextVersion = maxVersion + 1;
        const createdAt = new Date();
        const mode = input.mode || space.sedimentMode || discussion_space_schema_1.DiscussionSedimentMode.MANUAL;
        const trigger = input.trigger || 'manual';
        const title = String(input.title || '').trim() || `讨论沉淀 V${nextVersion}`;
        const existingOutline = (space.documentOutline || {});
        const structuredOutlineSections = normalizeStructuredOutlineSections(existingOutline);
        const hasStructuredSections = structuredOutlineSections.length > 0;
        const threadSummaries = threads.map((thread) => ({ id: thread.id, title: thread.title, depth: thread.depth }));
        const knowledgeSummaries = knowledgeEntries.map((item) => ({
            title: item.title,
            summary: item.summary,
            credibility: item.credibility,
            outlineSectionId: item.outlineSectionId,
        }));
        let content = '';
        let runtimeRunId;
        let runtimeSessionId;
        let runtimeAgentId;
        if (trigger === 'manual') {
            try {
                const runtimeResult = await this.generateSedimentByMeetingAssistant({
                    spaceId: input.spaceId,
                    projectId: space.projectId,
                    sedimentTitle: title,
                    mode,
                    threadScope: threadIds,
                    spaceTitle: space.title,
                    threads: threadSummaries,
                    messages,
                    knowledge: knowledgeSummaries,
                    outlineTitle: String(existingOutline.title || `${space.title} 大纲`),
                    outlineSections: structuredOutlineSections.map((section) => ({
                        id: section.id,
                        title: section.title,
                        description: section.description,
                        depth: section.depth,
                        order: section.order,
                    })),
                });
                content = runtimeResult.content;
                runtimeRunId = runtimeResult.runId;
                runtimeSessionId = runtimeResult.sessionId;
                runtimeAgentId = runtimeResult.agentId;
            }
            catch (error) {
                this.logger.warn(`Meeting assistant sediment failed, fallback to template: spaceId=${input.spaceId} reason=${error instanceof Error ? error.message : 'unknown'}`);
            }
        }
        if (!content) {
            content = hasStructuredSections
                ? buildOutlineDrivenSedimentMarkdown({
                    sedimentTitle: title,
                    spaceTitle: space.title,
                    outlineTitle: String(existingOutline.title || `${space.title} 大纲`),
                    outlineSections: structuredOutlineSections,
                    messages,
                    knowledge: knowledgeSummaries,
                })
                : buildSedimentMarkdown({
                    sedimentTitle: title,
                    spaceTitle: space.title,
                    threads: threadSummaries,
                    messages,
                    knowledge: knowledgeSummaries,
                });
        }
        const nextDocumentOutline = hasStructuredSections
            ? {
                ...existingOutline,
                updatedAt: createdAt,
                runId: runtimeRunId || existingOutline.runId,
                sessionId: runtimeSessionId || existingOutline.sessionId,
                agentId: runtimeAgentId || existingOutline.agentId,
            }
            : {
                version: Number(existingOutline.version || 1),
                title: existingOutline.title || `${space.title} 大纲`,
                sections: [
                    {
                        id: (0, crypto_1.randomUUID)(),
                        title: '讨论沉淀摘要',
                        order: 0,
                        depth: 0,
                        status: 'sufficient',
                        knowledgeCount: 0,
                        childSectionIds: [],
                    },
                    {
                        id: (0, crypto_1.randomUUID)(),
                        title: '讨论线梳理',
                        order: 1,
                        depth: 0,
                        status: 'sufficient',
                        knowledgeCount: 0,
                        childSectionIds: [],
                    },
                    {
                        id: (0, crypto_1.randomUUID)(),
                        title: '知识积累',
                        order: 2,
                        depth: 0,
                        status: 'draft',
                        knowledgeCount: knowledgeEntries.length,
                        childSectionIds: [],
                    },
                ],
                createdAt: existingOutline.createdAt || createdAt,
                updatedAt: createdAt,
                generatedBy: runtimeAgentId ? 'agent' : trigger === 'manual' ? 'hybrid' : 'human',
                runId: runtimeRunId,
                sessionId: runtimeSessionId,
                agentId: runtimeAgentId,
            };
        await this.discussionSpaceModel
            .updateOne({ id: input.spaceId }, {
            $set: {
                sedimentMode: mode,
                latestSedimentTitle: title,
                latestSedimentedDocument: content,
                documentOutline: nextDocumentOutline,
            },
            $push: {
                sedimentHistory: {
                    id: (0, crypto_1.randomUUID)(),
                    version: nextVersion,
                    title,
                    content,
                    threadScope: threadIds,
                    createdAt,
                    isDeleted: false,
                },
            },
        })
            .exec();
        return {
            mode,
            version: nextVersion,
            title,
            content,
            threadScope: threadIds,
            createdAt: createdAt.toISOString(),
        };
    }
    async getLatestSediment(spaceId) {
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            return null;
        }
        const activeHistory = this.listActiveSedimentHistory(space);
        if (!activeHistory.length) {
            return null;
        }
        const latest = [...activeHistory].sort((a, b) => {
            const left = new Date(a.createdAt || 0).getTime();
            const right = new Date(b.createdAt || 0).getTime();
            return right - left;
        })[0];
        const latestContent = String(latest.content || '').trim();
        if (!latestContent) {
            return null;
        }
        return {
            mode: space.sedimentMode || discussion_space_schema_1.DiscussionSedimentMode.MANUAL,
            version: Number(latest.version || 1),
            title: String(latest.title || space.latestSedimentTitle || DEFAULT_SEDIMENT_TITLE),
            content: latestContent,
            threadScope: Array.isArray(latest.threadScope) ? latest.threadScope : [],
            createdAt: latest.createdAt ? new Date(latest.createdAt).toISOString() : new Date().toISOString(),
        };
    }
    async listSedimentHistory(spaceId, limit = 20) {
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20;
        const history = this.listActiveSedimentHistory(space);
        const items = [...history]
            .sort((a, b) => {
            const left = new Date(a.createdAt || 0).getTime();
            const right = new Date(b.createdAt || 0).getTime();
            return right - left;
        })
            .slice(0, normalizedLimit)
            .map((item) => ({
            id: this.resolveSedimentHistoryId(item),
            version: item.version,
            title: String(item.title || DEFAULT_SEDIMENT_TITLE),
            content: item.content,
            threadScope: Array.isArray(item.threadScope) ? item.threadScope : [],
            createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        }));
        return {
            mode: space.sedimentMode || discussion_space_schema_1.DiscussionSedimentMode.MANUAL,
            items,
        };
    }
    async deleteSedimentHistory(spaceId, historyId, operatorId) {
        const normalizedOperatorId = String(operatorId || '').trim();
        if (!normalizedOperatorId) {
            throw new common_1.BadRequestException('删除沉淀历史需要提供 operatorId');
        }
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        if (space.creatorId !== normalizedOperatorId) {
            throw new common_1.ForbiddenException('仅讨论空间创建者可删除沉淀历史');
        }
        const rawHistory = Array.isArray(space.sedimentHistory) ? space.sedimentHistory : [];
        const now = new Date();
        let deletedHistoryId = '';
        const nextHistory = rawHistory.map((item) => {
            const normalized = item;
            const itemHistoryId = this.resolveSedimentHistoryId(normalized);
            if (this.isSedimentHistoryDeleted(normalized)) {
                return normalized;
            }
            if (itemHistoryId !== historyId) {
                return normalized;
            }
            deletedHistoryId = itemHistoryId;
            return {
                ...normalized,
                isDeleted: true,
                deletedAt: now,
                deletedBy: normalizedOperatorId,
            };
        });
        if (!deletedHistoryId) {
            throw new common_1.NotFoundException(`沉淀历史不存在: ${historyId}`);
        }
        const activeHistory = nextHistory
            .filter((item) => !this.isSedimentHistoryDeleted(item))
            .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        const latest = activeHistory[activeHistory.length - 1];
        await this.discussionSpaceModel
            .updateOne({ id: spaceId }, {
            $set: {
                sedimentHistory: nextHistory,
                latestSedimentedDocument: latest?.content || '',
                latestSedimentTitle: String(latest?.title || ''),
            },
        })
            .exec();
        return {
            deleted: true,
            historyId: deletedHistoryId,
        };
    }
};
exports.DiscussionSedimentService = DiscussionSedimentService;
exports.DiscussionSedimentService = DiscussionSedimentService = DiscussionSedimentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_space_schema_1.DiscussionSpace.name)),
    __param(1, (0, mongoose_1.InjectModel)(discussion_thread_schema_1.DiscussionThread.name)),
    __param(2, (0, mongoose_1.InjectModel)(discussion_message_schema_1.DiscussionMessage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        discussion_knowledge_service_1.DiscussionKnowledgeService])
], DiscussionSedimentService);
//# sourceMappingURL=discussion-sediment.service.js.map