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
exports.ContextFingerprintService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const infra_1 = require("../../../../../../libs/infra/src/index");
const agent_constants_1 = require("../agent.constants");
let ContextFingerprintService = class ContextFingerprintService {
    constructor(redisService) {
        this.redisService = redisService;
    }
    resolveSystemContextScope(agent, task, context) {
        const agentId = String(agent.id || agent._id?.toString?.() || 'unknown').trim() || 'unknown';
        const collaborationContext = (context?.collaborationContext || {});
        const sessionContext = (context?.sessionContext || {});
        const meetingId = String(collaborationContext?.meetingId || '').trim();
        if (meetingId) {
            return `meeting:${meetingId}:agent:${agentId}`;
        }
        const sessionId = String(collaborationContext?.sessionId || sessionContext?.sessionId || '').trim();
        if (sessionId) {
            return `session:${sessionId}:agent:${agentId}`;
        }
        const taskId = String(task.id || '').trim();
        if (taskId) {
            return `task:${taskId}:agent:${agentId}`;
        }
        return `ephemeral:${agentId}:${this.hashFingerprint(`${task.title || ''}|${task.type || ''}|${task.teamId || ''}`)}`;
    }
    hashFingerprint(input) {
        return (0, crypto_1.createHash)('sha256').update(String(input || '')).digest('hex');
    }
    async resolveSystemContextBlockContent(options) {
        const fullContent = String(options.fullContent || '').trim();
        if (!fullContent) {
            return null;
        }
        const normalizedSnapshot = (options.snapshot || {});
        const fingerprint = this.hashFingerprint(JSON.stringify(normalizedSnapshot));
        const key = this.systemContextFingerprintCacheKey(options.scope, options.blockType);
        const nextRecord = {
            fingerprint,
            snapshot: normalizedSnapshot,
            updatedAt: new Date().toISOString(),
        };
        try {
            const cached = await this.redisService.get(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.fingerprint === fingerprint) {
                    if (options.skipDedup) {
                        return fullContent;
                    }
                    return null;
                }
                if (options.buildDelta && parsed?.snapshot) {
                    const delta = String(options.buildDelta(parsed.snapshot, normalizedSnapshot) || '').trim();
                    if (delta) {
                        await this.redisService.set(key, JSON.stringify(nextRecord), agent_constants_1.SYSTEM_CONTEXT_FINGERPRINT_TTL_SECONDS);
                        return options.deltaPrefix ? `${options.deltaPrefix}\n${delta}` : delta;
                    }
                }
            }
            await this.redisService.set(key, JSON.stringify(nextRecord), agent_constants_1.SYSTEM_CONTEXT_FINGERPRINT_TTL_SECONDS);
            return fullContent;
        }
        catch {
            return fullContent;
        }
    }
    buildTaskInfoDelta(previous, current) {
        const changes = [];
        if (previous.title !== current.title) {
            changes.push(`- 标题：${previous.title || '（空）'} -> ${current.title || '（空）'}`);
        }
        if (previous.description !== current.description) {
            changes.push(`- 描述：${(0, agent_constants_1.compactLogText)(previous.description, 120) || '（空）'} -> ${(0, agent_constants_1.compactLogText)(current.description, 120) || '（空）'}`);
        }
        if (previous.type !== current.type) {
            changes.push(`- 类型：${previous.type || '（空）'} -> ${current.type || '（空）'}`);
        }
        if (previous.priority !== current.priority) {
            changes.push(`- 优先级：${previous.priority || '（空）'} -> ${current.priority || '（空）'}`);
        }
        return changes.join('\n');
    }
    buildIdentityMemoDelta(previous, current) {
        const toMap = (items) => new Map(items.map((item) => [`${item.title}::${item.topic}`, item]));
        const previousMap = toMap(previous || []);
        const currentMap = toMap(current || []);
        const added = [];
        const updated = [];
        const removed = [];
        for (const [key, next] of currentMap.entries()) {
            const prev = previousMap.get(key);
            const label = next.topic ? `${next.title} (${next.topic})` : next.title;
            if (!prev) {
                added.push(label);
                continue;
            }
            if (prev.contentHash !== next.contentHash) {
                updated.push(label);
            }
        }
        for (const [key, prev] of previousMap.entries()) {
            if (currentMap.has(key))
                continue;
            removed.push(prev.topic ? `${prev.title} (${prev.topic})` : prev.title);
        }
        const lines = [];
        if (added.length)
            lines.push(`- 新增：${added.join('、')}`);
        if (updated.length)
            lines.push(`- 更新：${updated.join('、')}`);
        if (removed.length)
            lines.push(`- 移除：${removed.join('、')}`);
        return lines.join('\n');
    }
    systemContextFingerprintCacheKey(scope, blockType) {
        return `agent:system-context-fingerprint:${scope}:${blockType}`;
    }
};
exports.ContextFingerprintService = ContextFingerprintService;
exports.ContextFingerprintService = ContextFingerprintService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [infra_1.RedisService])
], ContextFingerprintService);
//# sourceMappingURL=context-fingerprint.service.js.map