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
var MeetingSummaryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingSummaryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const meeting_schema_1 = require("../../../shared/schemas/meeting.schema");
const meeting_inner_message_constants_1 = require("../meeting-inner-message.constants");
const meeting_event_service_1 = require("./meeting-event.service");
const meeting_lifecycle_service_1 = require("./meeting-lifecycle.service");
const meeting_message_center_event_service_1 = require("./meeting-message-center-event.service");
let MeetingSummaryService = MeetingSummaryService_1 = class MeetingSummaryService {
    constructor(meetingModel, agentClientService, eventService, lifecycleService, meetingMessageCenterEventService) {
        this.meetingModel = meetingModel;
        this.agentClientService = agentClientService;
        this.eventService = eventService;
        this.lifecycleService = lifecycleService;
        this.meetingMessageCenterEventService = meetingMessageCenterEventService;
        this.logger = new common_1.Logger(MeetingSummaryService_1.name);
        this.meetingSummaryEventSenderAgentId = 'meeting-system';
    }
    async publishMeetingEndedSummaryEvent(meeting) {
        const meetingId = String(meeting?.id || '').trim();
        if (!meetingId) {
            return;
        }
        const endedAt = meeting.endedAt ? new Date(meeting.endedAt).toISOString() : new Date().toISOString();
        const dedupKey = `${meeting_inner_message_constants_1.MEETING_ENDED_EVENT_TYPE}:${meetingId}:${endedAt}`;
        try {
            await this.agentClientService.publishInnerMessage({
                senderAgentId: this.meetingSummaryEventSenderAgentId,
                eventType: meeting_inner_message_constants_1.MEETING_ENDED_EVENT_TYPE,
                title: `会议结束：${meeting.title}`,
                content: `会议 ${meetingId} 已结束，请生成会后总结。`,
                payload: {
                    meetingId,
                    title: meeting.title,
                    endedAt,
                    hostId: meeting.hostId,
                    hostType: meeting.hostType,
                    status: meeting.status,
                },
                source: 'meeting-service',
                dedupKey,
            });
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to publish meeting ended event for meeting ${meetingId}: ${reason}`);
        }
    }
    async generateMeetingSummary(meetingId, payload) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            return { generated: false, reason: 'meeting_not_found' };
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        const summaryContent = String(payload?.summary || '').trim();
        if (!summaryContent) {
            return { generated: false, reason: 'empty_summary' };
        }
        const existingSummaryContent = String(meeting.summary?.content || '').trim();
        if (!payload?.overwrite && existingSummaryContent && meeting.summary?.generatedAt) {
            return { generated: false, reason: 'already_generated' };
        }
        meeting.summary = {
            content: summaryContent,
            actionItems: this.normalizeSummaryItems(payload?.actionItems),
            decisions: this.normalizeSummaryItems(payload?.decisions),
            generatedAt: new Date(),
        };
        await meeting.save();
        await this.meetingMessageCenterEventService.publishMeetingSummaryGeneratedMessage(meeting);
        this.eventService.emitEvent(meetingId, {
            type: 'summary_generated',
            meetingId,
            data: {
                summary: summaryContent,
                generatedByAgentId: String(payload?.generatedByAgentId || '').trim() || undefined,
            },
            timestamp: new Date(),
        });
        this.logger.log(`Generated summary for meeting ${meetingId}`);
        return { generated: true };
    }
    normalizeSummaryItems(values) {
        if (!Array.isArray(values)) {
            return [];
        }
        return values
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }
};
exports.MeetingSummaryService = MeetingSummaryService;
exports.MeetingSummaryService = MeetingSummaryService = MeetingSummaryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(meeting_schema_1.Meeting.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        meeting_event_service_1.MeetingEventService,
        meeting_lifecycle_service_1.MeetingLifecycleService,
        meeting_message_center_event_service_1.MeetingMessageCenterEventService])
], MeetingSummaryService);
//# sourceMappingURL=meeting-summary.service.js.map