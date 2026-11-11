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
exports.ToolExecutionDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const builtin_1 = require("./builtin");
const builtin_tool_definitions_1 = require("./builtin-tool-definitions");
const builtin_tool_catalog_1 = require("./builtin-tool-catalog");
const tool_registry_service_1 = require("./tool-registry.service");
let ToolExecutionDispatcherService = class ToolExecutionDispatcherService {
    constructor(orchestrationToolHandler, requirementToolHandler, repoToolHandler, modelToolHandler, skillToolHandler, auditToolHandler, meetingToolHandler, promptRegistryToolHandler, webToolsService, agentMasterToolHandler, agentRoleToolHandler, memoToolHandler, communicationToolHandler, rdIntelligenceToolHandler, dataCollectionToolHandler, discussionOutlineToolHandler, toolRegistryService) {
        this.orchestrationToolHandler = orchestrationToolHandler;
        this.requirementToolHandler = requirementToolHandler;
        this.repoToolHandler = repoToolHandler;
        this.modelToolHandler = modelToolHandler;
        this.skillToolHandler = skillToolHandler;
        this.auditToolHandler = auditToolHandler;
        this.meetingToolHandler = meetingToolHandler;
        this.promptRegistryToolHandler = promptRegistryToolHandler;
        this.webToolsService = webToolsService;
        this.agentMasterToolHandler = agentMasterToolHandler;
        this.agentRoleToolHandler = agentRoleToolHandler;
        this.memoToolHandler = memoToolHandler;
        this.communicationToolHandler = communicationToolHandler;
        this.rdIntelligenceToolHandler = rdIntelligenceToolHandler;
        this.dataCollectionToolHandler = dataCollectionToolHandler;
        this.discussionOutlineToolHandler = discussionOutlineToolHandler;
        this.toolRegistryService = toolRegistryService;
    }
    async executeToolImplementation(tool, parameters, agentId, executionContext) {
        const repoDispatch = this.dispatchRepoToolImplementation(tool.id, parameters, executionContext);
        if (repoDispatch) {
            return repoDispatch;
        }
        const orchestrationDispatch = this.dispatchOrchestrationToolImplementation(tool.id, parameters, agentId, executionContext);
        if (orchestrationDispatch) {
            return orchestrationDispatch;
        }
        const requirementDispatch = this.dispatchRequirementToolImplementation(tool.id, parameters, agentId, executionContext);
        if (requirementDispatch) {
            return requirementDispatch;
        }
        const dataCollectionDispatch = this.dispatchDataCollectionToolImplementation(tool.id, parameters, agentId, executionContext);
        if (dataCollectionDispatch) {
            return dataCollectionDispatch;
        }
        const promptRegistryDispatch = this.dispatchPromptRegistryToolImplementation(tool.id, parameters);
        if (promptRegistryDispatch) {
            return promptRegistryDispatch;
        }
        switch (tool.id) {
            case builtin_tool_definitions_1.TOOL_ID__WEB_SEARCH_EXA:
                return this.webToolsService.performWebSearchExa(parameters);
            case builtin_tool_definitions_1.TOOL_ID__WEB_SEARCH_SERP:
                return this.webToolsService.performWebSearchSerp(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__WEB_FETCH:
                return this.webToolsService.performWebFetch(parameters);
            case builtin_tool_definitions_1.TOOL_ID__CONTENT_EXTRACT:
                return this.webToolsService.performContentExtract(parameters);
            case builtin_tool_definitions_1.TOOL_ID__SLACK_SEND_MESSAGE:
                return this.communicationToolHandler.sendSlackMessage(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__GMAIL_SEND_EMAIL:
                return this.communicationToolHandler.sendGmail(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__SEND_INTERNAL_MESSAGE:
                return this.communicationToolHandler.sendInternalMessage(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_LIST:
                return this.agentMasterToolHandler.getAgentsMcpList(parameters, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_CREATE:
                return this.agentMasterToolHandler.createAgentByMcp(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_ROLE_LIST:
                return this.agentRoleToolHandler.listAgentRolesByMcp(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_ROLE_CREATE:
                return this.agentRoleToolHandler.createAgentRoleByMcp(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_ROLE_UPDATE:
                return this.agentRoleToolHandler.updateAgentRoleByMcp(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_ROLE_DELETE:
                return this.agentRoleToolHandler.deleteAgentRoleByMcp(parameters);
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_STATISTICS_FILES_RUN:
                return this.rdIntelligenceToolHandler.runEngineeringStatistics(parameters);
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_STATISTICS_DOCS_HEAT_RUN:
                return this.rdIntelligenceToolHandler.runDocsHeat(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_MODEL_LIST:
                return this.modelToolHandler.listSystemModels(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_MODEL_ADD:
                return this.modelToolHandler.addModelToSystem(parameters);
            case builtin_tool_definitions_1.TOOL_ID__EMPLYEE_LOGS:
                return this.auditToolHandler.listHumanOperationLogs(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_MEMORY_SEARCH_MEMO:
                return this.memoToolHandler.searchMemoMemory(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_MEMORY_APPEND_MEMO:
                return this.memoToolHandler.appendMemoMemory(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__GET_TOOL_SCHEMA:
                return this.getToolSchema(parameters, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_SKILL_LIST:
                return this.skillToolHandler.listSkillsByTitle(parameters);
            case builtin_tool_definitions_1.TOOL_ID__AGENT_SKILL_CREATE:
                return this.skillToolHandler.createSkillByMcp(parameters);
            case builtin_tool_definitions_1.TOOL_ID__MEETING_LIST:
                return this.meetingToolHandler.listMeetings(parameters);
            case builtin_tool_definitions_1.TOOL_ID__MEETING_GET_DETAIL:
                return this.meetingToolHandler.getMeetingDetail(parameters);
            case builtin_tool_definitions_1.TOOL_ID__MEETING_SEND_MESSAGE:
                return this.meetingToolHandler.sendMeetingMessage(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__MEETING_UPDATE_STATUS:
                return this.meetingToolHandler.updateMeetingStatus(parameters);
            case builtin_tool_definitions_1.TOOL_ID__MEETING_SAVE_SUMMARY:
                return this.meetingToolHandler.saveMeetingSummary(parameters, agentId);
            case builtin_tool_definitions_1.TOOL_ID__DISCUSSION_OUTLINE_MANAGE:
                return this.discussionOutlineToolHandler.manage(parameters, agentId, executionContext);
            default:
                throw new Error(`Tool implementation not found: ${tool.id}`);
        }
    }
    dispatchRepoToolImplementation(toolId, parameters, executionContext) {
        switch (toolId) {
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_REPO_READ:
                return this.repoToolHandler.executeRepoRead(parameters, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_REPO_WRITER:
                return this.repoToolHandler.executeRepoWriter(parameters);
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_DOCS_READ:
                return this.repoToolHandler.getCodeDocsReader(parameters);
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_DOCS_WRITE:
                return this.repoToolHandler.executeDocsWrite(parameters);
            case builtin_tool_definitions_1.TOOL_ID__ENGINEERING_COMMIT_READ:
                return this.repoToolHandler.getCodeUpdatesReader(parameters);
            default:
                return undefined;
        }
    }
    dispatchPromptRegistryToolImplementation(toolId, parameters) {
        switch (toolId) {
            case builtin_tool_definitions_1.TOOL_ID__PROMPT_REGISTRY_LIST_TEMPLATES:
                return this.promptRegistryToolHandler.listPromptTemplates(parameters);
            case builtin_tool_definitions_1.TOOL_ID__PROMPT_REGISTRY_GET_TEMPLATE:
                return this.promptRegistryToolHandler.getPromptTemplate(parameters);
            case builtin_tool_definitions_1.TOOL_ID__PROMPT_REGISTRY_SAVE_TEMPLATE:
                return this.promptRegistryToolHandler.savePromptTemplate(parameters);
            default:
                return undefined;
        }
    }
    dispatchOrchestrationToolImplementation(toolId, parameters, agentId, executionContext) {
        switch (toolId) {
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_CREATE_PLAN:
                return this.orchestrationToolHandler.createOrchestrationPlan(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_UPDATE_PLAN:
                return this.orchestrationToolHandler.updateOrchestrationPlan(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_RUN_PLAN:
                return this.orchestrationToolHandler.runOrchestrationPlan(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_GET_PLAN:
                return this.orchestrationToolHandler.getOrchestrationPlan(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_LIST_PLANS:
                return this.orchestrationToolHandler.listOrchestrationPlans(agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_INIT_PLAN:
                return this.orchestrationToolHandler.planInitialize(parameters, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_SUBMIT_TASK:
                return this.orchestrationToolHandler.submitOrchestrationTask(parameters, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__ORCHESTRATION_SUBMIT_TASK_RUN_RESULT:
                return this.orchestrationToolHandler.reportOrchestrationTaskRunResult(parameters, executionContext);
            default:
                return undefined;
        }
    }
    dispatchRequirementToolImplementation(toolId, parameters, agentId, executionContext) {
        switch (toolId) {
            case builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_LIST:
                return this.requirementToolHandler.listRequirements(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_GET:
                return this.requirementToolHandler.getRequirement(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_CREATE:
                return this.requirementToolHandler.createRequirement(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_UPDATE_STATUS:
                return this.requirementToolHandler.updateRequirementStatus(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_UPDATE:
                return this.requirementToolHandler.mutateRequirement(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__REQUIREMENT_SYNC_GITHUB:
                return this.requirementToolHandler.syncRequirementGithub(parameters, agentId);
            default:
                return undefined;
        }
    }
    dispatchDataCollectionToolImplementation(toolId, parameters, agentId, executionContext) {
        switch (toolId) {
            case builtin_tool_definitions_1.TOOL_ID__DATA_COLLECTION_GET_SOURCE_CONFIG:
                return this.dataCollectionToolHandler.getSourceConfig(parameters, agentId, executionContext);
            case builtin_tool_definitions_1.TOOL_ID__DATA_COLLECTION_WRITE_RECORD:
                return this.dataCollectionToolHandler.writeRecord(parameters, agentId, executionContext);
            default:
                return undefined;
        }
    }
    getImplementedToolIds() {
        return builtin_tool_catalog_1.IMPLEMENTED_TOOL_IDS;
    }
    async getToolSchema(parameters, executionContext) {
        const queriedToolId = String(parameters?.toolId || '').trim();
        if (!queriedToolId) {
            throw new Error('get-tool-schema requires toolId');
        }
        const assignedToolIds = new Set((executionContext?.assignedToolIds || []).map((id) => String(id || '').trim()).filter(Boolean));
        if (assignedToolIds.size > 0 && !assignedToolIds.has(queriedToolId)) {
            const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queriedToolId);
            const hint = looksLikeUuid
                ? `。该 ID 看起来是 Skill ID 而非工具 ID。Skill 是知识型指令（已通过 system message 注入），不是可调用的工具，请直接根据 Skill 注入的内容完成任务`
                : '';
            throw new Error(`tool schema access denied: ${queriedToolId}${hint}`);
        }
        const contract = await this.toolRegistryService.getToolInputContract(queriedToolId);
        if (!contract?.schema) {
            return {
                toolId: queriedToolId,
                found: false,
                message: `工具 ${queriedToolId} 未找到或没有参数定义`,
            };
        }
        return {
            toolId: contract.toolId,
            found: true,
            schema: contract.schema,
            hint: this.buildToolSchemaHint(contract.toolId, contract.schema),
        };
    }
    buildToolSchemaHint(toolId, schema) {
        const properties = schema?.properties;
        if (!properties || typeof properties !== 'object') {
            return null;
        }
        const required = new Set(Array.isArray(schema.required)
            ? schema.required.map((item) => String(item || '').trim()).filter(Boolean)
            : []);
        const rows = Object.entries(properties);
        if (!rows.length) {
            return null;
        }
        const lines = [`工具参数契约 ${toolId}:`];
        if (required.size > 0) {
            lines.push(`required: [${Array.from(required).join(', ')}]`);
        }
        if (schema.additionalProperties === false) {
            lines.push('additionalProperties: false');
        }
        lines.push('properties:');
        for (const [key, spec] of rows) {
            const type = String(spec?.type || 'any');
            const enumText = Array.isArray(spec?.enum) ? `, enum=${JSON.stringify(spec.enum)}` : '';
            const requiredText = required.has(key) ? ' (required)' : '';
            const description = String(spec?.description || '').trim();
            const descText = description ? ` - ${description}` : '';
            lines.push(`  ${key}: ${type}${enumText}${requiredText}${descText}`);
        }
        return lines.join('\n');
    }
};
exports.ToolExecutionDispatcherService = ToolExecutionDispatcherService;
exports.ToolExecutionDispatcherService = ToolExecutionDispatcherService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [builtin_1.OrchestrationToolHandler,
        builtin_1.RequirementToolHandler,
        builtin_1.RepoToolHandler,
        builtin_1.ModelToolHandler,
        builtin_1.SkillToolHandler,
        builtin_1.AuditToolHandler,
        builtin_1.MeetingToolHandler,
        builtin_1.PromptRegistryToolHandler,
        builtin_1.WebToolsService,
        builtin_1.AgentMasterToolHandler,
        builtin_1.AgentRoleToolHandler,
        builtin_1.MemoToolHandler,
        builtin_1.CommunicationToolHandler,
        builtin_1.RdIntelligenceToolHandler,
        builtin_1.DataCollectionToolHandler,
        builtin_1.DiscussionOutlineToolHandler,
        tool_registry_service_1.ToolRegistryService])
], ToolExecutionDispatcherService);
//# sourceMappingURL=tool-execution-dispatcher.service.js.map