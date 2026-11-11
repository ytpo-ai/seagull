"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolGovernanceService = void 0;
const common_1 = require("@nestjs/common");
let ToolGovernanceService = class ToolGovernanceService {
    constructor() {
        this.rateLimitHits = new Map();
        this.circuitBreakers = new Map();
    }
    getGovernancePolicy(toolConfig) {
        const governance = (toolConfig?.governance || {});
        return {
            timeoutMs: this.parsePositiveInt(governance.timeoutMs ?? process.env.AGENTS_TOOL_TIMEOUT_MS, 30000),
            maxRetries: this.parsePositiveInt(governance.maxRetries ?? process.env.AGENTS_TOOL_RETRY_MAX, 1),
            rateLimitPerMinute: this.parsePositiveInt(governance.rateLimitPerMinute ?? process.env.AGENTS_TOOL_RATE_LIMIT_PER_MIN, 120),
            circuitFailureThreshold: this.parsePositiveInt(governance.circuitFailureThreshold ?? process.env.AGENTS_TOOL_CIRCUIT_FAILURE_THRESHOLD, 5),
            circuitOpenMs: this.parsePositiveInt(governance.circuitOpenMs ?? process.env.AGENTS_TOOL_CIRCUIT_OPEN_MS, 60000),
            idempotencyTtlMs: this.parsePositiveInt(governance.idempotencyTtlMs ?? process.env.AGENTS_TOOL_IDEMPOTENCY_TTL_MS, 300000),
        };
    }
    getIdempotencyKey(parameters, executionContext) {
        const fromContext = String(executionContext?.idempotencyKey || '').trim();
        if (fromContext)
            return fromContext;
        const fromParams = String(parameters?.idempotencyKey || parameters?.__idempotencyKey || '').trim();
        if (fromParams)
            return fromParams;
        return undefined;
    }
    enforceRateLimit(toolId, agentId, policy) {
        const key = `${toolId}:${agentId}`;
        const now = Date.now();
        const windowStart = now - 60000;
        const hits = (this.rateLimitHits.get(key) || []).filter((ts) => ts >= windowStart);
        if (hits.length >= policy.rateLimitPerMinute) {
            throw new Error(`rate limit exceeded for ${toolId}`);
        }
        hits.push(now);
        this.rateLimitHits.set(key, hits);
    }
    ensureCircuitClosed(toolId) {
        const circuit = this.circuitBreakers.get(toolId);
        if (!circuit)
            return;
        if (circuit.openUntil > Date.now()) {
            throw new Error(`circuit open for ${toolId}`);
        }
    }
    recordCircuitSuccess(toolId) {
        this.circuitBreakers.delete(toolId);
    }
    recordCircuitFailure(toolId, policy) {
        const current = this.circuitBreakers.get(toolId) || { failures: 0, openUntil: 0, lastFailureAt: 0 };
        const failures = current.failures + 1;
        const now = Date.now();
        const openUntil = failures >= policy.circuitFailureThreshold ? now + policy.circuitOpenMs : 0;
        this.circuitBreakers.set(toolId, {
            failures,
            openUntil,
            lastFailureAt: now,
        });
    }
    async executeWithTimeout(task, timeoutMs) {
        return await Promise.race([
            task(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`execution timeout after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    }
    async sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    isRetryableCode(code) {
        return code === 'TOOL_TIMEOUT' || code === 'TOOL_EXECUTION_FAILED' || code === 'TOOL_RATE_LIMITED';
    }
    parsePositiveInt(raw, fallback) {
        const num = Number(raw);
        if (!Number.isFinite(num) || num <= 0)
            return fallback;
        return Math.floor(num);
    }
};
exports.ToolGovernanceService = ToolGovernanceService;
exports.ToolGovernanceService = ToolGovernanceService = __decorate([
    (0, common_1.Injectable)()
], ToolGovernanceService);
//# sourceMappingURL=tool-governance.service.js.map