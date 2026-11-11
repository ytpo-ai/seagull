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
var AgentBeforeStepOptimizationHook_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentBeforeStepOptimizationHook = void 0;
const common_1 = require("@nestjs/common");
const lifecycle_hook_types_1 = require("../../runtime/hooks/lifecycle-hook.types");
const contracts_1 = require("../../../../../../libs/contracts/src/index");
let AgentBeforeStepOptimizationHook = AgentBeforeStepOptimizationHook_1 = class AgentBeforeStepOptimizationHook {
    constructor() {
        this.logger = new common_1.Logger(AgentBeforeStepOptimizationHook_1.name);
        this.id = 'agent.before-step-optimization';
        this.phases = ['step.before'];
        this.priority = 50;
    }
    matches(contextOrLegacy) {
        const stepContext = this.toStepContext(contextOrLegacy);
        if (!stepContext)
            return false;
        const latestUserContent = this.resolveLatestUserContent(stepContext.task, stepContext.messages).trim();
        return latestUserContent.length > 0 || String(stepContext.task.description || '').trim().length > 0;
    }
    async execute(context) {
        const stepContext = this.toStepContext(context);
        if (!stepContext)
            return lifecycle_hook_types_1.LIFECYCLE_HOOK_CONTINUE;
        const result = await this.run(stepContext);
        return {
            action: 'continue',
            appendMessages: result.appendSystemMessages,
            mutatedPayload: result.forcedToolCall
                ? { forcedToolCall: result.forcedToolCall, decision: result.decision }
                : { decision: result.decision },
            metadata: { hookDecision: result.decision },
        };
    }
    async run(context) {
        return {
            appendSystemMessages: [],
            decision: 'none',
        };
    }
    toStepContext(input) {
        if ('phase' in input && 'payload' in input) {
            const p = input.payload;
            if (!p.agent || !p.task || !p.messages || !p.modelConfig)
                return null;
            return {
                agent: p.agent,
                task: p.task,
                messages: p.messages,
                modelConfig: p.modelConfig,
                round: typeof p.round === 'number' ? p.round : 0,
                maxRounds: typeof p.maxRounds === 'number' ? p.maxRounds : 0,
                assignedToolIds: Array.isArray(p.assignedToolIds) ? p.assignedToolIds : [],
                executedToolIds: Array.isArray(p.executedToolIds) ? p.executedToolIds : [],
            };
        }
        return input;
    }
    resolveLatestUserContent(task, messages) {
        const latestUserMessage = [...(task.messages || []), ...(messages || [])]
            .reverse()
            .find((item) => item?.role === 'user' && typeof item.content === 'string' && item.content.trim().length > 0)?.content;
        return latestUserMessage ? (0, contracts_1.extractTextContent)(latestUserMessage) : (task.description || task.title || '');
    }
};
exports.AgentBeforeStepOptimizationHook = AgentBeforeStepOptimizationHook;
exports.AgentBeforeStepOptimizationHook = AgentBeforeStepOptimizationHook = AgentBeforeStepOptimizationHook_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AgentBeforeStepOptimizationHook);
//# sourceMappingURL=agent-before-step-optimization.hook.js.map