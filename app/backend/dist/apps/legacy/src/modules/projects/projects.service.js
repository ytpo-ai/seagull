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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProjectsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto = __importStar(require("crypto"));
const project_schema_1 = require("../../shared/schemas/project.schema");
const project_api_key_schema_1 = require("../../shared/schemas/project-api-key.schema");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
const role_tier_1 = require("../../shared/role-tier");
const agent_client_service_1 = require("../agents-client/agent-client.service");
let ProjectsService = ProjectsService_1 = class ProjectsService {
    constructor(projectModel, projectApiKeyModel, employeeModel, agentClientService) {
        this.projectModel = projectModel;
        this.projectApiKeyModel = projectApiKeyModel;
        this.employeeModel = employeeModel;
        this.agentClientService = agentClientService;
        this.logger = new common_1.Logger(ProjectsService_1.name);
    }
    async isSystemAdmin(userContext) {
        if (!userContext)
            return true;
        const employee = await this.employeeModel.findOne({ id: userContext.employeeId }).exec();
        if (!employee)
            return false;
        return (0, role_tier_1.getTierByEmployeeRole)(employee.role) === 'leadership';
    }
    async getAccessibleProjectIds(userContext) {
        if (!userContext) {
            const projects = await this.projectModel.find().select({ _id: 1 }).exec();
            return projects.map((p) => p._id.toString());
        }
        const employee = await this.employeeModel.findOne({ id: userContext.employeeId }).exec();
        if (!employee)
            return [];
        if ((0, role_tier_1.getTierByEmployeeRole)(employee.role) === 'leadership') {
            const projects = await this.projectModel.find().select({ _id: 1 }).exec();
            return projects.map((p) => p._id.toString());
        }
        const projects = await this.projectModel
            .find({ adminIds: userContext.employeeId })
            .select({ _id: 1 })
            .exec();
        return projects.map((p) => p._id.toString());
    }
    async assertProjectAccess(projectId, userContext) {
        if (!userContext)
            return;
        if (await this.isSystemAdmin(userContext))
            return;
        const project = await this.projectModel.findById(projectId).exec();
        if (!project) {
            throw new common_1.NotFoundException('项目不存在');
        }
        if (!project.adminIds.includes(userContext.employeeId)) {
            throw new common_1.ForbiddenException('无权限访问该项目');
        }
    }
    async createProject(dto) {
        const existing = await this.projectModel.findOne({ name: dto.name }).exec();
        if (existing) {
            throw new common_1.ConflictException(`项目 "${dto.name}" 已存在`);
        }
        const project = new this.projectModel({
            name: dto.name,
            description: dto.description,
            localDirectory: dto.localDirectory,
            adminIds: dto.adminIds || [],
            isActive: true,
        });
        const saved = await project.save();
        this.logger.log(`Created project: ${saved._id} - ${saved.name}`);
        return this.toProjectResponse(saved);
    }
    async getAllProjects(userContext) {
        const accessibleIds = await this.getAccessibleProjectIds(userContext);
        const projects = await this.projectModel
            .find({ _id: { $in: accessibleIds } })
            .sort({ createdAt: -1 })
            .exec();
        return projects.map((p) => this.toProjectResponse(p));
    }
    async getProject(projectId, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        const project = await this.projectModel.findById(projectId).exec();
        if (!project) {
            throw new common_1.NotFoundException('项目不存在');
        }
        return this.toProjectResponse(project);
    }
    async updateProject(projectId, dto, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        if (dto.name) {
            const existing = await this.projectModel.findOne({
                name: dto.name,
                _id: { $ne: projectId },
            }).exec();
            if (existing) {
                throw new common_1.ConflictException(`项目 "${dto.name}" 已存在`);
            }
        }
        const updated = await this.projectModel.findByIdAndUpdate(projectId, { ...dto, updatedAt: new Date() }, { new: true }).exec();
        if (!updated) {
            throw new common_1.NotFoundException('项目不存在');
        }
        this.logger.log(`Updated project: ${updated._id}`);
        return this.toProjectResponse(updated);
    }
    async deleteProject(projectId, userContext) {
        const isSysAdmin = await this.isSystemAdmin(userContext);
        if (!isSysAdmin) {
            throw new common_1.ForbiddenException('只有系统管理员可以删除项目');
        }
        const result = await this.projectModel.findByIdAndDelete(projectId).exec();
        if (!result) {
            throw new common_1.NotFoundException('项目不存在');
        }
        await this.projectApiKeyModel.deleteMany({ projectId }).exec();
        this.logger.log(`Deleted project: ${projectId}`);
    }
    async assignAgent(projectId, dto, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        if (!dto.agentId) {
            throw new common_1.BadRequestException('agentId 不能为空');
        }
        const agent = await this.agentClientService.getAgent(dto.agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent ${dto.agentId} 不存在`);
        }
        const updatedAgent = await this.agentClientService.updateAgent(dto.agentId, { projectId });
        const project = await this.projectModel.findById(projectId).exec();
        if (!project) {
            throw new common_1.NotFoundException('项目不存在');
        }
        this.logger.log(`Agent ${dto.agentId} assigned to project ${projectId}`);
        return {
            project: this.toProjectResponse(project),
            agent: updatedAgent,
        };
    }
    async removeAgent(projectId, agentId, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        const agent = await this.agentClientService.getAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent ${agentId} 不存在`);
        }
        if (agent.projectId !== projectId) {
            throw new common_1.BadRequestException(`Agent ${agentId} 不属于项目 ${projectId}`);
        }
        const updatedAgent = await this.agentClientService.updateAgent(agentId, { projectId: null });
        const project = await this.projectModel.findById(projectId).exec();
        if (!project) {
            throw new common_1.NotFoundException('项目不存在');
        }
        this.logger.log(`Agent ${agentId} removed from project ${projectId}`);
        return {
            project: this.toProjectResponse(project),
            agent: updatedAgent,
        };
    }
    async getProjectAgents(projectId, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        return this.agentClientService.getAllAgents({ projectId });
    }
    generateApiKey() {
        const rawKey = `sk-proj-${crypto.randomBytes(24).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const keyPrefix = rawKey.slice(0, 16) + '...';
        return { rawKey, keyHash, keyPrefix };
    }
    async createApiKey(projectId, dto, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        const existing = await this.projectApiKeyModel.findOne({
            projectId,
            name: dto.name,
        }).exec();
        if (existing) {
            throw new common_1.ConflictException(`API Key "${dto.name}" 在该项目中已存在`);
        }
        const { rawKey, keyHash, keyPrefix } = this.generateApiKey();
        const apiKey = new this.projectApiKeyModel({
            projectId,
            name: dto.name,
            keyHash,
            keyPrefix,
            agentIds: dto.agentIds || [],
            isActive: true,
        });
        const saved = await apiKey.save();
        this.logger.log(`Created API Key for project ${projectId}: ${saved._id}`);
        return {
            apiKey: this.toApiKeyResponse(saved),
            rawKey,
        };
    }
    async getApiKeys(projectId, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        const keys = await this.projectApiKeyModel
            .find({ projectId })
            .sort({ createdAt: -1 })
            .exec();
        return keys.map((k) => this.toApiKeyResponse(k));
    }
    async revokeApiKey(projectId, keyId, userContext) {
        await this.assertProjectAccess(projectId, userContext);
        const key = await this.projectApiKeyModel.findOneAndUpdate({ _id: keyId, projectId }, { isActive: false, updatedAt: new Date() }, { new: true }).exec();
        if (!key) {
            throw new common_1.NotFoundException('API Key 不存在');
        }
        this.logger.log(`Revoked API Key ${keyId} in project ${projectId}`);
    }
    async verifyApiKey(rawKey) {
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const key = await this.projectApiKeyModel.findOne({
            keyHash,
            isActive: true,
        }).exec();
        if (!key)
            return null;
        await this.projectApiKeyModel.updateOne({ _id: key._id }, { lastUsedAt: new Date() }).exec();
        return {
            projectId: key.projectId,
            agentIds: key.agentIds,
        };
    }
    toProjectResponse(project) {
        return {
            id: project._id.toString(),
            name: project.name,
            description: project.description,
            localDirectory: project.localDirectory,
            adminIds: project.adminIds || [],
            isActive: project.isActive,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        };
    }
    toApiKeyResponse(apiKey) {
        return {
            id: apiKey._id.toString(),
            projectId: apiKey.projectId,
            name: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
            agentIds: apiKey.agentIds || [],
            isActive: apiKey.isActive,
            lastUsedAt: apiKey.lastUsedAt,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
        };
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = ProjectsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(project_schema_1.Project.name)),
    __param(1, (0, mongoose_1.InjectModel)(project_api_key_schema_1.ProjectApiKey.name)),
    __param(2, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        agent_client_service_1.AgentClientService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map