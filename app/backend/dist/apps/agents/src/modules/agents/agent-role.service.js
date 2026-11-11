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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AgentRoleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRoleService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_role_schema_1 = require("../../schemas/agent-role.schema");
const tool_service_1 = require("../tools/tool.service");
const agent_constants_1 = require("./agent.constants");
const builtin_tool_catalog_1 = require("../tools/builtin-tool-catalog");
const role_tier_1 = require("../../../../../src/shared/role-tier");
const DEFAULT_MCP_PROFILE = {
    role: 'general-assistant',
    tools: [],
    permissions: [],
    permissionsManual: [],
    permissionsDerived: [],
    capabilities: [],
    exposed: false,
    description: 'No MCP profile found for this role',
};
let AgentRoleService = AgentRoleService_1 = class AgentRoleService {
    constructor(roleModel, toolService) {
        this.roleModel = roleModel;
        this.toolService = toolService;
        this.logger = new common_1.Logger(AgentRoleService_1.name);
    }
    async getAvailableRoles(options) {
        const filter = {};
        if (options?.status) {
            filter.status = options.status;
        }
        const rows = await this.roleModel.find(filter).sort({ updatedAt: -1 }).lean().exec();
        return rows.map((row) => this.normalizeRoleTier(row));
    }
    async getRoleById(roleId) {
        const normalizedRoleId = String(roleId || '').trim();
        if (!normalizedRoleId) {
            return null;
        }
        const role = await this.roleModel.findOne({ id: normalizedRoleId }).lean().exec();
        return role ? this.normalizeRoleTier(role) : null;
    }
    async getRoleByCode(roleCode) {
        const normalizedCode = String(roleCode || '').trim();
        if (!normalizedCode) {
            return null;
        }
        const role = await this.roleModel.findOne({ code: normalizedCode }).lean().exec();
        return role ? this.normalizeRoleTier(role) : null;
    }
    async createRole(input) {
        const code = String(input?.code || '').trim();
        const name = String(input?.name || '').trim();
        if (!code) {
            throw new common_1.BadRequestException('Role code is required');
        }
        if (!name) {
            throw new common_1.BadRequestException('Role name is required');
        }
        const existing = await this.roleModel.findOne({ code }).lean().exec();
        if (existing) {
            throw new common_1.BadRequestException(`Role code already exists: ${code}`);
        }
        const normalizedTier = (0, role_tier_1.normalizeAgentRoleTier)(input?.tier);
        if (input?.tier !== undefined && !normalizedTier) {
            throw new common_1.BadRequestException('Role tier must be one of leadership, operations, temporary');
        }
        if (normalizedTier && (0, role_tier_1.hasPresetTierByAgentRoleCode)(code) && normalizedTier !== (0, role_tier_1.getTierByAgentRoleCode)(code)) {
            throw new common_1.BadRequestException(`Role tier mismatch with code ${code}: expected ${(0, role_tier_1.getTierByAgentRoleCode)(code)}`);
        }
        const role = await this.roleModel.create({
            code,
            name,
            tier: normalizedTier || (0, role_tier_1.getTierByAgentRoleCode)(code),
            description: String(input?.description || '').trim(),
            capabilities: this.normalizeStringArray(input?.capabilities),
            tools: this.normalizeStringArray(input?.tools),
            permissions: this.normalizeStringArray(input?.permissions),
            permissionsManual: this.normalizeStringArray(input?.permissionsManual),
            permissionsDerived: this.normalizeStringArray(input?.permissionsDerived),
            exposed: input?.exposed === true,
            promptTemplate: String(input?.promptTemplate || '').trim(),
            status: input?.status === 'inactive' ? 'inactive' : 'active',
        });
        return this.normalizeRoleTier(role.toObject());
    }
    async updateRole(roleId, updates) {
        const normalizedRoleId = String(roleId || '').trim();
        if (!normalizedRoleId) {
            throw new common_1.BadRequestException('Role id is required');
        }
        const role = await this.roleModel.findOne({ id: normalizedRoleId }).exec();
        if (!role) {
            throw new common_1.NotFoundException(`Role not found: ${normalizedRoleId}`);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'code')) {
            const nextCode = String(updates.code || '').trim();
            if (!nextCode) {
                throw new common_1.BadRequestException('Role code cannot be empty');
            }
            const duplicate = await this.roleModel.findOne({ code: nextCode, id: { $ne: normalizedRoleId } }).lean().exec();
            if (duplicate) {
                throw new common_1.BadRequestException(`Role code already exists: ${nextCode}`);
            }
            role.code = nextCode;
            if (!Object.prototype.hasOwnProperty.call(updates, 'tier')) {
                role.tier = (0, role_tier_1.getTierByAgentRoleCode)(nextCode);
            }
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'tier')) {
            const nextTier = (0, role_tier_1.normalizeAgentRoleTier)(updates.tier);
            if (!nextTier) {
                throw new common_1.BadRequestException('Role tier must be one of leadership, operations, temporary');
            }
            if ((0, role_tier_1.hasPresetTierByAgentRoleCode)(role.code) && nextTier !== (0, role_tier_1.getTierByAgentRoleCode)(role.code)) {
                throw new common_1.BadRequestException(`Role tier mismatch with code ${role.code}: expected ${(0, role_tier_1.getTierByAgentRoleCode)(role.code)}`);
            }
            role.tier = nextTier;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
            const nextName = String(updates.name || '').trim();
            if (!nextName) {
                throw new common_1.BadRequestException('Role name cannot be empty');
            }
            role.name = nextName;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
            role.description = String(updates.description || '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'capabilities')) {
            role.capabilities = this.normalizeStringArray(updates.capabilities);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'tools')) {
            role.tools = this.normalizeStringArray(updates.tools);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'permissions')) {
            role.permissions = this.normalizeStringArray(updates.permissions);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'permissionsManual')) {
            role.permissionsManual = this.normalizeStringArray(updates.permissionsManual);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'permissionsDerived')) {
            role.permissionsDerived = this.normalizeStringArray(updates.permissionsDerived);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'exposed')) {
            role.exposed = updates.exposed === true;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'promptTemplate')) {
            role.promptTemplate = String(updates.promptTemplate || '').trim();
        }
        if (updates.status === 'active' || updates.status === 'inactive') {
            role.status = updates.status;
        }
        const saved = await role.save();
        return this.normalizeRoleTier(saved.toObject());
    }
    async deleteRole(roleId) {
        const normalizedRoleId = String(roleId || '').trim();
        if (!normalizedRoleId) {
            throw new common_1.BadRequestException('Role id is required');
        }
        const result = await this.roleModel.deleteOne({ id: normalizedRoleId }).exec();
        return { deleted: result.deletedCount === 1 };
    }
    async assertRoleExists(roleId) {
        const normalizedRoleId = String(roleId || '').trim();
        if (!normalizedRoleId) {
            throw new common_1.BadRequestException('roleId is required');
        }
        const role = await this.getRoleById(normalizedRoleId);
        if (!role) {
            throw new common_1.BadRequestException(`Invalid roleId: ${normalizedRoleId}`);
        }
        if (role.status !== 'active') {
            throw new common_1.BadRequestException(`Role is not active: ${normalizedRoleId}`);
        }
        return role;
    }
    async getRoleMapByIds(roleIds) {
        const uniqueIds = Array.from(new Set(roleIds.map((item) => String(item || '').trim()).filter(Boolean)));
        const map = new Map();
        if (!uniqueIds.length) {
            return map;
        }
        await Promise.all(uniqueIds.map(async (roleId) => {
            try {
                const role = await this.getRoleById(roleId);
                if (role) {
                    map.set(roleId, role);
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'unknown role fetch error';
                this.logger.warn(`Skip role ${roleId} due to fetch failure: ${message}`);
            }
        }));
        return map;
    }
    async inheritRoleProfilePermissions(roleId, currentPermissions) {
        const role = await this.assertRoleExists(roleId);
        return (0, agent_constants_1.uniqueStrings)(currentPermissions || [], role.permissions || role.capabilities || []);
    }
    async ensureToolsWithinRolePermissionWhitelist(roleId, tools, action) {
        const normalizedRoleId = String(roleId || '').trim();
        if (!normalizedRoleId) {
            throw new common_1.BadRequestException('roleId is required before assigning tools');
        }
        const role = await this.assertRoleExists(normalizedRoleId);
        const whitelist = new Set((0, agent_constants_1.normalizeToolIds)(role.tools || []));
        const normalized = (0, agent_constants_1.normalizeToolIds)(tools || []);
        const invalid = normalized.filter((toolId) => !whitelist.has(toolId));
        if (invalid.length > 0) {
            throw new common_1.BadRequestException(`Invalid tools for role ${role.code} on ${action}: ${invalid.join(', ')}. ` +
                'Agent.tools must be a subset of the role tool permission set.');
        }
        return normalized;
    }
    async getAllowedToolIds(agent) {
        const role = await this.getRoleById(agent.roleId);
        const merged = (0, agent_constants_1.uniqueStrings)(agent.tools || [], role?.tools || [], [...builtin_tool_catalog_1.AUTH_FREE_TOOL_IDS])
            .map((toolId) => (0, agent_constants_1.normalizeToolId)(toolId));
        return merged;
    }
    async getAgentsMcpMap() {
        const roles = await this.roleModel.find().lean().exec();
        const record = {};
        for (const role of roles) {
            const code = String(role.code || '').trim();
            if (code) {
                record[code] = this.roleToMcpMapProfile(role);
            }
        }
        return record;
    }
    async getMcpProfileByRoleCode(roleCode) {
        const normalizedRoleCode = String(roleCode || '').trim();
        if (!normalizedRoleCode) {
            return DEFAULT_MCP_PROFILE;
        }
        const role = await this.roleModel.findOne({ code: normalizedRoleCode }).lean().exec();
        if (!role) {
            return DEFAULT_MCP_PROFILE;
        }
        return this.roleToMcpMapProfile(role);
    }
    async getMcpProfilesByRoleCodes(roleCodes) {
        const uniqueRoleCodes = Array.from(new Set(roleCodes.map((item) => item.trim()).filter(Boolean)));
        if (!uniqueRoleCodes.length) {
            return new Map();
        }
        const roles = await this.roleModel.find({ code: { $in: uniqueRoleCodes } }).lean().exec();
        const map = new Map();
        for (const role of roles) {
            const code = String(role.code || '').trim();
            if (code) {
                map.set(code, this.roleToMcpMapProfile(role));
            }
        }
        return map;
    }
    async getMcpProfiles() {
        const roles = await this.roleModel.find().sort({ code: 1 }).lean().exec();
        return roles.map((role) => this.roleToMcpMapProfile(role));
    }
    async getMcpProfile(roleCode) {
        const normalizedCode = String(roleCode || '').trim();
        if (!normalizedCode)
            return null;
        const role = await this.roleModel.findOne({ code: normalizedCode }).lean().exec();
        if (!role)
            return null;
        return this.roleToMcpMapProfile(role);
    }
    async upsertMcpProfile(roleCode, updates) {
        const normalizedRoleCode = String(roleCode || '').trim();
        if (!normalizedRoleCode) {
            throw new common_1.BadRequestException('roleCode is required');
        }
        const existing = await this.roleModel.findOne({ code: normalizedRoleCode }).exec();
        const normalizedTools = (0, agent_constants_1.normalizeToolIds)(Object.prototype.hasOwnProperty.call(updates, 'tools') ? updates.tools || [] : (existing?.tools || []));
        const hasManualPermissionUpdates = Object.prototype.hasOwnProperty.call(updates, 'permissions') ||
            Object.prototype.hasOwnProperty.call(updates, 'capabilities') ||
            Object.prototype.hasOwnProperty.call(updates, 'permissionsManual');
        const manualPermissions = hasManualPermissionUpdates
            ? this.normalizeIncomingPermissions(updates)
            : this.normalizeIncomingPermissions(existing || {});
        const permissionsDerived = await this.derivePermissionsFromTools(normalizedTools);
        const mergedPermissions = (0, agent_constants_1.uniqueStrings)(manualPermissions, permissionsDerived);
        const updatePayload = {
            tools: normalizedTools,
            permissionsManual: manualPermissions,
            permissionsDerived,
            permissions: mergedPermissions,
            exposed: Object.prototype.hasOwnProperty.call(updates, 'exposed')
                ? updates.exposed === true
                : existing?.exposed === true,
        };
        if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
            updatePayload.description = updates.description || '';
        }
        const role = await this.roleModel
            .findOneAndUpdate({ code: normalizedRoleCode }, { $set: updatePayload }, { new: true })
            .lean()
            .exec();
        if (!role) {
            throw new common_1.BadRequestException(`Role not found for code: ${normalizedRoleCode}`);
        }
        return this.roleToMcpMapProfile(role);
    }
    async getToolPermissionSets() {
        const roles = await this.getAvailableRoles();
        return roles.map((role) => this.roleToToolPermissionSet(role));
    }
    async upsertToolPermissionSet(roleCode, updates) {
        const normalizedRoleCode = String(roleCode || '').trim();
        if (!normalizedRoleCode) {
            throw new common_1.BadRequestException('roleCode is required');
        }
        const existing = await this.roleModel.findOne({ code: normalizedRoleCode }).exec();
        if (!existing) {
            throw new common_1.BadRequestException(`Role code not found: ${normalizedRoleCode}`);
        }
        const normalizedTools = (0, agent_constants_1.normalizeToolIds)(Object.prototype.hasOwnProperty.call(updates, 'tools') ? updates.tools || [] : (existing.tools || []));
        const hasManualPermissionUpdates = Object.prototype.hasOwnProperty.call(updates, 'permissions') ||
            Object.prototype.hasOwnProperty.call(updates, 'capabilities') ||
            Object.prototype.hasOwnProperty.call(updates, 'permissionsManual');
        const manualPermissions = hasManualPermissionUpdates
            ? this.normalizeIncomingPermissions(updates)
            : this.normalizeIncomingPermissions(existing || {});
        const permissionsDerived = await this.derivePermissionsFromTools(normalizedTools);
        const mergedPermissions = (0, agent_constants_1.uniqueStrings)(manualPermissions, permissionsDerived);
        existing.tools = normalizedTools;
        existing.permissionsManual = manualPermissions;
        existing.permissionsDerived = permissionsDerived;
        existing.permissions = mergedPermissions;
        existing.exposed = Object.prototype.hasOwnProperty.call(updates, 'exposed')
            ? updates.exposed === true
            : existing.exposed === true;
        if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
            existing.description = String(updates.description || '').trim();
        }
        const saved = await existing.save();
        return this.roleToToolPermissionSet(saved.toObject());
    }
    async getMcpAgents(allAgents, options) {
        const includeHidden = options?.includeHidden === true;
        const normalizedAgents = allAgents.map((agent) => this.normalizeAgentEntity(agent));
        const roleMap = await this.getRoleMapByIds(normalizedAgents.map((agent) => agent.roleId));
        const mapped = await this.buildAgentMcpProfiles(normalizedAgents, roleMap);
        const visibleAgents = mapped.filter((item) => includeHidden || item.exposed);
        return {
            total: mapped.length,
            visible: visibleAgents.length,
            agents: visibleAgents,
        };
    }
    async getMcpAgent(agent, options) {
        const includeHidden = options?.includeHidden === true;
        const normalized = this.normalizeAgentEntity(agent);
        const role = await this.getRoleById(normalized.roleId);
        const profile = await this.buildSingleAgentMcpProfile(normalized, role || undefined);
        if (!includeHidden && !profile.exposed) {
            throw new common_1.NotFoundException(`MCP profile is not exposed for agent: ${normalized.id}`);
        }
        return profile;
    }
    async buildAgentMcpProfiles(agents, roleMap) {
        const profileKeys = agents.map((agent) => this.resolveProfileLookupKey(roleMap.get(agent.roleId)));
        const profileMap = await this.getMcpProfilesByRoleCodes(profileKeys);
        const toolMap = await this.buildToolSummaryMap(agents, profileMap, roleMap);
        return agents.map((agent) => {
            const role = roleMap.get(agent.roleId);
            const mapKey = this.resolveProfileLookupKey(role);
            const profile = profileMap.get(mapKey) || DEFAULT_MCP_PROFILE;
            return this.toMcpProfile(agent, profile, mapKey, toolMap, role);
        });
    }
    async buildSingleAgentMcpProfile(agent, role) {
        const mapKey = this.resolveProfileLookupKey(role);
        const mapProfile = await this.getMcpProfileByRoleCode(role?.code);
        const roleMap = new Map();
        if (role) {
            roleMap.set(agent.roleId, role);
        }
        const toolMap = await this.buildToolSummaryMap([agent], new Map([[mapKey, mapProfile]]), roleMap);
        return this.toMcpProfile(agent, mapProfile, mapKey, toolMap, role);
    }
    async derivePermissionsFromTools(tools) {
        const normalizedTools = (0, agent_constants_1.normalizeToolIds)(tools || []);
        if (!normalizedTools.length) {
            return [];
        }
        const matchedTools = await this.toolService.getToolsByIds(normalizedTools);
        const permissionIds = (matchedTools || []).flatMap((tool) => (Array.isArray(tool.requiredPermissions) ? tool.requiredPermissions : [])
            .map((item) => String(item?.id || '').trim())
            .filter(Boolean));
        return this.normalizeStringArray(permissionIds);
    }
    resolveProfileLookupKey(role) {
        const roleCode = String(role?.code || '').trim();
        if (roleCode)
            return roleCode;
        return '';
    }
    async buildToolSummaryMap(agents, profileMap, roleMap) {
        const mergedIds = (0, agent_constants_1.uniqueStrings)(...agents.map((agent) => {
            const mapKey = this.resolveProfileLookupKey(roleMap?.get(agent.roleId));
            const mapProfile = profileMap.get(mapKey) || DEFAULT_MCP_PROFILE;
            return [...(agent.tools || []), ...(mapProfile.tools || [])];
        })).map((toolId) => (0, agent_constants_1.normalizeToolId)(toolId));
        if (!mergedIds.length) {
            return new Map();
        }
        const tools = await this.toolService.getToolsByIds(mergedIds);
        const summaryMap = new Map();
        for (const tool of tools) {
            const canonicalId = tool.canonicalId || (0, agent_constants_1.normalizeToolId)(tool.id);
            const summary = {
                id: canonicalId,
                name: tool.name,
                description: tool.description,
                type: tool.type,
                category: tool.category,
            };
            summaryMap.set(canonicalId, summary);
            summaryMap.set(tool.id, summary);
        }
        return summaryMap;
    }
    toMcpProfile(agent, profile, mapKey, toolMap, role) {
        const toolIds = (0, agent_constants_1.uniqueStrings)(agent.tools || [], profile.tools || []).map((toolId) => (0, agent_constants_1.normalizeToolId)(toolId));
        const toolSet = toolIds.map((toolId) => {
            const existing = toolMap.get(toolId);
            if (existing)
                return existing;
            return {
                id: toolId,
                name: toolId,
                description: 'Tool metadata not found in registry',
            };
        });
        return {
            id: agent.id || '',
            name: agent.name,
            description: agent.description || profile.description || '',
            roleId: agent.roleId,
            role: role?.name || role?.code || profile.role,
            capabilitySet: (0, agent_constants_1.uniqueStrings)(agent.capabilities || [], profile.permissions || profile.capabilities || []),
            toolSet,
            exposed: profile.exposed === true,
            mapKey: mapKey || 'default',
        };
    }
    roleToMcpMapProfile(role) {
        const tools = (0, agent_constants_1.normalizeToolIds)(role?.tools || []);
        const permissionsManual = this.normalizeStringArray(role?.permissionsManual || []);
        const permissionsDerived = this.normalizeStringArray(role?.permissionsDerived || []);
        const permissions = this.resolveRolePermissions(role);
        return {
            role: String(role?.code || role?.name || '').trim() || DEFAULT_MCP_PROFILE.role,
            tools,
            permissions,
            permissionsManual,
            permissionsDerived,
            capabilities: permissions,
            exposed: role?.exposed === true,
            description: role?.description || '',
        };
    }
    roleToToolPermissionSet(role) {
        const permissions = this.resolveRolePermissions(role);
        return {
            roleId: role.id,
            roleCode: role.code,
            roleName: role.name || role.code,
            roleStatus: role.status || 'unknown',
            tools: (0, agent_constants_1.normalizeToolIds)(role.tools || []),
            permissions,
            permissionsManual: this.normalizeStringArray(role.permissionsManual || []),
            permissionsDerived: this.normalizeStringArray(role.permissionsDerived || []),
            capabilities: permissions,
            exposed: role.exposed === true,
            description: role.description || '',
        };
    }
    resolveRolePermissions(role) {
        if (!role) {
            return [];
        }
        return (0, agent_constants_1.uniqueStrings)(this.normalizeStringArray(role.permissions || []), this.normalizeStringArray(role.permissionsManual || []), this.normalizeStringArray(role.permissionsDerived || []), this.normalizeStringArray(role.capabilities || []));
    }
    normalizeIncomingPermissions(updates) {
        return (0, agent_constants_1.uniqueStrings)(this.normalizeStringArray(updates?.permissions || []), this.normalizeStringArray(updates?.permissionsManual || []), this.normalizeStringArray(updates?.capabilities || []));
    }
    normalizeAgentEntity(agent) {
        const plain = agent?.toObject ? agent.toObject() : agent;
        const id = plain?.id || plain?._id?.toString?.() || plain?._id;
        return {
            ...plain,
            id,
        };
    }
    normalizeRoleTier(role) {
        const code = String(role?.code || '').trim().toLowerCase();
        const tier = role?.tier || (0, role_tier_1.getTierByAgentRoleCode)(code);
        return {
            ...role,
            tier,
        };
    }
    normalizeStringArray(items) {
        return Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean)));
    }
};
exports.AgentRoleService = AgentRoleService;
exports.AgentRoleService = AgentRoleService = AgentRoleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_role_schema_1.AgentRole.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        tool_service_1.ToolService])
], AgentRoleService);
//# sourceMappingURL=agent-role.service.js.map