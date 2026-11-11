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
exports.ChannelMeetingAutoService = void 0;
const common_1 = require("@nestjs/common");
const channel_api_client_service_1 = require("./channel-api-client.service");
const channel_meeting_relay_service_1 = require("./channel-meeting-relay.service");
const channel_session_service_1 = require("./channel-session.service");
let ChannelMeetingAutoService = class ChannelMeetingAutoService {
    constructor(apiClient, relayService, sessionService) {
        this.apiClient = apiClient;
        this.relayService = relayService;
        this.sessionService = sessionService;
    }
    async resolveOrCreateOneOnOneMeeting(input) {
        const employeeId = String(input.employeeId || '').trim();
        const agentId = String(input.agentId || '').trim();
        if (!employeeId || !agentId) {
            throw new Error('resolve_one_on_one_invalid_input');
        }
        let meetingId = await this.findReusableOneOnOneMeetingFromSession(input.sessionFilter, employeeId, agentId);
        if (!meetingId) {
            meetingId = await this.findActiveOneOnOneMeeting(employeeId, agentId);
        }
        if (!meetingId) {
            meetingId = await this.createOneOnOneMeeting(employeeId, agentId);
        }
        await this.ensureMeetingReady(meetingId, employeeId);
        await this.relayService.startRelay({
            meetingId,
            chatId: String(input.chatId || '').trim(),
            employeeId,
        });
        await this.sessionService.setActiveMeeting(input.sessionFilter, meetingId, 'one_on_one', employeeId);
        return meetingId;
    }
    async switchAgent(input) {
        const employeeId = String(input.employeeId || '').trim();
        const currentMeetingId = String(input.currentMeetingId || '').trim();
        if (currentMeetingId) {
            await this.callApiAsUser(employeeId, {
                method: 'post',
                url: `/api/meetings/${currentMeetingId}/end`,
            }).catch(() => undefined);
            await this.relayService.stopRelay(currentMeetingId, employeeId).catch(() => undefined);
            await this.sessionService.clearActiveMeeting(input.sessionFilter);
        }
        return this.resolveOrCreateOneOnOneMeeting({
            employeeId,
            agentId: input.newAgentId,
            sessionFilter: input.sessionFilter,
            chatId: input.chatId,
        });
    }
    async endOneOnOneMeeting(input) {
        const meetingId = String(input.meetingId || '').trim();
        const employeeId = String(input.employeeId || '').trim();
        if (!meetingId || !employeeId) {
            return;
        }
        await this.callApiAsUser(employeeId, {
            method: 'post',
            url: `/api/meetings/${meetingId}/end`,
        }).catch(() => undefined);
        await this.relayService.stopRelay(meetingId, employeeId).catch(() => undefined);
        await this.sessionService.clearActiveMeeting(input.sessionFilter);
    }
    async findActiveOneOnOneMeeting(employeeId, agentId) {
        const response = await this.callApiAsUser(employeeId, {
            method: 'get',
            url: `/api/meetings/by-participant/${employeeId}`,
            params: {
                type: 'employee',
            },
        });
        const meetings = Array.isArray(response) ? response : [];
        const matched = meetings.find((item) => {
            const meeting = item;
            if (String(meeting.type || '').trim() !== 'one_on_one' || String(meeting.status || '').trim() !== 'active') {
                return false;
            }
            const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
            const normalized = participants.map((participant) => `${participant.participantType}:${participant.participantId}`);
            const unique = Array.from(new Set(normalized));
            return unique.length === 2 && unique.includes(`employee:${employeeId}`) && unique.includes(`agent:${agentId}`);
        });
        const meetingId = String(matched?.id || '').trim();
        return meetingId || undefined;
    }
    async createOneOnOneMeeting(employeeId, agentId) {
        const agentName = await this.resolveAgentName(employeeId, agentId);
        const created = (await this.callApiAsUser(employeeId, {
            method: 'post',
            url: '/api/meetings',
            data: {
                title: `与 ${agentName} 的1对1聊天`,
                type: 'one_on_one',
                hostId: employeeId,
                hostType: 'employee',
                participantIds: [{ id: agentId, type: 'agent' }],
            },
        }));
        const meetingId = String(created?.id || '').trim();
        if (!meetingId) {
            throw new Error('create_one_on_one_meeting_failed');
        }
        return meetingId;
    }
    async ensureMeetingReady(meetingId, employeeId) {
        let meeting = (await this.callApiAsUser(employeeId, {
            method: 'get',
            url: `/api/meetings/${meetingId}`,
        }));
        const status = String(meeting.status || '').trim();
        if (status === 'pending') {
            meeting = (await this.callApiAsUser(employeeId, {
                method: 'post',
                url: `/api/meetings/${meetingId}/start`,
                data: {
                    id: employeeId,
                    type: 'employee',
                    name: employeeId,
                    isHuman: true,
                },
            }));
        }
        else if (status === 'paused') {
            meeting = (await this.callApiAsUser(employeeId, {
                method: 'post',
                url: `/api/meetings/${meetingId}/resume`,
            }));
        }
        const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
        const employeeInMeeting = participants.some((participant) => String(participant.participantType || '').trim() === 'employee' &&
            String(participant.participantId || '').trim() === employeeId &&
            participant.isPresent);
        if (!employeeInMeeting) {
            await this.callApiAsUser(employeeId, {
                method: 'post',
                url: `/api/meetings/${meetingId}/join`,
                data: {
                    id: employeeId,
                    type: 'employee',
                    name: employeeId,
                    isHuman: true,
                },
            });
        }
    }
    async findReusableOneOnOneMeetingFromSession(sessionFilter, employeeId, agentId) {
        const activeMeeting = await this.sessionService.getActiveMeeting(sessionFilter);
        if (!activeMeeting || activeMeeting.meetingType !== 'one_on_one') {
            return undefined;
        }
        const meetingId = String(activeMeeting.meetingId || '').trim();
        if (!meetingId) {
            return undefined;
        }
        try {
            const meeting = (await this.callApiAsUser(employeeId, {
                method: 'get',
                url: `/api/meetings/${meetingId}`,
            }));
            if (String(meeting.status || '').trim() !== 'active' || String(meeting.type || '').trim() !== 'one_on_one') {
                return undefined;
            }
            const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
            const normalized = participants.map((participant) => `${participant.participantType}:${participant.participantId}`);
            const unique = Array.from(new Set(normalized));
            if (unique.length === 2 && unique.includes(`employee:${employeeId}`) && unique.includes(`agent:${agentId}`)) {
                return meetingId;
            }
            return undefined;
        }
        catch {
            return undefined;
        }
    }
    async resolveAgentName(employeeId, agentId) {
        try {
            const agent = (await this.callApiAsUser(employeeId, {
                method: 'get',
                url: `/api/agents/${agentId}`,
            }));
            const name = String(agent?.name || '').trim();
            return name || agentId;
        }
        catch {
            return agentId;
        }
    }
    async callApiAsUser(employeeId, request) {
        return this.apiClient.callApiAsUser(employeeId, request);
    }
};
exports.ChannelMeetingAutoService = ChannelMeetingAutoService;
exports.ChannelMeetingAutoService = ChannelMeetingAutoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [channel_api_client_service_1.ChannelApiClientService,
        channel_meeting_relay_service_1.ChannelMeetingRelayService,
        channel_session_service_1.ChannelSessionService])
], ChannelMeetingAutoService);
//# sourceMappingURL=channel-meeting-auto.service.js.map