"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const infra_1 = require("../../../../../libs/infra/src/index");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const agent_message_schema_1 = require("../../schemas/agent-message.schema");
const agent_part_schema_1 = require("../../schemas/agent-part.schema");
const agent_event_outbox_schema_1 = require("../../schemas/agent-event-outbox.schema");
const agent_runtime_maintenance_audit_schema_1 = require("../../schemas/agent-runtime-maintenance-audit.schema");
const agent_session_schema_1 = require("../../schemas/agent-session.schema");
const agent_run_score_schema_1 = require("../../schemas/agent-run-score.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const api_keys_module_1 = require("../../../../../src/modules/api-keys/api-keys.module");
const runtime_persistence_service_1 = require("./runtime-persistence.service");
const hook_dispatcher_service_1 = require("./hook-dispatcher.service");
const runtime_orchestrator_service_1 = require("./runtime-orchestrator.service");
const runtime_action_log_service_1 = require("./runtime-action-log.service");
const runtime_ei_sync_service_1 = require("./runtime-ei-sync.service");
const runtime_controller_1 = require("./runtime.controller");
const agent_run_score_controller_1 = require("./agent-run-score.controller");
const agent_run_score_service_1 = require("./agent-run-score.service");
const memo_module_1 = require("../memos/memo.module");
const runtime_memo_snapshot_queue_service_1 = require("./runtime-memo-snapshot-queue.service");
const hook_registry_service_1 = require("./hooks/hook-registry.service");
const hook_pipeline_service_1 = require("./hooks/hook-pipeline.service");
const agent_action_log_module_1 = require("../action-logs/agent-action-log.module");
const common_2 = require("../../../../../libs/common/src/index");
const model_module_1 = require("../models/model.module");
const runtime_run_diagnosis_service_1 = require("./runtime-run-diagnosis.service");
let RuntimeModule = class RuntimeModule {
};
exports.RuntimeModule = RuntimeModule;
exports.RuntimeModule = RuntimeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            infra_1.InfraModule,
            model_module_1.ModelModule,
            memo_module_1.MemoModule,
            api_keys_module_1.ApiKeysModule,
            agent_action_log_module_1.AgentActionLogModule,
            mongoose_1.MongooseModule.forFeature([
                { name: agent_run_schema_1.AgentRun.name, schema: agent_run_schema_1.AgentRunSchema },
                { name: agent_message_schema_1.AgentMessage.name, schema: agent_message_schema_1.AgentMessageSchema },
                { name: agent_part_schema_1.AgentPart.name, schema: agent_part_schema_1.AgentPartSchema },
                { name: agent_event_outbox_schema_1.AgentEventOutbox.name, schema: agent_event_outbox_schema_1.AgentEventOutboxSchema },
                { name: agent_runtime_maintenance_audit_schema_1.AgentRuntimeMaintenanceAudit.name, schema: agent_runtime_maintenance_audit_schema_1.AgentRuntimeMaintenanceAuditSchema },
                { name: agent_session_schema_1.AgentSession.name, schema: agent_session_schema_1.AgentSessionSchema },
                { name: agent_run_score_schema_1.AgentRunScore.name, schema: agent_run_score_schema_1.AgentRunScoreSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
            ]),
        ],
        controllers: [runtime_controller_1.RuntimeController, agent_run_score_controller_1.AgentRunScoreController],
        providers: [
            runtime_persistence_service_1.RuntimePersistenceService,
            agent_run_score_service_1.AgentRunScoreService,
            hook_dispatcher_service_1.HookDispatcherService,
            runtime_orchestrator_service_1.RuntimeOrchestratorService,
            runtime_action_log_service_1.RuntimeActionLogIngestionService,
            runtime_ei_sync_service_1.RuntimeEiSyncService,
            runtime_memo_snapshot_queue_service_1.RuntimeMemoSnapshotQueueService,
            hook_registry_service_1.HookRegistryService,
            hook_pipeline_service_1.HookPipelineService,
            common_2.DebugTimingProvider,
            runtime_run_diagnosis_service_1.RuntimeRunDiagnosisService,
        ],
        exports: [
            runtime_persistence_service_1.RuntimePersistenceService,
            agent_run_score_service_1.AgentRunScoreService,
            hook_dispatcher_service_1.HookDispatcherService,
            runtime_orchestrator_service_1.RuntimeOrchestratorService,
            runtime_action_log_service_1.RuntimeActionLogIngestionService,
            runtime_ei_sync_service_1.RuntimeEiSyncService,
            runtime_memo_snapshot_queue_service_1.RuntimeMemoSnapshotQueueService,
            hook_registry_service_1.HookRegistryService,
            hook_pipeline_service_1.HookPipelineService,
            common_2.DebugTimingProvider,
            runtime_run_diagnosis_service_1.RuntimeRunDiagnosisService,
        ],
    })
], RuntimeModule);
//# sourceMappingURL=runtime.module.js.map