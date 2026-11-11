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
exports.AgentModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const agent_message_schema_1 = require("../../schemas/agent-message.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const agent_role_schema_1 = require("../../schemas/agent-role.schema");
const agent_service_1 = require("./agent.service");
const agent_controller_1 = require("./agent.controller");
const model_module_1 = require("../models/model.module");
const api_keys_module_1 = require("../../../../../src/modules/api-keys/api-keys.module");
const tool_module_1 = require("../tools/tool.module");
const memo_module_1 = require("../memos/memo.module");
const runtime_module_1 = require("../runtime/runtime.module");
const opencode_module_1 = require("../opencode/opencode.module");
const agent_executor_runtime_service_1 = require("./agent-executor-runtime.service");
const agent_after_step_evaluation_hook_1 = require("./hooks/agent-after-step-evaluation.hook");
const agent_before_step_optimization_hook_1 = require("./hooks/agent-before-step-optimization.hook");
const agent_opencode_policy_service_1 = require("./agent-opencode-policy.service");
const agent_role_service_1 = require("./agent-role.service");
const agent_executor_service_1 = require("./agent-executor.service");
const prompt_registry_module_1 = require("../prompt-registry/prompt-registry.module");
const agent_executor_engine_router_1 = require("./executor-engines/agent-executor-engine.router");
const native_agent_executor_engine_1 = require("./executor-engines/native-agent-executor.engine");
const native_streaming_agent_executor_engine_1 = require("./executor-engines/native-streaming-agent-executor.engine");
const opencode_agent_executor_engine_1 = require("./executor-engines/opencode-agent-executor.engine");
const opencode_streaming_agent_executor_engine_1 = require("./executor-engines/opencode-streaming-agent-executor.engine");
const hook_registry_service_1 = require("../runtime/hooks/hook-registry.service");
const agent_action_log_module_1 = require("../action-logs/agent-action-log.module");
const context_module_1 = require("./context/context.module");
let AgentModule = class AgentModule {
    constructor(hookRegistry, beforeStepHook, afterStepHook) {
        this.hookRegistry = hookRegistry;
        this.beforeStepHook = beforeStepHook;
        this.afterStepHook = afterStepHook;
    }
    onModuleInit() {
        this.hookRegistry.register(this.beforeStepHook);
        this.hookRegistry.register(this.afterStepHook);
    }
};
exports.AgentModule = AgentModule;
exports.AgentModule = AgentModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
                { name: agent_run_schema_1.AgentRun.name, schema: agent_run_schema_1.AgentRunSchema },
                { name: agent_message_schema_1.AgentMessage.name, schema: agent_message_schema_1.AgentMessageSchema },
                { name: agent_skill_schema_1.Skill.name, schema: agent_skill_schema_1.SkillSchema },
                { name: agent_role_schema_1.AgentRole.name, schema: agent_role_schema_1.AgentRoleSchema },
            ]),
            model_module_1.ModelModule,
            api_keys_module_1.ApiKeysModule,
            tool_module_1.ToolModule,
            memo_module_1.MemoModule,
            agent_action_log_module_1.AgentActionLogModule,
            runtime_module_1.RuntimeModule,
            opencode_module_1.OpenCodeModule,
            prompt_registry_module_1.PromptRegistryModule,
            context_module_1.ContextModule,
        ],
        controllers: [agent_controller_1.AgentController],
        providers: [
            agent_service_1.AgentService,
            agent_executor_runtime_service_1.AgentExecutorRuntimeService,
            agent_before_step_optimization_hook_1.AgentBeforeStepOptimizationHook,
            agent_after_step_evaluation_hook_1.AgentAfterStepEvaluationHook,
            agent_opencode_policy_service_1.AgentOpenCodePolicyService,
            agent_role_service_1.AgentRoleService,
            agent_executor_engine_router_1.AgentExecutorEngineRouter,
            native_agent_executor_engine_1.NativeAgentExecutorEngine,
            native_streaming_agent_executor_engine_1.NativeStreamingAgentExecutorEngine,
            opencode_agent_executor_engine_1.OpencodeAgentExecutorEngine,
            opencode_streaming_agent_executor_engine_1.OpencodeStreamingAgentExecutorEngine,
            agent_executor_service_1.AgentExecutorService,
        ],
        exports: [agent_service_1.AgentService],
    }),
    __metadata("design:paramtypes", [hook_registry_service_1.HookRegistryService,
        agent_before_step_optimization_hook_1.AgentBeforeStepOptimizationHook,
        agent_after_step_evaluation_hook_1.AgentAfterStepEvaluationHook])
], AgentModule);
//# sourceMappingURL=agent.module.js.map