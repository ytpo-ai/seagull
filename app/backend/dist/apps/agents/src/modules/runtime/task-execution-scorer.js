"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskExecutionScorer = exports.AGENT_RUN_SCORE_RULE_POINTS = exports.AGENT_RUN_SCORE_BASE = exports.AGENT_RUN_SCORE_RULE_VERSION = void 0;
exports.AGENT_RUN_SCORE_RULE_VERSION = '1.0';
exports.AGENT_RUN_SCORE_BASE = 100;
exports.AGENT_RUN_SCORE_RULE_POINTS = {
    D1: -5,
    D2: -8,
    D3: -10,
    D4: -8,
    D5: -5,
    D6: -10,
    D7: -3,
    D8: -5,
    D9: -5,
    D10: -3,
    D11: -15,
    D12: -2,
    D13: -20,
};
const MULTI_STEP_TOOL_THRESHOLD = 3;
const DEFERRED_RULE_IDS = new Set(['D2', 'D9']);
class TaskExecutionScorer {
    constructor() {
        this.deductions = [];
        this.pendingDeductions = [];
        this.distinctExecutedToolIds = new Set();
        this.maxRoundSeen = -1;
        this.totalToolCalls = 0;
        this.successfulToolCalls = 0;
        this.failedToolCalls = 0;
        this.lastToolExecuted = false;
    }
    get lastToolId() {
        return this.lastToolIdValue;
    }
    get lastToolWasExecuted() {
        return this.lastToolExecuted;
    }
    markRound(round) {
        if (Number.isFinite(round) && round > this.maxRoundSeen) {
            this.maxRoundSeen = round;
        }
    }
    trackToolCall(toolId) {
        if (!toolId) {
            return;
        }
        this.totalToolCalls += 1;
        this.lastToolIdValue = toolId;
        this.lastToolExecuted = false;
    }
    markLastToolExecuted() {
        this.lastToolExecuted = true;
        if (this.lastToolIdValue) {
            this.distinctExecutedToolIds.add(this.lastToolIdValue);
        }
    }
    trackToolSuccess() {
        this.successfulToolCalls += 1;
    }
    trackToolFailure() {
        this.failedToolCalls += 1;
    }
    deduct(ruleId, round, options) {
        const points = exports.AGENT_RUN_SCORE_RULE_POINTS[ruleId];
        const record = {
            ruleId,
            points,
            round,
            toolId: options?.toolId,
            detail: options?.detail,
            timestamp: new Date(),
        };
        if (DEFERRED_RULE_IDS.has(ruleId)) {
            this.pendingDeductions.push(record);
        }
        else {
            this.deductions.push(record);
        }
    }
    summarize() {
        const isMultiStep = this.distinctExecutedToolIds.size >= MULTI_STEP_TOOL_THRESHOLD;
        const effectiveDeductions = isMultiStep
            ? this.deductions
            : [...this.deductions, ...this.pendingDeductions];
        const deductionsByRule = {};
        let deductedPoints = 0;
        for (const item of effectiveDeductions) {
            deductedPoints += Math.abs(item.points);
            if (!deductionsByRule[item.ruleId]) {
                deductionsByRule[item.ruleId] = {
                    count: 0,
                    totalPoints: 0,
                };
            }
            deductionsByRule[item.ruleId].count += 1;
            deductionsByRule[item.ruleId].totalPoints += item.points;
        }
        return {
            score: Math.max(0, exports.AGENT_RUN_SCORE_BASE - deductedPoints),
            baseScore: exports.AGENT_RUN_SCORE_BASE,
            totalDeductions: deductedPoints,
            stats: {
                totalRounds: this.maxRoundSeen + 1,
                totalToolCalls: this.totalToolCalls,
                successfulToolCalls: this.successfulToolCalls,
                failedToolCalls: this.failedToolCalls,
            },
            deductionsByRule,
            deductions: [...effectiveDeductions],
            ruleVersion: exports.AGENT_RUN_SCORE_RULE_VERSION,
        };
    }
}
exports.TaskExecutionScorer = TaskExecutionScorer;
//# sourceMappingURL=task-execution-scorer.js.map