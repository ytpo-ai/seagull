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
exports.MeetingMessageService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const meeting_schema_1 = require("../../../shared/schemas/meeting.schema");
const messages_service_1 = require("../../messages/messages.service");
const meeting_event_service_1 = require("./meeting-event.service");
const meeting_agent_state_service_1 = require("./meeting-agent-state.service");
const meeting_lifecycle_service_1 = require("./meeting-lifecycle.service");
let MeetingMessageService = class MeetingMessageService {
    constructor(meetingModel, messagesService, eventService, agentStateService, lifecycleService) {
        this.meetingModel = meetingModel;
        this.messagesService = messagesService;
        this.eventService = eventService;
        this.agentStateService = agentStateService;
        this.lifecycleService = lifecycleService;
    }
    setOnHumanMessageSentHook(hook) {
        this.onHumanMessageSentHook = hook;
    }
    async triggerAgentResponses(meetingId, triggerMessage) {
        if (!this.onHumanMessageSentHook)
            return;
        await this.onHumanMessageSentHook(meetingId, triggerMessage);
    }
    async sendMessage(meetingId, dto) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        if (meeting.status !== meeting_schema_1.MeetingStatus.ACTIVE) {
            throw new common_1.ConflictException('Meeting is not active');
        }
        const isSystemMessage = dto.senderType === 'system';
        const isHost = !isSystemMessage &&
            meeting.hostId === dto.senderId &&
            meeting.hostType === dto.senderType;
        const participant = isSystemMessage
            ? undefined
            : meeting.participants.find(p => p.participantId === dto.senderId && p.participantType === dto.senderType);
        if (participant && !participant.isPresent) {
            participant.isPresent = true;
            participant.joinedAt = participant.joinedAt || new Date();
        }
        if (!isSystemMessage && !participant && !isHost) {
            throw new common_1.ConflictException('Participant is not in the meeting or not present');
        }
        const message = {
            id: (0, uuid_1.v4)(),
            senderId: dto.senderId,
            senderType: dto.senderType,
            content: dto.content,
            type: dto.type || 'opinion',
            timestamp: new Date(),
            metadata: dto.metadata || {},
        };
        meeting.messages.push(message);
        meeting.messageCount += 1;
        if (participant) {
            participant.messageCount += 1;
            participant.hasSpoken = true;
        }
        await meeting.save();
        await this.messagesService.appendMessage({
            sceneType: 'meeting',
            sceneId: meetingId,
            senderType: message.senderType,
            senderId: message.senderId,
            content: message.content,
            messageType: message.type,
            metadata: {
                ...(message.metadata || {}),
                meetingId,
            },
            occurredAt: message.timestamp,
            traceId: message.id,
        });
        this.eventService.emitEvent(meetingId, {
            type: 'message',
            meetingId,
            data: message,
            timestamp: new Date(),
        });
        if (dto.senderType === 'employee') {
            await this.triggerAgentResponses(meetingId, message);
        }
        return message;
    }
    async addSystemMessage(meetingId, content) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting)
            return;
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        const message = {
            id: (0, uuid_1.v4)(),
            senderId: 'system',
            senderType: 'system',
            content,
            type: 'conclusion',
            timestamp: new Date(),
        };
        meeting.messages.push(message);
        meeting.messageCount += 1;
        await meeting.save();
        await this.messagesService.appendMessage({
            sceneType: 'meeting',
            sceneId: meetingId,
            senderType: 'system',
            senderId: 'system',
            senderRole: 'system',
            content,
            messageType: 'conclusion',
            metadata: {
                meetingId,
            },
            occurredAt: message.timestamp,
            traceId: message.id,
        });
        this.eventService.emitEvent(meetingId, {
            type: 'message',
            meetingId,
            data: message,
            timestamp: new Date(),
        });
    }
    analyzeMessageType(response) {
        const lowerResponse = response.toLowerCase();
        if (lowerResponse.includes('?') || lowerResponse.includes('？')) {
            return 'question';
        }
        else if (lowerResponse.includes('同意') || lowerResponse.includes('赞成') || lowerResponse.includes('agree')) {
            return 'agreement';
        }
        else if (lowerResponse.includes('不同意') || lowerResponse.includes('反对') || lowerResponse.includes('disagree')) {
            return 'disagreement';
        }
        else if (lowerResponse.includes('建议') || lowerResponse.includes('propose')) {
            return 'suggestion';
        }
        else if (lowerResponse.includes('总结') || lowerResponse.includes('conclusion')) {
            return 'conclusion';
        }
        return 'opinion';
    }
    hasAgentRepliedToMessage(meeting, messageId) {
        return (meeting.messages || []).some((item) => {
            if (!item || item.senderType !== 'agent') {
                return false;
            }
            const metadata = (item.metadata || {});
            return metadata.relatedMessageId === messageId;
        });
    }
    getMessageById(meeting, messageId) {
        const target = (meeting.messages || []).find((item) => item.id === messageId);
        return target || null;
    }
    assertMessageController(message, employeeId) {
        if (message.senderType !== 'employee' || message.senderId !== employeeId) {
            throw new common_1.ConflictException('Only the original sender can control this message');
        }
    }
    async pauseMessageResponse(meetingId, messageId, employeeId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        if (meeting.status !== meeting_schema_1.MeetingStatus.ACTIVE) {
            throw new common_1.ConflictException('Only active meetings support message pause');
        }
        const message = this.getMessageById(meeting, messageId);
        if (!message) {
            throw new common_1.NotFoundException(`Message not found: ${messageId}`);
        }
        this.assertMessageController(message, employeeId);
        if (this.hasAgentRepliedToMessage(meeting, messageId)) {
            throw new common_1.ConflictException('Message already has replies and cannot be paused');
        }
        const metadata = {
            ...(message.metadata || {}),
            pendingResponsePaused: true,
            pendingResponsePausedAt: new Date().toISOString(),
        };
        message.metadata = metadata;
        await meeting.save();
        await this.agentStateService.clearAllMeetingAgentThinking(meetingId, 'message_response_paused');
        return message;
    }
    async revokePausedMessage(meetingId, messageId, employeeId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        if (meeting.status !== meeting_schema_1.MeetingStatus.ACTIVE) {
            throw new common_1.ConflictException('Only active meetings support message revoke');
        }
        const targetMessage = this.getMessageById(meeting, messageId);
        if (!targetMessage) {
            throw new common_1.NotFoundException(`Message not found: ${messageId}`);
        }
        this.assertMessageController(targetMessage, employeeId);
        if (!targetMessage.metadata?.pendingResponsePaused) {
            throw new common_1.ConflictException('Message must be paused before revoke');
        }
        if (this.hasAgentRepliedToMessage(meeting, messageId)) {
            throw new common_1.ConflictException('Message already has replies and cannot be revoked');
        }
        const messageIndex = meeting.messages.findIndex((item) => item.id === messageId);
        if (messageIndex < 0) {
            throw new common_1.NotFoundException(`Message not found: ${messageId}`);
        }
        const [removedMessage] = meeting.messages.splice(messageIndex, 1);
        meeting.messageCount = Math.max(0, (meeting.messageCount || 0) - 1);
        const senderParticipant = meeting.participants.find((participant) => participant.participantId === removedMessage.senderId &&
            participant.participantType === removedMessage.senderType);
        if (senderParticipant) {
            senderParticipant.messageCount = Math.max(0, (senderParticipant.messageCount || 0) - 1);
            if (senderParticipant.messageCount === 0) {
                senderParticipant.hasSpoken = false;
            }
        }
        await meeting.save();
        await this.agentStateService.clearAllMeetingAgentThinking(meetingId, 'message_revoked');
        return meeting;
    }
};
exports.MeetingMessageService = MeetingMessageService;
exports.MeetingMessageService = MeetingMessageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(meeting_schema_1.Meeting.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        messages_service_1.MessagesService,
        meeting_event_service_1.MeetingEventService,
        meeting_agent_state_service_1.MeetingAgentStateService,
        meeting_lifecycle_service_1.MeetingLifecycleService])
], MeetingMessageService);
//# sourceMappingURL=meeting-message.service.js.map