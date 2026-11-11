"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoTaskHistoryService = void 0;
const common_1 = require("@nestjs/common");
let MemoTaskHistoryService = class MemoTaskHistoryService {
    normalizeTaskStatus(status) {
        const normalized = String(status || 'pending').trim().toLowerCase();
        if (normalized === 'in_progress')
            return 'running';
        if (normalized === 'completed')
            return 'success';
        if (normalized === 'pending' || normalized === 'queued' || normalized === 'scheduled')
            return normalized;
        if (normalized === 'running' || normalized === 'success' || normalized === 'failed' || normalized === 'cancelled') {
            return normalized;
        }
        return 'pending';
    }
    isHistoryStatus(status) {
        return status === 'running' || status === 'success' || status === 'failed' || status === 'cancelled';
    }
    normalizePriority(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'low' || normalized === 'medium' || normalized === 'high')
            return normalized;
        return undefined;
    }
    readHistoryItems(payload) {
        const items = Array.isArray(payload?.tasks) ? payload.tasks : [];
        const normalized = [];
        for (const item of items) {
            if (!item || typeof item !== 'object')
                continue;
            const taskId = String(item.taskId || '').trim();
            if (!taskId)
                continue;
            const status = this.normalizeTaskStatus(item.currentStatus || item.finalStatus || item.status);
            if (!this.isHistoryStatus(status))
                continue;
            const timeline = Array.isArray(item.statusTimeline)
                ? item.statusTimeline
                    .map((entry) => ({
                    status: this.normalizeTaskStatus(entry?.status),
                    at: String(entry?.at || ''),
                    note: entry?.note ? String(entry.note) : undefined,
                }))
                    .filter((entry) => this.isHistoryStatus(entry.status) && entry.at)
                : [];
            const normalizedFinalStatus = this.normalizeTaskStatus(item.finalStatus);
            normalized.push({
                taskId,
                title: String(item.title || `Task ${taskId}`).trim(),
                description: item.description ? String(item.description) : undefined,
                orchestrationId: item.orchestrationId ? String(item.orchestrationId) : undefined,
                priority: this.normalizePriority(item.priority),
                sourceType: 'orchestration_task',
                startedAt: item.startedAt ? String(item.startedAt) : undefined,
                finishedAt: item.finishedAt ? String(item.finishedAt) : undefined,
                finalStatus: normalizedFinalStatus === 'success' || normalizedFinalStatus === 'failed' || normalizedFinalStatus === 'cancelled'
                    ? normalizedFinalStatus
                    : undefined,
                currentStatus: status,
                statusTimeline: this.dedupeTimeline(timeline),
                updatedAt: String(item.updatedAt || new Date(0).toISOString()),
            });
        }
        return normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    dedupeTimeline(timeline) {
        const seen = new Set();
        const deduped = [];
        for (const item of timeline) {
            const key = `${item.status}:${item.at}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            deduped.push(item);
        }
        return deduped.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }
    upsertHistoryItem(historyItems, payload) {
        const at = payload.at || new Date().toISOString();
        const existing = historyItems.find((item) => item.taskId === payload.taskId);
        const timelineEntry = {
            status: payload.status,
            at,
            note: payload.note,
        };
        const nextItem = {
            taskId: payload.taskId,
            title: payload.title,
            description: payload.description,
            orchestrationId: payload.orchestrationId,
            priority: this.normalizePriority(payload.priority),
            sourceType: payload.sourceType,
            startedAt: existing?.startedAt || (payload.status === 'running' ? at : undefined),
            finishedAt: payload.status === 'success' || payload.status === 'failed' || payload.status === 'cancelled'
                ? at
                : existing?.finishedAt,
            finalStatus: payload.status === 'success' || payload.status === 'failed' || payload.status === 'cancelled'
                ? payload.status
                : existing?.finalStatus,
            currentStatus: payload.status,
            statusTimeline: this.dedupeTimeline([...(existing?.statusTimeline || []), timelineEntry]),
            updatedAt: at,
        };
        if (!nextItem.startedAt) {
            const runningAt = nextItem.statusTimeline.find((item) => item.status === 'running')?.at;
            nextItem.startedAt = runningAt || at;
        }
        const limit = Math.max(1, Math.min(Number(payload.maxItems || 500), 5000));
        const nextItems = [nextItem, ...historyItems.filter((item) => item.taskId !== payload.taskId)].slice(0, limit);
        return {
            nextItems,
            status: payload.status,
        };
    }
    renderHistoryContent(items, compact) {
        const lines = ['# History Log', '', '## Executed Tasks', ''];
        if (!items.length) {
            lines.push('- No executed tasks yet.');
            return `${lines.join('\n')}\n`;
        }
        for (const item of items) {
            const suffix = [
                `taskId:${item.taskId}`,
                `status:${item.currentStatus}`,
                item.finalStatus ? `final:${item.finalStatus}` : '',
                item.priority ? `priority:${item.priority}` : '',
                item.orchestrationId ? `orchestrationId:${item.orchestrationId}` : '',
                item.startedAt ? `started:${item.startedAt}` : '',
                item.finishedAt ? `finished:${item.finishedAt}` : '',
            ]
                .filter(Boolean)
                .join(' ');
            const desc = item.description ? ` - ${compact(item.description, 120)}` : '';
            lines.push(`- ${item.title}${desc} (${suffix})`);
            if (item.statusTimeline.length) {
                lines.push(`  - timeline: ${item.statusTimeline
                    .map((timeline) => `${timeline.status}@${timeline.at}${timeline.note ? `(${compact(timeline.note, 80)})` : ''}`)
                    .join(' -> ')}`);
            }
        }
        return `${lines.join('\n')}\n`;
    }
};
exports.MemoTaskHistoryService = MemoTaskHistoryService;
exports.MemoTaskHistoryService = MemoTaskHistoryService = __decorate([
    (0, common_1.Injectable)()
], MemoTaskHistoryService);
//# sourceMappingURL=memo-task-history.service.js.map