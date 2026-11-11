"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMeetingContext = isMeetingContext;
exports.isOrchestrationContext = isOrchestrationContext;
exports.isInnerMessageContext = isInnerMessageContext;
exports.isDiscussionContext = isDiscussionContext;
exports.isChatContext = isChatContext;
exports.isJsonOutputRequired = isJsonOutputRequired;
function isMeetingContext(ctx) {
    return ctx.scenarioMode === 'meeting';
}
function isOrchestrationContext(ctx) {
    return ctx.scenarioMode === 'orchestration';
}
function isInnerMessageContext(ctx) {
    return ctx.scenarioMode === 'inner-message';
}
function isDiscussionContext(ctx) {
    return ctx.scenarioMode === 'discussion';
}
function isChatContext(ctx) {
    return ctx.scenarioMode === 'chat';
}
function isJsonOutputRequired(ctx) {
    return ctx.responseDirective === 'json-only';
}
//# sourceMappingURL=collaboration-context.types.js.map