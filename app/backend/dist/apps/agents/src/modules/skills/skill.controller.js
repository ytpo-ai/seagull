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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillController = void 0;
const common_1 = require("@nestjs/common");
const skill_service_1 = require("./skill.service");
let SkillController = class SkillController {
    constructor(skillService) {
        this.skillService = skillService;
    }
    async getSkills(status, category, search, page, pageSize, includeContent, includeMetadata) {
        const numericPage = page ? Number(page) : undefined;
        const numericPageSize = pageSize ? Number(pageSize) : undefined;
        const shouldUsePaged = Boolean(search?.trim()) || Number.isFinite(numericPage) || Number.isFinite(numericPageSize);
        const shouldIncludeContent = includeContent === 'true' || includeContent === '1';
        const shouldIncludeMetadata = includeMetadata === 'true' || includeMetadata === '1';
        if (shouldUsePaged) {
            return this.skillService.getSkillsPaged({
                status,
                category,
                search,
                page: numericPage,
                pageSize: numericPageSize,
            }, {
                includeContent: shouldIncludeContent,
                includeMetadata: shouldIncludeMetadata,
            });
        }
        return this.skillService.getAllSkills({ status, category, search }, { includeContent: shouldIncludeContent, includeMetadata: shouldIncludeMetadata });
    }
    async createSkill(body) {
        return this.skillService.createSkill(body);
    }
    async getSkillContent(id) {
        return this.skillService.getSkillContentById(id);
    }
    async getAgentSkills(agentId) {
        return this.skillService.getAgentSkills(agentId);
    }
    async getSkillAgents(skillId) {
        return this.skillService.getSkillAgents(skillId);
    }
    async getAllSkillAgents() {
        return this.skillService.getAllSkillAgents();
    }
    async assignSkillToAgent(body) {
        return this.skillService.assignSkillToAgent(body.agentId, body.skillId, {
            enabled: body.enabled,
        });
    }
    async syncDocs() {
        return this.skillService.syncSkillDocsToDb();
    }
    async getSkill(id, includeContent, includeMetadata) {
        const shouldIncludeContent = includeContent === 'true' || includeContent === '1';
        const shouldIncludeMetadata = includeMetadata === 'true' || includeMetadata === '1';
        return this.skillService.getSkillById(id, {
            includeContent: shouldIncludeContent,
            includeMetadata: shouldIncludeMetadata,
        });
    }
    async updateSkill(id, updates) {
        return this.skillService.updateSkill(id, updates);
    }
    async deleteSkill(id) {
        return this.skillService.deleteSkill(id);
    }
};
exports.SkillController = SkillController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('includeContent')),
    __param(6, (0, common_1.Query)('includeMetadata')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "getSkills", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "createSkill", null);
__decorate([
    (0, common_1.Get)(':id/content'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "getSkillContent", null);
__decorate([
    (0, common_1.Get)('agents/:agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "getAgentSkills", null);
__decorate([
    (0, common_1.Get)('skills/:skillId/agents'),
    __param(0, (0, common_1.Param)('skillId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "getSkillAgents", null);
__decorate([
    (0, common_1.Get)('all-skill-agents'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "getAllSkillAgents", null);
__decorate([
    (0, common_1.Post)('assign'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "assignSkillToAgent", null);
__decorate([
    (0, common_1.Post)('docs/sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "syncDocs", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('includeContent')),
    __param(2, (0, common_1.Query)('includeMetadata')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "getSkill", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "updateSkill", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SkillController.prototype, "deleteSkill", null);
exports.SkillController = SkillController = __decorate([
    (0, common_1.Controller)('skills'),
    __metadata("design:paramtypes", [skill_service_1.SkillService])
], SkillController);
//# sourceMappingURL=skill.controller.js.map