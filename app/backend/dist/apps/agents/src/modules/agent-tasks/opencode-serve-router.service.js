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
var OpenCodeServeRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeServeRouterService = void 0;
const common_1 = require("@nestjs/common");
let OpenCodeServeRouterService = OpenCodeServeRouterService_1 = class OpenCodeServeRouterService {
    constructor() {
        this.logger = new common_1.Logger(OpenCodeServeRouterService_1.name);
        this.activeByServeId = new Map();
        this.rrCursor = 0;
        this.registry = this.loadRegistry();
    }
    listRegistry() {
        return this.registry;
    }
    resolveByServeId(serveId) {
        if (!serveId)
            return null;
        return this.registry.find((item) => item.serveId === serveId) || null;
    }
    pickServe() {
        if (this.registry.length === 0) {
            return null;
        }
        const weighted = this.registry
            .map((node) => {
            const active = this.activeByServeId.get(node.serveId) || 0;
            const capacity = Math.max(1, node.maxConcurrency);
            const loadRatio = active / capacity;
            const weightedLoad = loadRatio / Math.max(1, node.weight);
            return { node, weightedLoad, active };
        })
            .sort((a, b) => {
            if (a.weightedLoad === b.weightedLoad) {
                return a.node.serveId.localeCompare(b.node.serveId);
            }
            return a.weightedLoad - b.weightedLoad;
        });
        const leastLoad = weighted[0]?.weightedLoad;
        const candidates = weighted.filter((row) => row.weightedLoad === leastLoad).map((row) => row.node);
        if (!candidates.length) {
            return null;
        }
        const selected = candidates[this.rrCursor % candidates.length];
        this.rrCursor += 1;
        this.logger.debug(`Selected OpenCode serve ${selected.serveId}`);
        return selected;
    }
    markServeAcquire(serveId) {
        const current = this.activeByServeId.get(serveId) || 0;
        this.activeByServeId.set(serveId, current + 1);
    }
    markServeRelease(serveId) {
        const current = this.activeByServeId.get(serveId) || 0;
        if (current <= 1) {
            this.activeByServeId.delete(serveId);
            return;
        }
        this.activeByServeId.set(serveId, current - 1);
    }
    loadRegistry() {
        const raw = String(process.env.OPENCODE_SERVE_REGISTRY || '').trim();
        const fallbackBaseUrl = String(process.env.OPENCODE_SERVER_URL || '').trim();
        const fallbackAuthEnable = String(process.env.OPENCODE_SERVER_AUTH_ENABLE || '').trim().toLowerCase() === 'true';
        if (!raw) {
            if (!fallbackBaseUrl) {
                return [];
            }
            return [
                {
                    serveId: 'default',
                    baseUrl: fallbackBaseUrl,
                    authEnable: fallbackAuthEnable,
                    maxConcurrency: 16,
                    weight: 1,
                },
            ];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            const nodes = parsed
                .map((item, index) => {
                const serveId = String(item?.serveId || item?.id || `serve-${index + 1}`).trim();
                const baseUrl = String(item?.baseUrl || '').trim();
                if (!baseUrl) {
                    return null;
                }
                return {
                    serveId,
                    baseUrl,
                    authEnable: item?.authEnable === true,
                    maxConcurrency: Math.max(1, Number(item?.maxConcurrency || 16)),
                    weight: Math.max(1, Number(item?.weight || 1)),
                };
            })
                .filter((item) => Boolean(item));
            return nodes;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown';
            this.logger.warn(`Invalid OPENCODE_SERVE_REGISTRY, fallback to default: ${message}`);
            if (!fallbackBaseUrl) {
                return [];
            }
            return [
                {
                    serveId: 'default',
                    baseUrl: fallbackBaseUrl,
                    authEnable: fallbackAuthEnable,
                    maxConcurrency: 16,
                    weight: 1,
                },
            ];
        }
    }
};
exports.OpenCodeServeRouterService = OpenCodeServeRouterService;
exports.OpenCodeServeRouterService = OpenCodeServeRouterService = OpenCodeServeRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], OpenCodeServeRouterService);
//# sourceMappingURL=opencode-serve-router.service.js.map