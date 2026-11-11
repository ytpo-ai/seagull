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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingService = void 0;
const common_1 = require("@nestjs/common");
const meeting_event_service_1 = require("./services/meeting-event.service");
const meeting_agent_state_service_1 = require("./services/meeting-agent-state.service");
const meeting_lifecycle_service_1 = require("./services/meeting-lifecycle.service");
const meeting_participant_service_1 = require("./services/meeting-participant.service");
const meeting_message_service_1 = require("./services/meeting-message.service");
const meeting_orchestration_service_1 = require("./services/meeting-orchestration.service");
const meeting_summary_service_1 = require("./services/meeting-summary.service");
const meeting_message_center_event_service_1 = require("./services/meeting-message-center-event.service");
let MeetingService = class MeetingService {
    constructor(eventService, agentStateService, lifecycleService, participantService, messageService, orchestrationService, summaryService, meetingMessageCenterEventService) {
        this.eventService = eventService;
        this.agentStateService = agentStateService;
        this.lifecycleService = lifecycleService;
        this.participantService = participantService;
        this.messageService = messageService;
        this.orchestrationService = orchestrationService;
        this.summaryService = summaryService;
        this.meetingMessageCenterEventService = meetingMessageCenterEventService;
    }
    onModuleInit() {
        this.messageService.setOnHumanMessageSentHook((meetingId, message) => this.orchestrationService.triggerAgentResponses(meetingId, message));
        this.participantService.setOnAddSystemMessageHook((meetingId, content) => this.messageService.addSystemMessage(meetingId, content));
        this.participantService.setOnAgentJoinedActiveHook((meetingId, participant) => this.orchestrationService.catchUpAgent(meetingId, participant));
        this.lifecycleService.setOnAddSystemMessageHook((meetingId, content) => this.messageService.addSystemMessage(meetingId, content));
        this.lifecycleService.setOnAppendParticipantContextHook((meeting, action) => this.participantService.appendParticipantContextSystemMessage(meeting, action));
        this.lifecycleService.setOnPublishMeetingEndedSummaryEventHook((meeting) => this.summaryService.publishMeetingEndedSummaryEvent(meeting));
        this.lifecycleService.setOnPublishMeetingEndedMessageCenterEventHook((meeting) => this.meetingMessageCenterEventService.publishMeetingEndedMessage(meeting));
    }
    createMeeting(dto) {
        return this.lifecycleService.createMeeting(dto);
    }
    startMeeting(meetingId, startedBy) {
        return this.lifecycleService.startMeeting(meetingId, startedBy);
    }
    endMeeting(meetingId) {
        return this.lifecycleService.endMeeting(meetingId);
    }
    pauseMeeting(meetingId) {
        return this.lifecycleService.pauseMeeting(meetingId);
    }
    resumeMeeting(meetingId) {
        return this.lifecycleService.resumeMeeting(meetingId);
    }
    updateSpeakingMode(meetingId, speakingOrder) {
        return this.lifecycleService.updateSpeakingMode(meetingId, speakingOrder);
    }
    updateMeetingTitle(meetingId, title) {
        return this.lifecycleService.updateMeetingTitle(meetingId, title);
    }
    archiveMeeting(meetingId) {
        return this.lifecycleService.archiveMeeting(meetingId);
    }
    deleteMeeting(meetingId) {
        return this.lifecycleService.deleteMeeting(meetingId);
    }
    joinMeeting(meetingId, participant) {
        return this.participantService.joinMeeting(meetingId, participant);
    }
    leaveMeeting(meetingId, participant) {
        return this.participantService.leaveMeeting(meetingId, participant);
    }
    inviteParticipant(meetingId, participant, invitedBy) {
        return this.participantService.inviteParticipant(meetingId, participant, invitedBy);
    }
    addParticipant(meetingId, participant) {
        return this.participantService.addParticipant(meetingId, participant);
    }
    removeParticipant(meetingId, participantId, participantType) {
        return this.participantService.removeParticipant(meetingId, participantId, participantType);
    }
    sendMessage(meetingId, dto) {
        return this.messageService.sendMessage(meetingId, dto);
    }
    pauseMessageResponse(meetingId, messageId, employeeId) {
        return this.messageService.pauseMessageResponse(meetingId, messageId, employeeId);
    }
    revokePausedMessage(meetingId, messageId, employeeId) {
        return this.messageService.revokePausedMessage(meetingId, messageId, employeeId);
    }
    getMeeting(meetingId) {
        return this.lifecycleService.getMeeting(meetingId);
    }
    getMeetingDetail(meetingId) {
        return this.lifecycleService.getMeetingDetail(meetingId);
    }
    getMeetingAgentStates(meetingId) {
        return this.agentStateService.getMeetingAgentStates(meetingId);
    }
    getAllMeetings(filters) {
        return this.lifecycleService.getAllMeetings(filters);
    }
    getMeetingsByParticipant(participantId, participantType) {
        return this.lifecycleService.getMeetingsByParticipant(participantId, participantType);
    }
    getMeetingStats() {
        return this.lifecycleService.getMeetingStats();
    }
    generateMeetingSummary(meetingId, payload) {
        return this.summaryService.generateMeetingSummary(meetingId, payload);
    }
    subscribeToEvents(meetingId, callback) {
        this.eventService.subscribeToEvents(meetingId, callback);
    }
    unsubscribeFromEvents(meetingId, callback) {
        this.eventService.unsubscribeFromEvents(meetingId, callback);
    }
};
exports.MeetingService = MeetingService;
exports.MeetingService = MeetingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [meeting_event_service_1.MeetingEventService,
        meeting_agent_state_service_1.MeetingAgentStateService,
        meeting_lifecycle_service_1.MeetingLifecycleService,
        meeting_participant_service_1.MeetingParticipantService,
        meeting_message_service_1.MeetingMessageService,
        meeting_orchestration_service_1.MeetingOrchestrationService,
        meeting_summary_service_1.MeetingSummaryService,
        meeting_message_center_event_service_1.MeetingMessageCenterEventService])
], MeetingService);
//# sourceMappingURL=meeting.service.js.map