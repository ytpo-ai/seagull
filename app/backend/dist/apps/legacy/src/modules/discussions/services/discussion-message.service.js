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
var DiscussionMessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionMessageService = exports.buildDataUpdateAnalysisFallbackContent = exports.buildBranchContextMessageContent = exports.resolveDiscussionMessageRole = exports.buildDiscussionAgentTaskId = exports.shouldUseDefaultReplyAgent = exports.parseEnrichmentPayloadFromReply = exports.parseSearchEvidenceFromReply = exports.looksLikeClarificationResponse = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const discussion_message_schema_1 = require("../../../shared/schemas/discussion-message.schema");
const discussion_participant_schema_1 = require("../../../shared/schemas/discussion-participant.schema");
const discussion_space_schema_1 = require("../../../shared/schemas/discussion-space.schema");
const discussion_knowledge_entry_schema_1 = require("../../../shared/schemas/discussion-knowledge-entry.schema");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const discussion_participant_service_1 = require("./discussion-participant.service");
const discussion_mention_dispatch_service_1 = require("./discussion-mention-dispatch.service");
const discussion_knowledge_service_1 = require("./discussion-knowledge.service");
const discussion_sediment_service_1 = require("./discussion-sediment.service");
const discussion_message_stream_service_1 = require("./discussion-message-stream.service");
const discussion_space_service_1 = require("./discussion-space.service");
const discussion_thread_service_1 = require("./discussion-thread.service");
const VALID_RUNTIME_ENTRY_TYPES = new Set([
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.FACT,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.OPINION,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.SOURCE_REFERENCE,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ANALYSIS,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ACTION_ITEM,
]);
const VALID_RUNTIME_CREDIBILITY = new Set([
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.HIGH,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.MEDIUM,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.LOW,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.UNVERIFIED,
]);
const looksLikeClarificationResponse = (value) => {
    const text = String(value || '').trim();
    if (!text) {
        return false;
    }
    const lower = text.toLowerCase();
    return (/\?|？/.test(text) ||
        lower.includes('请告诉我') ||
        lower.includes('你希望') ||
        lower.includes('你可以按') ||
        lower.includes('选一条') ||
        lower.includes('如果你愿意'));
};
exports.looksLikeClarificationResponse = looksLikeClarificationResponse;
const extractBalancedJson = (input) => {
    const text = String(input || '');
    const start = text.search(/[\[{]/);
    if (start < 0) {
        return null;
    }
    const opening = text[start];
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaping = false;
    for (let index = start; index < text.length; index += 1) {
        const ch = text[index];
        if (inString) {
            if (escaping) {
                escaping = false;
                continue;
            }
            if (ch === '\\') {
                escaping = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === opening) {
            depth += 1;
            continue;
        }
        if (ch === closing) {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, index + 1).trim();
            }
        }
    }
    return null;
};
const parseFirstJsonPayloadFromReply = (raw) => {
    const text = String(raw || '').trim();
    if (!text) {
        return null;
    }
    const candidates = [text];
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
        candidates.unshift(fenced[1].trim());
    }
    const firstJsonStart = text.search(/[\[{]/);
    if (firstJsonStart >= 0) {
        candidates.push(text.slice(firstJsonStart).trim());
        const balanced = extractBalancedJson(text.slice(firstJsonStart));
        if (balanced) {
            candidates.unshift(balanced);
        }
    }
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        }
        catch (_error) {
            continue;
        }
    }
    return null;
};
const parseSearchEvidenceFromReply = (raw) => {
    const payload = parseFirstJsonPayloadFromReply(raw);
    const evidenceList = [];
    const dedupe = new Set();
    const pushEvidence = (item) => {
        const sourceUrl = String(item.sourceUrl || item.url || item.link || '').trim();
        if (!sourceUrl) {
            return;
        }
        const sourceName = String(item.sourceName || item.title || item.domain || '').trim() || undefined;
        const snippet = String(item.snippet || item.summary || item.excerpt || '').trim() || undefined;
        const query = String(item.query || item.keyword || item.searchQuery || '').trim() || undefined;
        const fetchedAt = String(item.fetchedAt || item.crawledAt || '').trim() || undefined;
        const publishedAt = String(item.publishedAt || item.contentDate || '').trim() || undefined;
        const key = `${sourceUrl}::${sourceName || ''}`;
        if (dedupe.has(key)) {
            return;
        }
        dedupe.add(key);
        evidenceList.push({ sourceName, sourceUrl, snippet, query, fetchedAt, publishedAt });
    };
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const objectPayload = payload;
        const candidates = [
            objectPayload.searchEvidence,
            objectPayload.sources,
            objectPayload.references,
            objectPayload.evidence,
        ].find((item) => Array.isArray(item));
        if (Array.isArray(candidates)) {
            for (const item of candidates) {
                if (item && typeof item === 'object') {
                    pushEvidence(item);
                }
            }
        }
    }
    if (evidenceList.length === 0) {
        const rawEntries = (0, exports.parseEnrichmentPayloadFromReply)(raw);
        for (const item of rawEntries) {
            const sourceUrl = String(item.sourceUrl || '').trim();
            if (!sourceUrl) {
                continue;
            }
            pushEvidence({
                sourceUrl,
                sourceName: item.sourceName,
                snippet: item.summary || item.content,
            });
        }
    }
    return evidenceList.slice(0, 8);
};
exports.parseSearchEvidenceFromReply = parseSearchEvidenceFromReply;
const parseEnrichmentPayloadFromReply = (raw) => {
    const text = String(raw || '').trim();
    if (!text) {
        return [];
    }
    const candidates = [text];
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
        candidates.unshift(fenced[1].trim());
    }
    const firstJsonStart = text.search(/[\[{]/);
    if (firstJsonStart >= 0) {
        candidates.push(text.slice(firstJsonStart).trim());
        const balanced = extractBalancedJson(text.slice(firstJsonStart));
        if (balanced) {
            candidates.unshift(balanced);
        }
    }
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) {
                return parsed.filter((item) => item && typeof item === 'object');
            }
            if (parsed && typeof parsed === 'object') {
                const payload = parsed;
                const maybeEntries = [payload.entries, payload.knowledgeEntries, payload.items, payload.data].find((item) => Array.isArray(item));
                if (Array.isArray(maybeEntries)) {
                    return maybeEntries.filter((item) => item && typeof item === 'object');
                }
            }
        }
        catch (_error) {
            continue;
        }
    }
    return [];
};
exports.parseEnrichmentPayloadFromReply = parseEnrichmentPayloadFromReply;
const normalizeRuntimeKnowledgeEntries = (input) => {
    const normalizeStringList = (value) => {
        if (!Array.isArray(value)) {
            return undefined;
        }
        const list = value.map((item) => String(item || '').trim()).filter(Boolean);
        return list.length ? list : undefined;
    };
    return input.rawEntries
        .map((item) => {
        const title = String(item.title || item.name || '').trim();
        const content = String(item.content || item.detail || item.summary || '').trim();
        if (!title || !content) {
            return null;
        }
        const rawEntryType = String(item.entryType || '').trim();
        const entryType = VALID_RUNTIME_ENTRY_TYPES.has(rawEntryType)
            ? rawEntryType
            : (input.isStructuredData ? discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT : discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ANALYSIS);
        const rawCredibility = String(item.credibility || '').trim();
        const credibility = VALID_RUNTIME_CREDIBILITY.has(rawCredibility)
            ? rawCredibility
            : undefined;
        const sourceUrl = String(item.sourceUrl || '').trim() || undefined;
        const sourceName = String(item.sourceName || '').trim() || undefined;
        const contentDateRaw = String(item.contentDate || '').trim();
        const contentDate = contentDateRaw && !Number.isNaN(new Date(contentDateRaw).getTime()) ? contentDateRaw : undefined;
        const rawStructuredData = item.structuredData && typeof item.structuredData === 'object'
            ? item.structuredData
            : undefined;
        const compareTo = rawStructuredData?.compareTo && typeof rawStructuredData.compareTo === 'object'
            ? rawStructuredData.compareTo
            : undefined;
        const compareToValue = compareTo?.value;
        const compareToPeriod = String(compareTo?.period || '').trim();
        const compareToChangePercent = Number(compareTo?.changePercent);
        const structuredData = rawStructuredData
            ? {
                value: typeof rawStructuredData.value === 'string' || typeof rawStructuredData.value === 'number'
                    ? rawStructuredData.value
                    : undefined,
                unit: typeof rawStructuredData.unit === 'string' ? rawStructuredData.unit : undefined,
                measureDate: typeof rawStructuredData.measureDate === 'string' ? rawStructuredData.measureDate : undefined,
                compareTo: (typeof compareToValue === 'string' || typeof compareToValue === 'number') && compareToPeriod
                    ? {
                        value: compareToValue,
                        period: compareToPeriod,
                        changePercent: Number.isFinite(compareToChangePercent) ? compareToChangePercent : undefined,
                    }
                    : undefined,
            }
            : undefined;
        return {
            title,
            content,
            summary: String(item.summary || '').trim() || undefined,
            entryType,
            sourceUrl,
            sourceName,
            credibility,
            topicTags: normalizeStringList(item.topicTags) || [input.sectionTitle],
            domainTags: normalizeStringList(item.domainTags),
            keywordTags: normalizeStringList(item.keywordTags),
            contentDate,
            structuredData,
        };
    })
        .filter(Boolean);
};
const shouldUseDefaultReplyAgent = (content, defaultReplyAgentId) => {
    if (!defaultReplyAgentId) {
        return false;
    }
    const hasExplicitMention = /@([^\s@]+)/.test(content || '');
    return !hasExplicitMention;
};
exports.shouldUseDefaultReplyAgent = shouldUseDefaultReplyAgent;
const buildDiscussionAgentTaskId = (spaceId, threadId, participantId) => {
    return `discussion-${spaceId}-${threadId}-${participantId}`;
};
exports.buildDiscussionAgentTaskId = buildDiscussionAgentTaskId;
const resolveDiscussionMessageRole = (senderType) => {
    if (senderType === discussion_message_schema_1.DiscussionMessageSenderType.AI) {
        return 'assistant';
    }
    if (senderType === discussion_message_schema_1.DiscussionMessageSenderType.SYSTEM) {
        return 'system';
    }
    return 'user';
};
exports.resolveDiscussionMessageRole = resolveDiscussionMessageRole;
const buildBranchContextMessageContent = (input) => {
    const sourceThreadLabel = input.parentThreadTitle?.trim() || '原讨论线';
    const sourceMessageLabel = typeof input.sourceSequence === 'number' && Number.isFinite(input.sourceSequence)
        ? `#${input.sourceSequence}`
        : '该消息';
    const sourceContent = String(input.sourceContent || '').trim();
    return [
        `此分支由「${sourceThreadLabel}」的消息 ${sourceMessageLabel} 创建。`,
        '以下为分叉来源消息：',
        sourceContent || '（分叉来源消息为空）',
    ].join('\n\n');
};
exports.buildBranchContextMessageContent = buildBranchContextMessageContent;
const buildDataUpdateAnalysisFallbackContent = (input) => {
    const sourceName = String(input.sourceName || '').trim() || '数据源';
    const dataCategory = String(input.dataCategory || '').trim() || 'general';
    const collectedAtText = input.collectedAt ? new Date(input.collectedAt).toISOString() : new Date().toISOString();
    const changePercent = Number(input.changePercent);
    const changeText = Number.isFinite(changePercent) ? `${changePercent.toFixed(2)}%` : '未知';
    const currentJson = JSON.stringify(input.currentData || {}, null, 2);
    const previousJson = JSON.stringify(input.previousData || {}, null, 2);
    return [
        `数据更新提醒：${sourceName} (${dataCategory})`,
        `采集时间：${collectedAtText}`,
        `变化幅度：${changeText}`,
        '',
        '当前数据：',
        '```json',
        currentJson,
        '```',
        '',
        '历史基线：',
        '```json',
        previousJson,
        '```',
        '',
        '建议关注：',
        '- 确认该变化是一次性波动还是持续趋势。',
        '- 与同周期其它指标交叉验证，排除单一来源噪音。',
        '- 若变化持续，建议补充背景事件并更新章节结论。',
    ].join('\n');
};
exports.buildDataUpdateAnalysisFallbackContent = buildDataUpdateAnalysisFallbackContent;
let DiscussionMessageService = DiscussionMessageService_1 = class DiscussionMessageService {
    constructor(discussionMessageModel, agentClientService, discussionThreadService, discussionParticipantService, discussionMentionDispatchService, discussionKnowledgeService, discussionSedimentService, discussionSpaceService, discussionMessageStreamService) {
        this.discussionMessageModel = discussionMessageModel;
        this.agentClientService = agentClientService;
        this.discussionThreadService = discussionThreadService;
        this.discussionParticipantService = discussionParticipantService;
        this.discussionMentionDispatchService = discussionMentionDispatchService;
        this.discussionKnowledgeService = discussionKnowledgeService;
        this.discussionSedimentService = discussionSedimentService;
        this.discussionSpaceService = discussionSpaceService;
        this.discussionMessageStreamService = discussionMessageStreamService;
        this.logger = new common_1.Logger(DiscussionMessageService_1.name);
    }
    sanitizeDataReferences(dataReferences) {
        if (!Array.isArray(dataReferences) || dataReferences.length === 0) {
            return [];
        }
        return dataReferences
            .map((item) => {
            const dataRecordId = String(item?.dataRecordId || '').trim();
            const dataSourceName = String(item?.dataSourceName || '').trim();
            const dataPreview = String(item?.dataPreview || '').trim();
            const collectedAt = new Date(item?.collectedAt || '');
            if (!dataRecordId || !dataSourceName || !dataPreview || Number.isNaN(collectedAt.getTime())) {
                return null;
            }
            return {
                dataRecordId,
                dataSourceName,
                dataPreview: dataPreview.slice(0, 300),
                collectedAt,
            };
        })
            .filter((item) => Boolean(item));
    }
    async createSystemMessage(input) {
        const latest = await this.discussionMessageModel
            .findOne({ spaceId: input.spaceId, threadId: input.threadId })
            .sort({ sequence: -1 })
            .lean()
            .exec();
        const nextSequence = (latest?.sequence || 0) + 1;
        const created = await this.discussionMessageModel.create({
            spaceId: input.spaceId,
            threadId: input.threadId,
            participantId: 'system',
            senderType: discussion_message_schema_1.DiscussionMessageSenderType.SYSTEM,
            content: input.content,
            messageType: input.messageType || discussion_message_schema_1.DiscussionMessageType.TEXT,
            sequence: nextSequence,
            mentions: [],
            branchSuggestions: [],
            crossReferences: [],
            dataReferences: [],
            knowledgeEntryIds: [],
            metadata: input.metadata,
        });
        await Promise.all([
            this.discussionThreadService.incrementSystemMessageCount(input.spaceId, input.threadId),
            this.discussionSpaceService.incrementStatistics(input.spaceId, { totalMessages: 1 }),
        ]);
        this.discussionMessageStreamService.emitMessageCreated(input.spaceId, input.threadId, created);
        return created;
    }
    buildKnowledgeFingerprint(input) {
        const title = String(input.title || '').trim().toLowerCase();
        const summary = String(input.summary || '').trim().toLowerCase();
        const content = String(input.content || '').trim().toLowerCase();
        return `${title}|${summary.slice(0, 80)}|${content.slice(0, 80)}`;
    }
    async resolveSectionRuntimeContext(input) {
        const sectionId = String(input.outlineSectionId || '').trim();
        if (!sectionId) {
            return null;
        }
        const space = await this.discussionSpaceService.getSpaceById(input.spaceId);
        const outlineSections = Array.isArray(space.documentOutline?.sections) ? space.documentOutline.sections : [];
        const sortedSections = [...outlineSections].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        const section = sortedSections.find((item) => String(item.id || '').trim() === sectionId);
        if (!section) {
            return null;
        }
        const sectionEntries = await this.discussionKnowledgeService.listKnowledgeEntries(input.spaceId, {
            outlineSectionId: sectionId,
            limit: 8,
        });
        const sectionKnowledgeSummary = sectionEntries.length
            ? sectionEntries
                .slice(0, 8)
                .map((item, index) => `${index + 1}. ${item.title}${item.summary ? ` - ${item.summary}` : ''}`)
                .join('\n')
            : '（暂无已沉淀条目）';
        const outlineSummary = sortedSections.length
            ? sortedSections
                .slice(0, 30)
                .map((item) => `${'  '.repeat(Math.max(0, Number(item.depth || 0)))}- ${item.title}`)
                .join('\n')
            : '（暂无大纲）';
        return {
            sectionId,
            sectionTitle: section.title,
            sectionDescription: section.description,
            isStructuredData: section.metadata?.isStructuredData,
            sectionKnowledgeSummary,
            outlineSummary,
        };
    }
    async createDataUpdateAnalysisMessage(spaceId, dto) {
        const space = await this.discussionSpaceService.getSpaceById(spaceId);
        if (space.status === discussion_space_schema_1.DiscussionSpaceStatus.ARCHIVED) {
            throw new common_1.ConflictException('讨论空间已归档，当前为只读状态，无法写入系统分析消息');
        }
        const threadId = String(dto.threadId || space.rootThreadId || '').trim();
        if (!threadId) {
            throw new common_1.NotFoundException('讨论空间缺少可用讨论线，无法写入数据分析消息');
        }
        await this.discussionThreadService.getThreadById(spaceId, threadId);
        const content = (0, exports.buildDataUpdateAnalysisFallbackContent)({
            sourceName: dto.sourceName,
            dataCategory: dto.dataCategory,
            collectedAt: dto.collectedAt,
            changePercent: dto.changePercent,
            currentData: dto.currentData,
            previousData: dto.previousData,
        });
        const created = await this.createSystemMessage({
            spaceId,
            threadId,
            content,
            metadata: {
                autoAnalysisOnDataUpdate: true,
                dataSourceName: dto.sourceName,
                outlineSectionId: dto.outlineSectionId,
                changePercent: dto.changePercent,
            },
        });
        return {
            created: true,
            messageId: created.id,
            threadId,
        };
    }
    async buildMentionRuntimeTask(input) {
        const compactUserPrompt = String(input.userPrompt || '').trim();
        const taskTitle = `Discussion mention reply | ${input.spaceTitle} / ${input.threadTitle}`;
        const taskDescription = [
            `你是讨论空间中的角色「${input.participant.displayName}」。`,
            `当前你被用户@提及，请基于对话上下文给出直接、可执行的回复。`,
            input.participant.expertise ? `角色领域：${input.participant.expertise}` : '',
            `讨论空间：${input.spaceTitle}`,
            `讨论线：${input.threadTitle}`,
            `用户最新消息：${compactUserPrompt || '（空）'}`,
            input.knowledgeHints ? `可复用知识：\n${input.knowledgeHints}` : '',
            input.sectionContext
                ? [
                    `当前是章节协作模式，请围绕章节「${input.sectionContext.sectionTitle}」持续推进。`,
                    input.sectionContext.sectionDescription ? `章节说明：${input.sectionContext.sectionDescription}` : '',
                    '章节已有知识摘要：',
                    input.sectionContext.sectionKnowledgeSummary,
                    '当前大纲框架：',
                    input.sectionContext.outlineSummary,
                    '请优先调用可用搜索工具（如 web.search/web.fetch）检索至少 2 个独立来源，再给出结论。',
                    '如果产出结构化知识条目，请使用 JSON code block 返回，格式优先为 {"searchEvidence":[...],"entries":[...]}。',
                    'searchEvidence 每条建议包含：sourceName/sourceUrl/snippet/query/fetchedAt。',
                    '若关键信息不足，可先提出 1-2 个澄清问题。',
                ]
                    .filter(Boolean)
                    .join('\n')
                : '',
            '输出要求：聚焦当前问题，优先给出下一步建议；信息不足时可先澄清，再给出可执行结论。',
        ]
            .filter(Boolean)
            .join('\n\n');
        const messages = input.recentMessages.map((item) => ({
            role: (0, exports.resolveDiscussionMessageRole)(item.senderType),
            content: String(item.content || ''),
            timestamp: item?.createdAt ? new Date(item.createdAt) : new Date(),
            metadata: {
                discussionMessageId: item.id,
                discussionParticipantId: item.participantId,
            },
        }));
        return {
            id: (0, exports.buildDiscussionAgentTaskId)(input.spaceId, input.threadId, input.participant.id),
            title: taskTitle,
            description: taskDescription,
            type: 'discussion_reply',
            priority: 'medium',
            status: 'pending',
            assignedAgents: input.participant.agentId ? [input.participant.agentId] : [],
            teamId: input.spaceId,
            messages,
        };
    }
    async generateAiMentionReply(input) {
        const participant = input.participant;
        const agentId = String(participant.agentId || '').trim();
        if (!agentId) {
            const fallback = [
                `@${participant.displayName} 已收到召唤。`,
                participant.expertise ? `结合我的领域 (${participant.expertise})，建议先明确目标和时间窗口。` : '建议先明确目标和时间窗口，再拆解执行步骤。',
                input.knowledgeHints ? `可复用知识:\n${input.knowledgeHints}` : '当前知识库暂无高相关条目，建议先发起一次针对性检索。',
            ].join('\n\n');
            return { content: fallback };
        }
        const task = await this.buildMentionRuntimeTask({
            spaceId: input.spaceId,
            threadId: input.threadId,
            participant,
            spaceTitle: input.spaceTitle,
            threadTitle: input.threadTitle,
            userPrompt: input.userPrompt,
            recentMessages: input.recentMessages,
            knowledgeHints: input.knowledgeHints,
            sectionContext: input.sectionContext,
        });
        const agentSessionId = (0, exports.buildDiscussionAgentTaskId)(input.spaceId, input.threadId, participant.id);
        const executionContext = {
            executionMode: 'chat',
            source: 'discussion_mention_runtime',
            agentSessionId,
            collaborationContext: {
                scenarioMode: 'discussion',
                responseDirective: 'text',
                collaborationMode: 'discussion',
                discussionSpaceId: input.spaceId,
                discussionThreadId: input.threadId,
                participantId: participant.id,
                participantName: participant.displayName,
                agentSessionId,
                sessionId: agentSessionId,
                outlineSectionId: input.sectionContext?.sectionId,
            },
            requestMeta: {
                source: 'discussion-message-service',
            },
        };
        const result = await this.agentClientService.executeTaskDetailed(agentId, task, executionContext);
        const reply = String(result.response || '').trim();
        return {
            content: reply ? `@${participant.displayName}\n\n${reply}` : `@${participant.displayName}\n\n（已执行 runtime，但未返回可展示内容）`,
            runId: result.runId,
            sessionId: result.sessionId,
        };
    }
    async sendMessage(spaceId, threadId, dto) {
        const senderType = dto.senderType || discussion_message_schema_1.DiscussionMessageSenderType.USER;
        const thread = await this.discussionThreadService.getThreadById(spaceId, threadId);
        await this.discussionParticipantService.getParticipantById(spaceId, dto.participantId);
        const space = await this.discussionSpaceService.getSpaceById(spaceId);
        if (space.status === discussion_space_schema_1.DiscussionSpaceStatus.ARCHIVED) {
            throw new common_1.ConflictException('讨论空间已归档，当前为只读状态，无法发送消息');
        }
        const latest = await this.discussionMessageModel.findOne({ spaceId, threadId }).sort({ sequence: -1 }).lean().exec();
        const nextSequence = (latest?.sequence || 0) + 1;
        let mentions = await this.discussionParticipantService.resolveMentions(spaceId, dto.content);
        if (senderType === discussion_message_schema_1.DiscussionMessageSenderType.USER && (0, exports.shouldUseDefaultReplyAgent)(dto.content, space.settings?.defaultReplyAgentId)) {
            const fallbackAgentId = space.settings?.defaultReplyAgentId || '';
            const [defaultReplyParticipant] = await this.discussionParticipantService.getParticipantsByIds(spaceId, [fallbackAgentId]);
            if (defaultReplyParticipant?.type === discussion_participant_schema_1.DiscussionParticipantType.AI_AGENT) {
                const mentionExists = mentions.some((mention) => mention.participantId === defaultReplyParticipant.id);
                if (!mentionExists) {
                    mentions = [
                        ...mentions,
                        {
                            participantId: defaultReplyParticipant.id,
                            displayName: defaultReplyParticipant.displayName,
                            offset: -1,
                        },
                    ];
                }
            }
        }
        const userMessage = await this.discussionMessageModel.create({
            spaceId,
            threadId,
            participantId: dto.participantId,
            senderType,
            content: dto.content,
            messageType: dto.messageType || discussion_message_schema_1.DiscussionMessageType.TEXT,
            sequence: nextSequence,
            mentions,
            branchSuggestions: [],
            crossReferences: [],
            dataReferences: this.sanitizeDataReferences(dto.dataReferences),
            knowledgeEntryIds: [],
            metadata: dto.metadata,
        });
        this.discussionMessageStreamService.emitMessageCreated(spaceId, threadId, userMessage);
        const aiMessages = [];
        let notifiedHumanParticipantIds = [];
        if (mentions.length && senderType === discussion_message_schema_1.DiscussionMessageSenderType.USER) {
            const mentionTargets = await this.discussionParticipantService.getParticipantsByIds(spaceId, mentions.map((mention) => mention.participantId));
            const dispatch = await this.discussionMentionDispatchService.dispatchMentions({
                spaceId,
                threadId,
                messageId: userMessage.id,
                mentionTargets,
                senderParticipantId: dto.participantId,
            });
            notifiedHumanParticipantIds = dispatch.notifiedHumanParticipantIds;
            const aiParticipants = dispatch.aiParticipants.filter((item) => item.type === discussion_participant_schema_1.DiscussionParticipantType.AI_AGENT);
            if (aiParticipants.length) {
                void this.generateAiMessagesAsync({
                    spaceId,
                    threadId,
                    outlineSectionId: thread.outlineSectionId,
                    threadTitle: thread.title,
                    spaceTitle: space.title,
                    userPrompt: dto.content,
                    aiParticipants,
                    realtimeSedimentMode: space.sedimentMode,
                });
            }
        }
        await Promise.all([
            this.discussionThreadService.incrementMessageCount(spaceId, threadId, dto.participantId),
            this.discussionParticipantService.incrementMessageCount(spaceId, dto.participantId),
            this.discussionSpaceService.incrementStatistics(spaceId, { totalMessages: 1 }),
        ]);
        let realtimeSedimentUpdated = false;
        if (space.sedimentMode === discussion_space_schema_1.DiscussionSedimentMode.REALTIME) {
            realtimeSedimentUpdated = true;
            void this.generateRealtimeSedimentAsync(spaceId);
        }
        return {
            userMessage,
            aiMessages,
            notifiedHumanParticipantIds,
            generatedKnowledgeEntryIds: [],
            realtimeSedimentUpdated,
        };
    }
    async generateAiMessagesAsync(input) {
        const sectionContext = await this.resolveSectionRuntimeContext({
            spaceId: input.spaceId,
            outlineSectionId: input.outlineSectionId,
        });
        for (const aiParticipant of input.aiParticipants) {
            this.discussionMessageStreamService.emitAgentExecutionStatus(input.spaceId, input.threadId, {
                participantId: aiParticipant.id,
                agentId: aiParticipant.agentId,
                status: 'running',
            });
            try {
                const runtimeContextMessages = await this.discussionMessageModel
                    .find({ spaceId: input.spaceId, threadId: input.threadId })
                    .sort({ sequence: -1 })
                    .limit(30)
                    .lean()
                    .exec();
                const recentMessages = [...runtimeContextMessages].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                const reusableKnowledge = await this.discussionKnowledgeService.getReusableKnowledge(input.spaceId, {
                    topicTags: aiParticipant.expertiseTags,
                    limit: 3,
                });
                const knowledgeHints = reusableKnowledge.map((item) => `- ${item.title}: ${item.summary}`).join('\n');
                let responseContent = '';
                let runtimeRunId;
                let runtimeSessionId;
                try {
                    const runtimeReply = await this.generateAiMentionReply({
                        spaceId: input.spaceId,
                        threadId: input.threadId,
                        participant: aiParticipant,
                        spaceTitle: input.spaceTitle,
                        threadTitle: input.threadTitle,
                        userPrompt: input.userPrompt,
                        recentMessages,
                        knowledgeHints,
                        sectionContext: sectionContext
                            ? {
                                sectionId: sectionContext.sectionId,
                                sectionTitle: sectionContext.sectionTitle,
                                sectionDescription: sectionContext.sectionDescription,
                                sectionKnowledgeSummary: sectionContext.sectionKnowledgeSummary,
                                outlineSummary: sectionContext.outlineSummary,
                            }
                            : undefined,
                    });
                    responseContent = runtimeReply.content;
                    runtimeRunId = runtimeReply.runId;
                    runtimeSessionId = runtimeReply.sessionId;
                }
                catch (error) {
                    const reason = error instanceof Error ? error.message : String(error || 'unknown');
                    this.logger.error(`Runtime mention execution failed: spaceId=${input.spaceId} threadId=${input.threadId} participantId=${aiParticipant.id} reason=${reason}`);
                    responseContent = [
                        `@${aiParticipant.displayName} runtime 执行失败。`,
                        `错误信息：${reason}`,
                        '请稍后重试，或检查该 Agent 的可用状态与模型配置。',
                    ].join('\n\n');
                }
                const searchEvidence = (0, exports.parseSearchEvidenceFromReply)(responseContent);
                const generatedEntries = sectionContext
                    ? normalizeRuntimeKnowledgeEntries({
                        rawEntries: (0, exports.parseEnrichmentPayloadFromReply)(responseContent),
                        sectionTitle: sectionContext.sectionTitle,
                        isStructuredData: sectionContext.isStructuredData,
                    })
                    : [];
                const existingSectionEntries = sectionContext
                    ? await this.discussionKnowledgeService.listKnowledgeEntries(input.spaceId, {
                        outlineSectionId: sectionContext.sectionId,
                        limit: 50,
                    })
                    : [];
                const selectedGeneratedEntries = [];
                if (sectionContext && generatedEntries.length > 0) {
                    const fingerprintSet = new Set(existingSectionEntries
                        .map((item) => this.buildKnowledgeFingerprint({
                        title: item.title,
                        summary: item.summary,
                        content: item.content,
                    }))
                        .filter(Boolean));
                    for (const entry of generatedEntries) {
                        if ((0, exports.looksLikeClarificationResponse)(entry.content)) {
                            continue;
                        }
                        const fingerprint = this.buildKnowledgeFingerprint(entry);
                        if (!fingerprint || fingerprintSet.has(fingerprint)) {
                            continue;
                        }
                        fingerprintSet.add(fingerprint);
                        selectedGeneratedEntries.push(entry);
                        if (selectedGeneratedEntries.length >= 8) {
                            break;
                        }
                    }
                }
                const latest = await this.discussionMessageModel
                    .findOne({ spaceId: input.spaceId, threadId: input.threadId })
                    .sort({ sequence: -1 })
                    .lean()
                    .exec();
                const aiSequence = (latest?.sequence || 0) + 1;
                const aiMessage = await this.discussionMessageModel.create({
                    spaceId: input.spaceId,
                    threadId: input.threadId,
                    participantId: aiParticipant.id,
                    senderType: discussion_message_schema_1.DiscussionMessageSenderType.AI,
                    content: responseContent,
                    messageType: discussion_message_schema_1.DiscussionMessageType.TEXT,
                    sequence: aiSequence,
                    mentions: [],
                    branchSuggestions: [],
                    crossReferences: [],
                    dataReferences: [],
                    knowledgeEntryIds: reusableKnowledge.map((item) => item.id),
                    metadata: {
                        agentId: aiParticipant.agentId,
                        knowledgeHits: reusableKnowledge.length,
                        mentionTriggered: true,
                        runtimeTriggered: true,
                        runtimeRunId,
                        runtimeSessionId,
                        outlineSectionId: sectionContext?.sectionId,
                        searchEvidenceCount: searchEvidence.length,
                        searchEvidence,
                    },
                });
                const generatedKnowledgeEntryIds = [];
                for (const generatedEntry of selectedGeneratedEntries) {
                    const created = await this.discussionKnowledgeService.createKnowledgeEntry(input.spaceId, {
                        participantId: aiParticipant.id,
                        threadId: input.threadId,
                        messageId: aiMessage.id,
                        title: generatedEntry.title,
                        content: generatedEntry.content,
                        summary: generatedEntry.summary,
                        outlineSectionId: sectionContext?.sectionId,
                        entryType: generatedEntry.entryType,
                        structuredData: generatedEntry.structuredData,
                        metadata: {
                            isStructuredData: generatedEntry.entryType === discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT || Boolean(sectionContext?.isStructuredData),
                        },
                        sourceUrl: generatedEntry.sourceUrl,
                        sourceType: generatedEntry.sourceUrl ? discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.WEB_SEARCH : discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.DISCUSSION_DERIVED,
                        sourceName: generatedEntry.sourceName || 'outline-section-chat-runtime',
                        domainTags: generatedEntry.domainTags,
                        topicTags: generatedEntry.topicTags || (sectionContext ? [sectionContext.sectionTitle] : []),
                        keywordTags: generatedEntry.keywordTags,
                        credibility: generatedEntry.credibility,
                        contentDate: generatedEntry.contentDate,
                    });
                    generatedKnowledgeEntryIds.push(created.id);
                }
                if (reusableKnowledge.length || generatedKnowledgeEntryIds.length) {
                    await this.discussionKnowledgeService.linkKnowledgeToMessage(input.spaceId, aiMessage.id, [
                        ...reusableKnowledge.map((item) => item.id),
                        ...generatedKnowledgeEntryIds,
                    ]);
                }
                if (generatedKnowledgeEntryIds.length || sectionContext?.sectionId || searchEvidence.length) {
                    const mergedMetadata = {
                        ...(aiMessage.metadata || {}),
                        generatedKnowledgeEntryIds,
                        outlineSectionId: sectionContext?.sectionId,
                        searchEvidenceCount: searchEvidence.length,
                        searchEvidence,
                    };
                    await this.discussionMessageModel
                        .updateOne({ id: aiMessage.id, spaceId: input.spaceId }, {
                        $set: {
                            metadata: mergedMetadata,
                        },
                    })
                        .exec();
                    aiMessage.metadata = mergedMetadata;
                }
                if (generatedKnowledgeEntryIds.length) {
                    aiMessage.knowledgeEntryIds = [
                        ...(aiMessage.knowledgeEntryIds || []),
                        ...generatedKnowledgeEntryIds,
                    ];
                }
                await Promise.all([
                    this.discussionThreadService.incrementMessageCount(input.spaceId, input.threadId, aiParticipant.id),
                    this.discussionParticipantService.incrementMessageCount(input.spaceId, aiParticipant.id),
                    this.discussionSpaceService.incrementStatistics(input.spaceId, { totalMessages: 1 }),
                ]);
                this.discussionMessageStreamService.emitMessageCreated(input.spaceId, input.threadId, aiMessage);
                this.discussionMessageStreamService.emitAgentExecutionStatus(input.spaceId, input.threadId, {
                    participantId: aiParticipant.id,
                    agentId: aiParticipant.agentId,
                    status: 'completed',
                });
            }
            catch (error) {
                this.logger.error(`Async AI mention message generation failed: spaceId=${input.spaceId} threadId=${input.threadId} participantId=${aiParticipant.id} reason=${error instanceof Error ? error.message : 'unknown'}`);
                this.discussionMessageStreamService.emitAgentExecutionStatus(input.spaceId, input.threadId, {
                    participantId: aiParticipant.id,
                    agentId: aiParticipant.agentId,
                    status: 'failed',
                    reason: error instanceof Error ? error.message : 'unknown',
                });
            }
        }
        if (input.realtimeSedimentMode === discussion_space_schema_1.DiscussionSedimentMode.REALTIME) {
            await this.generateRealtimeSedimentAsync(input.spaceId);
        }
    }
    async generateRealtimeSedimentAsync(spaceId) {
        try {
            await this.discussionSedimentService.generateSediment({
                spaceId,
                mode: discussion_space_schema_1.DiscussionSedimentMode.REALTIME,
                trigger: 'realtime_auto',
            });
        }
        catch (error) {
            this.logger.warn(`Realtime sediment generation failed: spaceId=${spaceId} reason=${error instanceof Error ? error.message : 'unknown'}`);
        }
    }
    async listMessages(spaceId, threadId, limit = 100) {
        await this.discussionThreadService.getThreadById(spaceId, threadId);
        return this.discussionMessageModel
            .find({ spaceId, threadId })
            .sort({ sequence: 1 })
            .limit(Math.max(1, Math.min(limit, 500)))
            .lean()
            .exec();
    }
    async getMessageById(spaceId, threadId, messageId) {
        const message = await this.discussionMessageModel.findOne({ id: messageId, spaceId, threadId }).lean().exec();
        if (!message) {
            throw new common_1.NotFoundException(`消息不存在: ${messageId}`);
        }
        return message;
    }
    async createBranchContextMessage(input) {
        const latest = await this.discussionMessageModel.findOne({ spaceId: input.spaceId, threadId: input.threadId }).sort({ sequence: -1 }).lean().exec();
        const nextSequence = (latest?.sequence || 0) + 1;
        const content = (0, exports.buildBranchContextMessageContent)({
            parentThreadTitle: input.parentThreadTitle,
            sourceSequence: input.sourceMessage.sequence,
            sourceContent: input.sourceMessage.content,
        });
        const created = await this.discussionMessageModel.create({
            spaceId: input.spaceId,
            threadId: input.threadId,
            participantId: 'system',
            senderType: discussion_message_schema_1.DiscussionMessageSenderType.SYSTEM,
            content,
            messageType: discussion_message_schema_1.DiscussionMessageType.BRANCH_CONTEXT,
            sequence: nextSequence,
            mentions: [],
            branchSuggestions: [],
            crossReferences: [],
            dataReferences: [],
            knowledgeEntryIds: [],
        });
        await Promise.all([
            this.discussionThreadService.incrementSystemMessageCount(input.spaceId, input.threadId),
            this.discussionSpaceService.incrementStatistics(input.spaceId, { totalMessages: 1 }),
        ]);
        return created;
    }
};
exports.DiscussionMessageService = DiscussionMessageService;
exports.DiscussionMessageService = DiscussionMessageService = DiscussionMessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_message_schema_1.DiscussionMessage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        discussion_thread_service_1.DiscussionThreadService,
        discussion_participant_service_1.DiscussionParticipantService,
        discussion_mention_dispatch_service_1.DiscussionMentionDispatchService,
        discussion_knowledge_service_1.DiscussionKnowledgeService,
        discussion_sediment_service_1.DiscussionSedimentService,
        discussion_space_service_1.DiscussionSpaceService,
        discussion_message_stream_service_1.DiscussionMessageStreamService])
], DiscussionMessageService);
//# sourceMappingURL=discussion-message.service.js.map