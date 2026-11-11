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
exports.MeetingToolHandler = void 0;
const common_1 = require("@nestjs/common");
const internal_api_client_service_1 = require("../internal-api-client.service");
let MeetingToolHandler = class MeetingToolHandler {
    constructor(internalApiClient) {
        this.internalApiClient = internalApiClient;
    }
    resolveMeetingContext(executionContext) {
        const collaborationContext = executionContext?.collaborationContext || {};
        return {
            meetingId: (typeof collaborationContext.meetingId === 'string' && collaborationContext.meetingId) ||
                (typeof executionContext?.teamId === 'string' && executionContext.teamId) ||
                undefined,
        };
    }
    async listMeetings(params) {
        const queryParams = new URLSearchParams();
        if (params?.status) {
            queryParams.append('status', params.status);
        }
        if (params?.limit) {
            queryParams.append('limit', String(params.limit));
        }
        const endpoint = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const result = await this.internalApiClient.callMeetingApi('GET', endpoint);
        const rawList = Array.isArray(result) ? result : [];
        const meetings = rawList.map((item) => {
            if (!item || typeof item !== 'object')
                return item;
            const { messages, ...lightweight } = item;
            return lightweight;
        });
        return {
            action: 'list_meetings',
            total: meetings.length,
            meetings,
            fetchedAt: new Date().toISOString(),
        };
    }
    async getMeetingDetail(params) {
        if (!params?.meetingId?.trim()) {
            throw new Error('meeting_get_detail requires meetingId');
        }
        const meetingId = params.meetingId.trim();
        const result = await this.internalApiClient.callMeetingApi('GET', `/${meetingId}/detail`);
        const meeting = result;
        return {
            action: 'get_detail',
            meetingId,
            meeting,
            fetchedAt: new Date().toISOString(),
        };
    }
    async sendMeetingMessage(params, agentId, executionContext) {
        if (!params?.meetingId?.trim()) {
            throw new Error('meeting_send_message requires meetingId');
        }
        if (!params?.content?.trim()) {
            throw new Error('meeting_send_message requires content');
        }
        const meetingContext = this.resolveMeetingContext(executionContext);
        const meetingId = params.meetingId.trim();
        const sendAsAgent = Boolean(agentId && meetingContext.meetingId && meetingContext.meetingId === meetingId);
        const payload = {
            senderId: sendAsAgent ? agentId : 'system',
            senderType: sendAsAgent ? 'agent' : 'system',
            content: params.content.trim(),
            type: params.type || 'opinion',
        };
        const result = await this.internalApiClient.callMeetingApi('POST', `/${meetingId}/messages`, payload);
        return {
            action: 'send_message',
            meetingId,
            senderId: payload.senderId,
            message: result,
            sentAt: new Date().toISOString(),
        };
    }
    async updateMeetingStatus(params) {
        if (!params?.meetingId?.trim()) {
            throw new Error('meeting_update_status requires meetingId');
        }
        if (!params?.action?.trim()) {
            throw new Error('meeting_update_status requires action');
        }
        const action = params.action.trim().toLowerCase();
        const validActions = ['start', 'end', 'pause', 'resume'];
        if (!validActions.includes(action)) {
            throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
        }
        const result = await this.internalApiClient.callMeetingApi('POST', `/${params.meetingId.trim()}/${action}`);
        return {
            action: 'update_status',
            meetingId: params.meetingId,
            previousStatus: result?.previousStatus,
            newStatus: result?.status || action,
            updatedAt: new Date().toISOString(),
        };
    }
    async saveMeetingSummary(params, agentId) {
        if (!params?.meetingId?.trim()) {
            throw new Error('meeting_save_summary requires meetingId');
        }
        if (!params?.summary?.trim()) {
            throw new Error('meeting_save_summary requires summary');
        }
        const meetingId = params.meetingId.trim();
        const result = await this.internalApiClient.callMeetingApi('PUT', `/${meetingId}/summary`, {
            summary: params.summary.trim(),
            actionItems: Array.isArray(params.actionItems) ? params.actionItems : [],
            decisions: Array.isArray(params.decisions) ? params.decisions : [],
            overwrite: Boolean(params.overwrite),
            generatedByAgentId: agentId,
        });
        const summaryResult = result;
        return {
            action: 'save_summary',
            meetingId,
            generated: Boolean(summaryResult?.generated),
            reason: summaryResult?.reason,
            processedAt: new Date().toISOString(),
        };
    }
};
exports.MeetingToolHandler = MeetingToolHandler;
exports.MeetingToolHandler = MeetingToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [internal_api_client_service_1.InternalApiClient])
], MeetingToolHandler);
//# sourceMappingURL=meeting-tool-handler.service.js.map