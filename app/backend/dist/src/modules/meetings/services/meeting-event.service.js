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
var MeetingEventService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingEventService = void 0;
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../libs/infra/src/index");
let MeetingEventService = MeetingEventService_1 = class MeetingEventService {
    constructor(redisService) {
        this.redisService = redisService;
        this.logger = new common_1.Logger(MeetingEventService_1.name);
        this.eventListeners = new Map();
    }
    subscribeToEvents(meetingId, callback) {
        if (!this.eventListeners.has(meetingId)) {
            this.eventListeners.set(meetingId, []);
        }
        this.eventListeners.get(meetingId).push(callback);
    }
    unsubscribeFromEvents(meetingId, callback) {
        const listeners = this.eventListeners.get(meetingId);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1)
                listeners.splice(index, 1);
        }
    }
    async emitEvent(meetingId, event) {
        void this.redisService.publish(`meeting:${meetingId}`, event).catch(() => {
        });
        const listeners = this.eventListeners.get(meetingId);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(event);
                }
                catch (error) {
                    this.logger.error(`Error in event listener: ${error.message}`);
                }
            });
        }
    }
};
exports.MeetingEventService = MeetingEventService;
exports.MeetingEventService = MeetingEventService = MeetingEventService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService])
], MeetingEventService);
//# sourceMappingURL=meeting-event.service.js.map