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
exports.DiscussionThreadService = void 0;
exports.canCreateBranch = canCreateBranch;
exports.collectThreadSubtreeIds = collectThreadSubtreeIds;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const discussion_thread_schema_1 = require("../../../shared/schemas/discussion-thread.schema");
const discussion_message_schema_1 = require("../../../shared/schemas/discussion-message.schema");
const discussion_knowledge_entry_schema_1 = require("../../../shared/schemas/discussion-knowledge-entry.schema");
const discussion_space_service_1 = require("./discussion-space.service");
function canCreateBranch(maxBranchDepth, parentDepth) {
    if (typeof maxBranchDepth !== 'number' || maxBranchDepth < 0) {
        return true;
    }
    return parentDepth + 1 <= maxBranchDepth;
}
function collectThreadSubtreeIds(rootThreadId, threads) {
    const byParent = new Map();
    for (const thread of threads) {
        if (!thread.parentThreadId) {
            continue;
        }
        const children = byParent.get(thread.parentThreadId) || [];
        children.push(thread.id);
        byParent.set(thread.parentThreadId, children);
    }
    const visited = new Set();
    const stack = [rootThreadId];
    while (stack.length) {
        const current = stack.pop();
        if (!current || visited.has(current)) {
            continue;
        }
        visited.add(current);
        const children = byParent.get(current) || [];
        for (const childId of children) {
            stack.push(childId);
        }
    }
    return Array.from(visited);
}
let DiscussionThreadService = class DiscussionThreadService {
    constructor(discussionThreadModel, discussionMessageModel, discussionKnowledgeEntryModel, discussionSpaceService) {
        this.discussionThreadModel = discussionThreadModel;
        this.discussionMessageModel = discussionMessageModel;
        this.discussionKnowledgeEntryModel = discussionKnowledgeEntryModel;
        this.discussionSpaceService = discussionSpaceService;
    }
    async createRootThread(spaceId, title = '主讨论线') {
        return this.discussionThreadModel.create({
            spaceId,
            title,
            branchOrigin: discussion_thread_schema_1.DiscussionThreadBranchOrigin.USER,
            depth: 0,
            status: discussion_thread_schema_1.DiscussionThreadStatus.ACTIVE,
            childThreadIds: [],
            activeParticipantIds: [],
            messageCount: 0,
        });
    }
    async createThread(spaceId, dto) {
        let depth = 0;
        if (dto.parentThreadId) {
            const parent = await this.discussionThreadModel.findOne({ id: dto.parentThreadId, spaceId }).lean().exec();
            if (!parent) {
                throw new common_1.NotFoundException(`父讨论线不存在: ${dto.parentThreadId}`);
            }
            const space = await this.discussionSpaceService.getSpaceById(spaceId);
            if (!canCreateBranch(space.settings?.maxBranchDepth, parent.depth)) {
                throw new common_1.BadRequestException(`已达到最大分叉深度: ${space.settings?.maxBranchDepth}`);
            }
            depth = parent.depth + 1;
        }
        const thread = await this.discussionThreadModel.create({
            ...dto,
            spaceId,
            depth,
            branchOrigin: dto.branchOrigin || discussion_thread_schema_1.DiscussionThreadBranchOrigin.USER,
            status: discussion_thread_schema_1.DiscussionThreadStatus.ACTIVE,
            childThreadIds: [],
            activeParticipantIds: [],
            messageCount: 0,
        });
        if (dto.parentThreadId) {
            await this.discussionThreadModel.updateOne({ id: dto.parentThreadId, spaceId }, { $addToSet: { childThreadIds: thread.id } }).exec();
        }
        await this.discussionSpaceService.incrementStatistics(spaceId, { totalThreads: 1 });
        return thread;
    }
    async getThreadById(spaceId, threadId) {
        const thread = await this.discussionThreadModel.findOne({ id: threadId, spaceId }).lean().exec();
        if (!thread) {
            throw new common_1.NotFoundException(`讨论线不存在: ${threadId}`);
        }
        return thread;
    }
    async updateThread(spaceId, threadId, dto) {
        const updated = await this.discussionThreadModel
            .findOneAndUpdate({ id: threadId, spaceId }, { $set: dto }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException(`讨论线不存在: ${threadId}`);
        }
        return updated;
    }
    async getOrCreateSectionThread(spaceId, sectionId, sectionTitle) {
        const normalizedSectionId = String(sectionId || '').trim();
        if (!normalizedSectionId) {
            throw new common_1.BadRequestException('章节 ID 不能为空');
        }
        const existed = await this.discussionThreadModel
            .findOne({
            spaceId,
            outlineSectionId: normalizedSectionId,
        })
            .sort({ createdAt: 1 })
            .lean()
            .exec();
        if (existed) {
            return existed;
        }
        const space = await this.discussionSpaceService.getSpaceById(spaceId);
        const rootThreadId = String(space.rootThreadId || '').trim();
        if (!rootThreadId) {
            throw new common_1.NotFoundException('讨论空间缺少主讨论线，无法创建章节讨论线');
        }
        const outlineSections = Array.isArray(space.documentOutline?.sections)
            ? space.documentOutline.sections
            : [];
        const matchedSection = outlineSections.find((item) => String(item.id || '').trim() === normalizedSectionId);
        if (!matchedSection) {
            throw new common_1.NotFoundException(`章节不存在: ${normalizedSectionId}`);
        }
        return this.createThread(spaceId, {
            title: String(sectionTitle || '').trim() || matchedSection.title || '章节讨论',
            parentThreadId: rootThreadId,
            contextSummary: matchedSection.description,
            outlineSectionId: normalizedSectionId,
        });
    }
    async listThreadTree(spaceId) {
        const threads = await this.discussionThreadModel.find({ spaceId }).sort({ createdAt: 1 }).lean().exec();
        const map = new Map();
        for (const raw of threads) {
            map.set(raw.id, { ...raw, children: [] });
        }
        const roots = [];
        for (const thread of map.values()) {
            if (!thread.parentThreadId) {
                roots.push(thread);
                continue;
            }
            const parent = map.get(thread.parentThreadId);
            if (parent) {
                parent.children.push(thread);
            }
        }
        return roots;
    }
    async deleteThread(spaceId, threadId) {
        const space = await this.discussionSpaceService.getSpaceById(spaceId);
        if (space.rootThreadId && space.rootThreadId === threadId) {
            throw new common_1.BadRequestException('主讨论线不允许删除');
        }
        const threads = await this.discussionThreadModel.find({ spaceId }).lean().exec();
        const target = threads.find((item) => item.id === threadId);
        if (!target) {
            throw new common_1.NotFoundException(`讨论线不存在: ${threadId}`);
        }
        const deletedThreadIds = collectThreadSubtreeIds(threadId, threads);
        if (!deletedThreadIds.length) {
            throw new common_1.NotFoundException(`讨论线不存在: ${threadId}`);
        }
        const [deletedMessageCount, deletedKnowledgeCount] = await Promise.all([
            this.discussionMessageModel.countDocuments({ spaceId, threadId: { $in: deletedThreadIds } }).exec(),
            this.discussionKnowledgeEntryModel.countDocuments({ spaceId, threadId: { $in: deletedThreadIds } }).exec(),
        ]);
        await Promise.all([
            this.discussionThreadModel.deleteMany({ spaceId, id: { $in: deletedThreadIds } }).exec(),
            this.discussionMessageModel.deleteMany({ spaceId, threadId: { $in: deletedThreadIds } }).exec(),
            this.discussionKnowledgeEntryModel.deleteMany({ spaceId, threadId: { $in: deletedThreadIds } }).exec(),
        ]);
        if (target.parentThreadId) {
            await this.discussionThreadModel
                .updateOne({ spaceId, id: target.parentThreadId }, { $pull: { childThreadIds: threadId } })
                .exec();
        }
        await this.discussionSpaceService.incrementStatistics(spaceId, {
            totalThreads: -deletedThreadIds.length,
            totalMessages: -deletedMessageCount,
            totalKnowledgeEntries: -deletedKnowledgeCount,
        });
        return {
            deleted: true,
            threadId,
            deletedThreadIds,
        };
    }
    async incrementMessageCount(spaceId, threadId, participantId) {
        await this.discussionThreadModel.updateOne({ id: threadId, spaceId }, {
            $inc: { messageCount: 1 },
            $addToSet: { activeParticipantIds: participantId },
        }).exec();
    }
    async incrementSystemMessageCount(spaceId, threadId) {
        await this.discussionThreadModel
            .updateOne({ id: threadId, spaceId }, {
            $inc: { messageCount: 1 },
        })
            .exec();
    }
};
exports.DiscussionThreadService = DiscussionThreadService;
exports.DiscussionThreadService = DiscussionThreadService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_thread_schema_1.DiscussionThread.name)),
    __param(1, (0, mongoose_1.InjectModel)(discussion_message_schema_1.DiscussionMessage.name)),
    __param(2, (0, mongoose_1.InjectModel)(discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntry.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        discussion_space_service_1.DiscussionSpaceService])
], DiscussionThreadService);
//# sourceMappingURL=discussion-thread.service.js.map