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
exports.TaskContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const agent_prompt_catalog_1 = require("../../prompt-registry/agent-prompt-catalog");
const context_fingerprint_service_1 = require("./context-fingerprint.service");
const context_prompt_service_1 = require("./context-prompt.service");
let TaskContextBuilder = class TaskContextBuilder {
    constructor(contextPromptService, contextFingerprintService) {
        this.contextPromptService = contextPromptService;
        this.contextFingerprintService = contextFingerprintService;
        this.layer = 'task';
        this.meta = { scope: 'run', stability: 'semi-static' };
    }
    shouldInject(input) {
        return input.scenarioType === 'orchestration' || input.scenarioType === 'meeting' || input.scenarioType === 'discussion';
    }
    async build(input) {
        const messages = [];
        const meetingLikeTask = input.scenarioType === 'meeting';
        const discussionLikeTask = input.scenarioType === 'discussion';
        if (discussionLikeTask) {
            const normalizedDescription = String(input.task.description || '').trim();
            if (normalizedDescription) {
                const fullContent = normalizedDescription;
                const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                    scope: input.contextScope,
                    blockType: 'task-info',
                    fullContent,
                    snapshot: {
                        title: String(input.task.title || '').trim(),
                        descriptionHash: this.contextFingerprintService.hashFingerprint(normalizedDescription),
                        type: String(input.task.type || '').trim(),
                    },
                    skipDedup: input.skipDedup,
                });
                if (resolvedContent) {
                    messages.push({ role: 'system', content: resolvedContent, timestamp: new Date() });
                }
            }
            return messages;
        }
        if (!meetingLikeTask) {
            const normalizedDescription = String(input.task.description || '').trim();
            const descriptionPreview = normalizedDescription.length > 120 ? `${normalizedDescription.slice(0, 120)}...` : normalizedDescription;
            const hasTaskUserMessage = (input.task.messages || []).some((msg) => msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim().length > 0);
            const hasHistoryUserMessage = input.context.previousMessages.some((msg) => msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim().length > 0);
            const descriptionWillBePrompt = Boolean(normalizedDescription) && !hasTaskUserMessage && !hasHistoryUserMessage;
            const descAlreadyInHistory = normalizedDescription.length > 50 &&
                input.context.previousMessages.some((msg) => msg.role === 'user' &&
                    typeof msg.content === 'string' &&
                    msg.content.includes(normalizedDescription.slice(0, 100)));
            const shouldSuppressDescription = descAlreadyInHistory || descriptionWillBePrompt;
            const taskInfoSnapshot = {
                title: String(input.task.title || '').trim(),
                description: descriptionPreview,
                type: String(input.task.type || '').trim(),
                priority: String(input.task.priority || '').trim(),
            };
            const fullTaskInfoContent = shouldSuppressDescription
                ? `任务信息:\n标题: ${taskInfoSnapshot.title}\n类型: ${taskInfoSnapshot.type}\n优先级: ${taskInfoSnapshot.priority}`
                : `任务信息:\n标题: ${taskInfoSnapshot.title}\n描述: ${taskInfoSnapshot.description}\n类型: ${taskInfoSnapshot.type}\n优先级: ${taskInfoSnapshot.priority}`;
            const taskInfoContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                scope: input.contextScope,
                blockType: 'task-info',
                fullContent: fullTaskInfoContent,
                snapshot: taskInfoSnapshot,
                buildDelta: (previous, current) => this.contextFingerprintService.buildTaskInfoDelta(previous, current),
                deltaPrefix: '任务信息增量更新：',
                skipDedup: input.skipDedup,
            });
            if (taskInfoContent) {
                messages.push({ role: 'system', content: taskInfoContent, timestamp: new Date() });
            }
            return messages;
        }
        const meetingExecutionPolicyTemplate = await this.contextPromptService.resolvePromptTemplate(agent_prompt_catalog_1.AGENT_PROMPTS.defaultMeetingExecutionPolicyPrompt);
        const meetingExecutionPolicy = await this.contextFingerprintService.resolveSystemContextBlockContent({
            scope: input.contextScope,
            blockType: 'meeting-execution-policy',
            fullContent: meetingExecutionPolicyTemplate.content,
            snapshot: {
                version: 'context-module',
                templateVersion: meetingExecutionPolicyTemplate.version || 'code-default',
                templateSource: meetingExecutionPolicyTemplate.source,
                contentHash: this.contextFingerprintService.hashFingerprint(meetingExecutionPolicyTemplate.content),
            },
            skipDedup: input.skipDedup,
        });
        if (meetingExecutionPolicy) {
            messages.push({
                role: 'system',
                content: meetingExecutionPolicy,
                timestamp: new Date(),
                metadata: {
                    promptSlug: agent_prompt_catalog_1.AGENT_PROMPTS.defaultMeetingExecutionPolicyPrompt.slug,
                },
            });
        }
        return messages;
    }
};
exports.TaskContextBuilder = TaskContextBuilder;
exports.TaskContextBuilder = TaskContextBuilder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_prompt_service_1.ContextPromptService,
        context_fingerprint_service_1.ContextFingerprintService])
], TaskContextBuilder);
//# sourceMappingURL=task-context.builder.js.map