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
exports.AgentRoleToolHandler = void 0;
const common_1 = require("@nestjs/common");
const internal_api_client_service_1 = require("../internal-api-client.service");
const role_tier_1 = require("../../../../../../src/shared/role-tier");
const tool_identity_util_1 = require("../tool-identity.util");
let AgentRoleToolHandler = class AgentRoleToolHandler {
    constructor(internalApiClient) {
        this.internalApiClient = internalApiClient;
    }
    normalizeRoleMcpPayload(role) {
        const code = String(role?.code || '').trim();
        return {
            id: String(role?.id || role?._id || '').trim(),
            code,
            name: String(role?.name || code).trim(),
            description: String(role?.description || '').trim(),
            capabilities: (0, tool_identity_util_1.normalizeStringArray)(role?.capabilities),
            tools: (0, tool_identity_util_1.normalizeStringArray)(role?.tools),
            promptTemplate: String(role?.promptTemplate || '').trim(),
            status: role?.status === 'inactive' ? 'inactive' : 'active',
            tier: (0, role_tier_1.normalizeAgentRoleTier)(role?.tier) || (0, role_tier_1.getTierByAgentRoleCode)(code),
        };
    }
    async listAgentRolesByMcp(params) {
        const normalizedStatus = String(params?.status || '').trim().toLowerCase();
        if (normalizedStatus && normalizedStatus !== 'active' && normalizedStatus !== 'inactive') {
            throw new Error('agent_role_master_list_roles invalid status, expected active|inactive');
        }
        const includeInactive = params?.includeInactive === true;
        const status = normalizedStatus || (includeInactive ? '' : 'active');
        const endpoint = status ? `/agents/roles?status=${status}` : '/agents/roles';
        const roles = (await this.internalApiClient.callAgentsApi('GET', endpoint)) || [];
        const items = (Array.isArray(roles) ? roles : []).map((role) => this.normalizeRoleMcpPayload(role));
        return {
            action: 'list_roles',
            total: items.length,
            status: status || 'all',
            roles: items,
            fetchedAt: new Date().toISOString(),
        };
    }
    async createAgentRoleByMcp(params) {
        const code = String(params?.code || '').trim();
        const name = String(params?.name || '').trim();
        if (!code) {
            throw new Error('agent_role_master_create_role requires code');
        }
        if (!name) {
            throw new Error('agent_role_master_create_role requires name');
        }
        const status = String(params?.status || '').trim().toLowerCase();
        if (status && status !== 'active' && status !== 'inactive') {
            throw new Error('agent_role_master_create_role invalid status, expected active|inactive');
        }
        const payload = {
            code,
            name,
            ...(Object.prototype.hasOwnProperty.call(params || {}, 'description')
                ? { description: String(params?.description || '').trim() }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(params || {}, 'capabilities')
                ? { capabilities: (0, tool_identity_util_1.normalizeStringArray)(params?.capabilities) }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(params || {}, 'tools') ? { tools: (0, tool_identity_util_1.normalizeStringArray)(params?.tools) } : {}),
            ...(Object.prototype.hasOwnProperty.call(params || {}, 'promptTemplate')
                ? { promptTemplate: String(params?.promptTemplate || '').trim() }
                : {}),
            ...(status ? { status } : {}),
            ...(Object.prototype.hasOwnProperty.call(params || {}, 'tier') ? { tier: String(params?.tier || '').trim() } : {}),
        };
        const created = await this.internalApiClient.callAgentsApi('POST', '/agents/roles', payload);
        return {
            action: 'create_role',
            created: true,
            role: this.normalizeRoleMcpPayload(created || payload),
            createdAt: new Date().toISOString(),
        };
    }
    async updateAgentRoleByMcp(params) {
        const roleId = String(params?.roleId || params?.id || '').trim();
        if (!roleId) {
            throw new Error('agent_role_master_update_role requires roleId');
        }
        const status = String(params?.status || '').trim().toLowerCase();
        if (status && status !== 'active' && status !== 'inactive') {
            throw new Error('agent_role_master_update_role invalid status, expected active|inactive');
        }
        const updates = {};
        if (Object.prototype.hasOwnProperty.call(params || {}, 'code')) {
            updates.code = String(params?.code || '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(params || {}, 'name')) {
            updates.name = String(params?.name || '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(params || {}, 'description')) {
            updates.description = String(params?.description || '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(params || {}, 'capabilities')) {
            updates.capabilities = (0, tool_identity_util_1.normalizeStringArray)(params?.capabilities);
        }
        if (Object.prototype.hasOwnProperty.call(params || {}, 'tools')) {
            updates.tools = (0, tool_identity_util_1.normalizeStringArray)(params?.tools);
        }
        if (Object.prototype.hasOwnProperty.call(params || {}, 'promptTemplate')) {
            updates.promptTemplate = String(params?.promptTemplate || '').trim();
        }
        if (status) {
            updates.status = status;
        }
        if (Object.prototype.hasOwnProperty.call(params || {}, 'tier')) {
            updates.tier = String(params?.tier || '').trim();
        }
        if (!Object.keys(updates).length) {
            throw new Error('agent_role_master_update_role requires at least one update field');
        }
        const updated = await this.internalApiClient.callAgentsApi('PUT', `/agents/roles/${roleId}`, updates);
        return {
            action: 'update_role',
            updated: true,
            roleId,
            role: this.normalizeRoleMcpPayload(updated || { id: roleId, ...updates }),
            updatedAt: new Date().toISOString(),
        };
    }
    async deleteAgentRoleByMcp(params) {
        const roleId = String(params?.roleId || params?.id || '').trim();
        if (!roleId) {
            throw new Error('agent_role_master_delete_role requires roleId');
        }
        const deleted = await this.internalApiClient.callAgentsApi('DELETE', `/agents/roles/${roleId}`);
        return {
            action: 'delete_role',
            roleId,
            deleted: deleted?.deleted === true,
            deletedAt: new Date().toISOString(),
        };
    }
};
exports.AgentRoleToolHandler = AgentRoleToolHandler;
exports.AgentRoleToolHandler = AgentRoleToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [internal_api_client_service_1.InternalApiClient])
], AgentRoleToolHandler);
//# sourceMappingURL=agent-role-tool-handler.service.js.map