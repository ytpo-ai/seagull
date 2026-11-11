"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var MemoDocSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoDocSyncService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const fs_2 = require("fs");
const path = __importStar(require("path"));
let MemoDocSyncService = MemoDocSyncService_1 = class MemoDocSyncService {
    constructor() {
        this.logger = new common_1.Logger(MemoDocSyncService_1.name);
        this.fileSyncEnabled = String(process.env.MEMO_FILE_SYNC_ENABLED || 'false').toLowerCase() === 'true';
    }
    isFileSyncEnabled() {
        return this.fileSyncEnabled;
    }
    resolveWorkspaceRoot() {
        const cwd = process.cwd();
        const candidates = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')];
        for (const candidate of candidates) {
            if ((0, fs_2.existsSync)(path.join(candidate, 'docs'))) {
                return candidate;
            }
        }
        return cwd;
    }
    getMemoDirs(agentId, memoKind) {
        const root = this.resolveWorkspaceRoot();
        const configuredDataRoot = process.env.AGENT_DATA_ROOT?.trim();
        const dataRoot = configuredDataRoot
            ? path.resolve(path.isAbsolute(configuredDataRoot) ? configuredDataRoot : path.join(root, configuredDataRoot))
            : null;
        const baseDir = dataRoot ? path.join(dataRoot, 'memos') : path.join(root, 'docs', 'memos');
        const agentDir = agentId ? path.join(baseDir, this.normalizeSegment(agentId)) : baseDir;
        const kindDir = memoKind ? path.join(agentDir, this.normalizeSegment(memoKind)) : agentDir;
        return { root, baseDir, agentDir, kindDir };
    }
    async syncMemo(memo) {
        if (!this.fileSyncEnabled)
            return;
        const { kindDir } = this.getMemoDirs(memo.agentId, memo.memoKind);
        await fs_1.promises.mkdir(kindDir, { recursive: true });
        const filePath = path.join(kindDir, `${memo.slug}.md`);
        await fs_1.promises.writeFile(filePath, this.renderMemoMarkdown(memo), 'utf8');
    }
    async removeMemo(memo) {
        if (!this.fileSyncEnabled)
            return;
        const { kindDir } = this.getMemoDirs(memo.agentId, memo.memoKind);
        const filePath = path.join(kindDir, `${memo.slug}.md`);
        try {
            await fs_1.promises.unlink(filePath);
        }
        catch {
            return;
        }
    }
    async rebuildIndex(memos) {
        if (!this.fileSyncEnabled)
            return;
        const { baseDir } = this.getMemoDirs();
        await fs_1.promises.mkdir(baseDir, { recursive: true });
        await fs_1.promises.writeFile(path.join(baseDir, 'README.md'), this.renderIndexMarkdown(memos), 'utf8');
    }
    renderMemoMarkdown(memo) {
        const payload = memo.payload || {};
        const payloadText = Object.keys(payload).length ? JSON.stringify(payload, null, 2) : 'N/A';
        const tags = (memo.tags || []).join(', ');
        const keywords = (memo.contextKeywords || []).join(', ');
        return [
            `# Memo: ${memo.title}`,
            '',
            `- id: \`${memo.id}\``,
            `- agentId: \`${memo.agentId}\``,
            `- version: ${memo.version || 1}`,
            `- type: ${memo.memoType}`,
            `- kind: ${memo.memoKind || 'topic'}`,
            `- source: ${memo.source || 'agent'}`,
            `- tags: ${tags || 'N/A'}`,
            `- contextKeywords: ${keywords || 'N/A'}`,
            `- updatedAt: ${memo.updatedAt ? new Date(memo.updatedAt).toISOString() : new Date().toISOString()}`,
            '',
            '## Payload',
            '',
            '```json',
            payloadText,
            '```',
            '',
            '## Content',
            '',
            memo.content || 'N/A',
            '',
        ].join('\n');
    }
    renderIndexMarkdown(memos) {
        const grouped = new Map();
        for (const memo of memos) {
            const key = memo.agentId;
            const list = grouped.get(key) || [];
            list.push(memo);
            grouped.set(key, list);
        }
        const lines = ['# Agent Memos Registry', '', `- totalMemos: ${memos.length}`, ''];
        if (!memos.length) {
            lines.push('- No memos yet.', '');
            return lines.join('\n');
        }
        for (const [agentId, items] of grouped.entries()) {
            lines.push(`## Agent: ${agentId}`, '');
            for (const memo of items.slice(0, 200)) {
                lines.push(`- [${memo.title}](./${this.normalizeSegment(memo.agentId)}/${this.normalizeSegment(memo.memoKind || 'topic')}/${memo.slug}.md) - ${memo.memoKind || 'topic'} - ${memo.memoType} - v${memo.version || 1}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    normalizeSegment(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }
    reportSyncError(error, message) {
        const detail = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`${message}: ${detail}`);
    }
};
exports.MemoDocSyncService = MemoDocSyncService;
exports.MemoDocSyncService = MemoDocSyncService = MemoDocSyncService_1 = __decorate([
    (0, common_1.Injectable)()
], MemoDocSyncService);
//# sourceMappingURL=memo-doc-sync.service.js.map