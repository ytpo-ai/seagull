"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_ROLE_TIERS = void 0;
exports.hasPresetTierByAgentRoleCode = hasPresetTierByAgentRoleCode;
exports.isAgentRoleTier = isAgentRoleTier;
exports.normalizeAgentRoleTier = normalizeAgentRoleTier;
exports.getTierByEmployeeRole = getTierByEmployeeRole;
exports.getTierByAgentRoleCode = getTierByAgentRoleCode;
exports.canDelegateAcrossTier = canDelegateAcrossTier;
exports.AGENT_ROLE_TIERS = ['leadership', 'operations', 'temporary'];
const ALLOWED_DELEGATION_DIRECTIONS = new Set([
    'leadership>operations',
    'leadership>temporary',
    'operations>temporary',
]);
const EMPLOYEE_ROLE_TIER_MAP = {
    founder: 'leadership',
    co_founder: 'leadership',
    ceo: 'leadership',
    cto: 'leadership',
    manager: 'operations',
    senior: 'operations',
    junior: 'operations',
    intern: 'temporary',
};
const AGENT_ROLE_CODE_TIER_MAP = {
    'executive-lead': 'leadership',
    'human-exclusive-assistant': 'leadership',
    'management-assistant': 'operations',
    'technical-architect': 'operations',
    'fullstack-engineer': 'operations',
    'devops-engineer': 'operations',
    'data-analyst': 'operations',
    'product-manager': 'operations',
    'human-resources-manager': 'operations',
    'administrative-assistant': 'operations',
    'marketing-strategist': 'operations',
    'system-builtin-agent': 'operations',
    'meeting-assistant': 'operations',
    'temporary-worker': 'temporary',
};
function hasPresetTierByAgentRoleCode(roleCode) {
    const normalized = String(roleCode || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return Object.prototype.hasOwnProperty.call(AGENT_ROLE_CODE_TIER_MAP, normalized);
}
function isAgentRoleTier(value) {
    return typeof value === 'string' && exports.AGENT_ROLE_TIERS.includes(value);
}
function normalizeAgentRoleTier(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (isAgentRoleTier(normalized)) {
        return normalized;
    }
    return undefined;
}
function getTierByEmployeeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (!normalized) {
        return 'operations';
    }
    return EMPLOYEE_ROLE_TIER_MAP[normalized] || 'operations';
}
function getTierByAgentRoleCode(roleCode) {
    const normalized = String(roleCode || '').trim().toLowerCase();
    if (!normalized) {
        return 'operations';
    }
    return AGENT_ROLE_CODE_TIER_MAP[normalized] || 'operations';
}
function canDelegateAcrossTier(sourceTier, targetTier) {
    return ALLOWED_DELEGATION_DIRECTIONS.has(`${sourceTier}>${targetTier}`);
}
//# sourceMappingURL=role-tier.js.map