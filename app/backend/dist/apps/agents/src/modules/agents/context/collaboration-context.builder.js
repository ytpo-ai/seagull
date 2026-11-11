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
exports.CollaborationContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("../../../../../../libs/contracts/src/index");
const context_fingerprint_service_1 = require("./context-fingerprint.service");
const JSON_ONLY_DIRECTIVE = [
    '[输出格式约束] 当前为结构化 JSON 输出模式。',
    '回复必须是合法 JSON 对象，以 { 开头 } 结尾。',
    '非 JSON 内容将被系统丢弃。',
].join('\n');
const JSON_PREFERRED_DIRECTIVE = [
    '[输出格式偏好] 优先以 JSON 对象格式回复。',
    '如确需自然语言说明，可在 JSON 的 "message" 字段中附加。',
].join('\n');
let CollaborationContextBuilder = class CollaborationContextBuilder {
    constructor(contextFingerprintService) {
        this.contextFingerprintService = contextFingerprintService;
        this.layer = 'collaboration';
        this.meta = { scope: 'run', stability: 'semi-static' };
    }
    shouldInject(input) {
        if (input.scenarioType === 'orchestration' ||
            input.scenarioType === 'meeting' ||
            input.scenarioType === 'discussion' ||
            input.scenarioType === 'inner-message') {
            return true;
        }
        return Boolean(input.persistedContext?.collaborationContext || input.context.collaborationContext);
    }
    async build(input) {
        const resolvedContext = this.resolveCollaborationContext(input);
        const scenarioType = this.resolveScenarioType(input, resolvedContext);
        if (scenarioType === 'meeting') {
            const meeting = resolvedContext;
            const participantProfiles = Array.isArray(meeting.participantProfiles) ? meeting.participantProfiles : [];
            const participantCount = participantProfiles.length || (Array.isArray(meeting.participants) ? meeting.participants.length : 0);
            const meetingTitle = String(meeting.meetingTitle || '').trim();
            const meetingDescription = String(meeting.meetingDescription || '').trim();
            const agenda = String(meeting.agenda || '').trim();
            const roleInMeeting = participantProfiles.find((profile) => String(profile.id || '') === String(input.agent.id || '').trim())?.role || 'participant';
            const fullContent = `你正在参加一个会议，会议标题是"${meetingTitle || '未命名会议'}"。\n` +
                `${meetingDescription ? `会议描述：${meetingDescription}\n` : ''}` +
                `${agenda ? `会议议程：${agenda}\n` : ''}` +
                `参与者：${participantCount}人在场\n` +
                `你的角色：${roleInMeeting === 'host' ? '主持人' : '参与者'}\n\n` +
                `Working Environment Context (Meeting): ${JSON.stringify({
                    meetingId: meeting.meetingId,
                    meetingTitle,
                    meetingType: meeting.meetingType,
                    agenda,
                    participants: participantProfiles.length ? participantProfiles : meeting.participants,
                    commandPriority: {
                        highestAuthority: 'human_host_or_owner',
                        exclusiveAssistantOverride: true,
                    },
                })}`;
            const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                scope: input.contextScope,
                blockType: 'collaboration',
                fullContent,
                snapshot: {
                    meetingId: String(meeting.meetingId || '').trim(),
                    participantCount,
                    agendaId: String(meeting.agendaId || '').trim(),
                },
                skipDedup: input.skipDedup,
            });
            if (!resolvedContent) {
                return [];
            }
            return [{ role: 'system', content: resolvedContent, timestamp: new Date() }];
        }
        if (scenarioType === 'orchestration') {
            const orchestration = resolvedContext;
            const upstreamOutputs = orchestration.upstreamOutputs || orchestration.dependencyContext || '';
            const contentParts = [
                `Working Environment Context (Orchestration): ${JSON.stringify({
                    agentTier: orchestration.agentTier || 'operations',
                    roleInPlan: orchestration.roleInPlan || 'executor',
                    collaborators: orchestration.collaborators || [],
                    delegationRules: orchestration.delegationRules || {
                        canDelegateTo: ['operations', 'temporary'],
                        cannotDelegateTo: ['leadership'],
                    },
                    upstreamOutputs,
                })}`,
            ];
            this.pushResponseDirectiveConstraint(contentParts, orchestration);
            const fullContent = contentParts.join('\n');
            const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                scope: input.contextScope,
                blockType: 'collaboration',
                fullContent,
                snapshot: {
                    planId: String(orchestration.planId || '').trim(),
                    collaboratorCount: Array.isArray(orchestration.collaborators) ? orchestration.collaborators.length : 0,
                    upstreamOutputHash: this.contextFingerprintService.hashFingerprint(JSON.stringify(upstreamOutputs)),
                    responseDirective: String(orchestration.responseDirective || '').trim() || undefined,
                },
                skipDedup: input.skipDedup,
            });
            if (!resolvedContent) {
                return [];
            }
            return [{ role: 'system', content: resolvedContent, timestamp: new Date() }];
        }
        if (scenarioType === 'inner-message') {
            const inner = resolvedContext;
            const contentParts = [
                `Working Environment Context (Inner Message): ${JSON.stringify({
                    messageId: inner.messageId,
                    eventType: inner.eventType,
                    triggerSource: inner.triggerSource,
                    senderAgentId: inner.senderAgentId,
                    runtimeTaskType: inner.runtimeTaskType,
                    meetingId: inner.meetingId,
                    planId: inner.planId,
                })}`,
            ];
            this.pushResponseDirectiveConstraint(contentParts, inner);
            const fullContent = contentParts.join('\n');
            const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                scope: input.contextScope,
                blockType: 'collaboration',
                fullContent,
                snapshot: {
                    messageId: String(inner.messageId || '').trim() || undefined,
                    eventType: String(inner.eventType || '').trim() || undefined,
                    runtimeTaskType: String(inner.runtimeTaskType || '').trim() || undefined,
                },
                skipDedup: input.skipDedup,
            });
            if (!resolvedContent) {
                return [];
            }
            return [{ role: 'system', content: resolvedContent, timestamp: new Date() }];
        }
        if (scenarioType === 'discussion') {
            const discussion = resolvedContext;
            const contextPayload = {
                scenarioMode: 'discussion',
                discussionSpaceId: discussion.discussionSpaceId,
                discussionThreadId: discussion.discussionThreadId,
                discussionMessageId: discussion.discussionMessageId,
                participantId: discussion.participantId,
                participantName: discussion.participantName || undefined,
                collaborationMode: discussion.collaborationMode || 'discussion',
            };
            const outlineSectionId = String(discussion.outlineSectionId || '').trim();
            if (outlineSectionId) {
                contextPayload.outlineSectionId = outlineSectionId;
            }
            const fullContent = `Working Environment Context (Discussion): ${JSON.stringify(contextPayload)}`;
            const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                scope: input.contextScope,
                blockType: 'collaboration',
                fullContent,
                snapshot: {
                    discussionSpaceId: String(discussion.discussionSpaceId || '').trim() || undefined,
                    discussionThreadId: String(discussion.discussionThreadId || '').trim() || undefined,
                    discussionMessageId: String(discussion.discussionMessageId || '').trim() || undefined,
                    outlineSectionId: outlineSectionId || undefined,
                },
                skipDedup: input.skipDedup,
            });
            if (!resolvedContent) {
                return [];
            }
            return [{ role: 'system', content: resolvedContent, timestamp: new Date() }];
        }
        const chat = resolvedContext;
        if (!Object.keys(chat).length)
            return [];
        const fullContent = `Working Environment Context (Chat): ${JSON.stringify(chat)}`;
        const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
            scope: input.contextScope,
            blockType: 'collaboration',
            fullContent,
            snapshot: {
                chatHash: this.contextFingerprintService.hashFingerprint(JSON.stringify(chat)),
            },
            skipDedup: input.skipDedup,
        });
        if (!resolvedContent) {
            return [];
        }
        return [{ role: 'system', content: resolvedContent, timestamp: new Date() }];
    }
    resolveCollaborationContext(input) {
        const raw = (input.persistedContext?.collaborationContext || input.context.collaborationContext || {});
        if (!raw || typeof raw !== 'object') {
            return {};
        }
        return contracts_1.CollaborationContextFactory.fromLegacy(raw);
    }
    resolveScenarioType(input, context) {
        if ('scenarioMode' in context) {
            const scenarioMode = String(context.scenarioMode || '').trim();
            if (scenarioMode === 'meeting' ||
                scenarioMode === 'orchestration' ||
                scenarioMode === 'discussion' ||
                scenarioMode === 'inner-message' ||
                scenarioMode === 'chat') {
                return scenarioMode;
            }
        }
        return input.scenarioType;
    }
    pushResponseDirectiveConstraint(contentParts, context) {
        const responseDirective = String(context.responseDirective || '').trim();
        if (responseDirective === 'json-only') {
            contentParts.push(JSON_ONLY_DIRECTIVE);
            return;
        }
        if (responseDirective === 'json-preferred') {
            contentParts.push(JSON_PREFERRED_DIRECTIVE);
            return;
        }
        if (String(context.format || '').trim() === 'json') {
            contentParts.push(JSON_ONLY_DIRECTIVE);
        }
    }
};
exports.CollaborationContextBuilder = CollaborationContextBuilder;
exports.CollaborationContextBuilder = CollaborationContextBuilder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_fingerprint_service_1.ContextFingerprintService])
], CollaborationContextBuilder);
//# sourceMappingURL=collaboration-context.builder.js.map