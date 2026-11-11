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
exports.DiscussionParticipantService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const discussion_participant_schema_1 = require("../../../shared/schemas/discussion-participant.schema");
let DiscussionParticipantService = class DiscussionParticipantService {
    constructor(discussionParticipantModel) {
        this.discussionParticipantModel = discussionParticipantModel;
    }
    async addParticipant(spaceId, dto) {
        if (dto.type === discussion_participant_schema_1.DiscussionParticipantType.HUMAN && !dto.userId) {
            throw new common_1.BadRequestException('human 参与者必须提供 userId');
        }
        if (dto.type === discussion_participant_schema_1.DiscussionParticipantType.AI_AGENT && !dto.agentId) {
            throw new common_1.BadRequestException('ai_agent 参与者必须提供 agentId');
        }
        return this.discussionParticipantModel.create({
            ...dto,
            spaceId,
            expertiseTags: dto.expertiseTags || [],
            role: dto.role || discussion_participant_schema_1.DiscussionParticipantRole.ON_DEMAND,
        });
    }
    async ensureCreatorParticipant(spaceId, creatorId) {
        const existing = await this.discussionParticipantModel.findOne({ spaceId, userId: creatorId }).lean().exec();
        if (existing) {
            return;
        }
        await this.discussionParticipantModel.create({
            spaceId,
            type: discussion_participant_schema_1.DiscussionParticipantType.HUMAN,
            userId: creatorId,
            displayName: `用户-${creatorId}`,
            role: discussion_participant_schema_1.DiscussionParticipantRole.PRIMARY,
            expertiseTags: [],
        });
    }
    async listParticipants(spaceId) {
        return this.discussionParticipantModel.find({ spaceId }).sort({ createdAt: 1 }).lean().exec();
    }
    async updateParticipant(spaceId, participantId, dto) {
        const updated = await this.discussionParticipantModel
            .findOneAndUpdate({ id: participantId, spaceId }, { $set: dto }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException(`参与者不存在: ${participantId}`);
        }
        return updated;
    }
    async removeParticipant(spaceId, participantId) {
        const result = await this.discussionParticipantModel.deleteOne({ id: participantId, spaceId }).exec();
        if (result.deletedCount === 0) {
            throw new common_1.NotFoundException(`参与者不存在: ${participantId}`);
        }
    }
    async getParticipantById(spaceId, participantId) {
        const participant = await this.discussionParticipantModel.findOne({ id: participantId, spaceId }).lean().exec();
        if (!participant) {
            throw new common_1.NotFoundException(`参与者不存在: ${participantId}`);
        }
        return participant;
    }
    async getParticipantsByIds(spaceId, participantIds) {
        const ids = Array.from(new Set((participantIds || []).filter(Boolean)));
        if (!ids.length) {
            return [];
        }
        return this.discussionParticipantModel
            .find({ spaceId, id: { $in: ids } })
            .lean()
            .exec();
    }
    async resolveMentions(spaceId, content) {
        const mentionMatches = Array.from(content.matchAll(/@([^\s@]+)/g));
        if (!mentionMatches.length) {
            return [];
        }
        const participants = await this.discussionParticipantModel.find({ spaceId }).lean().exec();
        const byName = new Map();
        for (const participant of participants) {
            byName.set(participant.displayName, participant);
        }
        return mentionMatches
            .map((match) => {
            const name = match[1] || '';
            const participant = byName.get(name);
            if (!participant) {
                return null;
            }
            return {
                participantId: participant.id,
                displayName: participant.displayName,
                offset: match.index || 0,
            };
        })
            .filter((item) => !!item);
    }
    async incrementMessageCount(spaceId, participantId) {
        await this.discussionParticipantModel.updateOne({ id: participantId, spaceId }, { $inc: { messageCount: 1 }, $set: { lastActiveAt: new Date() } }).exec();
    }
};
exports.DiscussionParticipantService = DiscussionParticipantService;
exports.DiscussionParticipantService = DiscussionParticipantService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(discussion_participant_schema_1.DiscussionParticipant.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DiscussionParticipantService);
//# sourceMappingURL=discussion-participant.service.js.map