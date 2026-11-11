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
var MeetingParticipantService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingParticipantService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_client_service_1 = require("../../agents-client/agent-client.service");
const employee_service_1 = require("../../employees/employee.service");
const meeting_schema_1 = require("../../../shared/schemas/meeting.schema");
const meeting_event_service_1 = require("./meeting-event.service");
const meeting_lifecycle_service_1 = require("./meeting-lifecycle.service");
let MeetingParticipantService = MeetingParticipantService_1 = class MeetingParticipantService {
    constructor(meetingModel, agentClientService, employeeService, eventService, lifecycleService) {
        this.meetingModel = meetingModel;
        this.agentClientService = agentClientService;
        this.employeeService = employeeService;
        this.eventService = eventService;
        this.lifecycleService = lifecycleService;
        this.logger = new common_1.Logger(MeetingParticipantService_1.name);
        this.modelManagementAgentName = 'model management agent';
    }
    setOnAddSystemMessageHook(hook) {
        this.onAddSystemMessageHook = hook;
    }
    setOnAgentJoinedActiveHook(hook) {
        this.onAgentJoinedActiveHook = hook;
    }
    async addSystemMessage(meetingId, content) {
        if (!this.onAddSystemMessageHook)
            return;
        await this.onAddSystemMessageHook(meetingId, content);
    }
    async catchUpAgent(meetingId, participant) {
        if (!this.onAgentJoinedActiveHook)
            return;
        await this.onAgentJoinedActiveHook(meetingId, participant);
    }
    async buildParticipantContextProfiles(meeting) {
        const participants = meeting.participants || [];
        const employeeIds = Array.from(new Set(participants
            .filter((p) => p.participantType === 'employee' && p.participantId)
            .map((p) => p.participantId)));
        const agentIds = Array.from(new Set(participants
            .filter((p) => p.participantType === 'agent' && p.participantId)
            .map((p) => p.participantId)));
        const employeeLookup = new Map();
        const agentLookup = new Map();
        await Promise.all(employeeIds.map(async (employeeId) => {
            try {
                const employee = await this.employeeService.getEmployee(employeeId);
                const displayName = employee?.name || employee?.email || employeeId;
                employeeLookup.set(employeeId, displayName);
            }
            catch {
                employeeLookup.set(employeeId, employeeId);
            }
        }));
        await Promise.all(agentIds.map(async (agentId) => {
            try {
                const agent = await this.agentClientService.getAgent(agentId);
                agentLookup.set(agentId, agent?.name || agentId);
            }
            catch {
                agentLookup.set(agentId, agentId);
            }
        }));
        const uniqueProfiles = new Map();
        for (const participant of participants) {
            if (!participant?.participantId || !participant?.participantType) {
                continue;
            }
            const key = `${participant.participantType}:${participant.participantId}`;
            if (uniqueProfiles.has(key)) {
                continue;
            }
            const baseName = participant.participantType === 'employee'
                ? employeeLookup.get(participant.participantId) || '参会员工'
                : agentLookup.get(participant.participantId) || '参会Agent';
            uniqueProfiles.set(key, {
                id: participant.participantId,
                type: participant.participantType,
                name: baseName,
                role: participant.role,
                isPresent: Boolean(participant.isPresent),
            });
        }
        return Array.from(uniqueProfiles.values());
    }
    formatParticipantContextSummary(profiles) {
        if (profiles.length === 0) {
            return '暂无参会人。';
        }
        return profiles
            .map((profile) => {
            const roleLabel = profile.role === meeting_schema_1.ParticipantRole.HOST ? '主持人' : '参与者';
            const presenceLabel = profile.isPresent ? '在场' : '未在场';
            return `${profile.name}（${roleLabel}，${presenceLabel}）`;
        })
            .join('；');
    }
    buildParticipantDisplayNameMap(profiles) {
        const lookup = new Map();
        for (const profile of profiles) {
            lookup.set(`${profile.type}:${profile.id}`, profile.name);
        }
        return lookup;
    }
    resolveMessageSenderDisplayName(message, nameLookup) {
        if (message.senderType === 'system') {
            return '系统';
        }
        const key = `${message.senderType}:${message.senderId}`;
        return nameLookup.get(key) || (message.senderType === 'agent' ? '参会Agent' : '参会成员');
    }
    async resolveParticipantDisplayName(participantId, participantType) {
        if (participantType === 'employee') {
            try {
                const employee = await this.employeeService.getEmployee(participantId);
                return employee?.name || employee?.email || '参会员工';
            }
            catch {
                return '参会员工';
            }
        }
        try {
            const agent = await this.agentClientService.getAgent(participantId);
            return agent?.name || '参会Agent';
        }
        catch {
            return '参会Agent';
        }
    }
    async appendParticipantContextSystemMessage(meeting, action) {
        const profiles = await this.buildParticipantContextProfiles(meeting);
        if (action === 'updated') {
            const presentCount = profiles.filter((profile) => profile.isPresent).length;
            await this.addSystemMessage(meeting.id, `参会人上下文已更新：当前参会${presentCount}人`);
            return;
        }
        const summary = this.formatParticipantContextSummary(profiles);
        const actionText = action === 'initialized' ? '已初始化' : '已更新';
        await this.addSystemMessage(meeting.id, `参会人上下文${actionText}：${summary}`);
    }
    isHiddenAgentForMeeting(agent) {
        if (!agent) {
            return false;
        }
        const normalizedName = String(agent.name || '').toLowerCase().trim();
        if (normalizedName === this.modelManagementAgentName) {
            return true;
        }
        return false;
    }
    getExpandedMeetingTitle(originalTitle) {
        const normalized = String(originalTitle || '').trim();
        const replaced = normalized
            .replace(' 的1对1聊天', ' 等的讨论')
            .replace('的1对1聊天', '等的讨论')
            .replace('1对1聊天', '多人讨论');
        return replaced || '多人讨论';
    }
    async maybeRenameExpandedOneToOneMeeting(meeting, addedParticipant) {
        const currentTitle = String(meeting.title || '').trim();
        if (!currentTitle.includes('1对1聊天')) {
            return false;
        }
        if (!addedParticipant || addedParticipant.type !== 'agent') {
            return false;
        }
        const addedAgent = await this.agentClientService.getAgent(addedParticipant.id);
        if (this.isHiddenAgentForMeeting(addedAgent)) {
            return false;
        }
        const participantCount = new Set((meeting.participants || []).map((participant) => `${participant.participantType}:${participant.participantId}`)).size;
        if (participantCount <= 2) {
            return false;
        }
        const nextTitle = this.getExpandedMeetingTitle(currentTitle);
        if (!nextTitle || nextTitle === currentTitle) {
            return false;
        }
        meeting.title = nextTitle;
        await meeting.save();
        this.eventService.emitEvent(meeting.id, {
            type: 'settings_changed',
            meetingId: meeting.id,
            data: { title: nextTitle },
            timestamp: new Date(),
        });
        this.logger.log(`Meeting ${meeting.id} title updated after participant expansion: ${nextTitle}`);
        return true;
    }
    async joinMeeting(meetingId, participant) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        if (meeting.status === meeting_schema_1.MeetingStatus.ENDED || meeting.status === meeting_schema_1.MeetingStatus.ARCHIVED) {
            throw new common_1.ConflictException('Meeting has already ended');
        }
        let existingParticipant = meeting.participants.find(p => p.participantId === participant.id && p.participantType === participant.type);
        if (!existingParticipant) {
            existingParticipant = {
                participantId: participant.id,
                participantType: participant.type,
                role: meeting_schema_1.ParticipantRole.PARTICIPANT,
                isPresent: true,
                hasSpoken: false,
                messageCount: 0,
                joinedAt: new Date(),
            };
            meeting.participants.push(existingParticipant);
        }
        else {
            existingParticipant.isPresent = true;
            existingParticipant.joinedAt = new Date();
        }
        meeting.invitedParticipants = meeting.invitedParticipants.filter(ip => !(ip.participantId === participant.id && ip.participantType === participant.type));
        await meeting.save();
        await this.addSystemMessage(meetingId, `${participant.name} 加入了会议。`);
        this.eventService.emitEvent(meetingId, {
            type: 'participant_joined',
            meetingId,
            data: participant,
            timestamp: new Date(),
        });
        this.logger.log(`${participant.name} joined meeting ${meetingId}`);
        if (meeting.status === meeting_schema_1.MeetingStatus.ACTIVE && participant.type === 'agent') {
            setTimeout(() => this.catchUpAgent(meetingId, participant), 1000);
        }
        return meeting;
    }
    async leaveMeeting(meetingId, participant) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        const p = meeting.participants.find(p => p.participantId === participant.id && p.participantType === participant.type);
        if (p) {
            p.isPresent = false;
            p.leftAt = new Date();
            await meeting.save();
            await this.addSystemMessage(meetingId, `${participant.name} 离开了会议。`);
            this.eventService.emitEvent(meetingId, {
                type: 'participant_left',
                meetingId,
                data: participant,
                timestamp: new Date(),
            });
            this.logger.log(`${participant.name} left meeting ${meetingId}`);
        }
        return meeting;
    }
    async inviteParticipant(meetingId, participant, invitedBy) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        const isAlreadyParticipant = meeting.participants.some(p => p.participantId === participant.id && p.participantType === participant.type);
        if (isAlreadyParticipant) {
            throw new common_1.ConflictException('Already a participant');
        }
        if (participant.type === 'agent') {
            meeting.participants.push({
                participantId: participant.id,
                participantType: participant.type,
                role: meeting_schema_1.ParticipantRole.PARTICIPANT,
                isPresent: true,
                hasSpoken: false,
                messageCount: 0,
                joinedAt: new Date(),
            });
            await meeting.save();
            await this.maybeRenameExpandedOneToOneMeeting(meeting, participant);
            await this.addSystemMessage(meetingId, `${invitedBy.name} 邀请了 ${participant.name}。`);
            setTimeout(() => this.catchUpAgent(meetingId, participant), 1000);
            this.logger.log(`${participant.name} joined meeting ${meetingId} by invitation`);
            return meeting;
        }
        const isAlreadyInvited = meeting.invitedParticipants.some(ip => ip.participantId === participant.id && ip.participantType === participant.type);
        if (isAlreadyInvited) {
            throw new common_1.ConflictException('Already invited');
        }
        meeting.invitedParticipants.push({
            participantId: participant.id,
            participantType: participant.type,
        });
        await meeting.save();
        await this.addSystemMessage(meetingId, `${invitedBy.name} 邀请了 ${participant.name}。`);
        this.logger.log(`${participant.name} invited to meeting ${meetingId} by ${invitedBy.name}`);
        return meeting;
    }
    async addParticipant(meetingId, participant) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        if (!participant?.id || !participant?.type) {
            throw new common_1.BadRequestException('Participant identity is required');
        }
        const existingParticipant = meeting.participants.find((p) => p.participantId === participant.id && p.participantType === participant.type);
        if (existingParticipant) {
            throw new common_1.ConflictException('Already a participant');
        }
        const isAgent = participant.type === 'agent';
        const isPresent = isAgent && meeting.status === meeting_schema_1.MeetingStatus.ACTIVE;
        meeting.participants.push({
            participantId: participant.id,
            participantType: participant.type,
            role: meeting_schema_1.ParticipantRole.PARTICIPANT,
            isPresent,
            hasSpoken: false,
            messageCount: 0,
            joinedAt: isPresent ? new Date() : undefined,
        });
        meeting.invitedParticipants = (meeting.invitedParticipants || []).filter((p) => !(p.participantId === participant.id && p.participantType === participant.type));
        await meeting.save();
        const addedParticipantName = await this.resolveParticipantDisplayName(participant.id, participant.type);
        await this.addSystemMessage(meetingId, `${addedParticipantName} 被添加为参会人。`);
        await this.appendParticipantContextSystemMessage(meeting, 'updated');
        await this.maybeRenameExpandedOneToOneMeeting(meeting, participant);
        if (isAgent && isPresent) {
            setTimeout(() => this.catchUpAgent(meetingId, participant), 1000);
        }
        return meeting;
    }
    async removeParticipant(meetingId, participantId, participantType) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        this.lifecycleService.ensureMeetingCompatibility(meeting);
        if (meeting.hostId === participantId && meeting.hostType === participantType) {
            throw new common_1.ConflictException('Cannot remove host from participants');
        }
        const participantToRemove = meeting.participants.find((p) => p.participantId === participantId && p.participantType === participantType);
        const removedParticipantName = participantToRemove
            ? await this.resolveParticipantDisplayName(participantId, participantType)
            : participantType === 'agent'
                ? '参会Agent'
                : '参会成员';
        const beforeCount = meeting.participants.length;
        meeting.participants = meeting.participants.filter((p) => !(p.participantId === participantId && p.participantType === participantType));
        meeting.invitedParticipants = (meeting.invitedParticipants || []).filter((p) => !(p.participantId === participantId && p.participantType === participantType));
        if (beforeCount === meeting.participants.length) {
            throw new common_1.NotFoundException('Participant not found in this meeting');
        }
        await meeting.save();
        await this.addSystemMessage(meetingId, `${removedParticipantName} 已从参会人员中移除。`);
        await this.appendParticipantContextSystemMessage(meeting, 'updated');
        return meeting;
    }
};
exports.MeetingParticipantService = MeetingParticipantService;
exports.MeetingParticipantService = MeetingParticipantService = MeetingParticipantService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(meeting_schema_1.Meeting.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        agent_client_service_1.AgentClientService,
        employee_service_1.EmployeeService,
        meeting_event_service_1.MeetingEventService,
        meeting_lifecycle_service_1.MeetingLifecycleService])
], MeetingParticipantService);
//# sourceMappingURL=meeting-participant.service.js.map