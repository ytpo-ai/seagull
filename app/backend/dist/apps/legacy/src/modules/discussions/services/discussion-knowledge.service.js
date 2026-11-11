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
exports.DiscussionKnowledgeService = void 0;
exports.extractKeywordTags = extractKeywordTags;
exports.inferCredibility = inferCredibility;
exports.buildReusableKnowledgeFilter = buildReusableKnowledgeFilter;
exports.resolveOutlineSectionStatusByKnowledgeCount = resolveOutlineSectionStatusByKnowledgeCount;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const discussion_knowledge_entry_schema_1 = require("../../../shared/schemas/discussion-knowledge-entry.schema");
const discussion_space_schema_1 = require("../../../shared/schemas/discussion-space.schema");
const discussion_participant_schema_1 = require("../../../shared/schemas/discussion-participant.schema");
const discussion_message_schema_1 = require("../../../shared/schemas/discussion-message.schema");
const discussion_space_service_1 = require("./discussion-space.service");
function extractKeywordTags(content, max = 8) {
    const cleaned = String(content || '')
        .toLowerCase()
        .replace(/[`~!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, ' ');
    const pieces = cleaned
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3);
    const ignored = new Set(['this', 'that', 'with', 'from', 'have', 'will', 'what', 'where', 'when', 'about']);
    const score = new Map();
    for (const piece of pieces) {
        if (ignored.has(piece)) {
            continue;
        }
        score.set(piece, (score.get(piece) || 0) + 1);
    }
    return Array.from(score.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(1, max))
        .map(([word]) => word);
}
function inferCredibility(sourceType, sourceUrl) {
    if (sourceType === discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.USER_INPUT || sourceType === discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.DISCUSSION_DERIVED) {
        return discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.UNVERIFIED;
    }
    if (!sourceUrl) {
        return discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.MEDIUM;
    }
    const trustedDomains = ['gov', 'edu', 'reuters.com', 'bloomberg.com', 'iea.org', 'imf.org', 'worldbank.org'];
    const normalized = sourceUrl.toLowerCase();
    if (trustedDomains.some((domain) => normalized.includes(domain))) {
        return discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.HIGH;
    }
    if (sourceType === discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.WEB_SEARCH) {
        return discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.MEDIUM;
    }
    return discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.LOW;
}
function buildSummary(content, maxLength = 140) {
    const normalized = String(content || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '无摘要';
    }
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 1)}...`;
}
function buildReusableKnowledgeFilter(spaceId, input) {
    const topicTags = (input.topicTags || []).filter(Boolean);
    const filter = {
        spaceId,
        isActive: true,
    };
    if (!input.includeDerived) {
        filter.sourceType = { $ne: discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.DISCUSSION_DERIVED };
    }
    if (topicTags.length) {
        filter.$or = [{ topicTags: { $in: topicTags } }, { keywordTags: { $in: topicTags } }];
    }
    return filter;
}
function resolveOutlineSectionStatusByKnowledgeCount(knowledgeCount, currentStatus) {
    if (currentStatus === 'review') {
        return 'review';
    }
    if (knowledgeCount <= 0) {
        return 'draft';
    }
    if (knowledgeCount >= 3) {
        return 'sufficient';
    }
    return 'enriching';
}
let DiscussionKnowledgeService = class DiscussionKnowledgeService {
    constructor(discussionSpaceModel, discussionKnowledgeEntryModel, discussionParticipantModel, discussionMessageModel, discussionSpaceService) {
        this.discussionSpaceModel = discussionSpaceModel;
        this.discussionKnowledgeEntryModel = discussionKnowledgeEntryModel;
        this.discussionParticipantModel = discussionParticipantModel;
        this.discussionMessageModel = discussionMessageModel;
        this.discussionSpaceService = discussionSpaceService;
    }
    async syncOutlineSectionProgress(spaceId, outlineSectionId) {
        const sectionId = String(outlineSectionId || '').trim();
        if (!sectionId) {
            return;
        }
        const [knowledgeCount, space] = await Promise.all([
            this.discussionKnowledgeEntryModel.countDocuments({
                spaceId,
                outlineSectionId: sectionId,
                isActive: true,
            }),
            this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec(),
        ]);
        if (!space?.documentOutline || !Array.isArray(space.documentOutline.sections)) {
            return;
        }
        const currentOutline = space.documentOutline;
        const currentSections = (currentOutline.sections || []);
        let changed = false;
        const nextSections = currentSections.map((section) => {
            if (String(section?.id || '') !== sectionId) {
                return section;
            }
            const nextStatus = resolveOutlineSectionStatusByKnowledgeCount(Number(knowledgeCount || 0), (section?.status || 'draft'));
            const prevKnowledgeCount = Number(section?.knowledgeCount || 0);
            const prevStatus = String(section?.status || 'draft');
            if (prevKnowledgeCount === Number(knowledgeCount || 0) && prevStatus === nextStatus) {
                return section;
            }
            changed = true;
            return {
                ...section,
                knowledgeCount: Number(knowledgeCount || 0),
                status: nextStatus,
            };
        });
        if (!changed) {
            return;
        }
        await this.discussionSpaceModel
            .updateOne({ id: spaceId }, {
            $set: {
                documentOutline: {
                    ...currentOutline,
                    version: Number(currentOutline.version || 1) + 1,
                    updatedAt: new Date(),
                    sections: nextSections,
                },
            },
        })
            .exec();
    }
    async createKnowledgeEntry(spaceId, dto) {
        const keywordTags = dto.keywordTags?.length ? dto.keywordTags : extractKeywordTags(dto.content);
        const credibility = dto.credibility || inferCredibility(dto.sourceType, dto.sourceUrl);
        const summary = dto.summary?.trim() || buildSummary(dto.content);
        const created = await this.discussionKnowledgeEntryModel.create({
            ...dto,
            spaceId,
            summary,
            keywordTags,
            topicTags: dto.topicTags || [],
            domainTags: dto.domainTags || [],
            outlineSectionId: dto.outlineSectionId,
            entryType: dto.entryType || discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntryType.FACT,
            structuredData: dto.structuredData
                ? {
                    ...dto.structuredData,
                    measureDate: dto.structuredData.measureDate ? new Date(dto.structuredData.measureDate) : undefined,
                }
                : undefined,
            metadata: dto.metadata,
            credibility,
            contentDate: dto.contentDate ? new Date(dto.contentDate) : undefined,
            credibilityDetail: {
                sourceAuthority: credibility === discussion_knowledge_entry_schema_1.DiscussionKnowledgeCredibility.HIGH ? 'high' : 'medium',
                contentFreshness: 'recent',
                crossValidated: false,
                userOverride: Boolean(dto.credibility),
                lastAssessedAt: new Date(),
            },
        });
        await Promise.all([
            this.discussionParticipantModel
                .updateOne({ id: dto.participantId, spaceId }, { $inc: { knowledgeContribution: 1 } })
                .exec(),
            this.discussionSpaceService.incrementStatistics(spaceId, { totalKnowledgeEntries: 1 }),
        ]);
        await this.syncOutlineSectionProgress(spaceId, dto.outlineSectionId);
        return created;
    }
    async createDerivedKnowledgeEntry(input) {
        return this.createKnowledgeEntry(input.spaceId, {
            participantId: input.participantId,
            threadId: input.threadId,
            messageId: input.messageId,
            title: input.title,
            content: input.content,
            sourceType: discussion_knowledge_entry_schema_1.DiscussionKnowledgeSourceType.DISCUSSION_DERIVED,
            sourceName: 'discussion-space',
            topicTags: input.topicTags || [],
            domainTags: input.domainTags || [],
        });
    }
    async listKnowledgeEntries(spaceId, query) {
        const filter = {
            spaceId,
            isActive: true,
        };
        const andFilters = [];
        if (query.threadId) {
            andFilters.push({
                $or: [
                    { threadId: query.threadId },
                    { threadId: { $exists: false } },
                    { threadId: null },
                    { threadId: '' },
                ],
            });
        }
        if (query.participantId) {
            filter.participantId = query.participantId;
        }
        if (query.outlineSectionId) {
            filter.outlineSectionId = query.outlineSectionId;
        }
        if (query.credibility) {
            filter.credibility = query.credibility;
        }
        if (query.keyword) {
            andFilters.push({
                $or: [
                    { title: { $regex: query.keyword, $options: 'i' } },
                    { summary: { $regex: query.keyword, $options: 'i' } },
                    { keywordTags: { $in: [query.keyword.toLowerCase()] } },
                ],
            });
        }
        if (andFilters.length > 0) {
            filter.$and = andFilters;
        }
        const limit = Math.max(1, Math.min(Number(query.limit || 50), 200));
        return this.discussionKnowledgeEntryModel
            .find(filter)
            .sort({ referenceCount: -1, createdAt: -1 })
            .limit(limit)
            .lean()
            .exec();
    }
    async getReusableKnowledge(spaceId, input) {
        const filter = buildReusableKnowledgeFilter(spaceId, input);
        return this.discussionKnowledgeEntryModel
            .find(filter)
            .sort({ credibility: 1, referenceCount: -1, createdAt: -1 })
            .limit(Math.max(1, Math.min(Number(input.limit || 5), 20)))
            .lean()
            .exec();
    }
    async linkKnowledgeToMessage(spaceId, messageId, knowledgeEntryIds) {
        if (!knowledgeEntryIds.length) {
            return;
        }
        await Promise.all([
            this.discussionMessageModel
                .updateOne({ id: messageId, spaceId }, {
                $addToSet: {
                    knowledgeEntryIds: { $each: knowledgeEntryIds },
                },
            })
                .exec(),
            this.discussionKnowledgeEntryModel
                .updateMany({ id: { $in: knowledgeEntryIds }, spaceId }, { $inc: { referenceCount: 1 } })
                .exec(),
        ]);
    }
    async linkExistingKnowledgeEntriesToMessage(input) {
        const deduplicatedIds = Array.from(new Set((input.knowledgeEntryIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!deduplicatedIds.length) {
            throw new common_1.BadRequestException('knowledgeEntryIds 至少需要包含一个条目');
        }
        const message = await this.discussionMessageModel
            .findOne({ id: input.messageId, spaceId: input.spaceId, threadId: input.threadId })
            .lean()
            .exec();
        if (!message) {
            throw new common_1.NotFoundException(`消息不存在: ${input.messageId}`);
        }
        const existingKnowledgeEntries = await this.discussionKnowledgeEntryModel
            .find({
            spaceId: input.spaceId,
            id: { $in: deduplicatedIds },
            isActive: true,
        })
            .select({ id: 1 })
            .lean()
            .exec();
        const existingIds = new Set(existingKnowledgeEntries.map((item) => item.id));
        const missingIds = deduplicatedIds.filter((id) => !existingIds.has(id));
        if (missingIds.length) {
            throw new common_1.NotFoundException(`知识条目不存在或不可用: ${missingIds.join(',')}`);
        }
        await this.linkKnowledgeToMessage(input.spaceId, input.messageId, deduplicatedIds);
        return deduplicatedIds;
    }
    async deleteKnowledgeEntry(spaceId, knowledgeEntryId) {
        const normalizedId = String(knowledgeEntryId || '').trim();
        if (!normalizedId) {
            throw new common_1.BadRequestException('knowledgeEntryId 不能为空');
        }
        const target = await this.discussionKnowledgeEntryModel
            .findOne({ id: normalizedId, spaceId, isActive: true })
            .lean()
            .exec();
        if (!target) {
            throw new common_1.NotFoundException(`知识条目不存在: ${normalizedId}`);
        }
        await Promise.all([
            this.discussionKnowledgeEntryModel
                .updateOne({ id: normalizedId, spaceId }, {
                $set: {
                    isActive: false,
                },
            })
                .exec(),
            this.discussionMessageModel
                .updateMany({ spaceId }, {
                $pull: {
                    knowledgeEntryIds: normalizedId,
                },
            })
                .exec(),
            this.discussionSpaceService.incrementStatistics(spaceId, { totalKnowledgeEntries: -1 }),
        ]);
        await this.syncOutlineSectionProgress(spaceId, String(target.outlineSectionId || '').trim() || undefined);
        return {
            removed: true,
            knowledgeEntryId: normalizedId,
        };
    }
};
exports.DiscussionKnowledgeService = DiscussionKnowledgeService;
exports.DiscussionKnowledgeService = DiscussionKnowledgeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_space_schema_1.DiscussionSpace.name)),
    __param(1, (0, mongoose_1.InjectModel)(discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntry.name)),
    __param(2, (0, mongoose_1.InjectModel)(discussion_participant_schema_1.DiscussionParticipant.name)),
    __param(3, (0, mongoose_1.InjectModel)(discussion_message_schema_1.DiscussionMessage.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        discussion_space_service_1.DiscussionSpaceService])
], DiscussionKnowledgeService);
//# sourceMappingURL=discussion-knowledge.service.js.map