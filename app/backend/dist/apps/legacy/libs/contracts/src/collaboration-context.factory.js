"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationContextFactory = void 0;
class CollaborationContextFactory {
    static orchestration(params) {
        const { responseDirective = 'json-only', ...rest } = params;
        return {
            scenarioMode: 'orchestration',
            responseDirective,
            ...rest,
        };
    }
    static meeting(params) {
        const { responseDirective = 'text', ...rest } = params;
        return {
            scenarioMode: 'meeting',
            responseDirective,
            collaborationMode: 'meeting',
            ...rest,
        };
    }
    static innerMessage(params) {
        const { requireJsonResponse = true, ...rest } = params;
        return {
            scenarioMode: 'inner-message',
            responseDirective: requireJsonResponse ? 'json-only' : 'text',
            ...rest,
        };
    }
    static discussion(params) {
        const { responseDirective = 'text', ...rest } = params;
        return {
            scenarioMode: 'discussion',
            responseDirective,
            collaborationMode: 'discussion',
            ...rest,
        };
    }
    static chat(params) {
        return {
            scenarioMode: 'chat',
            responseDirective: 'text',
            ...(params || {}),
        };
    }
    static fromLegacy(raw) {
        if (raw.scenarioMode && typeof raw.scenarioMode === 'string') {
            return raw;
        }
        if (raw.meetingId && (raw.collaborationMode === 'meeting' || raw.meetingTitle)) {
            return {
                scenarioMode: 'meeting',
                responseDirective: 'text',
                ...raw,
            };
        }
        if (raw.planId) {
            const roleInPlan = String(raw.roleInPlan || 'executor');
            return {
                scenarioMode: 'orchestration',
                responseDirective: 'json-only',
                planId: String(raw.planId),
                roleInPlan: roleInPlan,
                ...raw,
            };
        }
        if (raw.discussionSpaceId ||
            raw.discussionThreadId ||
            raw.collaborationMode === 'discussion' ||
            raw.scene === 'discussion') {
            const patched = { ...raw };
            if (!patched.discussionSpaceId && patched.spaceId) {
                patched.discussionSpaceId = patched.spaceId;
            }
            if (!patched.discussionThreadId && patched.threadId) {
                patched.discussionThreadId = patched.threadId;
            }
            return {
                scenarioMode: 'discussion',
                responseDirective: 'text',
                ...patched,
            };
        }
        return {
            scenarioMode: 'chat',
            responseDirective: 'text',
            ...raw,
        };
    }
}
exports.CollaborationContextFactory = CollaborationContextFactory;
//# sourceMappingURL=collaboration-context.factory.js.map