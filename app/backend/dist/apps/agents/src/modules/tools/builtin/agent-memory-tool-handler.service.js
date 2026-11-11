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
exports.MemoToolHandler = void 0;
const common_1 = require("@nestjs/common");
const memo_service_1 = require("../../memos/memo.service");
const memo_write_queue_service_1 = require("../../memos/memo-write-queue.service");
let MemoToolHandler = class MemoToolHandler {
    constructor(memoService, memoWriteQueue) {
        this.memoService = memoService;
        this.memoWriteQueue = memoWriteQueue;
    }
    async searchMemoMemory(params, agentId) {
        if (!agentId) {
            throw new Error('memo_mcp_search requires agentId');
        }
        const query = params?.query?.trim() || '';
        const memories = await this.memoService.searchMemos(agentId, query, {
            memoType: params?.memoType,
            limit: params?.limit,
            progressive: true,
            detail: params?.detail === true,
        });
        return {
            agentId,
            query,
            total: memories.length,
            memories,
            fetchedAt: new Date().toISOString(),
        };
    }
    async appendMemoMemory(params, agentId, executionContext) {
        if (!agentId) {
            throw new Error('memo_mcp_append requires agentId');
        }
        if (!params?.content?.trim()) {
            throw new Error('memo_mcp_append requires content');
        }
        const resolvedTargetAgentId = String(params.targetAgentId || params.agentId || '').trim() || agentId;
        const requestedKind = params.memoKind;
        const requestedType = params.memoType;
        if ((requestedKind === 'achievement' || requestedKind === 'criticism') && !String(params.targetAgentId || params.agentId || '').trim()) {
            throw new Error('memo_mcp_append requires targetAgentId for achievement/criticism');
        }
        if (requestedType === 'standard' && !requestedKind) {
            throw new Error('memo_mcp_append requires memoKind when memoType=standard');
        }
        if (requestedKind === 'topic' && requestedType && requestedType !== 'knowledge') {
            throw new Error('memo_mcp_append requires memoType=knowledge when memoKind=topic');
        }
        if ((requestedKind === 'achievement' || requestedKind === 'criticism') && requestedType && requestedType !== 'standard') {
            throw new Error(`memo_mcp_append requires memoType=standard when memoKind=${requestedKind}`);
        }
        const actor = this.resolveMemoActorContext(executionContext);
        if (params.memoId) {
            const existing = await this.memoService.getMemoById(params.memoId);
            if (existing.agentId !== resolvedTargetAgentId) {
                throw new Error('memo_mcp_append memoId owner mismatch with targetAgentId');
            }
            const useDivider = existing.memoKind === 'achievement' || existing.memoKind === 'criticism';
            const existingContent = String(existing.content || '').trim();
            const nextContent = params.content.trim();
            const queued = await this.memoWriteQueue.queueUpdateMemo(existing.id, {
                content: useDivider
                    ? existingContent
                        ? `${existingContent}\n\n—\n\n${nextContent}`
                        : nextContent
                    : `${existing.content}\n\n${nextContent}`,
                tags: Array.from(new Set([...(existing.tags || []), ...((params.tags || []).filter(Boolean))])),
            }, {
                actor,
                skipRolePermissionCheck: true,
            });
            return {
                action: 'queued_update',
                memoId: existing.id,
                requestId: queued.requestId,
            };
        }
        const queued = await this.memoWriteQueue.queueCreateMemo({
            agentId: resolvedTargetAgentId,
            title: params.title?.trim() || 'Runtime memo',
            content: params.content.trim(),
            memoKind: params.memoKind,
            memoType: params.memoType || 'knowledge',
            payload: {
                taskId: params.taskId,
                topic: params.topic || 'runtime',
            },
            tags: params.tags || [],
            source: 'memo_mcp_append',
        }, {
            actor,
            skipRolePermissionCheck: true,
        });
        return {
            action: 'queued_create',
            requestId: queued.requestId,
        };
    }
    resolveMemoActorContext(executionContext) {
        const collaborationContext = executionContext?.collaborationContext || {};
        const employeeId = String(executionContext?.actor?.employeeId ||
            collaborationContext.employeeId ||
            collaborationContext.initiatorId ||
            collaborationContext.triggeredBy ||
            collaborationContext.userId ||
            '').trim();
        const role = String(executionContext?.actor?.role ||
            collaborationContext.role ||
            collaborationContext.actorRole ||
            collaborationContext.initiatorRole ||
            collaborationContext.userRole ||
            '').trim();
        if (!employeeId && !role) {
            return undefined;
        }
        return {
            ...(employeeId ? { employeeId } : {}),
            ...(role ? { role } : {}),
        };
    }
};
exports.MemoToolHandler = MemoToolHandler;
exports.MemoToolHandler = MemoToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memo_service_1.MemoService,
        memo_write_queue_service_1.MemoWriteQueueService])
], MemoToolHandler);
//# sourceMappingURL=agent-memory-tool-handler.service.js.map