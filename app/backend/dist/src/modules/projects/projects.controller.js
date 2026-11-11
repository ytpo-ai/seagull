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
var ProjectsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("../../../libs/auth/src/index");
const projects_service_1 = require("./projects.service");
const project_dto_1 = require("./dto/project.dto");
const INTERNAL_CONTEXT_SECRET = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
let ProjectsController = ProjectsController_1 = class ProjectsController {
    constructor(projectsService) {
        this.projectsService = projectsService;
        this.logger = new common_1.Logger(ProjectsController_1.name);
    }
    tryGetUserContext(req) {
        const encoded = req.headers['x-user-context'];
        const signature = req.headers['x-user-signature'];
        if (!encoded || !signature) {
            return null;
        }
        if (!(0, auth_1.verifyEncodedContext)(encoded, signature, INTERNAL_CONTEXT_SECRET)) {
            this.logger.debug('User context signature verification failed, treating as internal call');
            return null;
        }
        const userContext = (0, auth_1.decodeUserContext)(encoded);
        if (!userContext.employeeId) {
            return null;
        }
        return userContext;
    }
    async createProject(dto, req) {
        return this.projectsService.createProject(dto);
    }
    async getAllProjects(req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.getAllProjects(userContext);
    }
    async getProject(id, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.getProject(id, userContext);
    }
    async updateProject(id, dto, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.updateProject(id, dto, userContext);
    }
    async deleteProject(id, req) {
        const userContext = this.tryGetUserContext(req);
        await this.projectsService.deleteProject(id, userContext);
        return { message: '项目已删除' };
    }
    async getProjectAgents(projectId, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.getProjectAgents(projectId, userContext);
    }
    async assignAgent(projectId, dto, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.assignAgent(projectId, dto, userContext);
    }
    async removeAgent(projectId, agentId, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.removeAgent(projectId, agentId, userContext);
    }
    async createApiKey(projectId, dto, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.createApiKey(projectId, dto, userContext);
    }
    async getApiKeys(projectId, req) {
        const userContext = this.tryGetUserContext(req);
        return this.projectsService.getApiKeys(projectId, userContext);
    }
    async revokeApiKey(projectId, keyId, req) {
        const userContext = this.tryGetUserContext(req);
        await this.projectsService.revokeApiKey(projectId, keyId, userContext);
        return { message: 'API Key 已撤销' };
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [project_dto_1.CreateProjectDto, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "createProject", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getAllProjects", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getProject", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, project_dto_1.UpdateProjectDto, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "deleteProject", null);
__decorate([
    (0, common_1.Get)(':id/agents'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getProjectAgents", null);
__decorate([
    (0, common_1.Post)(':id/agents'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, project_dto_1.AssignAgentDto, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "assignAgent", null);
__decorate([
    (0, common_1.Delete)(':id/agents/:agentId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('agentId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "removeAgent", null);
__decorate([
    (0, common_1.Post)(':id/api-keys'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, project_dto_1.CreateApiKeyDto, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "createApiKey", null);
__decorate([
    (0, common_1.Get)(':id/api-keys'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getApiKeys", null);
__decorate([
    (0, common_1.Delete)(':id/api-keys/:keyId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('keyId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "revokeApiKey", null);
exports.ProjectsController = ProjectsController = ProjectsController_1 = __decorate([
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map