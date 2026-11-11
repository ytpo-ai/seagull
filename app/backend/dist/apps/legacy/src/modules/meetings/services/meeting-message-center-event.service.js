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
var MeetingMessageCenterEventService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingMessageCenterEventService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const infra_1 = require("../../../../libs/infra/src/index");
let MeetingMessageCenterEventService = MeetingMessageCenterEventService_1 = class MeetingMessageCenterEventService {
    constructor(redisService, messageBus) {
        this.redisService = redisService;
        this.messageBus = messageBus;
        this.logger = new common_1.Logger(MeetingMessageCenterEventService_1.name);
    }
    async publishMeetingEndedMessage(meeting) {
        const meetingId = String(meeting?.id || '').trim();
        if (!meetingId) {
            return;
        }
        const receivers = this.resolveReceiverIds(meeting);
        if (!receivers.length) {
            return;
        }
        const endedAt = meeting.endedAt ? new Date(meeting.endedAt).toISOString() : new Date().toISOString();
        const streamIds = [];
        for (const receiverId of receivers) {
            try {
                const event = (0, infra_1.buildMessageCenterEvent)({
                    eventType: 'meeting.session.ended',
                    source: infra_1.MESSAGE_CENTER_EVENT_SOURCE_MEETING,
                    traceId: (0, crypto_1.randomUUID)(),
                    occurredAt: endedAt,
                    data: {
                        receiverId,
                        messageType: 'system_alert',
                        title: '会议已结束',
                        content: `会议《${meeting.title || meetingId}》已结束，可查看会议详情与总结。`,
                        actionUrl: `/meetings/${encodeURIComponent(meetingId)}`,
                        bizKey: `meeting:${meetingId}:ended:${receiverId}`,
                        priority: 'normal',
                        extra: {
                            meetingId,
                            endedAt,
                            status: 'ended',
                            hostId: String(meeting.hostId || '').trim(),
                            hostType: String(meeting.hostType || '').trim(),
                        },
                    },
                });
                const result = await this.messageBus.publish('message-center.events', { payload: event });
                if (result.sequenceId) {
                    streamIds.push(result.sequenceId);
                }
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error || 'unknown');
                this.logger.warn(`Failed to publish meeting-ended message-center event (non-blocking): meetingId=${meetingId} receiverId=${receiverId} reason=${reason}`);
            }
        }
        this.logger.log(`Published meeting-ended message-center events: meetingId=${meetingId} receivers=${receivers.length} streamIds=${streamIds.join(',') || 'n/a'}`);
    }
    async publishMeetingSummaryGeneratedMessage(meeting) {
        const meetingId = String(meeting?.id || '').trim();
        if (!meetingId) {
            return;
        }
        const receivers = this.resolveReceiverIds(meeting);
        if (!receivers.length) {
            return;
        }
        const generatedAt = meeting.summary?.generatedAt
            ? new Date(meeting.summary.generatedAt).toISOString()
            : new Date().toISOString();
        const summaryContent = String(meeting.summary?.content || '').trim();
        const actionItems = Array.isArray(meeting.summary?.actionItems) ? meeting.summary.actionItems : [];
        const decisions = Array.isArray(meeting.summary?.decisions) ? meeting.summary.decisions : [];
        for (const receiverId of receivers) {
            try {
                const event = (0, infra_1.buildMessageCenterEvent)({
                    eventType: 'meeting.summary.generated',
                    source: infra_1.MESSAGE_CENTER_EVENT_SOURCE_MEETING,
                    traceId: (0, crypto_1.randomUUID)(),
                    occurredAt: generatedAt,
                    data: {
                        receiverId,
                        messageType: 'system_alert',
                        title: '会议纪要已生成',
                        content: summaryContent || `会议《${meeting.title || meetingId}》已生成纪要。`,
                        actionUrl: `/meetings/${encodeURIComponent(meetingId)}`,
                        bizKey: `meeting:${meetingId}:summary:${receiverId}`,
                        priority: 'normal',
                        extra: {
                            meetingId,
                            generatedAt,
                            summary: summaryContent,
                            actionItems,
                            decisions,
                        },
                    },
                });
                await this.messageBus.publish('message-center.events', { payload: event });
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error || 'unknown');
                this.logger.warn(`Failed to publish meeting-summary-generated event (non-blocking): meetingId=${meetingId} receiverId=${receiverId} reason=${reason}`);
            }
        }
    }
    resolveReceiverIds(meeting) {
        const receiverIds = new Set();
        if (meeting.hostType === 'employee' && String(meeting.hostId || '').trim()) {
            receiverIds.add(String(meeting.hostId).trim());
        }
        for (const participant of meeting.participants || []) {
            if (!participant) {
                continue;
            }
            if (participant.participantType === 'employee') {
                const participantId = String(participant.participantId || '').trim();
                if (participantId) {
                    receiverIds.add(participantId);
                }
                continue;
            }
            const mappedEmployeeId = String(participant.assistantForEmployeeId || '').trim();
            if (mappedEmployeeId) {
                receiverIds.add(mappedEmployeeId);
            }
        }
        return Array.from(receiverIds.values());
    }
};
exports.MeetingMessageCenterEventService = MeetingMessageCenterEventService;
exports.MeetingMessageCenterEventService = MeetingMessageCenterEventService = MeetingMessageCenterEventService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(infra_1.MESSAGE_BUS)),
    __metadata("design:paramtypes", [infra_1.RedisService, Object])
], MeetingMessageCenterEventService);
//# sourceMappingURL=meeting-message-center-event.service.js.map