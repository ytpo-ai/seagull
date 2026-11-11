"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const tool_schema_1 = require("../../schemas/tool.schema");
const toolkit_schema_1 = require("../../schemas/toolkit.schema");
const tool_execution_schema_1 = require("../../schemas/tool-execution.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const employee_schema_1 = require("../../../../../src/shared/schemas/employee.schema");
const operation_log_schema_1 = require("../../../../../src/shared/schemas/operation-log.schema");
const api_key_schema_1 = require("../../../../../src/shared/schemas/api-key.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const agent_role_schema_1 = require("../../schemas/agent-role.schema");
const agent_tool_credential_schema_1 = require("../../schemas/agent-tool-credential.schema");
const agent_tool_token_revocation_schema_1 = require("../../schemas/agent-tool-token-revocation.schema");
const tool_service_1 = require("./tool.service");
const tool_controller_1 = require("./tool.controller");
const composio_service_1 = require("./composio.service");
const exa_service_1 = require("./builtin/exa.service");
const model_module_1 = require("../models/model.module");
const memo_module_1 = require("../memos/memo.module");
const skill_module_1 = require("../skills/skill.module");
const internal_api_client_service_1 = require("./internal-api-client.service");
const tool_governance_service_1 = require("./tool-governance.service");
const builtin_1 = require("./builtin");
const prompt_registry_admin_module_1 = require("../prompt-registry/prompt-registry-admin.module");
const agent_tool_auth_service_1 = require("./agent-tool-auth.service");
const agent_tool_auth_guard_1 = require("./agent-tool-auth.guard");
const agent_action_log_module_1 = require("../action-logs/agent-action-log.module");
const infra_1 = require("../../../../../libs/infra/src/index");
const tool_registry_service_1 = require("./tool-registry.service");
const tool_execution_service_1 = require("./tool-execution.service");
const tool_execution_dispatcher_service_1 = require("./tool-execution-dispatcher.service");
let ToolModule = class ToolModule {
};
exports.ToolModule = ToolModule;
exports.ToolModule = ToolModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            infra_1.InfraModule,
            model_module_1.ModelModule,
            memo_module_1.MemoModule,
            skill_module_1.SkillModule,
            agent_action_log_module_1.AgentActionLogModule,
            prompt_registry_admin_module_1.PromptRegistryAdminModule,
            mongoose_1.MongooseModule.forFeature([
                { name: tool_schema_1.Tool.name, schema: tool_schema_1.ToolSchema },
                { name: toolkit_schema_1.Toolkit.name, schema: toolkit_schema_1.ToolkitSchema },
                { name: tool_execution_schema_1.ToolExecution.name, schema: tool_execution_schema_1.ToolExecutionSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
                { name: employee_schema_1.Employee.name, schema: employee_schema_1.EmployeeSchema },
                { name: operation_log_schema_1.OperationLog.name, schema: operation_log_schema_1.OperationLogSchema },
                { name: api_key_schema_1.ApiKey.name, schema: api_key_schema_1.ApiKeySchema },
                { name: agent_skill_schema_1.Skill.name, schema: agent_skill_schema_1.SkillSchema },
                { name: agent_role_schema_1.AgentRole.name, schema: agent_role_schema_1.AgentRoleSchema },
                { name: agent_tool_credential_schema_1.AgentToolCredential.name, schema: agent_tool_credential_schema_1.AgentToolCredentialSchema },
                { name: agent_tool_token_revocation_schema_1.AgentToolTokenRevocation.name, schema: agent_tool_token_revocation_schema_1.AgentToolTokenRevocationSchema },
            ]),
        ],
        controllers: [tool_controller_1.ToolController],
        providers: [
            tool_service_1.ToolService,
            tool_registry_service_1.ToolRegistryService,
            tool_execution_service_1.ToolExecutionService,
            tool_execution_dispatcher_service_1.ToolExecutionDispatcherService,
            composio_service_1.ComposioService,
            exa_service_1.ExaService,
            builtin_1.WebToolsService,
            internal_api_client_service_1.InternalApiClient,
            tool_governance_service_1.ToolGovernanceService,
            builtin_1.OrchestrationToolHandler,
            builtin_1.RequirementToolHandler,
            builtin_1.RepoToolHandler,
            builtin_1.ModelToolHandler,
            builtin_1.SkillToolHandler,
            builtin_1.AuditToolHandler,
            builtin_1.MeetingToolHandler,
            builtin_1.PromptRegistryToolHandler,
            builtin_1.AgentMasterToolHandler,
            builtin_1.AgentRoleToolHandler,
            builtin_1.MemoToolHandler,
            builtin_1.CommunicationToolHandler,
            builtin_1.DataCollectionToolHandler,
            builtin_1.DiscussionOutlineToolHandler,
            builtin_1.RdIntelligenceToolHandler,
            agent_tool_auth_service_1.AgentToolAuthService,
            agent_tool_auth_guard_1.AgentToolAuthGuard,
        ],
        exports: [
            tool_service_1.ToolService,
            tool_registry_service_1.ToolRegistryService,
            tool_execution_service_1.ToolExecutionService,
            composio_service_1.ComposioService,
            exa_service_1.ExaService,
            builtin_1.WebToolsService,
            internal_api_client_service_1.InternalApiClient,
            tool_governance_service_1.ToolGovernanceService,
            builtin_1.OrchestrationToolHandler,
            builtin_1.RequirementToolHandler,
            builtin_1.RepoToolHandler,
            builtin_1.ModelToolHandler,
            builtin_1.SkillToolHandler,
            builtin_1.AuditToolHandler,
            builtin_1.MeetingToolHandler,
            builtin_1.PromptRegistryToolHandler,
            builtin_1.AgentMasterToolHandler,
            builtin_1.AgentRoleToolHandler,
            builtin_1.MemoToolHandler,
            builtin_1.CommunicationToolHandler,
            builtin_1.DataCollectionToolHandler,
            builtin_1.DiscussionOutlineToolHandler,
            builtin_1.RdIntelligenceToolHandler,
            agent_tool_auth_service_1.AgentToolAuthService,
            agent_tool_auth_guard_1.AgentToolAuthGuard,
        ],
    })
], ToolModule);
//# sourceMappingURL=tool.module.js.map