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
exports.DiscussionMessageStreamService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const discussion_thread_service_1 = require("./discussion-thread.service");
let DiscussionMessageStreamService = class DiscussionMessageStreamService {
    constructor(discussionThreadService) {
        this.discussionThreadService = discussionThreadService;
        this.streamChannels = new Map();
    }
    async streamThreadMessages(spaceId, threadId) {
        const thread = await this.discussionThreadService.getThreadById(spaceId, threadId);
        if (!thread) {
            throw new common_1.NotFoundException(`讨论线不存在: ${threadId}`);
        }
        const streamKey = this.buildStreamKey(spaceId, threadId);
        return new rxjs_1.Observable((subscriber) => {
            let channels = this.streamChannels.get(streamKey);
            if (!channels) {
                channels = new Set();
                this.streamChannels.set(streamKey, channels);
            }
            const channel = new rxjs_1.Subject();
            const subscription = channel.subscribe({
                next: (event) => subscriber.next(event),
                error: (error) => subscriber.error(error),
                complete: () => subscriber.complete(),
            });
            channels.add(channel);
            channel.next({
                data: {
                    type: 'discussion.message.snapshot',
                    data: {
                        spaceId,
                        threadId,
                    },
                },
            });
            return () => {
                subscription.unsubscribe();
                const target = this.streamChannels.get(streamKey);
                if (!target) {
                    return;
                }
                target.delete(channel);
                channel.complete();
                if (!target.size) {
                    this.streamChannels.delete(streamKey);
                }
            };
        });
    }
    emitMessageCreated(spaceId, threadId, message) {
        const streamKey = this.buildStreamKey(spaceId, threadId);
        const channels = this.streamChannels.get(streamKey);
        if (!channels?.size) {
            return;
        }
        const event = {
            data: {
                type: 'discussion.message.created',
                data: {
                    spaceId,
                    threadId,
                    message,
                },
            },
        };
        for (const channel of channels) {
            channel.next(event);
        }
    }
    emitAgentExecutionStatus(spaceId, threadId, payload) {
        const streamKey = this.buildStreamKey(spaceId, threadId);
        const channels = this.streamChannels.get(streamKey);
        if (!channels?.size) {
            return;
        }
        const event = {
            data: {
                type: 'discussion.agent.execution.status',
                data: {
                    spaceId,
                    threadId,
                    participantId: payload.participantId,
                    agentId: payload.agentId,
                    status: payload.status,
                    reason: payload.reason,
                },
            },
        };
        for (const channel of channels) {
            channel.next(event);
        }
    }
    buildStreamKey(spaceId, threadId) {
        return `${spaceId}:${threadId}`;
    }
};
exports.DiscussionMessageStreamService = DiscussionMessageStreamService;
exports.DiscussionMessageStreamService = DiscussionMessageStreamService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [discussion_thread_service_1.DiscussionThreadService])
], DiscussionMessageStreamService);
//# sourceMappingURL=discussion-message-stream.service.js.map