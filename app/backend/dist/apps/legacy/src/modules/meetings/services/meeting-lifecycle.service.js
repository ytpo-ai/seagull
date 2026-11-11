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
var MeetingLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const meeting_schema_1 = require("../../../shared/schemas/meeting.schema");
const messages_service_1 = require("../../messages/messages.service");
const meeting_event_service_1 = require("./meeting-event.service");
const meeting_agent_state_service_1 = require("./meeting-agent-state.service");
let MeetingLifecycleService = MeetingLifecycleService_1 = class MeetingLifecycleService {
    constructor(meetingModel, agentClientService, messagesService, eventService, agentStateService) {
        this.meetingModel = meetingModel;
        this.agentClientService = agentClientService;
        this.messagesService = messagesService;
        this.eventService = eventService;
        this.agentStateService = agentStateService;
        this.logger = new common_1.Logger(MeetingLifecycleService_1.name);
    }
    setOnAddSystemMessageHook(hook) {
        this.onAddSystemMessageHook = hook;
    }
    setOnAppendParticipantContextHook(hook) {
        this.onAppendParticipantContextHook = hook;
    }
    setOnPublishMeetingEndedSummaryEventHook(hook) {
        this.onPublishMeetingEndedSummaryEventHook = hook;
    }
    setOnPublishMeetingEndedMessageCenterEventHook(hook) {
        this.onPublishMeetingEndedMessageCenterEventHook = hook;
    }
    async addSystemMessage(meetingId, content) {
        if (!this.onAddSystemMessageHook)
            return;
        await this.onAddSystemMessageHook(meetingId, content);
    }
    async appendParticipantContextSystemMessage(meeting, action) {
        if (!this.onAppendParticipantContextHook)
            return;
        await this.onAppendParticipantContextHook(meeting, action);
    }
    async publishMeetingEndedSummaryEvent(meeting) {
        if (!this.onPublishMeetingEndedSummaryEventHook)
            return;
        await this.onPublishMeetingEndedSummaryEventHook(meeting);
    }
    async publishMeetingEndedMessageCenterEvent(meeting) {
        if (!this.onPublishMeetingEndedMessageCenterEventHook)
            return;
        await this.onPublishMeetingEndedMessageCenterEventHook(meeting);
    }
    normalizeSpeakingMode(mode) {
        if (mode === 'ordered' || mode === 'sequential' || mode === 'round_robin') {
            return 'ordered';
        }
        return 'free';
    }
    ensureMeetingCompatibility(meeting) {
        if (!meeting.hostType) {
            const hostParticipant = meeting.participants?.find(p => p.role === meeting_schema_1.ParticipantRole.HOST) || meeting.participants?.find(p => p.participantId === meeting.hostId);
            meeting.hostType = (hostParticipant?.participantType || 'employee');
        }
        if (!meeting.participants)
            meeting.participants = [];
        if (!meeting.messages)
            meeting.messages = [];
        if (!meeting.invitedParticipants)
            meeting.invitedParticipants = [];
        if (!meeting.settings)
            meeting.settings = {};
        meeting.settings.speakingOrder = this.normalizeSpeakingMode(meeting.settings.speakingOrder);
    }
    async createMeeting(dto) {
        const participants = [...(dto.participantIds || [])];
        const dedupedParticipants = Array.from(new Map(participants.map((participant) => [`${participant.type}:${participant.id}`, participant])).values());
        const filteredParticipants = dedupedParticipants.filter((p) => !(p.id === dto.hostId && p.type === dto.hostType));
        const meetingProjectId = String(dto.projectId || '').trim() || undefined;
        const meeting = new this.meetingModel({
            id: (0, uuid_1.v4)(),
            title: dto.title,
            description: dto.description,
            type: dto.type,
            status: meeting_schema_1.MeetingStatus.PENDING,
            hostId: dto.hostId,
            hostType: dto.hostType,
            ...(meetingProjectId ? { projectId: meetingProjectId } : {}),
            participants: [
                {
                    participantId: dto.hostId,
                    participantType: dto.hostType,
                    role: meeting_schema_1.ParticipantRole.HOST,
                    isPresent: false,
                    hasSpoken: false,
                    messageCount: 0,
                },
                ...filteredParticipants.map(p => ({
                    participantId: p.id,
                    participantType: p.type,
                    role: meeting_schema_1.ParticipantRole.PARTICIPANT,
                    isPresent: false,
                    hasSpoken: false,
                    messageCount: 0,
                })),
            ],
            agenda: dto.agenda,
            scheduledStartTime: dto.scheduledStartTime,
            settings: {
                maxParticipants: 20,
                allowAutoStart: true,
                aiModeration: false,
                recordTranscript: true,
                autoEndOnSilence: 30,
                ...dto.settings,
                speakingOrder: this.normalizeSpeakingMode(dto.settings?.speakingOrder),
            },
            messages: [],
            invitedParticipants: [],
            messageCount: 0,
        });
        const saved = await meeting.save();
        this.logger.log(`Created ${dto.type} meeting: ${saved.title} (${saved.id})`);
        return saved;
    }
    async startMeeting(meetingId, startedBy) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.ensureMeetingCompatibility(meeting);
        if (meeting.status === meeting_schema_1.MeetingStatus.ACTIVE) {
            throw new common_1.ConflictException('Meeting is already active');
        }
        if (meeting.status === meeting_schema_1.MeetingStatus.ENDED || meeting.status === meeting_schema_1.MeetingStatus.ARCHIVED) {
            throw new common_1.ConflictException('Meeting has already ended');
        }
        meeting.status = meeting_schema_1.MeetingStatus.ACTIVE;
        meeting.startedAt = new Date();
        const startTime = new Date();
        const hostParticipant = meeting.participants.find(p => p.participantId === meeting.hostId && p.participantType === meeting.hostType);
        if (hostParticipant) {
            hostParticipant.isPresent = true;
            hostParticipant.joinedAt = startTime;
        }
        meeting.participants.forEach((participant) => {
            if (participant.participantType === 'agent' && !participant.isPresent) {
                participant.isPresent = true;
                participant.joinedAt = startTime;
            }
        });
        await meeting.save();
        await this.addSystemMessage(meetingId, `会议 "${meeting.title}" 已开始。`);
        await this.appendParticipantContextSystemMessage(meeting, 'initialized');
        this.eventService.emitEvent(meetingId, {
            type: 'status_changed',
            meetingId,
            data: { status: meeting_schema_1.MeetingStatus.ACTIVE, startedBy },
            timestamp: new Date(),
        });
        this.logger.log(`Meeting ${meetingId} started by ${startedBy.name}`);
        return meeting;
    }
    async endMeeting(meetingId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.ensureMeetingCompatibility(meeting);
        if (meeting.status === meeting_schema_1.MeetingStatus.ARCHIVED) {
            throw new common_1.ConflictException('Archived meeting cannot be ended again');
        }
        if (meeting.status === meeting_schema_1.MeetingStatus.ENDED) {
            this.logger.warn(`Meeting ${meetingId} is already ended, skip duplicate end flow`);
            return meeting;
        }
        meeting.status = meeting_schema_1.MeetingStatus.ENDED;
        meeting.endedAt = new Date();
        meeting.participants.forEach(p => {
            if (p.isPresent) {
                p.isPresent = false;
                p.leftAt = new Date();
            }
        });
        await meeting.save();
        await this.agentStateService.clearAllMeetingAgentThinking(meetingId, 'meeting_ended');
        await this.addSystemMessage(meetingId, `会议 "${meeting.title}" 已结束。`);
        await this.publishMeetingEndedSummaryEvent(meeting);
        await this.publishMeetingEndedMessageCenterEvent(meeting);
        this.eventService.emitEvent(meetingId, {
            type: 'status_changed',
            meetingId,
            data: { status: meeting_schema_1.MeetingStatus.ENDED },
            timestamp: new Date(),
        });
        this.logger.log(`Meeting ${meetingId} ended`);
        return meeting;
    }
    async pauseMeeting(meetingId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.ensureMeetingCompatibility(meeting);
        if (meeting.status !== meeting_schema_1.MeetingStatus.ACTIVE) {
            throw new common_1.ConflictException('Only active meetings can be paused');
        }
        meeting.status = meeting_schema_1.MeetingStatus.PAUSED;
        await meeting.save();
        await this.agentStateService.clearAllMeetingAgentThinking(meetingId, 'meeting_paused');
        this.eventService.emitEvent(meetingId, {
            type: 'status_changed',
            meetingId,
            data: { status: meeting_schema_1.MeetingStatus.PAUSED },
            timestamp: new Date(),
        });
        return meeting;
    }
    async resumeMeeting(meetingId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.ensureMeetingCompatibility(meeting);
        if (meeting.status !== meeting_schema_1.MeetingStatus.PAUSED) {
            throw new common_1.ConflictException('Only paused meetings can be resumed');
        }
        meeting.status = meeting_schema_1.MeetingStatus.ACTIVE;
        await meeting.save();
        this.eventService.emitEvent(meetingId, {
            type: 'status_changed',
            meetingId,
            data: { status: meeting_schema_1.MeetingStatus.ACTIVE },
            timestamp: new Date(),
        });
        return meeting;
    }
    async updateSpeakingMode(meetingId, speakingOrder) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.ensureMeetingCompatibility(meeting);
        if (meeting.status === meeting_schema_1.MeetingStatus.ENDED || meeting.status === meeting_schema_1.MeetingStatus.ARCHIVED) {
            throw new common_1.ConflictException('Cannot update speaking mode for ended meeting');
        }
        meeting.settings = {
            ...meeting.settings,
            speakingOrder: this.normalizeSpeakingMode(speakingOrder),
        };
        await meeting.save();
        this.eventService.emitEvent(meetingId, {
            type: 'settings_changed',
            meetingId,
            data: { speakingOrder: meeting.settings.speakingOrder },
            timestamp: new Date(),
        });
        return meeting;
    }
    async updateMeetingTitle(meetingId, title) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        const nextTitle = String(title || '').trim();
        if (!nextTitle) {
            throw new common_1.BadRequestException('Meeting title is required');
        }
        if (meeting.title === nextTitle) {
            return meeting;
        }
        meeting.title = nextTitle;
        await meeting.save();
        this.eventService.emitEvent(meetingId, {
            type: 'settings_changed',
            meetingId,
            data: { title: nextTitle },
            timestamp: new Date(),
        });
        return meeting;
    }
    async archiveMeeting(meetingId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.ensureMeetingCompatibility(meeting);
        if (meeting.status !== meeting_schema_1.MeetingStatus.ENDED) {
            throw new common_1.ConflictException('Only ended meetings can be archived');
        }
        meeting.status = meeting_schema_1.MeetingStatus.ARCHIVED;
        await meeting.save();
        await this.agentStateService.clearAllMeetingAgentThinking(meetingId, 'meeting_archived');
        this.logger.log(`Meeting ${meetingId} archived`);
        return meeting;
    }
    async deleteMeeting(meetingId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        if (meeting.status !== meeting_schema_1.MeetingStatus.PENDING &&
            meeting.status !== meeting_schema_1.MeetingStatus.ENDED &&
            meeting.status !== meeting_schema_1.MeetingStatus.ARCHIVED) {
            throw new common_1.ConflictException('Only pending, ended, or archived meetings can be deleted');
        }
        await this.agentStateService.clearAllMeetingAgentThinking(meetingId, 'meeting_deleted');
        await this.messagesService.deleteMessagesByScene('meeting', meetingId);
        await this.meetingModel.deleteOne({ id: meetingId }).exec();
        this.logger.log(`Meeting ${meetingId} deleted`);
    }
    async getMeeting(meetingId) {
        return this.meetingModel.findOne({ id: meetingId }).exec();
    }
    async getMeetingDetail(meetingId) {
        return this.getMeeting(meetingId);
    }
    async getAllMeetings(filters) {
        const query = {};
        if (filters?.type)
            query.type = filters.type;
        if (filters?.status)
            query.status = filters.status;
        if (filters?.projectId !== undefined) {
            query.projectId = filters.projectId || { $in: [null, '', undefined] };
        }
        return this.meetingModel.find(query).sort({ createdAt: -1 }).exec();
    }
    async getMeetingsByParticipant(participantId, participantType) {
        return this.meetingModel.find({
            $or: [
                { hostId: participantId, hostType: participantType },
                { 'participants.participantId': participantId, 'participants.participantType': participantType },
                { 'invitedParticipants.participantId': participantId, 'invitedParticipants.participantType': participantType },
            ],
        }).sort({ createdAt: -1 }).exec();
    }
    async getMeetingStats() {
        const total = await this.meetingModel.countDocuments();
        const byType = await this.meetingModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
        const byStatus = await this.meetingModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
        const totalMessages = await this.meetingModel.aggregate([{ $group: { _id: null, total: { $sum: '$messageCount' } } }]);
        return {
            total,
            byType,
            byStatus,
            totalMessages: totalMessages[0]?.total || 0,
        };
    }
};
exports.MeetingLifecycleService = MeetingLifecycleService;
exports.MeetingLifecycleService = MeetingLifecycleService = MeetingLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(meeting_schema_1.Meeting.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        messages_service_1.MessagesService,
        meeting_event_service_1.MeetingEventService,
        meeting_agent_state_service_1.MeetingAgentStateService])
], MeetingLifecycleService);
//# sourceMappingURL=meeting-lifecycle.service.js.map