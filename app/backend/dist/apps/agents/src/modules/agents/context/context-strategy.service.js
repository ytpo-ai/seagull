"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextStrategyService = void 0;
const common_1 = require("@nestjs/common");
const agent_executor_helpers_1 = require("../agent-executor.helpers");
let ContextStrategyService = class ContextStrategyService {
    parseActivationTags(tags) {
        const validFields = new Set(['domainType', 'taskType', 'phase', 'roleInPlan']);
        const validRules = new Set(['must', 'no', 'enable']);
        return (tags || [])
            .map((tag) => {
            const normalizedTag = String(tag || '').trim();
            if (!normalizedTag) {
                return null;
            }
            const parts = normalizedTag.split(':');
            if (parts.length !== 3) {
                return null;
            }
            const [rawField, rawValues, rawRule] = parts;
            const field = String(rawField || '').trim();
            const rule = String(rawRule || '').trim();
            if (!validFields.has(field) || !validRules.has(rule)) {
                return null;
            }
            const values = String(rawValues || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
            if (values.length === 0) {
                return null;
            }
            return {
                field,
                values,
                rule,
            };
        })
            .filter((item) => Boolean(item));
    }
    evaluateActivationTags(activationTags, context) {
        for (const tag of activationTags.filter((item) => item.rule === 'no')) {
            const contextValue = String(context[tag.field] || '').trim();
            if (contextValue && tag.values.includes(contextValue)) {
                return {
                    active: false,
                    reason: `no rule matched: ${tag.field}=${contextValue}`,
                };
            }
        }
        for (const tag of activationTags.filter((item) => item.rule === 'must')) {
            const contextValue = String(context[tag.field] || '').trim();
            if (!contextValue || !tag.values.includes(contextValue)) {
                return {
                    active: false,
                    reason: `must rule failed: ${tag.field}=${contextValue || 'undefined'}, expected ${tag.values.join(',')}`,
                };
            }
        }
        const enableHints = activationTags
            .filter((item) => item.rule === 'enable')
            .filter((item) => {
            const contextValue = String(context[item.field] || '').trim();
            return contextValue && item.values.includes(contextValue);
        });
        return {
            active: true,
            reason: enableHints.length > 0
                ? `enable hints: ${enableHints.map((item) => `${item.field}=${item.values.join(',')}`).join('; ')}`
                : 'all must passed',
        };
    }
    shouldActivateSkillContent(skill, task, context, activationContext) {
        const collaborationCtx = (context?.collaborationContext || {});
        const skillActivation = collaborationCtx.skillActivation;
        if (skillActivation?.mode === 'precise') {
            const ids = Array.isArray(skillActivation.skillIds) ? skillActivation.skillIds : [];
            return ids.includes(skill.id);
        }
        const resolvedActivationContext = activationContext || {
            domainType: String(collaborationCtx.domainType || '').trim() || undefined,
            taskType: String(collaborationCtx.taskType || task.type || '').trim() || undefined,
            phase: String(collaborationCtx.phase || '').trim() || undefined,
            roleInPlan: String(collaborationCtx.roleInPlan || '').trim() || undefined,
        };
        const activationTags = this.parseActivationTags(skill.tags || []);
        if (activationTags.length > 0) {
            return this.evaluateActivationTags(activationTags, resolvedActivationContext).active;
        }
        const meetingLike = (0, agent_executor_helpers_1.isMeetingLikeTask)(task, context);
        const discussionLike = task.type === 'discussion' ||
            context?.task?.type === 'discussion' ||
            String(collaborationCtx.scenarioMode || '').trim() === 'discussion' ||
            String(collaborationCtx.collaborationMode || '').trim() === 'discussion';
        const taskText = `${task.title || ''} ${task.description || ''} ${task.type || ''}`.toLowerCase();
        const tags = (skill.tags || []).map((t) => t.toLowerCase());
        const skillName = String(skill.name || '').toLowerCase();
        const skillCategory = String(skill.category || '').toLowerCase();
        if (meetingLike) {
            const meetingPinnedSkills = ['meeting-resilience', 'meeting-sensitive-planner'];
            if (meetingPinnedSkills.some((signal) => skillName.includes(signal) || tags.some((tag) => tag.includes(signal)))) {
                return true;
            }
        }
        if (discussionLike) {
            const discussionSignals = ['discussion', 'discuss', 'thread', 'debate', 'brainstorm', '讨论'];
            if (skillCategory === 'discussion' ||
                discussionSignals.some((signal) => skillName.includes(signal) || tags.some((tag) => tag.includes(signal)))) {
                return true;
            }
        }
        if (task.type && tags.some((tag) => tag.includes(task.type))) {
            return true;
        }
        const skillSignals = [skill.name.toLowerCase(), ...tags];
        let hitCount = 0;
        for (const signal of skillSignals) {
            const words = signal.split(/[\s\-_]+/).filter((w) => w.length >= 3);
            if (words.some((word) => taskText.includes(word))) {
                hitCount += 1;
            }
            if (hitCount >= 2)
                return true;
        }
        return false;
    }
    buildToolPromptMessages(assignedTools) {
        const seen = new Set();
        return assignedTools
            .map((tool) => {
            const toolId = String(tool.canonicalId || tool.id || '').trim();
            const prompt = String(tool.prompt || '').trim();
            return { toolId, prompt };
        })
            .filter((item) => item.toolId && item.prompt)
            .sort((a, b) => a.toolId.localeCompare(b.toolId))
            .map((item) => `Tool Use Strategy（${item.toolId}）:\n${item.prompt}`)
            .filter((message) => {
            if (seen.has(message))
                return false;
            seen.add(message);
            return true;
        });
    }
};
exports.ContextStrategyService = ContextStrategyService;
exports.ContextStrategyService = ContextStrategyService = __decorate([
    (0, common_1.Injectable)()
], ContextStrategyService);
//# sourceMappingURL=context-strategy.service.js.map