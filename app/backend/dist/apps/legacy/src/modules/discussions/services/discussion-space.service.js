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
exports.DiscussionSpaceService = exports.buildListSpacesFilter = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const discussion_space_schema_1 = require("../../../shared/schemas/discussion-space.schema");
const buildListSpacesFilter = (query) => {
    const filter = {};
    if (query.status) {
        filter.status = query.status;
    }
    else if (!query.includeArchived) {
        filter.status = { $ne: discussion_space_schema_1.DiscussionSpaceStatus.ARCHIVED };
    }
    if (query.category) {
        filter.category = query.category;
    }
    if (query.creatorId) {
        filter.creatorId = query.creatorId;
    }
    if (query.projectId) {
        filter.projectId = query.projectId;
    }
    if (query.tags?.length) {
        filter.tags = { $in: query.tags };
    }
    return filter;
};
exports.buildListSpacesFilter = buildListSpacesFilter;
let DiscussionSpaceService = class DiscussionSpaceService {
    constructor(discussionSpaceModel) {
        this.discussionSpaceModel = discussionSpaceModel;
    }
    async createSpace(dto) {
        const { industryContext, ...spacePayload } = dto;
        const normalizedIndustryContext = industryContext?.trim();
        return this.discussionSpaceModel.create({
            ...spacePayload,
            category: dto.category || discussion_space_schema_1.DiscussionSpaceCategory.GENERAL,
            metadata: normalizedIndustryContext ? { industryContext: normalizedIndustryContext } : undefined,
            status: discussion_space_schema_1.DiscussionSpaceStatus.ACTIVE,
            statistics: {
                totalThreads: 1,
                totalMessages: 0,
                totalKnowledgeEntries: 0,
                totalTokensConsumed: 0,
                totalCost: 0,
            },
        });
    }
    async listSpaces(query) {
        const filter = (0, exports.buildListSpacesFilter)(query);
        return this.discussionSpaceModel.find(filter).sort({ createdAt: -1 }).lean().exec();
    }
    async getSpaceById(spaceId) {
        const space = await this.discussionSpaceModel.findOne({ id: spaceId }).lean().exec();
        if (!space) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        return space;
    }
    async updateSpace(spaceId, dto) {
        const updated = await this.discussionSpaceModel
            .findOneAndUpdate({ id: spaceId }, { $set: dto }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        return updated;
    }
    async updateStatus(spaceId, status, operatorId) {
        if (status === discussion_space_schema_1.DiscussionSpaceStatus.ARCHIVED) {
            return this.archiveSpace(spaceId, operatorId);
        }
        const updated = await this.discussionSpaceModel
            .findOneAndUpdate({ id: spaceId }, {
            $set: { status },
            $unset: {
                archivedAt: '',
                archivedBy: '',
            },
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        return updated;
    }
    async archiveSpace(spaceId, operatorId) {
        const archivedBy = String(operatorId || '').trim();
        const updated = await this.discussionSpaceModel
            .findOneAndUpdate({ id: spaceId }, {
            $set: {
                status: discussion_space_schema_1.DiscussionSpaceStatus.ARCHIVED,
                archivedAt: new Date(),
                ...(archivedBy ? { archivedBy } : {}),
            },
            ...(archivedBy
                ? {}
                : {
                    $unset: {
                        archivedBy: '',
                    },
                }),
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException(`讨论空间不存在: ${spaceId}`);
        }
        return updated;
    }
    async unarchiveSpace(spaceId) {
        return this.updateStatus(spaceId, discussion_space_schema_1.DiscussionSpaceStatus.ACTIVE);
    }
    async setRootThread(spaceId, rootThreadId) {
        await this.discussionSpaceModel.updateOne({ id: spaceId }, { $set: { rootThreadId } }).exec();
    }
    async clearDefaultReplyAgentIfMatched(spaceId, participantId) {
        await this.discussionSpaceModel.updateOne({
            id: spaceId,
            'settings.defaultReplyAgentId': participantId,
        }, {
            $unset: {
                'settings.defaultReplyAgentId': '',
            },
        }).exec();
    }
    async incrementStatistics(spaceId, patch) {
        const $inc = {};
        if (patch.totalThreads) {
            $inc['statistics.totalThreads'] = patch.totalThreads;
        }
        if (patch.totalMessages) {
            $inc['statistics.totalMessages'] = patch.totalMessages;
        }
        if (patch.totalKnowledgeEntries) {
            $inc['statistics.totalKnowledgeEntries'] = patch.totalKnowledgeEntries;
        }
        if (patch.totalTokensConsumed) {
            $inc['statistics.totalTokensConsumed'] = patch.totalTokensConsumed;
        }
        if (patch.totalCost) {
            $inc['statistics.totalCost'] = patch.totalCost;
        }
        if (Object.keys($inc).length) {
            await this.discussionSpaceModel.updateOne({ id: spaceId }, { $inc }).exec();
        }
    }
};
exports.DiscussionSpaceService = DiscussionSpaceService;
exports.DiscussionSpaceService = DiscussionSpaceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_space_schema_1.DiscussionSpace.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DiscussionSpaceService);
//# sourceMappingURL=discussion-space.service.js.map