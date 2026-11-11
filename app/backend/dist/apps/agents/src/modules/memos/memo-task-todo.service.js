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
exports.MemoTaskTodoService = void 0;
const common_1 = require("@nestjs/common");
const memo_task_history_service_1 = require("./memo-task-history.service");
let MemoTaskTodoService = class MemoTaskTodoService {
    constructor(memoTaskHistoryService) {
        this.memoTaskHistoryService = memoTaskHistoryService;
    }
    normalizeTaskSourceType(sourceType) {
        const normalized = String(sourceType || 'orchestration_task').trim().toLowerCase();
        if (normalized === 'meeting_chat' || normalized === 'runtime_note')
            return normalized;
        return 'orchestration_task';
    }
    isTodoActiveStatus(status) {
        return status === 'pending' || status === 'queued' || status === 'scheduled';
    }
    readTodoItems(payload) {
        const items = Array.isArray(payload?.tasks) ? payload.tasks : [];
        const normalized = [];
        for (const item of items) {
            if (!item || typeof item !== 'object')
                continue;
            const taskId = String(item.taskId || '').trim();
            if (!taskId)
                continue;
            const status = this.memoTaskHistoryService.normalizeTaskStatus(item.status);
            if (!this.isTodoActiveStatus(status))
                continue;
            normalized.push({
                taskId,
                title: String(item.title || `Task ${taskId}`).trim(),
                description: item.description ? String(item.description) : undefined,
                status,
                orchestrationId: item.orchestrationId ? String(item.orchestrationId) : undefined,
                priority: this.memoTaskHistoryService.normalizePriority(item.priority),
                sourceType: 'orchestration_task',
                updatedAt: String(item.updatedAt || new Date(0).toISOString()),
                note: item.note ? String(item.note) : undefined,
            });
        }
        return normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    upsertTodoItem(items, next) {
        const merged = [next, ...items.filter((item) => item.taskId !== next.taskId)].slice(0, 500);
        return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    renderTodoContent(items, compact) {
        const lines = ['# TODO List', '', '## Pending Tasks', ''];
        if (!items.length) {
            lines.push('- No pending tasks.');
            return `${lines.join('\n')}\n`;
        }
        for (const item of items) {
            const suffix = [
                `taskId:${item.taskId}`,
                `status:${item.status}`,
                item.priority ? `priority:${item.priority}` : '',
                item.orchestrationId ? `orchestrationId:${item.orchestrationId}` : '',
                `updated:${item.updatedAt}`,
            ]
                .filter(Boolean)
                .join(' ');
            const desc = item.description ? ` - ${compact(item.description, 120)}` : '';
            lines.push(`- ${item.title}${desc} (${suffix})`);
        }
        return `${lines.join('\n')}\n`;
    }
    normalizeTaskStatus(status) {
        return this.memoTaskHistoryService.normalizeTaskStatus(status);
    }
};
exports.MemoTaskTodoService = MemoTaskTodoService;
exports.MemoTaskTodoService = MemoTaskTodoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memo_task_history_service_1.MemoTaskHistoryService])
], MemoTaskTodoService);
//# sourceMappingURL=memo-task-todo.service.js.map