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
exports.MeetingController = void 0;
const common_1 = require("@nestjs/common");
const meeting_service_1 = require("./meeting.service");
const meeting_schema_1 = require("../../shared/schemas/meeting.schema");
let MeetingController = class MeetingController {
    constructor(meetingService) {
        this.meetingService = meetingService;
    }
    async createMeeting(dto) {
        const meeting = await this.meetingService.createMeeting(dto);
        return {
            success: true,
            data: meeting,
            message: '会议创建成功',
        };
    }
    async getAllMeetings(type, status, projectId) {
        const meetings = await this.meetingService.getAllMeetings({ type, status, projectId });
        return {
            success: true,
            data: meetings,
        };
    }
    async getMeetingStats() {
        const stats = await this.meetingService.getMeetingStats();
        return {
            success: true,
            data: stats,
        };
    }
    async getMeetingsByParticipant(participantId, type = 'employee') {
        const meetings = await this.meetingService.getMeetingsByParticipant(participantId, type);
        return {
            success: true,
            data: meetings,
        };
    }
    async getMeetingAgentStates(id) {
        const states = await this.meetingService.getMeetingAgentStates(id);
        return {
            success: true,
            data: states,
        };
    }
    async getMeeting(id) {
        const meeting = await this.meetingService.getMeeting(id);
        if (!meeting) {
            return {
                success: false,
                message: '会议不存在',
            };
        }
        return {
            success: true,
            data: meeting,
        };
    }
    async getMeetingDetail(id) {
        const meeting = await this.meetingService.getMeetingDetail(id);
        if (!meeting) {
            return {
                success: false,
                message: '会议不存在',
            };
        }
        return {
            success: true,
            data: meeting,
        };
    }
    async startMeeting(id, startedBy) {
        const meeting = await this.meetingService.startMeeting(id, startedBy);
        return {
            success: true,
            data: meeting,
            message: '会议已开始',
        };
    }
    async endMeeting(id) {
        const meeting = await this.meetingService.endMeeting(id);
        return {
            success: true,
            data: meeting,
            message: '会议已结束',
        };
    }
    async generateSummary(id, payload) {
        const result = await this.meetingService.generateMeetingSummary(id, payload);
        return {
            success: true,
            data: result,
            message: result.generated ? '会议总结已写入' : '会议总结无需重复写入',
        };
    }
    async saveSummary(id, payload) {
        const result = await this.meetingService.generateMeetingSummary(id, payload);
        return {
            success: true,
            data: result,
            message: result.generated ? '会议总结已写入' : '会议总结无需重复写入',
        };
    }
    async pauseMeeting(id) {
        const meeting = await this.meetingService.pauseMeeting(id);
        return {
            success: true,
            data: meeting,
            message: '会议已暂停',
        };
    }
    async resumeMeeting(id) {
        const meeting = await this.meetingService.resumeMeeting(id);
        return {
            success: true,
            data: meeting,
            message: '会议已恢复',
        };
    }
    async updateSpeakingMode(id, speakingOrder) {
        const meeting = await this.meetingService.updateSpeakingMode(id, speakingOrder);
        return {
            success: true,
            data: meeting,
            message: '会议发言模式已更新',
        };
    }
    async updateMeetingTitle(id, title) {
        const meeting = await this.meetingService.updateMeetingTitle(id, title);
        return {
            success: true,
            data: meeting,
            message: '会议名称已更新',
        };
    }
    async joinMeeting(id, participant) {
        const meeting = await this.meetingService.joinMeeting(id, participant);
        return {
            success: true,
            data: meeting,
            message: '已成功加入会议',
        };
    }
    async leaveMeeting(id, participant) {
        const meeting = await this.meetingService.leaveMeeting(id, participant);
        return {
            success: true,
            data: meeting,
            message: '已离开会议',
        };
    }
    async sendMessage(id, dto) {
        const message = await this.meetingService.sendMessage(id, dto);
        return {
            success: true,
            data: message,
            message: '消息已发送',
        };
    }
    async pauseMessageResponse(id, messageId, dto) {
        const message = await this.meetingService.pauseMessageResponse(id, messageId, dto.employeeId);
        return {
            success: true,
            data: message,
            message: '消息回复已暂停',
        };
    }
    async revokePausedMessage(id, messageId, dto) {
        const meeting = await this.meetingService.revokePausedMessage(id, messageId, dto.employeeId);
        return {
            success: true,
            data: meeting,
            message: '消息已撤回',
        };
    }
    async archiveMeeting(id) {
        const meeting = await this.meetingService.archiveMeeting(id);
        return {
            success: true,
            data: meeting,
            message: '会议已归档',
        };
    }
    async deleteMeeting(id) {
        await this.meetingService.deleteMeeting(id);
        return {
            success: true,
            message: '会议已删除',
        };
    }
    async inviteParticipant(id, participant, invitedBy) {
        const meeting = await this.meetingService.inviteParticipant(id, participant, invitedBy);
        return {
            success: true,
            data: meeting,
            message: '邀请已发送',
        };
    }
    async addParticipant(id, participant) {
        const meeting = await this.meetingService.addParticipant(id, participant);
        return {
            success: true,
            data: meeting,
            message: '参会人员已添加',
        };
    }
    async removeParticipant(id, participantType, participantId) {
        const meeting = await this.meetingService.removeParticipant(id, participantId, participantType);
        return {
            success: true,
            data: meeting,
            message: '参会人员已移除',
        };
    }
};
exports.MeetingController = MeetingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "createMeeting", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "getAllMeetings", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "getMeetingStats", null);
__decorate([
    (0, common_1.Get)('by-participant/:participantId'),
    __param(0, (0, common_1.Param)('participantId')),
    __param(1, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "getMeetingsByParticipant", null);
__decorate([
    (0, common_1.Get)(':id/agent-states'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "getMeetingAgentStates", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "getMeeting", null);
__decorate([
    (0, common_1.Get)(':id/detail'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "getMeetingDetail", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "startMeeting", null);
__decorate([
    (0, common_1.Post)(':id/end'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "endMeeting", null);
__decorate([
    (0, common_1.Post)(':id/generate-summary'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "generateSummary", null);
__decorate([
    (0, common_1.Put)(':id/summary'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "saveSummary", null);
__decorate([
    (0, common_1.Post)(':id/pause'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "pauseMeeting", null);
__decorate([
    (0, common_1.Post)(':id/resume'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "resumeMeeting", null);
__decorate([
    (0, common_1.Put)(':id/speaking-mode'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('speakingOrder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "updateSpeakingMode", null);
__decorate([
    (0, common_1.Put)(':id/title'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('title')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "updateMeetingTitle", null);
__decorate([
    (0, common_1.Post)(':id/join'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "joinMeeting", null);
__decorate([
    (0, common_1.Post)(':id/leave'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "leaveMeeting", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)(':id/messages/:messageId/pause'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "pauseMessageResponse", null);
__decorate([
    (0, common_1.Post)(':id/messages/:messageId/revoke'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "revokePausedMessage", null);
__decorate([
    (0, common_1.Post)(':id/archive'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "archiveMeeting", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "deleteMeeting", null);
__decorate([
    (0, common_1.Post)(':id/invite'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('participant')),
    __param(2, (0, common_1.Body)('invitedBy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "inviteParticipant", null);
__decorate([
    (0, common_1.Post)(':id/participants'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "addParticipant", null);
__decorate([
    (0, common_1.Delete)(':id/participants/:participantType/:participantId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('participantType')),
    __param(2, (0, common_1.Param)('participantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MeetingController.prototype, "removeParticipant", null);
exports.MeetingController = MeetingController = __decorate([
    (0, common_1.Controller)('meetings'),
    __metadata("design:paramtypes", [meeting_service_1.MeetingService])
], MeetingController);
//# sourceMappingURL=meeting.controller.js.map