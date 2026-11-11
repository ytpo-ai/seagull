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
var AgentAfterStepEvaluationHook_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentAfterStepEvaluationHook = void 0;
const common_1 = require("@nestjs/common");
const agent_prompt_catalog_1 = require("../../prompt-registry/agent-prompt-catalog");
const lifecycle_hook_types_1 = require("../../runtime/hooks/lifecycle-hook.types");
const MAX_TOOL_INTENT_RETRIES = 2;
const TOOL_INTENT_PATTERNS = [
    /我(现在|马上|立即|先|正在|来)(就|去)?(调用|执行|使用|克隆|拉取|读取|查询|搜索|发送|写入)/,
    /让我(调用|执行|使用|来|去)/,
    /(收到|好的|明白).{0,20}(执行|调用|克隆|使用工具)/,
    /开始(执行|调用|克隆|拉取|查询)/,
    /我(会|将)(调用|执行|使用)/,
    /(立即|马上)(执行|调用)/,
    /(不能|无法|没法).{0,16}(执行|调用).{0,12}(工具|repo-writer|repo-read)/,
    /请在.{0,16}(终端|环境).{0,16}(运行|执行)/,
    /repo-writer\s+clone/i,
];
let AgentAfterStepEvaluationHook = AgentAfterStepEvaluationHook_1 = class AgentAfterStepEvaluationHook {
    constructor() {
        this.logger = new common_1.Logger(AgentAfterStepEvaluationHook_1.name);
        this.id = 'agent.after-step-evaluation';
        this.phases = ['step.after'];
        this.priority = 50;
        this.retryCounters = new Map();
    }
    matches(contextOrLegacy, response) {
        if ('phase' in contextOrLegacy && 'payload' in contextOrLegacy) {
            const p = contextOrLegacy.payload;
            return String(p.response || '').trim().length > 0;
        }
        return String(response || '').trim().length > 0;
    }
    async execute(context) {
        const stepContext = this.toStepContext(context);
        if (!stepContext)
            return lifecycle_hook_types_1.LIFECYCLE_HOOK_CONTINUE;
        const responseText = String(context.payload.response || '');
        const result = await this.run(stepContext, responseText);
        return {
            action: result.retryRequested ? 'retry' : 'continue',
            appendMessages: result.appendSystemMessages,
            mutatedPayload: { decision: result.decision },
            metadata: { hookDecision: result.decision, retryRequested: result.retryRequested ?? false },
        };
    }
    async run(context, response) {
        try {
            if (this.detectsToolIntentWithoutExecution(response, context.assignedToolIds)) {
                const taskId = String(context.task?.id || context.task?._id || 'unknown');
                const currentRetries = this.retryCounters.get(taskId) || 0;
                if (currentRetries < MAX_TOOL_INTENT_RETRIES) {
                    this.retryCounters.set(taskId, currentRetries + 1);
                    this.logger.warn(`[tool_intent_without_execution] agent=${context.agent?.name} taskId=${taskId} round=${context.round + 1} retry=${currentRetries + 1}/${MAX_TOOL_INTENT_RETRIES}`);
                    return {
                        decision: 'inject_instruction',
                        retryRequested: true,
                        appendSystemMessages: [agent_prompt_catalog_1.AGENT_PROMPTS.toolIntentRetryInstruction.buildDefaultContent()],
                    };
                }
                this.logger.warn(`[tool_intent_retry_exhausted] agent=${context.agent?.name} taskId=${taskId} round=${context.round + 1} — accepting response after ${MAX_TOOL_INTENT_RETRIES} retries`);
                this.retryCounters.delete(taskId);
            }
            return {
                decision: 'accept',
                appendSystemMessages: [],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[after_step_hook_failed] error=${message}`);
            return {
                decision: 'accept',
                appendSystemMessages: [],
            };
        }
    }
    detectsToolIntentWithoutExecution(response, assignedToolIds) {
        if (/<tool_call>/i.test(response))
            return false;
        const hasIntentLanguage = TOOL_INTENT_PATTERNS.some((p) => p.test(response));
        if (hasIntentLanguage)
            return true;
        const lowerResponse = response.toLowerCase();
        if (lowerResponse.includes('```') &&
            (lowerResponse.includes('repo-writer clone') || lowerResponse.includes('git clone'))) {
            return true;
        }
        const lower = lowerResponse;
        const mentionsToolId = assignedToolIds.some((id) => {
            const shortName = (id.split('.').pop() || id).toLowerCase();
            if (shortName.length < 4)
                return false;
            return lower.includes(shortName);
        });
        return mentionsToolId;
    }
    toStepContext(input) {
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
};
exports.AgentAfterStepEvaluationHook = AgentAfterStepEvaluationHook;
exports.AgentAfterStepEvaluationHook = AgentAfterStepEvaluationHook = AgentAfterStepEvaluationHook_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AgentAfterStepEvaluationHook);
//# sourceMappingURL=agent-after-step-evaluation.hook.js.map