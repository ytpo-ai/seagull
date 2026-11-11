"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextModule = void 0;
const common_1 = require("@nestjs/common");
const memo_module_1 = require("../../memos/memo.module");
const prompt_registry_module_1 = require("../../prompt-registry/prompt-registry.module");
const context_assembler_service_1 = require("./context-assembler.service");
const identity_context_builder_1 = require("./identity-context.builder");
const toolset_context_builder_1 = require("./toolset-context.builder");
const domain_context_builder_1 = require("./domain-context.builder");
const collaboration_context_builder_1 = require("./collaboration-context.builder");
const task_context_builder_1 = require("./task-context.builder");
const deduction_context_builder_1 = require("./deduction-context.builder");
const memory_context_builder_1 = require("./memory-context.builder");
const context_fingerprint_service_1 = require("./context-fingerprint.service");
const context_strategy_service_1 = require("./context-strategy.service");
const context_prompt_service_1 = require("./context-prompt.service");
let ContextModule = class ContextModule {
};
exports.ContextModule = ContextModule;
exports.ContextModule = ContextModule = __decorate([
    (0, common_1.Module)({
        imports: [memo_module_1.MemoModule, prompt_registry_module_1.PromptRegistryModule],
        providers: [
            context_assembler_service_1.ContextAssemblerService,
            context_fingerprint_service_1.ContextFingerprintService,
            context_strategy_service_1.ContextStrategyService,
            context_prompt_service_1.ContextPromptService,
            identity_context_builder_1.IdentityContextBuilder,
            toolset_context_builder_1.ToolsetContextBuilder,
            domain_context_builder_1.DomainContextBuilder,
            collaboration_context_builder_1.CollaborationContextBuilder,
            task_context_builder_1.TaskContextBuilder,
            deduction_context_builder_1.DeductionContextBuilder,
            memory_context_builder_1.MemoryContextBuilder,
        ],
        exports: [context_assembler_service_1.ContextAssemblerService, context_fingerprint_service_1.ContextFingerprintService, context_strategy_service_1.ContextStrategyService],
    })
], ContextModule);
//# sourceMappingURL=context.module.js.map