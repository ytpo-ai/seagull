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
exports.ToolsetContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const agent_prompt_catalog_1 = require("../../prompt-registry/agent-prompt-catalog");
const agent_constants_1 = require("../agent.constants");
const context_fingerprint_service_1 = require("./context-fingerprint.service");
const context_prompt_service_1 = require("./context-prompt.service");
const context_strategy_service_1 = require("./context-strategy.service");
let ToolsetContextBuilder = class ToolsetContextBuilder {
    constructor(contextPromptService, contextStrategyService, contextFingerprintService) {
        this.contextPromptService = contextPromptService;
        this.contextStrategyService = contextStrategyService;
        this.contextFingerprintService = contextFingerprintService;
        this.layer = 'toolset';
        this.meta = { scope: 'run', stability: 'dynamic' };
    }
    shouldInject() {
        return true;
    }
    async build(input) {
        const messages = [];
        if (input.enabledSkills.length > 0) {
            const skillLines = input.enabledSkills
                .map((skill) => `- ${skill.name} (id=${skill.id}, proficiency=${skill.proficiencyLevel}) | description=${skill.description} | tags=${(skill.tags || []).join(', ') || 'N/A'}`)
                .join('\n');
            messages.push({
                role: 'system',
                content: `Enabled Skills for this agent:\n${skillLines}\n\n` +
                    `注意：Skills 是知识型指令（已在后续 system message 中注入完整内容），不是可调用的工具。` +
                    `请直接根据 skill 注入的指令内容完成任务，不要尝试用 get-tool-schema 查询 Skill ID。`,
                timestamp: new Date(),
            });
            for (const skill of input.enabledSkills) {
                const collaborationCtx = (input.context?.collaborationContext || {});
                const activationContext = {
                    domainType: String(collaborationCtx.domainType || '').trim() || undefined,
                    taskType: String(collaborationCtx.taskType || input.task.type || '').trim() || undefined,
                    phase: String(collaborationCtx.phase || '').trim() || undefined,
                    roleInPlan: String(collaborationCtx.roleInPlan || '').trim() || undefined,
                };
                if (!this.contextStrategyService.shouldActivateSkillContent(skill, input.task, input.context, activationContext)) {
                    continue;
                }
                const rawContent = input.shared.skillContents.get(skill.id);
                if (!rawContent)
                    continue;
                const contentChunks = (0, agent_constants_1.splitTextByMaxLength)(rawContent, agent_constants_1.SKILL_CONTENT_MAX_INJECT_LENGTH);
                contentChunks.forEach((contentChunk, index) => {
                    const chunkSuffix = contentChunks.length > 1 ? `（part ${index + 1}/${contentChunks.length}）` : '';
                    messages.push({
                        role: 'system',
                        content: `【enabled skill - ${skill.name}${chunkSuffix}】\n\n${contentChunk}`,
                        timestamp: new Date(),
                    });
                });
            }
        }
        if (input.shared.assignedTools.length > 0) {
            const toolSpecs = input.shared.assignedTools.map((tool) => {
                const id = tool.canonicalId || (0, agent_constants_1.normalizeToolId)(tool.id);
                const name = String(tool.name || '').trim() || 'Unnamed Tool';
                const description = String(tool.description || '').trim() || 'No description';
                return `- ${id} | ${name} | ${description}`;
            });
            const toolSpecContent = await this.contextPromptService.resolvePromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.toolInjectionInstruction, { toolSpecs });
            const toolPromptMessages = this.contextStrategyService.buildToolPromptMessages(input.shared.assignedTools);
            const toolStrategyContent = toolPromptMessages.length > 0
                ? await this.contextPromptService.resolvePromptContent(agent_prompt_catalog_1.AGENT_PROMPTS.toolStrategyWrapper, {
                    toolPromptMessages,
                })
                : '';
            const combinedToolsetSpecContent = `${toolSpecContent}\n\n${toolStrategyContent}`;
            const resolvedToolsetSpecContent = await this.contextFingerprintService.resolveSystemContextBlockContent({
                scope: input.contextScope,
                blockType: 'toolset-spec',
                fullContent: combinedToolsetSpecContent,
                snapshot: {
                    toolIdsSorted: input.shared.assignedTools
                        .map((tool) => String(tool.canonicalId || (0, agent_constants_1.normalizeToolId)(tool.id) || '').trim())
                        .filter((id) => id.length > 0)
                        .sort(),
                },
                skipDedup: input.skipDedup,
            });
            if (resolvedToolsetSpecContent) {
                if (resolvedToolsetSpecContent !== combinedToolsetSpecContent) {
                    messages.push({
                        role: 'system',
                        content: resolvedToolsetSpecContent,
                        timestamp: new Date(),
                        metadata: {
                            promptSlug: `${agent_prompt_catalog_1.AGENT_PROMPTS.toolInjectionInstruction.slug}+${agent_prompt_catalog_1.AGENT_PROMPTS.toolStrategyWrapper.slug}`,
                        },
                    });
                    return messages;
                }
                messages.push({
                    role: 'system',
                    content: toolSpecContent,
                    timestamp: new Date(),
                    metadata: {
                        promptSlug: agent_prompt_catalog_1.AGENT_PROMPTS.toolInjectionInstruction.slug,
                    },
                });
                if (toolStrategyContent) {
                    messages.push({
                        role: 'system',
                        content: toolStrategyContent,
                        timestamp: new Date(),
                        metadata: {
                            promptSlug: agent_prompt_catalog_1.AGENT_PROMPTS.toolStrategyWrapper.slug,
                        },
                    });
                }
            }
        }
        return messages;
    }
};
exports.ToolsetContextBuilder = ToolsetContextBuilder;
exports.ToolsetContextBuilder = ToolsetContextBuilder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [context_prompt_service_1.ContextPromptService,
        context_strategy_service_1.ContextStrategyService,
        context_fingerprint_service_1.ContextFingerprintService])
], ToolsetContextBuilder);
//# sourceMappingURL=toolset-context.builder.js.map