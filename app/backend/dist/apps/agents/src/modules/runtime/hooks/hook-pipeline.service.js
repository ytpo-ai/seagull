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
var HookPipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookPipelineService = void 0;
const common_1 = require("@nestjs/common");
const hook_registry_service_1 = require("./hook-registry.service");
let HookPipelineService = HookPipelineService_1 = class HookPipelineService {
    constructor(registry) {
        this.registry = registry;
        this.logger = new common_1.Logger(HookPipelineService_1.name);
    }
    async run(context) {
        const startAt = Date.now();
        const hooks = this.registry.getHooksForPhase(context.phase);
        const result = {
            aborted: false,
            appendMessages: [],
            messageFilters: [],
            finalPayload: { ...context.payload },
            executedHooks: [],
            skippedHooks: [],
            metadata: {},
            durationMs: 0,
            pauseRequested: false,
            cancelRequested: false,
            retryRequested: false,
        };
        if (hooks.length === 0) {
            result.durationMs = Date.now() - startAt;
            return result;
        }
        const mutableContext = {
            ...context,
            payload: { ...context.payload },
        };
        for (const hook of hooks) {
            try {
                const matched = await hook.matches(mutableContext);
                if (!matched) {
                    result.skippedHooks.push(hook.id);
                    continue;
                }
                const hookStartAt = Date.now();
                const hookResult = await hook.execute(mutableContext);
                const hookDuration = Date.now() - hookStartAt;
                result.executedHooks.push(hook.id);
                this.logger.debug(`[hook_pipeline] phase=${context.phase} hook=${hook.id} action=${hookResult.action} durationMs=${hookDuration}`);
                if (hookResult.appendMessages?.length) {
                    result.appendMessages.push(...hookResult.appendMessages.map((m) => String(m || '').trim()).filter(Boolean));
                }
                if (hookResult.messageFilters?.length) {
                    result.messageFilters.push(...hookResult.messageFilters);
                }
                if (hookResult.mutatedPayload) {
                    Object.assign(mutableContext.payload, hookResult.mutatedPayload);
                }
                if (hookResult.metadata) {
                    Object.assign(result.metadata, hookResult.metadata);
                }
                const { action } = hookResult;
                if (action === 'abort') {
                    result.aborted = true;
                    result.abortedBy = hook.id;
                    break;
                }
                if (action === 'cancel') {
                    result.cancelRequested = true;
                    result.cancelRequestedBy = result.cancelRequestedBy || hook.id;
                    result.cancelReason = result.cancelReason || hookResult.reason || `cancelled by hook ${hook.id}`;
                    break;
                }
                if (action === 'pause' && !result.pauseRequested) {
                    result.pauseRequested = true;
                    result.pauseRequestedBy = hook.id;
                    result.pauseReason = hookResult.reason || `paused by hook ${hook.id}`;
                }
                if (action === 'retry' && !result.retryRequested) {
                    result.retryRequested = true;
                    result.retryRequestedBy = hook.id;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`[hook_pipeline_error] phase=${context.phase} hook=${hook.id} error=${message}`);
                result.metadata[`error_${hook.id}`] = message;
            }
        }
        result.finalPayload = { ...mutableContext.payload };
        result.durationMs = Date.now() - startAt;
        if (result.executedHooks.length > 0) {
            const controlFlags = [
                result.aborted ? 'aborted' : '',
                result.pauseRequested ? 'pause' : '',
                result.cancelRequested ? 'cancel' : '',
                result.retryRequested ? 'retry' : '',
            ].filter(Boolean).join(',');
            this.logger.debug(`[hook_pipeline_done] phase=${context.phase} executed=${result.executedHooks.length} skipped=${result.skippedHooks.length} controls=${controlFlags || 'none'} durationMs=${result.durationMs}`);
        }
        return result;
    }
    static applyMessageFilters(messages, filters) {
        if (!filters.length)
            return messages;
        let result = [...messages];
        for (const filter of filters) {
            if (filter.type === 'remove') {
                result = result.filter((msg) => !matchesFilter(msg, filter));
            }
            else if (filter.type === 'replace') {
                result = result.map((msg) => {
                    if (matchesFilter(msg, filter) && filter.replaceContent !== undefined) {
                        return { ...msg, content: filter.replaceContent };
                    }
                    return msg;
                });
            }
        }
        return result;
    }
};
exports.HookPipelineService = HookPipelineService;
exports.HookPipelineService = HookPipelineService = HookPipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [hook_registry_service_1.HookRegistryService])
], HookPipelineService);
function matchesFilter(msg, filter) {
    if (filter.matchRole && msg.role !== filter.matchRole)
        return false;
    const content = String(msg.content || '');
    if (filter.matchContentContains) {
        if (!content.includes(filter.matchContentContains))
            return false;
    }
    if (filter.matchContentPattern) {
        try {
            const regex = new RegExp(filter.matchContentPattern);
            if (!regex.test(content))
                return false;
        }
        catch {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=hook-pipeline.service.js.map