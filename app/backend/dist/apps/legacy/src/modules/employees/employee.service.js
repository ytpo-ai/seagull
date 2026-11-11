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
var EmployeeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
const agent_client_service_1 = require("../agents-client/agent-client.service");
const uuid_1 = require("uuid");
const models_1 = require("../../config/models");
const role_tier_1 = require("../../shared/role-tier");
let EmployeeService = EmployeeService_1 = class EmployeeService {
    constructor(employeeModel, agentClientService) {
        this.employeeModel = employeeModel;
        this.agentClientService = agentClientService;
        this.logger = new common_1.Logger(EmployeeService_1.name);
    }
    async onModuleInit() {
        const purgeResult = await this.employeeModel.deleteMany({ type: employee_schema_1.EmployeeType.AGENT }).exec();
        if (purgeResult.deletedCount) {
            this.logger.warn(`Purged legacy AI agent employees: ${purgeResult.deletedCount}`);
        }
    }
    pickDefaultAssistantModel() {
        const preferredIds = ['gpt-4o-mini', 'gpt-4o', 'claude-sonnet-4-6', 'gemini-1.5-flash'];
        for (const modelId of preferredIds) {
            const found = models_1.AVAILABLE_MODELS.find((model) => model.id === modelId);
            if (found) {
                return found;
            }
        }
        return models_1.AVAILABLE_MODELS[0];
    }
    async buildAssistantName(baseName) {
        const allAgents = await this.agentClientService.getAllAgents();
        const taken = new Set((allAgents || [])
            .map((agent) => String(agent.name || '').trim().toLowerCase())
            .filter(Boolean));
        const normalizedBase = baseName.trim() || '专属助理';
        if (!taken.has(normalizedBase.toLowerCase())) {
            return normalizedBase;
        }
        for (let idx = 2; idx <= 999; idx += 1) {
            const candidate = `${normalizedBase} ${idx}`;
            if (!taken.has(candidate.toLowerCase())) {
                return candidate;
            }
        }
        return `${normalizedBase} ${Date.now()}`;
    }
    buildAssistantDisplayName(ownerName) {
        const normalized = ownerName.trim();
        if (!normalized) {
            return '专属助理';
        }
        return `${normalized} 的专属助理`;
    }
    async attachAssistantNames(employees) {
        const assistantIds = Array.from(new Set(employees
            .map((employee) => employee.exclusiveAssistantAgentId || employee.aiProxyAgentId)
            .filter((id) => !!id)));
        if (assistantIds.length === 0) {
            return employees.map((employee) => employee.toObject());
        }
        const nameById = new Map();
        try {
            const allAgents = await this.agentClientService.getAllAgents();
            for (const agent of allAgents || []) {
                const id = String(agent.id || '').trim();
                if (!id) {
                    continue;
                }
                nameById.set(id, String(agent.name || '').trim());
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to resolve assistant names from agents service: ${message}`);
        }
        return employees.map((employee) => {
            const assistantId = employee.exclusiveAssistantAgentId || employee.aiProxyAgentId;
            const assistantName = assistantId ? nameById.get(assistantId) : undefined;
            return {
                ...employee.toObject(),
                exclusiveAssistantName: assistantName || undefined,
            };
        });
    }
    async createEmployee(dto) {
        if (dto.type !== employee_schema_1.EmployeeType.HUMAN) {
            throw new common_1.ConflictException('AI Agent employee identity has been removed; only human employees are supported');
        }
        if (!dto.name) {
            throw new common_1.ConflictException('Human employee must have a name');
        }
        if (dto.userId) {
            const existing = await this.employeeModel.findOne({
                userId: dto.userId,
            }).exec();
            if (existing) {
                throw new common_1.ConflictException('User is already an employee');
            }
        }
        if (dto.exclusiveAssistantAgentId) {
            const assistantAgent = await this.agentClientService.getAgent(dto.exclusiveAssistantAgentId);
            if (!assistantAgent) {
                throw new common_1.ConflictException('Exclusive assistant agent does not exist or is unavailable');
            }
            const duplicateAssistant = await this.employeeModel.findOne({
                type: employee_schema_1.EmployeeType.HUMAN,
                $or: [
                    { exclusiveAssistantAgentId: dto.exclusiveAssistantAgentId },
                    { aiProxyAgentId: dto.exclusiveAssistantAgentId },
                ],
            }).exec();
            if (duplicateAssistant) {
                throw new common_1.ConflictException('This agent is already bound as another human account assistant');
            }
        }
        const roleTier = this.resolveEmployeeTierOrThrow(dto.tier, dto.role);
        const employee = new this.employeeModel({
            id: (0, uuid_1.v4)(),
            type: dto.type,
            userId: dto.userId,
            name: dto.name,
            email: dto.email,
            avatar: dto.avatar,
            role: dto.role,
            tier: roleTier,
            departmentId: dto.departmentId,
            title: dto.title || this.getDefaultTitle(dto.role),
            description: dto.description,
            joinDate: new Date(),
            status: dto.role === employee_schema_1.EmployeeRole.FOUNDER || dto.role === employee_schema_1.EmployeeRole.CO_FOUNDER
                ? employee_schema_1.EmployeeStatus.ACTIVE
                : employee_schema_1.EmployeeStatus.PROBATION,
            probationEndDate: dto.role === employee_schema_1.EmployeeRole.FOUNDER || dto.role === employee_schema_1.EmployeeRole.CO_FOUNDER
                ? undefined
                : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            salary: dto.salary || 0,
            shares: dto.shares || 0,
            stockOptions: dto.stockOptions || 0,
            capabilities: dto.capabilities || [],
            allowAIProxy: dto.allowAIProxy || false,
            aiProxyAgentId: dto.aiProxyAgentId,
            exclusiveAssistantAgentId: dto.exclusiveAssistantAgentId || dto.aiProxyAgentId,
            meetingPreferences: {
                autoJoin: true,
                notifications: true,
                preferredMeetingTypes: [],
            },
            performance: {
                overallScore: 0,
                taskCompletionRate: 0,
                codeQuality: 0,
                collaboration: 0,
                innovation: 0,
                efficiency: 0,
                totalEvaluations: 0,
            },
            statistics: {
                totalTasks: 0,
                completedTasks: 0,
                totalTokens: 0,
                totalCost: 0,
                meetingsAttended: 0,
                meetingsHosted: 0,
            },
        });
        const saved = await employee.save();
        this.logger.log(`Created ${dto.type} employee: ${saved.name || saved.id}`);
        return saved;
    }
    async getEmployeesByOrganization(filters) {
        if (filters?.type && filters.type !== employee_schema_1.EmployeeType.HUMAN) {
            return [];
        }
        const query = { type: employee_schema_1.EmployeeType.HUMAN };
        if (filters?.status)
            query.status = filters.status;
        if (filters?.departmentId)
            query.departmentId = filters.departmentId;
        const employees = await this.employeeModel.find(query).sort({ createdAt: -1 }).exec();
        return this.attachAssistantNames(employees);
    }
    async getEmployee(employeeId) {
        return this.employeeModel.findOne({ id: employeeId }).exec();
    }
    async getEmployeeByAgentId(agentId) {
        return this.employeeModel.findOne({ agentId }).exec();
    }
    async getEmployeeByUserId(userId) {
        return this.employeeModel.findOne({ userId }).exec();
    }
    async updateEmployee(employeeId, dto) {
        const existing = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!existing) {
            return null;
        }
        const normalizedUpdate = { ...dto };
        const nextRole = dto.role || existing.role;
        if (dto.role !== undefined || dto.tier !== undefined) {
            normalizedUpdate.tier = this.resolveEmployeeTierOrThrow(dto.tier, nextRole);
        }
        if (dto.exclusiveAssistantAgentId !== undefined) {
            if (dto.exclusiveAssistantAgentId) {
                const assistantAgent = await this.agentClientService.getAgent(dto.exclusiveAssistantAgentId);
                if (!assistantAgent) {
                    throw new common_1.ConflictException('Exclusive assistant agent does not exist or is unavailable');
                }
                const duplicateAssistant = await this.employeeModel.findOne({
                    id: { $ne: employeeId },
                    type: employee_schema_1.EmployeeType.HUMAN,
                    $or: [
                        { exclusiveAssistantAgentId: dto.exclusiveAssistantAgentId },
                        { aiProxyAgentId: dto.exclusiveAssistantAgentId },
                    ],
                }).exec();
                if (duplicateAssistant) {
                    throw new common_1.ConflictException('This agent is already bound as another human account assistant');
                }
            }
            normalizedUpdate.aiProxyAgentId = dto.exclusiveAssistantAgentId || undefined;
            normalizedUpdate.allowAIProxy = !!dto.exclusiveAssistantAgentId;
        }
        const updated = await this.employeeModel.findOneAndUpdate({ id: employeeId }, { ...normalizedUpdate, updatedAt: new Date() }, { new: true }).exec();
        const nextName = String(dto.name || '').trim();
        const prevName = String(existing.name || '').trim();
        const assistantAgentId = updated?.exclusiveAssistantAgentId || updated?.aiProxyAgentId;
        const shouldSyncAssistantName = !!updated && !!assistantAgentId && !!nextName && nextName !== prevName;
        if (shouldSyncAssistantName && assistantAgentId) {
            const targetAssistantName = this.buildAssistantDisplayName(nextName);
            await this.agentClientService.updateAgent(assistantAgentId, { name: targetAssistantName });
        }
        if (updated) {
            this.logger.log(`Updated employee: ${employeeId}`);
        }
        return updated;
    }
    async deleteEmployee(employeeId) {
        const result = await this.employeeModel.findOneAndDelete({ id: employeeId }).exec();
        if (result) {
            this.logger.log(`Deleted employee: ${employeeId}`);
            return true;
        }
        return false;
    }
    async confirmEmployee(employeeId) {
        return this.employeeModel.findOneAndUpdate({ id: employeeId }, {
            status: employee_schema_1.EmployeeStatus.ACTIVE,
            probationEndDate: new Date(),
            updatedAt: new Date(),
        }, { new: true }).exec();
    }
    async terminateEmployee(employeeId, reason) {
        return this.employeeModel.findOneAndUpdate({ id: employeeId }, {
            status: employee_schema_1.EmployeeStatus.TERMINATED,
            updatedAt: new Date(),
        }, { new: true }).exec();
    }
    async getEmployeeStats() {
        const total = await this.employeeModel.countDocuments({ type: employee_schema_1.EmployeeType.HUMAN });
        const byType = await this.employeeModel.aggregate([
            { $match: { type: employee_schema_1.EmployeeType.HUMAN } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
        ]);
        const byStatus = await this.employeeModel.aggregate([
            { $match: { type: employee_schema_1.EmployeeType.HUMAN } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const byDepartment = await this.employeeModel.aggregate([
            { $match: { type: employee_schema_1.EmployeeType.HUMAN } },
            { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        ]);
        const humans = byType.find(t => t._id === employee_schema_1.EmployeeType.HUMAN)?.count || 0;
        const agents = 0;
        return {
            total,
            byType,
            byStatus,
            byDepartment,
            humans,
            agents,
        };
    }
    async setAIProxy(employeeId, agentId) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee)
            return null;
        if (employee.type !== employee_schema_1.EmployeeType.HUMAN) {
            throw new common_1.ConflictException('Only human employees can set AI proxy');
        }
        if (agentId) {
            const assistantAgent = await this.agentClientService.getAgent(agentId);
            if (!assistantAgent) {
                throw new common_1.ConflictException('Exclusive assistant agent does not exist or is unavailable');
            }
            const duplicateAssistant = await this.employeeModel.findOne({
                id: { $ne: employeeId },
                type: employee_schema_1.EmployeeType.HUMAN,
                $or: [
                    { exclusiveAssistantAgentId: agentId },
                    { aiProxyAgentId: agentId },
                ],
            }).exec();
            if (duplicateAssistant) {
                throw new common_1.ConflictException('This agent is already bound as another human account assistant');
            }
        }
        employee.allowAIProxy = !!agentId;
        employee.aiProxyAgentId = agentId || undefined;
        employee.exclusiveAssistantAgentId = agentId || undefined;
        employee.updatedAt = new Date();
        await employee.save();
        this.logger.log(`Set AI proxy for employee ${employeeId}: ${agentId}`);
        return employee;
    }
    async setExclusiveAssistant(employeeId, agentId) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee)
            return null;
        if (employee.type !== employee_schema_1.EmployeeType.HUMAN) {
            throw new common_1.ConflictException('Only human employees can bind exclusive assistant');
        }
        const agent = await this.agentClientService.getAgent(agentId);
        if (!agent) {
            throw new common_1.ConflictException('Exclusive assistant agent does not exist or is unavailable');
        }
        const conflictBinding = await this.employeeModel.findOne({
            id: { $ne: employeeId },
            type: employee_schema_1.EmployeeType.HUMAN,
            $or: [
                { exclusiveAssistantAgentId: agentId },
                { aiProxyAgentId: agentId },
            ],
        }).exec();
        if (conflictBinding) {
            throw new common_1.ConflictException('This agent is already bound as another human account assistant');
        }
        employee.exclusiveAssistantAgentId = agentId;
        employee.allowAIProxy = true;
        employee.aiProxyAgentId = agentId;
        employee.updatedAt = new Date();
        await employee.save();
        this.logger.log(`Set exclusive assistant for employee ${employeeId}: ${agentId}`);
        return employee;
    }
    async getExclusiveAssistant(employeeId) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee)
            return null;
        return {
            employeeId,
            agentId: employee.exclusiveAssistantAgentId || employee.aiProxyAgentId || null,
        };
    }
    async createAndBindExclusiveAssistant(employeeId) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee)
            return null;
        if (employee.type !== employee_schema_1.EmployeeType.HUMAN) {
            throw new common_1.ConflictException('Only human employees can create exclusive assistant');
        }
        const existingAssistantId = employee.exclusiveAssistantAgentId || employee.aiProxyAgentId;
        if (existingAssistantId) {
            const existingAssistant = await this.agentClientService.getAgent(existingAssistantId);
            if (existingAssistant) {
                employee.exclusiveAssistantAgentId = existingAssistantId;
                employee.aiProxyAgentId = existingAssistantId;
                employee.allowAIProxy = true;
                employee.updatedAt = new Date();
                await employee.save();
                return employee;
            }
        }
        const duplicateAssistant = await this.employeeModel.findOne({
            id: { $ne: employeeId },
            type: employee_schema_1.EmployeeType.HUMAN,
            $or: [
                { exclusiveAssistantAgentId: existingAssistantId },
                { aiProxyAgentId: existingAssistantId },
            ],
        }).exec();
        if (existingAssistantId && duplicateAssistant) {
            throw new common_1.ConflictException('This agent is already bound as another human account assistant');
        }
        const ownerDisplayName = employee.name || employee.email || employee.id;
        const assistantName = await this.buildAssistantName(this.buildAssistantDisplayName(ownerDisplayName));
        const model = this.pickDefaultAssistantModel();
        const assistantRoleId = process.env.DEFAULT_EXCLUSIVE_ASSISTANT_ROLE_ID || 'role-human-exclusive-assistant';
        let createdAssistant;
        try {
            createdAssistant = await this.agentClientService.createAgent({
                name: assistantName,
                roleId: assistantRoleId,
                description: `人类成员 ${ownerDisplayName} 的专属助理`,
                model,
                capabilities: ['personal_schedule_management', 'task_followup', 'communication_drafting'],
                systemPrompt: `你是 ${ownerDisplayName} 的专属助理。你在会议中默认保持被动，仅在该人类明确 @ 你时响应。请保持简洁、专业，并优先执行个人事务协调与行动跟进。`,
                isActive: true,
                tools: [
                    'builtin.data-gathering.internal.web.search-exa',
                    'builtin.data-gathering.internal.web.fetch',
                    'builtin.data-gathering.internal.content.extract',
                ],
                permissions: [],
                personality: {
                    workEthic: 90,
                    creativity: 70,
                    leadership: 55,
                    teamwork: 92,
                },
                learningAbility: 85,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Failed to auto-create exclusive assistant for employee ${employeeId}: ${message}`);
            throw new common_1.ConflictException('Failed to create exclusive assistant agent');
        }
        const newAssistantId = String(createdAssistant.id || '');
        if (!newAssistantId) {
            throw new common_1.ConflictException('Failed to create exclusive assistant agent');
        }
        const sharedAgentConflict = await this.employeeModel.findOne({
            id: { $ne: employeeId },
            type: employee_schema_1.EmployeeType.HUMAN,
            $or: [
                { exclusiveAssistantAgentId: newAssistantId },
                { aiProxyAgentId: newAssistantId },
            ],
        }).exec();
        if (sharedAgentConflict) {
            throw new common_1.ConflictException('Generated assistant is already bound to another human account, please retry');
        }
        employee.exclusiveAssistantAgentId = newAssistantId;
        employee.aiProxyAgentId = newAssistantId;
        employee.allowAIProxy = true;
        employee.updatedAt = new Date();
        await employee.save();
        this.logger.log(`Auto created and bound exclusive assistant for employee ${employeeId}: ${newAssistantId}`);
        return employee;
    }
    async getMeetingEntityId(employeeId) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee)
            return null;
        if (employee.type !== employee_schema_1.EmployeeType.HUMAN) {
            return null;
        }
        if (employee.allowAIProxy && employee.aiProxyAgentId) {
            const agent = await this.agentClientService.getAgent(employee.aiProxyAgentId);
            return {
                type: employee_schema_1.EmployeeType.AGENT,
                id: employee.aiProxyAgentId,
                name: agent?.name || employee.name || 'AI Proxy',
            };
        }
        return {
            type: employee_schema_1.EmployeeType.HUMAN,
            id: employeeId,
            name: employee.name || 'Unknown',
        };
    }
    getDefaultTitle(role) {
        const titles = {
            [employee_schema_1.EmployeeRole.FOUNDER]: '创始人',
            [employee_schema_1.EmployeeRole.CO_FOUNDER]: '联合创始人',
            [employee_schema_1.EmployeeRole.CEO]: '首席执行官',
            [employee_schema_1.EmployeeRole.CTO]: '首席技术官',
            [employee_schema_1.EmployeeRole.MANAGER]: '经理',
            [employee_schema_1.EmployeeRole.SENIOR]: '高级工程师',
            [employee_schema_1.EmployeeRole.JUNIOR]: '工程师',
            [employee_schema_1.EmployeeRole.INTERN]: '实习生',
        };
        return titles[role] || '员工';
    }
    resolveEmployeeTierOrThrow(requestedTier, role) {
        const normalizedRequestedTier = (0, role_tier_1.normalizeAgentRoleTier)(requestedTier);
        if (requestedTier !== undefined && !normalizedRequestedTier) {
            throw new common_1.ConflictException('tier must be one of leadership, operations, temporary');
        }
        const mappedTier = (0, role_tier_1.getTierByEmployeeRole)(role);
        if (normalizedRequestedTier && normalizedRequestedTier !== mappedTier) {
            throw new common_1.ConflictException(`tier mismatch for role ${role}: expected ${mappedTier}, got ${normalizedRequestedTier}`);
        }
        return normalizedRequestedTier || mappedTier;
    }
};
exports.EmployeeService = EmployeeService;
exports.EmployeeService = EmployeeService = EmployeeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        agent_client_service_1.AgentClientService])
], EmployeeService);
//# sourceMappingURL=employee.service.js.map