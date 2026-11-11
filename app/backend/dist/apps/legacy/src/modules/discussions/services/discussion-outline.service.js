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
var DiscussionOutlineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionOutlineService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const rxjs_1 = require("rxjs");
const discussion_space_schema_1 = require("../../../shared/schemas/discussion-space.schema");
const discussion_knowledge_entry_schema_1 = require("../../../shared/schemas/discussion-knowledge-entry.schema");
const discussion_participant_schema_1 = require("../../../shared/schemas/discussion-participant.schema");
const discussion_knowledge_service_1 = require("./discussion-knowledge.service");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const OUTLINE_TASK_RETENTION_MS = 30 * 60 * 1000;
const INDUSTRY_RESEARCH_ROLE_CODE = 'industry-research';
const VALID_KNOWLEDGE_ENTRY_TYPES = new Set([
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.FACT,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.OPINION,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.SOURCE_REFERENCE,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ANALYSIS,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ACTION_ITEM,
]);
const VALID_KNOWLEDGE_CREDIBILITY = new Set([
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.HIGH,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.MEDIUM,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.LOW,
    discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.UNVERIFIED,
]);
let DiscussionOutlineService = DiscussionOutlineService_1 = class DiscussionOutlineService {
    constructor(discussionSpaceModel, discussionKnowledgeEntryModel, discussionParticipantModel, discussionKnowledgeService, agentClientService) {
        this.discussionSpaceModel = discussionSpaceModel;
        this.discussionKnowledgeEntryModel = discussionKnowledgeEntryModel;
        this.discussionParticipantModel = discussionParticipantModel;
        this.discussionKnowledgeService = discussionKnowledgeService;
        this.agentClientService = agentClientService;
        this.logger = new common_1.Logger(DiscussionOutlineService_1.name);
        this.outlineTaskStore = new Map();
        this.outlineTaskChannels = new Map();
    }
    buildTaskId(spaceId) {
        return `discussion-outline-${spaceId}-${(0, crypto_1.randomUUID)()}`;
    }
    touchTask(task) {
        const next = {
            ...task,
            updatedAt: new Date().toISOString(),
        };
        this.outlineTaskStore.set(task.taskId, next);
        return next;
    }
    emitTaskEvent(taskId, payload) {
        const channels = this.outlineTaskChannels.get(taskId);
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
            this.outlineTaskStore.delete(taskId);
            this.outlineTaskChannels.delete(taskId);
        }, OUTLINE_TASK_RETENTION_MS);
    }
    extractAgentCandidateValue(candidate, key) {
        const value = candidate[key];
        return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }
    isOutlineResearchAgent(candidate) {
        const roleCode = this.extractAgentCandidateValue(candidate, 'roleCode');
        const agentType = this.extractAgentCandidateValue(candidate, 'agentType');
        const roleName = this.extractAgentCandidateValue(candidate, 'roleName');
        const name = this.extractAgentCandidateValue(candidate, 'name');
        const description = this.extractAgentCandidateValue(candidate, 'description');
        if (roleCode === INDUSTRY_RESEARCH_ROLE_CODE) {
            return true;
        }
        if (agentType === 'industry-research' || agentType === 'research') {
            return true;
        }
        const labels = `${roleName} ${name} ${description}`;
        return labels.includes('行业研究') || labels.includes('industry research') || labels.includes('行业观察');
    }
    isOutlineWebResearchCapable(candidate) {
        const tools = Array.isArray(candidate.tools) ? candidate.tools : [];
        const toolLabels = tools.map((item) => String(item || '').toLowerCase()).join(' ');
        const hasWebResearchTool = toolLabels.includes('web.search') ||
            toolLabels.includes('web-search') ||
            toolLabels.includes('web.fetch') ||
            toolLabels.includes('content.extract');
        if (!hasWebResearchTool) {
            return false;
        }
        const name = this.extractAgentCandidateValue(candidate, 'name');
        const description = this.extractAgentCandidateValue(candidate, 'description');
        const systemPrompt = this.extractAgentCandidateValue(candidate, 'systemPrompt');
        const labels = `${name} ${description} ${systemPrompt}`;
        const excludes = ['cto', '研发', 'requirement', '编排', 'orchestration', 'workflow'];
        if (excludes.some((keyword) => labels.includes(keyword))) {
            return false;
        }
        const includes = ['研究', '行业', '能源', 'market', 'radar', 'analyst', 'observation'];
        return includes.some((keyword) => labels.includes(keyword));
    }
    async resolveOutlineAgentId(space, options) {
        const requireResearchRole = Boolean(options?.requireResearchRole);
        let defaultActiveAgentId = null;
        const defaultReplyParticipantId = String(space.settings?.defaultReplyAgentId || '').trim();
        if (defaultReplyParticipantId) {
            const participant = await this.discussionParticipantModel
                .findOne({
                id: defaultReplyParticipantId,
                spaceId: space.id,
                type: discussion_participant_schema_1.DiscussionParticipantType.AI_AGENT,
            })
                .lean()
                .exec();
            const mappedAgentId = String(participant?.agentId || '').trim();
            const candidateAgentId = mappedAgentId || defaultReplyParticipantId;
            const matched = await this.agentClientService.getAgent(candidateAgentId);
            if (matched?.id && matched.isActive) {
                const matchedId = String(matched.id);
                defaultActiveAgentId = matchedId;
                if (!requireResearchRole || this.isOutlineResearchAgent(matched)) {
                    return matchedId;
                }
            }
        }
        const projectAgents = (await this.agentClientService.getActiveAgents(space.projectId ? { projectId: space.projectId } : undefined)) || [];
        const projectMatch = projectAgents.find((item) => this.isOutlineResearchAgent(item));
        if (projectMatch?.id) {
            return String(projectMatch.id);
        }
        const projectWebResearchMatch = projectAgents.find((item) => this.isOutlineWebResearchCapable(item));
        if (projectWebResearchMatch?.id) {
            return String(projectWebResearchMatch.id);
        }
        if (space.projectId) {
            const globalAgents = (await this.agentClientService.getActiveAgents()) || [];
            const globalMatch = globalAgents.find((item) => this.isOutlineResearchAgent(item));
            if (globalMatch?.id) {
                return String(globalMatch.id);
            }
            const globalWebResearchMatch = globalAgents.find((item) => this.isOutlineWebResearchCapable(item));
            if (globalWebResearchMatch?.id) {
                return String(globalWebResearchMatch.id);
            }
        }
        if (defaultActiveAgentId) {
            return defaultActiveAgentId;
        }
        return null;
    }
    buildDefaultOutlineSections(context) {
        return [
            this.buildSection({ title: `${context} 发展脉络`, order: 0, depth: 0, metadata: { isStructuredData: false } }),
            this.buildSection({ title: '核心公司图谱', order: 1, depth: 0, metadata: { isStructuredData: true, collectFrequency: 'weekly' } }),
            this.buildSection({ title: '关键人物与组织', order: 2, depth: 0, metadata: { isStructuredData: false } }),
            this.buildSection({ title: '趋势叙事与争议焦点', order: 3, depth: 0, metadata: { isStructuredData: false } }),
            this.buildSection({ title: '关键数据指标追踪', order: 4, depth: 0, metadata: { isStructuredData: true, collectFrequency: 'daily' } }),
            this.buildSection({ title: '下一步调研与采集任务', order: 5, depth: 0, metadata: { isStructuredData: true, collectFrequency: 'weekly' } }),
        ];
    }
    buildOutlineGenerationTask(input) {
        const description = [
            `你是行业研究专家。请为讨论空间生成结构化文档大纲，必须输出 JSON。`,
            `讨论空间：${input.spaceTitle}`,
            `分类：${input.category}`,
            `行业上下文：${input.industryContext}`,
            '要求：',
            '1. 覆盖行业脉络、核心公司、关键人物、趋势叙事、数据验证、输出节奏。',
            '2. 章节支持父子层级，顶层章节建议 5-8 个，每个顶层包含 2-4 个子章节。',
            '3. 每个章节包含 title/description/order/depth，并尽量补充 metadata：suggestedDataSources/collectFrequency/isStructuredData。',
            '4. 输出必须是 JSON，不要附加解释文本。',
            '输出格式：',
            '{',
            '  "title": "...",',
            '  "sections": [',
            '    {',
            '      "id": "optional",',
            '      "title": "...",',
            '      "description": "...",',
            '      "parentSectionId": "optional",',
            '      "order": 0,',
            '      "depth": 0,',
            '      "metadata": {',
            '        "suggestedDataSources": ["..."],',
            '        "collectFrequency": "daily|weekly|monthly",',
            '        "isStructuredData": true',
            '      }',
            '    }',
            '  ]',
            '}',
        ].join('\n');
        return {
            id: this.buildTaskId(input.spaceId),
            title: `Discussion outline generation | ${input.spaceTitle}`,
            description,
            type: 'discussion_outline_generate',
            priority: 'medium',
            status: 'pending',
            assignedAgents: [],
            teamId: input.spaceId,
            messages: [],
        };
    }
    parseOutlinePayload(raw) {
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
            const balanced = this.extractBalancedJson(text.slice(firstJsonStart));
            if (balanced) {
                candidates.unshift(balanced);
            }
        }
        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                if (Array.isArray(parsed)) {
                    return { sections: parsed };
                }
                if (parsed && typeof parsed === 'object') {
                    const payload = parsed;
                    const sections = Array.isArray(payload.sections) ? payload.sections : [];
                    if (sections.length) {
                        return {
                            title: typeof payload.title === 'string' ? payload.title : undefined,
                            sections,
                        };
                    }
                }
            }
            catch (_error) {
                continue;
            }
        }
        return null;
    }
    normalizeGeneratedSections(rawSections) {
        const generated = rawSections
            .filter((item) => item && typeof item === 'object' && String(item.title || '').trim())
            .map((item, index) => {
            const title = String(item.title || '').trim() || `章节 ${index + 1}`;
            const rawOrder = Number(item.order);
            const rawDepth = Number(item.depth);
            const metadata = item.metadata && typeof item.metadata === 'object'
                ? {
                    suggestedDataSources: Array.isArray(item.metadata.suggestedDataSources)
                        ? item.metadata.suggestedDataSources
                            .map((value) => String(value || '').trim())
                            .filter(Boolean)
                        : undefined,
                    collectFrequency: ['daily', 'weekly', 'monthly'].includes(String(item.metadata.collectFrequency || '').trim())
                        ? String(item.metadata.collectFrequency || '').trim()
                        : undefined,
                    isStructuredData: Boolean(item.metadata.isStructuredData),
                }
                : undefined;
            return this.buildSection({
                id: String(item.id || '').trim() || (0, crypto_1.randomUUID)(),
                title,
                description: String(item.description || '').trim() || undefined,
                parentSectionId: String(item.parentSectionId || '').trim() || undefined,
                order: Number.isFinite(rawOrder) ? rawOrder : index,
                depth: Number.isFinite(rawDepth) ? Math.max(0, rawDepth) : 0,
                metadata,
                status: 'draft',
                knowledgeCount: 0,
            });
        });
        return this.rebuildChildSectionIds(generated);
    }
    createTaskSnapshot(input) {
        const now = new Date().toISOString();
        const task = {
            taskId: this.buildTaskId(input.spaceId),
            spaceId: input.spaceId,
            taskType: input.taskType,
            sectionId: input.sectionId,
            status: 'queued',
            createdAt: now,
            updatedAt: now,
        };
        this.outlineTaskStore.set(task.taskId, task);
        return task;
    }
    markTaskStatus(taskId, status) {
        const current = this.outlineTaskStore.get(taskId);
        if (!current) {
            throw new common_1.NotFoundException(`大纲任务不存在: ${taskId}`);
        }
        const next = this.touchTask({
            ...current,
            status,
            startedAt: status === 'running' ? new Date().toISOString() : current.startedAt,
            finishedAt: status === 'succeeded' || status === 'failed' ? new Date().toISOString() : current.finishedAt,
            error: status === 'failed' ? current.error : undefined,
        });
        return next;
    }
    buildEnrichmentContent(section, index) {
        const title = `${section.title} 补充观察 ${index + 1}`;
        const content = [
            `研究章节：${section.title}`,
            section.description ? `章节说明：${section.description}` : undefined,
            '建议从至少 2 个来源交叉验证该章节的关键结论。',
            section.metadata?.isStructuredData
                ? '重点补充可量化指标（数值、单位、时间区间、对比基准）。'
                : '重点补充事实脉络、观点分歧和影响分析。',
            '后续可将关键结论沉淀到结构化报告章节中。',
        ]
            .filter(Boolean)
            .join('\n');
        return {
            title,
            content,
            summary: `${section.title} 的补充知识条目（自动生成）`,
        };
    }
    buildSectionEnrichmentTask(input) {
        const existingText = input.existingEntries.length
            ? input.existingEntries
                .slice(0, 8)
                .map((item, index) => `${index + 1}. ${item.title}${item.summary ? ` - ${item.summary}` : ''}`)
                .join('\n')
            : '（暂无）';
        const suggestedDataSources = Array.isArray(input.section.metadata?.suggestedDataSources)
            ? input.section.metadata?.suggestedDataSources?.filter(Boolean).join('、')
            : '';
        const outlineText = input.outlineSections
            .slice(0, 20)
            .sort((a, b) => a.order - b.order)
            .map((item) => `${'  '.repeat(Math.max(0, item.depth))}- ${item.title}${item.description ? `（${item.description}）` : ''}`)
            .join('\n');
        const description = [
            '你是行业研究助手。请基于章节主题产出可直接入库的知识条目 JSON。',
            `讨论空间：${input.spaceTitle}`,
            `讨论背景：${input.spaceDescription || '（无）'}`,
            `行业上下文：${input.industryContext}`,
            `章节标题：${input.section.title}`,
            `章节说明：${input.section.description || '（无）'}`,
            `建议数据源：${suggestedDataSources || '（无）'}`,
            `目标数量：${input.expectedCount}`,
            '',
            '大纲框架（保持章节语义一致）：',
            outlineText || '（无）',
            '',
            '已有条目（避免重复）：',
            existingText,
            '',
            '输出要求：',
            '1. 仅输出 JSON，不要附加解释。',
            '2. 输出数组或对象；若为对象，使用 searchEvidence + entries 字段。',
            '3. 每条记录字段：title/content/summary/entryType/sourceUrl/sourceName/credibility/structuredData/topicTags/domainTags/keywordTags/contentDate。',
            '4. entryType 仅允许：fact/data_point/opinion/source_reference/analysis/action_item。',
            '5. credibility 仅允许：high/medium/low/unverified。',
            '6. 若为 data_point，尽量补充 structuredData.value/unit/measureDate/compareTo。',
            '7. 请优先调用可用搜索工具检索信息，至少引用 2 个独立来源。',
            '8. searchEvidence 每条建议包含 sourceName/sourceUrl/snippet/query/fetchedAt。',
            '9. 信息不足时允许先提出最多 1-2 个澄清问题。',
        ].join('\n');
        return {
            id: this.buildTaskId(input.spaceId),
            title: `Discussion outline section enrich | ${input.section.title}`,
            description,
            type: 'discussion_outline_enrich_section',
            priority: 'medium',
            status: 'pending',
            assignedAgents: [],
            teamId: input.spaceId,
            messages: [],
        };
    }
    parseEnrichmentPayload(raw) {
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
            const balanced = this.extractBalancedJson(text.slice(firstJsonStart));
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
    }
    extractBalancedJson(input) {
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
            }
            else if (ch === closing) {
                depth -= 1;
                if (depth === 0) {
                    return text.slice(start, index + 1).trim();
                }
            }
        }
        return null;
    }
    normalizeKnowledgeFingerprint(input) {
        const title = String(input.title || '').trim().toLowerCase();
        const summary = String(input.summary || '').trim().toLowerCase();
        const content = String(input.content || '').trim().toLowerCase();
        return `${title}|${summary.slice(0, 80)}|${content.slice(0, 80)}`;
    }
    inferFallbackReason(input) {
        if (!input.hasAgent) {
            return 'no_agent_available';
        }
        if (input.runtimeFailed) {
            return 'agent_execution_failed';
        }
        const runtimeText = input.runtimeResponseText.trim();
        if (!runtimeText) {
            return 'agent_response_empty';
        }
        if (input.parsedRawEntriesCount <= 0) {
            return 'agent_response_non_json';
        }
        if (input.normalizedRuntimeEntriesCount <= 0) {
            return 'agent_entries_invalid';
        }
        if (input.acceptedAgentEntriesCount <= 0) {
            return 'agent_entries_duplicated';
        }
        return 'agent_entries_invalid';
    }
    normalizeRuntimeKnowledgeEntries(rawEntries, section) {
        return rawEntries
            .map((item) => {
            const title = String(item.title || item.name || '').trim();
            const content = String(item.content || item.detail || item.summary || '').trim();
            if (!title || !content) {
                return null;
            }
            const rawEntryType = String(item.entryType || '').trim();
            const normalizedEntryType = VALID_KNOWLEDGE_ENTRY_TYPES.has(rawEntryType)
                ? rawEntryType
                : (section.metadata?.isStructuredData ? discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT : discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ANALYSIS);
            const rawCredibility = String(item.credibility || '').trim();
            const credibility = VALID_KNOWLEDGE_CREDIBILITY.has(rawCredibility)
                ? rawCredibility
                : undefined;
            const sourceUrl = String(item.sourceUrl || '').trim();
            const sourceName = String(item.sourceName || '').trim();
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
                    value: typeof rawStructuredData.value === 'number' || typeof rawStructuredData.value === 'string'
                        ? rawStructuredData.value
                        : undefined,
                    unit: typeof rawStructuredData.unit === 'string' ? rawStructuredData.unit : undefined,
                    measureDate: typeof rawStructuredData.measureDate === 'string' ? rawStructuredData.measureDate : undefined,
                    compareTo: (typeof compareToValue === 'number' || typeof compareToValue === 'string') && compareToPeriod
                        ? {
                            value: compareToValue,
                            period: compareToPeriod,
                            changePercent: Number.isFinite(compareToChangePercent) ? compareToChangePercent : undefined,
                        }
                        : undefined,
                }
                : undefined;
            const normalizeStringArray = (value) => {
                if (!Array.isArray(value)) {
                    return undefined;
                }
                const list = value.map((item) => String(item || '').trim()).filter(Boolean);
                return list.length ? list : undefined;
            };
            const contentDateRaw = String(item.contentDate || '').trim();
            const contentDate = contentDateRaw && !Number.isNaN(new Date(contentDateRaw).getTime()) ? contentDateRaw : undefined;
            return {
                title,
                content,
                summary: String(item.summary || '').trim() || undefined,
                entryType: normalizedEntryType,
                sourceUrl: sourceUrl || undefined,
                sourceName: sourceName || undefined,
                credibility,
                structuredData,
                topicTags: normalizeStringArray(item.topicTags) || [section.title],
                domainTags: normalizeStringArray(item.domainTags),
                keywordTags: normalizeStringArray(item.keywordTags),
                contentDate,
            };
        })
            .filter(Boolean);
    }
    buildPlainTextRuntimeKnowledgeEntry(input) {
        const normalized = String(input.responseText || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized || normalized.length < 40) {
            return null;
        }
        if (this.isClarificationLikeResponse(normalized)) {
            return null;
        }
        const summary = normalized.length > 140 ? `${normalized.slice(0, 139)}...` : normalized;
        return {
            title: `${input.section.title} 补充观察`,
            content: normalized,
            summary,
            entryType: input.section.metadata?.isStructuredData
                ? discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT
                : discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ANALYSIS,
            sourceName: 'outline-enricher-runtime-plain',
            credibility: discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.UNVERIFIED,
            topicTags: [input.section.title],
        };
    }
    isClarificationLikeResponse(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            return false;
        }
        const lower = normalized.toLowerCase();
        return (/\?|？/.test(normalized) ||
            lower.includes('请告诉我') ||
            lower.includes('你希望') ||
            lower.includes('你可以按') ||
            lower.includes('选一条') ||
            lower.includes('如果你愿意'));
    }
    buildSection(input) {
        return {
            id: input.id || (0, crypto_1.randomUUID)(),
            title: input.title,
            description: input.description,
            parentSectionId: input.parentSectionId,
            order: Number.isFinite(input.order) ? Number(input.order) : 0,
            depth: Number.isFinite(input.depth) ? Number(input.depth) : 0,
            status: input.status || 'draft',
            knowledgeCount: Number(input.knowledgeCount || 0),
            childSectionIds: Array.isArray(input.childSectionIds) ? input.childSectionIds.filter(Boolean) : [],
            metadata: input.metadata,
        };
    }
    normalizeOutline(raw, spaceTitle) {
        const now = new Date();
        if (!raw || typeof raw !== 'object') {
            return {
                version: 1,
                title: `${spaceTitle} 大纲`,
                sections: [],
                createdAt: now,
                updatedAt: now,
                generatedBy: 'human',
            };
        }
        const candidate = raw;
        const rawSections = Array.isArray(candidate.sections) ? candidate.sections : [];
        if (rawSections.length && typeof rawSections[0] === 'string') {
            return {
                version: Number(candidate.version || 1),
                title: String(candidate.title || `${spaceTitle} 大纲`),
                sections: rawSections.map((title, index) => this.buildSection({
                    title,
                    order: index,
                    depth: 0,
                })),
                createdAt: candidate.createdAt ? new Date(candidate.createdAt) : now,
                updatedAt: candidate.updatedAt ? new Date(candidate.updatedAt) : now,
                generatedBy: 'hybrid',
            };
        }
        return {
            version: Number(candidate.version || 1),
            title: String(candidate.title || `${spaceTitle} 大纲`),
            sections: rawSections.map((section, index) => this.buildSection({
                ...section,
                title: String(section?.title || `章节 ${index + 1}`),
                order: Number.isFinite(section?.order) ? Number(section.order) : index,
                depth: Number.isFinite(section?.depth) ? Number(section.depth) : 0,
                status: (section?.status || 'draft'),
            })),
            createdAt: candidate.createdAt ? new Date(candidate.createdAt) : now,
            updatedAt: candidate.updatedAt ? new Date(candidate.updatedAt) : now,
            generatedBy: (candidate.generatedBy || 'human'),
            agentId: candidate.agentId,
            runId: candidate.runId,
            sessionId: candidate.sessionId,
        };
    }
    rebuildChildSectionIds(sections) {
        const childrenMap = new Map();
        for (const section of sections) {
            if (!section.parentSectionId) {
                continue;
            }
            if (!childrenMap.has(section.parentSectionId)) {
                childrenMap.set(section.parentSectionId, []);
            }
            childrenMap.get(section.parentSectionId)?.push(section.id);
        }
        return sections.map((section) => ({
            ...section,
            childSectionIds: childrenMap.get(section.id) || [],
        }));
    }
    async getOutline(spaceId) {
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        return this.normalizeOutline(space.documentOutline, space.title);
    }
    async generateOutline(spaceId, input) {
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        const context = input?.industryContext?.trim() || space.metadata?.industryContext || '目标行业';
        const now = new Date();
        const defaultSections = this.buildDefaultOutlineSections(context);
        let sections = defaultSections;
        let generatedBy = 'human';
        let runtimeRunId;
        let runtimeSessionId;
        let runtimeAgentId;
        try {
            const agentId = await this.resolveOutlineAgentId(space, { requireResearchRole: true });
            if (agentId) {
                const task = this.buildOutlineGenerationTask({
                    spaceId,
                    spaceTitle: space.title,
                    industryContext: context,
                    category: space.category,
                });
                task.assignedAgents = [agentId];
                const runtime = await this.agentClientService.executeTaskDetailed(agentId, task, {
                    executionMode: 'task',
                    source: 'discussion_outline_runtime',
                    agentSessionId: this.buildTaskId(spaceId),
                    collaborationContext: {
                        scene: 'discussion',
                        spaceId,
                        category: space.category,
                        industryContext: context,
                        responseDirective: 'json-only',
                        format: 'json',
                    },
                    requestMeta: {
                        source: 'discussion-outline-service',
                    },
                });
                const parsedPayload = this.parseOutlinePayload(runtime.response);
                const parsedSections = parsedPayload?.sections?.length ? this.normalizeGeneratedSections(parsedPayload.sections) : [];
                if (parsedSections.length) {
                    sections = parsedSections;
                    generatedBy = 'agent';
                }
                else {
                    generatedBy = space.category === discussion_space_schema_1.DiscussionSpaceCategory.INDUSTRY_OBSERVATION ? 'hybrid' : 'human';
                }
                runtimeRunId = runtime.runId;
                runtimeSessionId = runtime.sessionId;
                runtimeAgentId = agentId;
            }
            else {
                generatedBy = space.category === discussion_space_schema_1.DiscussionSpaceCategory.INDUSTRY_OBSERVATION ? 'hybrid' : 'human';
            }
        }
        catch (error) {
            this.logger.warn(`Outline runtime generation failed, fallback to default template: spaceId=${spaceId} reason=${error instanceof Error ? error.message : 'unknown'}`);
            generatedBy = space.category === discussion_space_schema_1.DiscussionSpaceCategory.INDUSTRY_OBSERVATION ? 'hybrid' : 'human';
            sections = defaultSections;
        }
        const current = this.normalizeOutline(space.documentOutline, space.title);
        const outline = {
            version: (current.version || 1) + 1,
            title: `${space.title} 行业观察大纲`,
            sections,
            createdAt: current.createdAt || now,
            updatedAt: now,
            generatedBy,
            agentId: runtimeAgentId || current.agentId,
            runId: runtimeRunId || current.runId,
            sessionId: runtimeSessionId || current.sessionId,
        };
        await this.discussionSpaceModel.updateOne({ id: spaceId }, { $set: { documentOutline: outline } }).exec();
        return outline;
    }
    async updateOutline(spaceId, dto) {
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        const current = this.normalizeOutline(space.documentOutline, space.title);
        const now = new Date();
        const normalizedSections = this.rebuildChildSectionIds((dto.sections || []).map((section, index) => this.buildSection({
            ...section,
            title: String(section.title || `章节 ${index + 1}`),
            order: Number.isFinite(section.order) ? Number(section.order) : index,
            depth: Number.isFinite(section.depth) ? Number(section.depth) : 0,
        })));
        const nextOutline = {
            ...current,
            title: dto.title?.trim() || current.title,
            sections: normalizedSections,
            version: current.version + 1,
            updatedAt: now,
            generatedBy: dto.generatedBy || 'human',
        };
        await this.discussionSpaceModel.updateOne({ id: spaceId }, { $set: { documentOutline: nextOutline } }).exec();
        return nextOutline;
    }
    async addSection(spaceId, dto) {
        const current = await this.getOutline(spaceId);
        const order = Number.isFinite(dto.order) ? Number(dto.order) : current.sections.length;
        const parent = dto.parentSectionId ? current.sections.find((item) => item.id === dto.parentSectionId) : undefined;
        const depth = parent ? parent.depth + 1 : 0;
        const added = this.buildSection({
            title: dto.title,
            description: dto.description,
            parentSectionId: dto.parentSectionId,
            order,
            depth,
            status: dto.status || 'draft',
            metadata: dto.metadata,
        });
        return this.updateOutline(spaceId, {
            sections: [...current.sections, added],
            generatedBy: 'human',
            title: current.title,
        });
    }
    async updateSection(spaceId, sectionId, dto) {
        const current = await this.getOutline(spaceId);
        const sections = current.sections.map((section) => {
            if (section.id !== sectionId) {
                return section;
            }
            return {
                ...section,
                title: dto.title?.trim() || section.title,
                description: dto.description !== undefined ? dto.description : section.description,
                parentSectionId: dto.parentSectionId !== undefined ? dto.parentSectionId : section.parentSectionId,
                order: dto.order !== undefined ? Number(dto.order) : section.order,
                status: dto.status || section.status,
                metadata: dto.metadata || section.metadata,
            };
        });
        return this.updateOutline(spaceId, {
            sections,
            generatedBy: 'human',
            title: current.title,
        });
    }
    async deleteSection(spaceId, sectionId) {
        const current = await this.getOutline(spaceId);
        const target = current.sections.find((section) => section.id === sectionId);
        if (!target) {
            throw new common_1.NotFoundException(`章节不存在: ${sectionId}`);
        }
        const toDelete = new Set([sectionId]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const section of current.sections) {
                if (section.parentSectionId && toDelete.has(section.parentSectionId) && !toDelete.has(section.id)) {
                    toDelete.add(section.id);
                    changed = true;
                }
            }
        }
        const deletedSectionIds = Array.from(toDelete);
        const deletedKnowledgeResult = await this.discussionKnowledgeEntryModel.deleteMany({
            spaceId,
            outlineSectionId: { $in: deletedSectionIds },
        }).exec();
        const outline = await this.updateOutline(spaceId, {
            sections: current.sections.filter((item) => !toDelete.has(item.id)),
            generatedBy: 'human',
            title: current.title,
        });
        return {
            sectionId,
            deletedSectionIds,
            deletedKnowledgeCount: Number(deletedKnowledgeResult?.deletedCount || 0),
            outline,
        };
    }
    async clearSectionEnrichment(spaceId, sectionId) {
        const outline = await this.getOutline(spaceId);
        const section = outline.sections.find((item) => item.id === sectionId);
        if (!section) {
            throw new common_1.NotFoundException(`章节不存在: ${sectionId}`);
        }
        const deletedResult = await this.discussionKnowledgeEntryModel.deleteMany({
            spaceId,
            outlineSectionId: sectionId,
            sourceType: { $ne: 'user_input' },
        }).exec();
        const knowledgeCount = await this.discussionKnowledgeEntryModel.countDocuments({
            spaceId,
            outlineSectionId: sectionId,
            isActive: true,
        });
        const nextStatus = section.status === 'review'
            ? 'review'
            : knowledgeCount <= 0
                ? 'draft'
                : knowledgeCount >= 3
                    ? 'sufficient'
                    : 'enriching';
        const nextOutline = await this.updateOutline(spaceId, {
            title: outline.title,
            generatedBy: 'human',
            sections: outline.sections.map((item) => item.id === sectionId
                ? {
                    ...item,
                    knowledgeCount: Number(knowledgeCount || 0),
                    status: nextStatus,
                }
                : item),
        });
        return {
            sectionId,
            clearedKnowledgeCount: Number(deletedResult?.deletedCount || 0),
            outline: nextOutline,
        };
    }
    async enrichSection(spaceId, sectionId) {
        const outline = await this.getOutline(spaceId);
        const section = outline.sections.find((item) => item.id === sectionId);
        if (!section) {
            throw new common_1.NotFoundException(`章节不存在: ${sectionId}`);
        }
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        const [existingCount, existingEntries] = await Promise.all([
            this.discussionKnowledgeEntryModel.countDocuments({
                spaceId,
                outlineSectionId: sectionId,
                isActive: true,
            }),
            this.discussionKnowledgeEntryModel
                .find({
                spaceId,
                outlineSectionId: sectionId,
                isActive: true,
            }, {
                title: 1,
                summary: 1,
                content: 1,
            })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean()
                .exec(),
        ]);
        const targetThreshold = 3;
        const remaining = Math.max(0, targetThreshold - Number(existingCount || 0));
        const addCount = Math.min(3, remaining);
        if (addCount <= 0) {
            return {
                sectionId,
                enrichedCount: 0,
                outline: await this.getOutline(spaceId),
            };
        }
        const existingSummaryEntries = (existingEntries || []).map((item) => ({
            title: String(item.title || '').trim(),
            summary: String(item.summary || '').trim(),
            content: String(item.content || '').trim(),
        }));
        const existingFingerprints = new Set(existingSummaryEntries.map((item) => this.normalizeKnowledgeFingerprint(item)).filter(Boolean));
        let normalizedRuntimeEntries = new Array();
        let runtimeResponseText = '';
        let parsedRawEntriesCount = 0;
        let runtimeFailed = false;
        let resolvedAgentId;
        let rerunForClarification = false;
        try {
            const agentId = await this.resolveOutlineAgentId(space, { requireResearchRole: true });
            resolvedAgentId = agentId || undefined;
            if (agentId) {
                const task = this.buildSectionEnrichmentTask({
                    spaceId,
                    spaceTitle: space.title,
                    spaceDescription: String(space.description || '').trim() || undefined,
                    industryContext: String(space.metadata?.industryContext || '').trim() || '目标行业',
                    section,
                    outlineSections: outline.sections.map((item) => ({
                        title: item.title,
                        description: item.description,
                        depth: Number(item.depth || 0),
                        order: Number(item.order || 0),
                    })),
                    existingEntries: existingSummaryEntries,
                    expectedCount: addCount,
                });
                task.assignedAgents = [agentId];
                const runtime = await this.agentClientService.executeTaskDetailed(agentId, task, {
                    executionMode: 'task',
                    source: 'discussion_outline_enrich_runtime',
                    agentSessionId: this.buildTaskId(spaceId),
                    collaborationContext: {
                        scene: 'discussion',
                        spaceId,
                        category: space.category,
                        sectionId: section.id,
                        sectionTitle: section.title,
                        responseDirective: 'json-only',
                        format: 'json',
                    },
                    requestMeta: {
                        source: 'discussion-outline-service',
                    },
                });
                runtimeResponseText = String(runtime.response || '');
                const rawEntries = this.parseEnrichmentPayload(runtime.response);
                parsedRawEntriesCount = rawEntries.length;
                normalizedRuntimeEntries = this.normalizeRuntimeKnowledgeEntries(rawEntries, section);
                const shouldRerunForClarification = !normalizedRuntimeEntries.length &&
                    this.isClarificationLikeResponse(runtimeResponseText);
                if (shouldRerunForClarification) {
                    rerunForClarification = true;
                    const rerunTask = {
                        ...task,
                        id: this.buildTaskId(spaceId),
                        description: [
                            task.description,
                            '',
                            '附加约束（必须遵守）：',
                            '1. 请优先补充可入库 JSON 条目，同时保留 searchEvidence。',
                            '2. 若上下文缺失，可按“全球范围 + 近20年”作默认假设，并可提出最多 1 个澄清问题。',
                            '3. 条目需保留可追溯来源链接。',
                        ].join('\n'),
                    };
                    const rerunRuntime = await this.agentClientService.executeTaskDetailed(agentId, rerunTask, {
                        executionMode: 'task',
                        source: 'discussion_outline_enrich_runtime_retry',
                        agentSessionId: this.buildTaskId(spaceId),
                        collaborationContext: {
                            scene: 'discussion',
                            spaceId,
                            category: space.category,
                            sectionId: section.id,
                            sectionTitle: section.title,
                            responseDirective: 'json-only',
                            format: 'json',
                        },
                        requestMeta: {
                            source: 'discussion-outline-service',
                            retryReason: 'clarification_response',
                        },
                    });
                    runtimeResponseText = String(rerunRuntime.response || '');
                    const rerunRawEntries = this.parseEnrichmentPayload(rerunRuntime.response);
                    parsedRawEntriesCount = rerunRawEntries.length;
                    normalizedRuntimeEntries = this.normalizeRuntimeKnowledgeEntries(rerunRawEntries, section);
                }
                if (!normalizedRuntimeEntries.length) {
                    const plainTextEntry = this.buildPlainTextRuntimeKnowledgeEntry({
                        responseText: runtimeResponseText,
                        section,
                    });
                    if (plainTextEntry) {
                        normalizedRuntimeEntries = [plainTextEntry];
                    }
                }
            }
        }
        catch (error) {
            runtimeFailed = true;
            this.logger.warn(`Outline section enrichment runtime failed, fallback to local generation: spaceId=${spaceId} sectionId=${sectionId} reason=${error instanceof Error ? error.message : 'unknown'}`);
        }
        const selectedEntries = new Array();
        const selectedFingerprints = new Set(existingFingerprints);
        for (const runtimeEntry of normalizedRuntimeEntries) {
            if (selectedEntries.length >= addCount) {
                break;
            }
            const fingerprint = this.normalizeKnowledgeFingerprint(runtimeEntry);
            if (!fingerprint || selectedFingerprints.has(fingerprint)) {
                continue;
            }
            selectedFingerprints.add(fingerprint);
            selectedEntries.push(runtimeEntry);
        }
        const acceptedAgentEntriesCount = selectedEntries.length;
        const fallbackTarget = acceptedAgentEntriesCount > 0 ? 0 : addCount;
        let fallbackIndex = 0;
        while (selectedEntries.length < acceptedAgentEntriesCount + fallbackTarget) {
            const generated = this.buildEnrichmentContent(section, fallbackIndex);
            fallbackIndex += 1;
            const fallbackEntry = {
                title: generated.title,
                content: generated.content,
                summary: generated.summary,
                entryType: section.metadata?.isStructuredData
                    ? discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT
                    : discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.ANALYSIS,
                sourceUrl: undefined,
                sourceName: 'outline-enricher-fallback',
                credibility: discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.UNVERIFIED,
                structuredData: undefined,
                topicTags: [section.title],
                domainTags: undefined,
                keywordTags: undefined,
                contentDate: undefined,
            };
            const fingerprint = this.normalizeKnowledgeFingerprint(fallbackEntry);
            if (!fingerprint || selectedFingerprints.has(fingerprint)) {
                if (fallbackIndex > 20) {
                    break;
                }
                continue;
            }
            selectedFingerprints.add(fingerprint);
            selectedEntries.push(fallbackEntry);
        }
        const createdFallbackEntries = selectedEntries.length - acceptedAgentEntriesCount;
        const enrichmentMeta = {
            mode: createdFallbackEntries > 0 ? 'fallback' : 'agent',
            agentId: resolvedAgentId,
            acceptedAgentEntries: acceptedAgentEntriesCount,
            createdFallbackEntries,
            fallbackReason: createdFallbackEntries > 0
                ? this.inferFallbackReason({
                    hasAgent: Boolean(resolvedAgentId),
                    runtimeFailed,
                    runtimeResponseText,
                    parsedRawEntriesCount,
                    normalizedRuntimeEntriesCount: normalizedRuntimeEntries.length,
                    acceptedAgentEntriesCount,
                })
                : undefined,
        };
        if (enrichmentMeta.mode === 'fallback') {
            const responsePreview = String(runtimeResponseText || '').replace(/\s+/g, ' ').slice(0, 200);
            this.logger.warn(`[outline_enrich_fallback] spaceId=${spaceId} sectionId=${sectionId} reason=${enrichmentMeta.fallbackReason || 'unknown'} hasAgent=${Boolean(resolvedAgentId)} agentId=${resolvedAgentId || 'none'} runtimeResponseLength=${runtimeResponseText.length} parsedRawEntries=${parsedRawEntriesCount} normalizedEntries=${normalizedRuntimeEntries.length} acceptedAgentEntries=${acceptedAgentEntriesCount} rerunForClarification=${rerunForClarification} responsePreview="${responsePreview}"`);
        }
        for (const entry of selectedEntries) {
            await this.discussionKnowledgeService.createKnowledgeEntry(spaceId, {
                participantId: 'system',
                title: entry.title,
                content: entry.content,
                summary: entry.summary,
                outlineSectionId: section.id,
                entryType: entry.entryType,
                structuredData: entry.structuredData,
                metadata: {
                    isStructuredData: entry.entryType === discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.DATA_POINT || Boolean(section.metadata?.isStructuredData),
                },
                sourceUrl: entry.sourceUrl,
                sourceType: entry.sourceUrl ? discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.WEB_SEARCH : discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.DISCUSSION_DERIVED,
                sourceName: entry.sourceName || 'outline-enricher-runtime',
                domainTags: entry.domainTags,
                topicTags: entry.topicTags || [section.title],
                keywordTags: entry.keywordTags,
                credibility: entry.credibility,
                contentDate: entry.contentDate,
            });
        }
        return {
            sectionId,
            enrichedCount: selectedEntries.length,
            outline: await this.getOutline(spaceId),
            enrichmentMeta,
        };
    }
    async enrichAllDraftSections(spaceId) {
        const outline = await this.getOutline(spaceId);
        const draftSections = outline.sections.filter((item) => item.status === 'draft');
        let enrichedCount = 0;
        for (const section of draftSections) {
            const result = await this.enrichSection(spaceId, section.id);
            enrichedCount += result.enrichedCount;
        }
        return {
            processedSectionIds: draftSections.map((item) => item.id),
            enrichedCount,
            outline: await this.getOutline(spaceId),
        };
    }
    async createGenerateOutlineTask(spaceId, input) {
        const task = this.createTaskSnapshot({ spaceId, taskType: 'generate' });
        setTimeout(async () => {
            try {
                const running = this.markTaskStatus(task.taskId, 'running');
                this.emitTaskEvent(task.taskId, {
                    type: 'discussion.outline.task.running',
                    data: { task: running },
                });
                const outline = await this.generateOutline(spaceId, input);
                const succeeded = this.touchTask({
                    ...running,
                    status: 'succeeded',
                    finishedAt: new Date().toISOString(),
                    result: { outline },
                });
                this.emitTaskEvent(task.taskId, {
                    type: 'discussion.outline.task.succeeded',
                    data: { task: succeeded },
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'outline_generate_failed';
                const current = this.outlineTaskStore.get(task.taskId);
                if (!current) {
                    return;
                }
                const failed = this.touchTask({
                    ...current,
                    status: 'failed',
                    finishedAt: new Date().toISOString(),
                    error: message,
                });
                this.emitTaskEvent(task.taskId, {
                    type: 'discussion.outline.task.failed',
                    data: { task: failed },
                });
                this.logger.warn(`Generate outline task failed: spaceId=${spaceId} taskId=${task.taskId} reason=${message}`);
            }
            finally {
                this.scheduleTaskCleanup(task.taskId);
            }
        }, 0);
        return task;
    }
    async createEnrichSectionTask(spaceId, sectionId) {
        const task = this.createTaskSnapshot({ spaceId, taskType: 'enrich_section', sectionId });
        setTimeout(async () => {
            try {
                const running = this.markTaskStatus(task.taskId, 'running');
                this.emitTaskEvent(task.taskId, {
                    type: 'discussion.outline.task.running',
                    data: { task: running },
                });
                const result = await this.enrichSection(spaceId, sectionId);
                const succeeded = this.touchTask({
                    ...running,
                    status: 'succeeded',
                    finishedAt: new Date().toISOString(),
                    result: {
                        outline: result.outline,
                        enrichedCount: result.enrichedCount,
                        enrichmentMeta: result.enrichmentMeta,
                    },
                });
                this.emitTaskEvent(task.taskId, {
                    type: 'discussion.outline.task.succeeded',
                    data: { task: succeeded },
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'outline_enrich_failed';
                const current = this.outlineTaskStore.get(task.taskId);
                if (!current) {
                    return;
                }
                const failed = this.touchTask({
                    ...current,
                    status: 'failed',
                    finishedAt: new Date().toISOString(),
                    error: message,
                });
                this.emitTaskEvent(task.taskId, {
                    type: 'discussion.outline.task.failed',
                    data: { task: failed },
                });
                this.logger.warn(`Enrich section task failed: spaceId=${spaceId} sectionId=${sectionId} taskId=${task.taskId} reason=${message}`);
            }
            finally {
                this.scheduleTaskCleanup(task.taskId);
            }
        }, 0);
        return task;
    }
    async streamOutlineTaskEvents(spaceId, taskId) {
        const task = this.outlineTaskStore.get(taskId);
        if (!task || task.spaceId !== spaceId) {
            throw new common_1.NotFoundException(`大纲任务不存在: ${taskId}`);
        }
        return new rxjs_1.Observable((subscriber) => {
            let channels = this.outlineTaskChannels.get(taskId);
            if (!channels) {
                channels = new Set();
                this.outlineTaskChannels.set(taskId, channels);
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
                    type: 'discussion.outline.task.snapshot',
                    data: {
                        task,
                    },
                },
            });
            const heartbeat = setInterval(() => {
                const latest = this.outlineTaskStore.get(taskId);
                if (!latest) {
                    return;
                }
                channel.next({
                    data: {
                        type: 'discussion.outline.task.snapshot',
                        data: {
                            task: latest,
                        },
                    },
                });
            }, 10000);
            return () => {
                clearInterval(heartbeat);
                subscription.unsubscribe();
                const target = this.outlineTaskChannels.get(taskId);
                if (!target) {
                    return;
                }
                target.delete(channel);
                channel.complete();
                if (!target.size) {
                    this.outlineTaskChannels.delete(taskId);
                }
            };
        });
    }
    async getKnowledgeCoverage(spaceId) {
        const outline = await this.getOutline(spaceId);
        const sectionIds = outline.sections.map((item) => item.id);
        if (!sectionIds.length) {
            return {
                totalSections: 0,
                coveredSections: 0,
                sufficientSections: 0,
                coverage: 0,
                sectionDetails: [],
            };
        }
        const coverageAgg = await this.discussionKnowledgeEntryModel.aggregate([
            {
                $match: {
                    spaceId,
                    isActive: true,
                    outlineSectionId: { $in: sectionIds },
                },
            },
            {
                $group: {
                    _id: '$outlineSectionId',
                    knowledgeCount: { $sum: 1 },
                    latestEntryDate: { $max: '$createdAt' },
                },
            },
        ]);
        const sectionStatMap = new Map();
        for (const item of coverageAgg) {
            if (!item?._id) {
                continue;
            }
            sectionStatMap.set(String(item._id), {
                knowledgeCount: Number(item.knowledgeCount || 0),
                latestEntryDate: item.latestEntryDate ? new Date(item.latestEntryDate) : undefined,
            });
        }
        const sectionDetails = outline.sections.map((section) => {
            const stat = sectionStatMap.get(section.id);
            const knowledgeCount = stat ? Number(stat.knowledgeCount || 0) : 0;
            const status = section.status === 'review'
                ? 'review'
                : knowledgeCount <= 0
                    ? 'draft'
                    : knowledgeCount >= 3
                        ? 'sufficient'
                        : 'enriching';
            return {
                sectionId: section.id,
                sectionTitle: section.title,
                knowledgeCount,
                status,
                latestEntryDate: stat?.latestEntryDate,
            };
        });
        const totalSections = sectionDetails.length;
        const coveredSections = sectionDetails.filter((item) => item.knowledgeCount > 0).length;
        const sufficientSections = sectionDetails.filter((item) => item.status === 'sufficient').length;
        return {
            totalSections,
            coveredSections,
            sufficientSections,
            coverage: totalSections ? Number((coveredSections / totalSections).toFixed(4)) : 0,
            sectionDetails,
        };
    }
};
exports.DiscussionOutlineService = DiscussionOutlineService;
exports.DiscussionOutlineService = DiscussionOutlineService = DiscussionOutlineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_space_schema_1.DiscussionSpace.name)),
    __param(1, (0, mongoose_1.InjectModel)(discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntry.name)),
    __param(2, (0, mongoose_1.InjectModel)(discussion_participant_schema_1.DiscussionParticipant.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        discussion_knowledge_service_1.DiscussionKnowledgeService,
        agent_client_service_1.AgentClientService])
], DiscussionOutlineService);
//# sourceMappingURL=discussion-outline.service.js.map