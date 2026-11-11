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
var IdentityContextBuilder_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const agent_prompt_catalog_1 = require("../../prompt-registry/agent-prompt-catalog");
const context_fingerprint_service_1 = require("./context-fingerprint.service");
const context_prompt_service_1 = require("./context-prompt.service");
const prompt_resolver_service_1 = require("../../prompt-registry/prompt-resolver.service");
let IdentityContextBuilder = IdentityContextBuilder_1 = class IdentityContextBuilder {
    constructor(contextPromptService, contextFingerprintService, promptResolverService) {
        this.contextPromptService = contextPromptService;
        this.contextFingerprintService = contextFingerprintService;
        this.promptResolverService = promptResolverService;
        this.layer = 'identity';
        this.meta = { scope: 'run', stability: 'semi-static' };
    }
    shouldInject() {
        return true;
    }
    async build(input) {
        const messages = [];
        const guidelineContent = await this.contextPromptService.resolvePromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.agentWorkingGuideline);
        const normalizedSystemPrompt = String(input.agent.systemPrompt || '').trim();
        const systemPromptContent = normalizedSystemPrompt.length >= IdentityContextBuilder_1.MIN_SYSTEM_PROMPT_LENGTH
            ? normalizedSystemPrompt
            : '';
        const agentPromptTemplateRef = this.normalizePromptTemplateRef(input.agent.promptTemplateRef);
        const agentPromptTemplateContent = await this.resolvePromptTemplateRefContent(agentPromptTemplateRef, '');
        const identityBaseFullContent = [guidelineContent, systemPromptContent, agentPromptTemplateContent]
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .join('\n\n');
        const identityBaseSnapshot = {
            guidelineHash: this.contextFingerprintService.hashFingerprint(guidelineContent),
            systemPromptHash: this.contextFingerprintService.hashFingerprint(systemPromptContent),
            promptTemplateHash: this.contextFingerprintService.hashFingerprint(agentPromptTemplateContent),
        };
        const identityBaseContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
            scope: input.contextScope,
            blockType: 'identity-base',
            fullContent: identityBaseFullContent,
            snapshot: identityBaseSnapshot,
            skipDedup: input.skipDedup,
        });
        if (identityBaseContent) {
            messages.push({
                role: 'system',
                content: guidelineContent,
                timestamp: new Date(),
                metadata: {
                    promptSlug: agent_prompt_catalog_1.AGENT_PROMPTS.agentWorkingGuideline.slug,
                },
            });
            if (systemPromptContent) {
                messages.push({
                    role: 'system',
                    content: systemPromptContent,
                    timestamp: new Date(),
                });
            }
            if (agentPromptTemplateContent) {
                messages.push({
                    role: 'system',
                    content: agentPromptTemplateContent,
                    timestamp: new Date(),
                });
            }
        }
        return messages;
    }
    normalizePromptTemplateRef(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return null;
        }
        const scene = String(input.scene || '').trim();
        const role = String(input.role || '').trim();
        if (!scene || !role) {
            return null;
        }
        return { scene, role };
    }
    async resolvePromptTemplateRefContent(ref, defaultContent) {
        if (!ref) {
            return defaultContent;
        }
        try {
            const resolved = await this.promptResolverService.resolve({
                scene: ref.scene,
                role: ref.role,
                defaultContent,
            });
            return String(resolved.content || '').trim();
        }
        catch {
            return defaultContent;
        }
    }
};
exports.IdentityContextBuilder = IdentityContextBuilder;
IdentityContextBuilder.MIN_SYSTEM_PROMPT_LENGTH = 5;
exports.IdentityContextBuilder = IdentityContextBuilder = IdentityContextBuilder_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_prompt_service_1.ContextPromptService,
        context_fingerprint_service_1.ContextFingerprintService,
        prompt_resolver_service_1.PromptResolverService])
], IdentityContextBuilder);
//# sourceMappingURL=identity-context.builder.js.map