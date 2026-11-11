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
exports.DomainContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const context_fingerprint_service_1 = require("./context-fingerprint.service");
let DomainContextBuilder = class DomainContextBuilder {
    constructor(contextFingerprintService) {
        this.contextFingerprintService = contextFingerprintService;
        this.layer = 'domain';
        this.meta = { scope: 'run', stability: 'static' };
    }
    shouldInject(input) {
        return Boolean(input.persistedContext?.domainContext?.domainType || input.persistedContext?.domainContext?.description);
    }
    async build(input) {
        const domain = input.persistedContext?.domainContext || {
            domainType: 'general',
            description: '通用对话任务',
        };
        const constraints = Array.isArray(domain.constraints) && domain.constraints.length
            ? `\n约束:\n${domain.constraints.map((item) => `- ${item}`).join('\n')}`
            : '';
        const refs = Array.isArray(domain.knowledgeRefs) && domain.knowledgeRefs.length
            ? `\n知识引用:\n${domain.knowledgeRefs.map((item) => `- ${item}`).join('\n')}`
            : '';
        const content = `Domain Context:\n- domainType: ${domain.domainType || 'general'}\n- description: ${domain.description || ''}${constraints}${refs}`;
        const resolvedContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
            scope: input.contextScope,
            blockType: 'domain',
            fullContent: content,
            snapshot: {
                domainType: String(domain.domainType || 'general').trim(),
                descriptionHash: this.contextFingerprintService.hashFingerprint(String(domain.description || '')),
                constraintCount: Array.isArray(domain.constraints) ? domain.constraints.length : 0,
                refCount: Array.isArray(domain.knowledgeRefs) ? domain.knowledgeRefs.length : 0,
            },
            skipDedup: input.skipDedup,
        });
        if (!resolvedContent) {
            return [];
        }
        return [{ role: 'system', content: resolvedContent, timestamp: new Date() }];
    }
};
exports.DomainContextBuilder = DomainContextBuilder;
exports.DomainContextBuilder = DomainContextBuilder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_fingerprint_service_1.ContextFingerprintService])
], DomainContextBuilder);
//# sourceMappingURL=domain-context.builder.js.map