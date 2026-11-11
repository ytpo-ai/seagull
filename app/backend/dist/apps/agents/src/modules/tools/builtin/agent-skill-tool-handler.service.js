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
exports.SkillToolHandler = void 0;
const common_1 = require("@nestjs/common");
const skill_service_1 = require("../../skills/skill.service");
let SkillToolHandler = class SkillToolHandler {
    constructor(skillService) {
        this.skillService = skillService;
    }
    async listSkillsByTitle(params) {
        const title = String(params?.title || '').trim();
        const search = String(params?.search || title).trim();
        const status = String(params?.status || '').trim();
        const category = String(params?.category || '').trim();
        const includeMetadata = params?.includeMetadata === true;
        const page = Math.max(1, Math.min(Number(params?.page || 1), 1000));
        const pageSize = Math.max(1, Math.min(Number(params?.limit || 20), 100));
        const result = await this.skillService.getSkillsPaged({
            status: (status || undefined),
            category: category || undefined,
            search: search || undefined,
            page,
            pageSize,
        }, {
            includeMetadata,
        });
        return {
            total: result.total,
            page: result.page,
            limit: result.pageSize,
            totalPages: result.totalPages,
            keyword: search || undefined,
            status: status || undefined,
            category: category || undefined,
            items: result.items.map((skill) => ({
                id: skill.id,
                title: skill.name,
                name: skill.name,
                description: skill.description,
                category: skill.category,
                status: skill.status,
                tags: Array.isArray(skill.tags) ? skill.tags : [],
                provider: skill.provider,
                version: skill.version,
                confidenceScore: skill.confidenceScore,
                metadata: includeMetadata ? (skill.metadata || {}) : undefined,
                updatedAt: skill.updatedAt,
            })),
            fetchedAt: new Date().toISOString(),
        };
    }
    async createSkillByMcp(params) {
        const name = String(params?.title || params?.name || '').trim();
        if (!name) {
            throw new Error('skill_master_create_skill requires title or name');
        }
        const description = String(params?.description || '').trim();
        if (!description) {
            throw new Error('skill_master_create_skill requires description');
        }
        const tags = Array.isArray(params?.tags)
            ? params.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];
        const created = await this.skillService.createSkill({
            name,
            description,
            category: params?.category,
            tags,
            sourceType: params?.sourceType,
            sourceUrl: params?.sourceUrl,
            provider: params?.provider,
            version: params?.version,
            status: params?.status,
            confidenceScore: params?.confidenceScore,
            discoveredBy: 'SkillMasterMCP',
            metadata: params?.metadata,
            content: params?.content,
            contentType: params?.contentType,
        });
        return {
            created: true,
            skill: {
                id: created.id,
                title: created.name,
                name: created.name,
                description: created.description,
                category: created.category,
                status: created.status,
                tags: Array.isArray(created.tags) ? created.tags : [],
                provider: created.provider,
                version: created.version,
                confidenceScore: created.confidenceScore,
                createdAt: created.createdAt,
            },
            createdAt: new Date().toISOString(),
        };
    }
};
exports.SkillToolHandler = SkillToolHandler;
exports.SkillToolHandler = SkillToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [skill_service_1.SkillService])
], SkillToolHandler);
//# sourceMappingURL=agent-skill-tool-handler.service.js.map