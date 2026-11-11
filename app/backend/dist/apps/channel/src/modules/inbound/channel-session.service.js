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
exports.ChannelSessionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const channel_session_schema_1 = require("./schemas/channel-session.schema");
let ChannelSessionService = class ChannelSessionService {
    constructor(sessionModel) {
        this.sessionModel = sessionModel;
        this.timeoutMinutes = Math.max(1, Number(process.env.CHANNEL_SESSION_TIMEOUT_MINUTES || 30));
        this.meetingSessionAgentPlaceholder = 'meeting';
    }
    async getOrCreate(input) {
        const now = new Date();
        const expiredBefore = new Date(now.getTime() - this.timeoutMinutes * 60 * 1000);
        const providerType = String(input.providerType || '').trim();
        const externalChatId = String(input.externalChatId || '').trim();
        const externalUserId = String(input.externalUserId || '').trim();
        const session = await this.sessionModel
            .findOne({
            providerType,
            externalChatId,
            externalUserId,
        })
            .exec();
        if (!session) {
            return this.sessionModel.create({
                providerType,
                externalChatId,
                externalUserId,
                employeeId: String(input.employeeId || '').trim(),
                agentId: String(input.agentId || '').trim(),
                agentSessionId: undefined,
                lastMessageAt: now,
                messageCount: 1,
                isActive: true,
            });
        }
        const shouldReset = !session.isActive || !session.lastMessageAt || session.lastMessageAt < expiredBefore;
        session.isActive = true;
        session.lastMessageAt = now;
        session.employeeId = String(input.employeeId || '').trim();
        session.agentId = String(input.agentId || '').trim();
        session.messageCount = shouldReset ? 1 : Number(session.messageCount || 0) + 1;
        if (shouldReset) {
            session.agentSessionId = undefined;
        }
        return session.save();
    }
    async updateAgentSessionId(channelSessionId, agentSessionId) {
        const id = String(channelSessionId || '').trim();
        const sessionId = String(agentSessionId || '').trim();
        if (!id || !sessionId) {
            return;
        }
        await this.sessionModel
            .updateOne({ _id: id }, {
            $set: {
                agentSessionId: sessionId,
                lastMessageAt: new Date(),
            },
        })
            .exec();
    }
    async setActiveMeeting(filter, meetingId, meetingType, employeeId) {
        const normalizedMeetingId = String(meetingId || '').trim();
        const normalizedMeetingType = String(meetingType || '').trim();
        if (!normalizedMeetingId || !normalizedMeetingType) {
            return;
        }
        const normalizedEmployeeId = String(employeeId || '').trim();
        const update = {
            $set: {
                activeMeetingId: normalizedMeetingId,
                activeMeetingType: normalizedMeetingType,
                lastMessageAt: new Date(),
                isActive: true,
            },
        };
        const options = {};
        if (normalizedEmployeeId) {
            update.$setOnInsert = {
                employeeId: normalizedEmployeeId,
                agentId: this.meetingSessionAgentPlaceholder,
                messageCount: 0,
            };
            options.upsert = true;
            options.setDefaultsOnInsert = true;
        }
        await this.sessionModel.updateOne(this.normalizeFilter(filter), update, options).exec();
    }
    async clearActiveMeeting(filter) {
        await this.sessionModel
            .updateOne(this.normalizeFilter(filter), {
            $set: {
                activeMeetingId: undefined,
                activeMeetingType: undefined,
                lastMessageAt: new Date(),
            },
        })
            .exec();
    }
    async clearActiveMeetingByMeetingId(meetingId) {
        const normalizedMeetingId = String(meetingId || '').trim();
        if (!normalizedMeetingId) {
            return;
        }
        await this.sessionModel
            .updateMany({ activeMeetingId: normalizedMeetingId }, {
            $set: {
                activeMeetingId: undefined,
                activeMeetingType: undefined,
                lastMessageAt: new Date(),
            },
        })
            .exec();
    }
    async getActiveMeeting(filter) {
        const session = await this.sessionModel.findOne(this.normalizeFilter(filter)).select({ activeMeetingId: 1, activeMeetingType: 1 }).exec();
        const meetingId = String(session?.activeMeetingId || '').trim();
        const meetingType = String(session?.activeMeetingType || '').trim();
        if (!meetingId || !meetingType) {
            return undefined;
        }
        return {
            meetingId,
            meetingType,
        };
    }
    async listSessionsWithActiveMeeting() {
        const sessions = await this.sessionModel
            .find({
            activeMeetingId: { $exists: true, $ne: '' },
        })
            .select({ activeMeetingId: 1, employeeId: 1, externalChatId: 1 })
            .lean()
            .exec();
        return sessions
            .map((session) => ({
            meetingId: String(session.activeMeetingId || '').trim(),
            employeeId: String(session.employeeId || '').trim(),
            chatId: String(session.externalChatId || '').trim(),
        }))
            .filter((session) => Boolean(session.meetingId && session.employeeId && session.chatId));
    }
    async reset(input) {
        const result = await this.sessionModel
            .updateOne(this.normalizeFilter(input), {
            $set: {
                agentSessionId: undefined,
                activeMeetingId: undefined,
                activeMeetingType: undefined,
                messageCount: 0,
                lastMessageAt: new Date(),
            },
        })
            .exec();
        return Number(result.matchedCount || 0) > 0;
    }
    normalizeFilter(filter) {
        return {
            providerType: String(filter.providerType || '').trim(),
            externalChatId: String(filter.externalChatId || '').trim(),
            externalUserId: String(filter.externalUserId || '').trim(),
        };
    }
};
exports.ChannelSessionService = ChannelSessionService;
exports.ChannelSessionService = ChannelSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(channel_session_schema_1.ChannelSession.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ChannelSessionService);
//# sourceMappingURL=channel-session.service.js.map