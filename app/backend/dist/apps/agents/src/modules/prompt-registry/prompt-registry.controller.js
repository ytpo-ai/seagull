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
exports.PromptRegistryController = void 0;
const common_1 = require("@nestjs/common");
const prompt_registry_admin_service_1 = require("./prompt-registry-admin.service");
const auth_1 = require("../../../../../libs/auth/src/index");
let PromptRegistryController = class PromptRegistryController {
    constructor(promptRegistryAdminService) {
        this.promptRegistryAdminService = promptRegistryAdminService;
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
    }
    async listTemplates(scene, role, category, status, limit, req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.listTemplates({
            scene,
            role,
            category,
            status,
            limit: Number(limit || 50),
        });
    }
    async listTemplateFilters(req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.listTemplateFilters();
    }
    async getEffectiveTemplate(scene, role, sessionOverride, req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.getEffectiveTemplate({ scene, role, sessionOverride });
    }
    async saveDraft(body, req, internalContext, internalSignature) {
        const operatorId = this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.saveDraft({
            scene: String(body.scene || ''),
            role: String(body.role || ''),
            content: String(body.content || ''),
            description: body.description,
            category: body.category,
            tags: Array.isArray(body.tags) ? body.tags : undefined,
            source: body.source?.type
                ? {
                    type: body.source.type,
                    repo: body.source.repo,
                    path: body.source.path,
                }
                : undefined,
            baseVersion: typeof body.baseVersion === 'number' ? body.baseVersion : undefined,
            summary: body.summary,
            operatorId,
        });
    }
    async publish(body, req, internalContext, internalSignature) {
        const operatorId = this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.publish({
            scene: String(body.scene || ''),
            role: String(body.role || ''),
            version: Number(body.version || 0),
            summary: body.summary,
            operatorId,
        });
    }
    async unpublish(body, req, internalContext, internalSignature) {
        const operatorId = this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.unpublish({
            scene: String(body.scene || ''),
            role: String(body.role || ''),
            version: Number(body.version || 0),
            summary: body.summary,
            operatorId,
        });
    }
    async rollback(body, req, internalContext, internalSignature) {
        const operatorId = this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.rollback({
            scene: String(body.scene || ''),
            role: String(body.role || ''),
            targetVersion: Number(body.targetVersion || 0),
            summary: body.summary,
            operatorId,
        });
    }
    async diff(scene, role, baseVersion, targetVersion, req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.compareVersions({
            scene,
            role,
            baseVersion: Number(baseVersion || 0),
            targetVersion: Number(targetVersion || 0),
        });
    }
    async getTemplateById(id, req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.getTemplateById(String(id || ''));
    }
    async listAudits(scene, role, limit, req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.listAudits({
            scene,
            role,
            limit: Number(limit || 50),
        });
    }
    async deleteTemplate(id, req, internalContext, internalSignature) {
        this.resolveOperatorId(req, internalContext, internalSignature);
        return this.promptRegistryAdminService.deleteTemplate({ templateId: String(id || '') });
    }
    resolveOperatorId(req, encoded, signature) {
        const fromMiddleware = String(req?.userContext?.employeeId || '').trim();
        if (fromMiddleware) {
            return fromMiddleware;
        }
        if (!encoded || !signature) {
            throw new common_1.UnauthorizedException('Missing internal user context');
        }
        if (!(0, auth_1.verifyEncodedContext)(encoded, signature, this.contextSecret)) {
            throw new common_1.UnauthorizedException('Invalid internal user context signature');
        }
        const context = (0, auth_1.decodeUserContext)(encoded);
        const employeeId = String(context?.employeeId || '').trim();
        if (!employeeId || Number(context?.expiresAt || 0) <= Date.now()) {
            throw new common_1.UnauthorizedException('Invalid internal user context');
        }
        return employeeId;
    }
};
exports.PromptRegistryController = PromptRegistryController;
__decorate([
    (0, common_1.Get)('templates'),
    __param(0, (0, common_1.Query)('scene')),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('category')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Req)()),
    __param(6, (0, common_1.Headers)('x-user-context')),
    __param(7, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Get)('templates/filters'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-user-context')),
    __param(2, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "listTemplateFilters", null);
__decorate([
    (0, common_1.Get)('templates/effective'),
    __param(0, (0, common_1.Query)('scene')),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('sessionOverride')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Headers)('x-user-context')),
    __param(5, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "getEffectiveTemplate", null);
__decorate([
    (0, common_1.Post)('templates/draft'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "saveDraft", null);
__decorate([
    (0, common_1.Post)('templates/publish'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('templates/unpublish'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "unpublish", null);
__decorate([
    (0, common_1.Post)('templates/rollback'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "rollback", null);
__decorate([
    (0, common_1.Get)('templates/diff'),
    __param(0, (0, common_1.Query)('scene')),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('baseVersion')),
    __param(3, (0, common_1.Query)('targetVersion')),
    __param(4, (0, common_1.Req)()),
    __param(5, (0, common_1.Headers)('x-user-context')),
    __param(6, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "diff", null);
__decorate([
    (0, common_1.Get)('templates/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "getTemplateById", null);
__decorate([
    (0, common_1.Get)('audits'),
    __param(0, (0, common_1.Query)('scene')),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Headers)('x-user-context')),
    __param(5, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "listAudits", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], PromptRegistryController.prototype, "deleteTemplate", null);
exports.PromptRegistryController = PromptRegistryController = __decorate([
    (0, common_1.Controller)('prompt-registry'),
    __metadata("design:paramtypes", [prompt_registry_admin_service_1.PromptRegistryAdminService])
], PromptRegistryController);
//# sourceMappingURL=prompt-registry.controller.js.map