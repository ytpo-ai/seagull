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
var DiscussionMentionDispatchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionMentionDispatchService = void 0;
const common_1 = require("@nestjs/common");
const discussion_participant_schema_1 = require("../../../shared/schemas/discussion-participant.schema");
const message_center_service_1 = require("../../message-center/message-center.service");
const discussion_space_service_1 = require("./discussion-space.service");
let DiscussionMentionDispatchService = DiscussionMentionDispatchService_1 = class DiscussionMentionDispatchService {
    constructor(messageCenterService, discussionSpaceService) {
        this.messageCenterService = messageCenterService;
        this.discussionSpaceService = discussionSpaceService;
        this.logger = new common_1.Logger(DiscussionMentionDispatchService_1.name);
    }
    async dispatchMentions(input) {
        const aiParticipants = [];
        const notifiedHumanParticipantIds = [];
        if (!input.mentionTargets.length) {
            return { aiParticipants, notifiedHumanParticipantIds };
        }
        const space = await this.discussionSpaceService.getSpaceById(input.spaceId);
        for (const participant of input.mentionTargets) {
            if (participant.type === discussion_participant_schema_1.DiscussionParticipantType.AI_AGENT) {
                aiParticipants.push(participant);
                continue;
            }
            const receiverId = String(participant.userId || '').trim();
            if (!receiverId) {
                continue;
            }
            try {
                await this.messageCenterService.createSystemMessage({
                    receiverId,
                    type: 'system_alert',
                    source: 'discussion-service',
                    title: `讨论中有人@你：${space.title}`,
                    content: `${participant.displayName} 在讨论中被提及，请及时查看上下文并参与回复。`,
                    dedupKey: `discussion:mention:${input.spaceId}:${input.threadId}:${input.messageId}:${participant.id}`,
                    payload: {
                        spaceId: input.spaceId,
                        threadId: input.threadId,
                        messageId: input.messageId,
                        mentionedParticipantId: participant.id,
                        senderParticipantId: input.senderParticipantId,
                        actionUrl: `/discussions/${encodeURIComponent(input.spaceId)}?threadId=${encodeURIComponent(input.threadId)}`,
                    },
                });
                notifiedHumanParticipantIds.push(participant.id);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error || 'unknown');
                this.logger.warn(`Failed to notify mentioned human participant (non-blocking): spaceId=${input.spaceId} participantId=${participant.id} reason=${reason}`);
            }
        }
        return {
            aiParticipants,
            notifiedHumanParticipantIds,
        };
    }
};
exports.DiscussionMentionDispatchService = DiscussionMentionDispatchService;
exports.DiscussionMentionDispatchService = DiscussionMentionDispatchService = DiscussionMentionDispatchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [message_center_service_1.MessageCenterService,
        discussion_space_service_1.DiscussionSpaceService])
], DiscussionMentionDispatchService);
//# sourceMappingURL=discussion-mention-dispatch.service.js.map