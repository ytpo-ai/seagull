"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const agent_schema_1 = require("../../schemas/agent.schema");
const tool_schema_1 = require("../../schemas/tool.schema");
const agent_memo_schema_1 = require("../../schemas/agent-memo.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const agent_run_schema_1 = require("../../schemas/agent-run.schema");
const agent_part_schema_1 = require("../../schemas/agent-part.schema");
const agent_run_score_schema_1 = require("../../schemas/agent-run-score.schema");
const memo_aggregation_service_1 = require("./memo-aggregation.service");
const memo_controller_1 = require("./memo.controller");
const memo_doc_sync_service_1 = require("./memo-doc-sync.service");
const memo_event_bus_service_1 = require("./memo-event-bus.service");
const memo_service_1 = require("./memo.service");
const identity_aggregation_service_1 = require("./identity-aggregation.service");
const evaluation_aggregation_service_1 = require("./evaluation-aggregation.service");
const deduction_aggregation_service_1 = require("./deduction-aggregation.service");
const memo_task_todo_service_1 = require("./memo-task-todo.service");
const memo_task_history_service_1 = require("./memo-task-history.service");
const memo_aggregation_command_consumer_service_1 = require("./memo-aggregation-command-consumer.service");
const memo_write_queue_service_1 = require("./memo-write-queue.service");
const memo_write_command_consumer_service_1 = require("./memo-write-command-consumer.service");
let MemoModule = class MemoModule {
};
exports.MemoModule = MemoModule;
exports.MemoModule = MemoModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: agent_memo_schema_1.AgentMemo.name, schema: agent_memo_schema_1.AgentMemoSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
                { name: tool_schema_1.Tool.name, schema: tool_schema_1.ToolSchema },
                { name: agent_skill_schema_1.Skill.name, schema: agent_skill_schema_1.SkillSchema },
                { name: agent_run_schema_1.AgentRun.name, schema: agent_run_schema_1.AgentRunSchema },
                { name: agent_part_schema_1.AgentPart.name, schema: agent_part_schema_1.AgentPartSchema },
                { name: agent_run_score_schema_1.AgentRunScore.name, schema: agent_run_score_schema_1.AgentRunScoreSchema },
            ]),
        ],
        controllers: [memo_controller_1.MemoController],
        providers: [
            memo_service_1.MemoService,
            memo_doc_sync_service_1.MemoDocSyncService,
            memo_aggregation_service_1.MemoAggregationService,
            memo_event_bus_service_1.MemoEventBusService,
            identity_aggregation_service_1.IdentityAggregationService,
            evaluation_aggregation_service_1.EvaluationAggregationService,
            deduction_aggregation_service_1.DeductionAggregationService,
            memo_task_todo_service_1.MemoTaskTodoService,
            memo_task_history_service_1.MemoTaskHistoryService,
            memo_aggregation_command_consumer_service_1.MemoAggregationCommandConsumerService,
            memo_write_queue_service_1.MemoWriteQueueService,
            memo_write_command_consumer_service_1.MemoWriteCommandConsumerService,
        ],
        exports: [memo_service_1.MemoService, memo_event_bus_service_1.MemoEventBusService, identity_aggregation_service_1.IdentityAggregationService, evaluation_aggregation_service_1.EvaluationAggregationService, deduction_aggregation_service_1.DeductionAggregationService, memo_write_queue_service_1.MemoWriteQueueService],
    })
], MemoModule);
//# sourceMappingURL=memo.module.js.map