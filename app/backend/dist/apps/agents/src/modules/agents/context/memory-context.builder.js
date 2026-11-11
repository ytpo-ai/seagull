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
exports.MemoryContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const memo_service_1 = require("../../memos/memo.service");
let MemoryContextBuilder = class MemoryContextBuilder {
    constructor(memoService) {
        this.memoService = memoService;
        this.layer = 'memory';
        this.meta = { scope: 'run', stability: 'dynamic' };
    }
    shouldInject(input) {
        return Boolean(input.persistedContext?.runSummaries?.length || input.agent.id);
    }
    async build(input) {
        const summaries = input.persistedContext?.runSummaries || [];
        const messages = [];
        if (summaries.length) {
            const lines = summaries.slice(-8).map((summary, index) => {
                const title = summary.taskTitle || summary.taskId || `run-${index + 1}`;
                const outcome = summary.outcome || '';
                const outputs = (summary.keyOutputs || []).join('；');
                return `- ${title}: ${outcome}${outputs ? ` | outputs: ${outputs}` : ''}`;
            });
            messages.push({
                role: 'system',
                content: `工作记忆（历史运行摘要）:\n${lines.join('\n')}`,
                timestamp: new Date(),
            });
        }
        const agentId = String(input.agent.id || '').trim();
        if (!agentId) {
            return messages;
        }
        const memoQuery = `${input.task.title}\n${input.task.description}\n${input.task.messages?.slice(-1)[0]?.content || ''}`;
        const relevantMemos = await this.memoService.getTaskMemoryContext(agentId, memoQuery).catch(() => '');
        if (relevantMemos) {
            messages.push({
                role: 'system',
                content: `以下是从备忘录中按需检索到的相关记忆（渐进加载摘要）:\n${relevantMemos}\n\n` +
                    '请优先参考这些记忆，并在必要时调用 builtin.sys-mg.mcp.agent-memory.list 获取更完整上下文；若有新结论可调用 builtin.sys-mg.mcp.agent-memory.create 追加沉淀。',
                timestamp: new Date(),
            });
        }
        return messages;
    }
};
exports.MemoryContextBuilder = MemoryContextBuilder;
exports.MemoryContextBuilder = MemoryContextBuilder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memo_service_1.MemoService])
], MemoryContextBuilder);
//# sourceMappingURL=memory-context.builder.js.map