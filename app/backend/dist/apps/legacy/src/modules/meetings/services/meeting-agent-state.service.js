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
exports.MeetingAgentStateService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const infra_1 = require("../../../../libs/infra/src/index");
const meeting_schema_1 = require("../../../shared/schemas/meeting.schema");
const meeting_event_service_1 = require("./meeting-event.service");
let MeetingAgentStateService = class MeetingAgentStateService {
    constructor(meetingModel, redisService, eventService) {
        this.meetingModel = meetingModel;
        this.redisService = redisService;
        this.eventService = eventService;
        this.meetingAgentStateKeyPrefix = 'meeting:agent-state';
        this.meetingAgentStateTtlSeconds = 90;
    }
    buildMeetingAgentStateKey(meetingId, agentId) {
        return `${this.meetingAgentStateKeyPrefix}:${meetingId}:${agentId}`;
    }
    buildMeetingAgentStatePattern(meetingId) {
        return `${this.meetingAgentStateKeyPrefix}:${meetingId}:*`;
    }
    async setAgentState(meetingId, agentId, state, options) {
        const updatedAt = new Date().toISOString();
        const payload = {
            agentId,
            state,
            updatedAt,
            reason: options?.reason,
            token: options?.token,
        };
        const key = this.buildMeetingAgentStateKey(meetingId, agentId);
        if (state === 'thinking') {
            await this.redisService.set(key, JSON.stringify(payload), this.meetingAgentStateTtlSeconds);
        }
        else {
            await this.redisService.del(key);
        }
        this.eventService.emitEvent(meetingId, {
            type: 'agent_state_changed',
            meetingId,
            data: payload,
            timestamp: new Date(),
        });
    }
    async clearAgentThinking(meetingId, agentId, options) {
        const key = this.buildMeetingAgentStateKey(meetingId, agentId);
        if (options?.token) {
            const raw = await this.redisService.get(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.token && parsed.token !== options.token) {
                        return;
                    }
                }
                catch {
                }
            }
        }
        await this.setAgentState(meetingId, agentId, 'idle', { reason: options?.reason });
    }
    async clearAllMeetingAgentThinking(meetingId, reason) {
        const states = await this.getMeetingAgentStates(meetingId);
        await Promise.all(states.map((item) => this.setAgentState(meetingId, item.agentId, 'idle', { reason })));
    }
    async getMeetingAgentStates(meetingId) {
        const meeting = await this.meetingModel.findOne({ id: meetingId }).exec();
        if (!meeting) {
            throw new common_1.NotFoundException(`Meeting not found: ${meetingId}`);
        }
        const keys = await this.redisService.keys(this.buildMeetingAgentStatePattern(meetingId));
        if (keys.length === 0) {
            return [];
        }
        const states = await Promise.all(keys.map(async (key) => {
            const raw = await this.redisService.get(key);
            if (!raw) {
                return null;
            }
            try {
                return JSON.parse(raw);
            }
            catch {
                return null;
            }
        }));
        return states
            .filter((item) => Boolean(item && item.agentId && item.state === 'thinking'))
            .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    }
};
exports.MeetingAgentStateService = MeetingAgentStateService;
exports.MeetingAgentStateService = MeetingAgentStateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(meeting_schema_1.Meeting.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        infra_1.RedisService,
        meeting_event_service_1.MeetingEventService])
], MeetingAgentStateService);
//# sourceMappingURL=meeting-agent-state.service.js.map