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
exports.ContextPromptService = void 0;
const common_1 = require("@nestjs/common");
const prompt_resolver_service_1 = require("../../prompt-registry/prompt-resolver.service");
let ContextPromptService = class ContextPromptService {
    constructor(promptResolverService) {
        this.promptResolverService = promptResolverService;
    }
    async resolvePromptTemplate(template, payload) {
        const buildDefaultContent = template.buildDefaultContent;
        const defaultContent = buildDefaultContent(payload);
        const resolved = await this.promptResolverService.resolve({
            scene: template.scene,
            role: template.role,
            defaultContent,
        });
        return {
            content: resolved.content,
            source: resolved.source,
            version: resolved.version,
        };
    }
    async resolvePromptContent(template, payload) {
        const resolved = await this.resolvePromptTemplate(template, payload);
        return resolved.content;
    }
};
exports.ContextPromptService = ContextPromptService;
exports.ContextPromptService = ContextPromptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prompt_resolver_service_1.PromptResolverService])
], ContextPromptService);
//# sourceMappingURL=context-prompt.service.js.map