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
exports.ContextAssemblerService = void 0;
const common_1 = require("@nestjs/common");
const identity_context_builder_1 = require("./identity-context.builder");
const toolset_context_builder_1 = require("./toolset-context.builder");
const domain_context_builder_1 = require("./domain-context.builder");
const collaboration_context_builder_1 = require("./collaboration-context.builder");
const task_context_builder_1 = require("./task-context.builder");
const deduction_context_builder_1 = require("./deduction-context.builder");
const memory_context_builder_1 = require("./memory-context.builder");
let ContextAssemblerService = class ContextAssemblerService {
    constructor(identityBuilder, toolsetBuilder, domainBuilder, collaborationBuilder, taskBuilder, deductionBuilder, memoryBuilder) {
        this.identityBuilder = identityBuilder;
        this.toolsetBuilder = toolsetBuilder;
        this.domainBuilder = domainBuilder;
        this.collaborationBuilder = collaborationBuilder;
        this.taskBuilder = taskBuilder;
        this.deductionBuilder = deductionBuilder;
        this.memoryBuilder = memoryBuilder;
    }
    get builders() {
        return [
            this.identityBuilder,
            this.toolsetBuilder,
            this.domainBuilder,
            this.collaborationBuilder,
            this.taskBuilder,
            this.deductionBuilder,
            this.memoryBuilder,
        ];
    }
    async assemble(input) {
        const messages = [];
        const blockMetas = [];
        let systemBlockCount = 0;
        for (const builder of this.builders) {
            if (builder.shouldInject(input)) {
                const blockMessages = await builder.build(input);
                messages.push(...blockMessages);
                const systemMessageCount = blockMessages.filter((message) => message.role === 'system').length;
                systemBlockCount += systemMessageCount;
                blockMetas.push({
                    layer: builder.layer,
                    scope: builder.meta.scope,
                    stability: builder.meta.stability,
                    messageCount: blockMessages.length,
                    systemMessageCount,
                });
            }
        }
        const previousNonSystemMessages = (input.context.previousMessages || []).filter((message) => message?.role !== 'system');
        messages.push(...previousNonSystemMessages);
        return {
            messages,
            systemBlockCount,
            blockMetas,
        };
    }
};
exports.ContextAssemblerService = ContextAssemblerService;
exports.ContextAssemblerService = ContextAssemblerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [identity_context_builder_1.IdentityContextBuilder,
        toolset_context_builder_1.ToolsetContextBuilder,
        domain_context_builder_1.DomainContextBuilder,
        collaboration_context_builder_1.CollaborationContextBuilder,
        task_context_builder_1.TaskContextBuilder,
        deduction_context_builder_1.DeductionContextBuilder,
        memory_context_builder_1.MemoryContextBuilder])
], ContextAssemblerService);
//# sourceMappingURL=context-assembler.service.js.map