"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestrationModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_module_1 = require("../auth/auth.module");
const agent_client_module_1 = require("../agents-client/agent-client.module");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
const agent_schema_1 = require("../../../apps/agents/src/schemas/agent.schema");
const agent_role_schema_1 = require("../../../apps/agents/src/schemas/agent-role.schema");
const ei_project_schema_1 = require("../../shared/schemas/ei-project.schema");
const orchestration_plan_schema_1 = require("../../shared/schemas/orchestration-plan.schema");
const orchestration_task_schema_1 = require("../../shared/schemas/orchestration-task.schema");
const tool_schema_1 = require("../../../apps/agents/src/schemas/tool.schema");
const agent_skill_schema_1 = require("../../../apps/agents/src/schemas/agent-skill.schema");
const orchestration_run_schema_1 = require("../../shared/schemas/orchestration-run.schema");
const orchestration_run_task_schema_1 = require("../../shared/schemas/orchestration-run-task.schema");
const orchestration_controller_1 = require("./orchestration.controller");
const orchestration_service_1 = require("./orchestration.service");
const planner_service_1 = require("./planner.service");
const messages_module_1 = require("../messages/messages.module");
const orchestration_plan_session_schema_1 = require("../../shared/schemas/orchestration-plan-session.schema");
const session_manager_service_1 = require("./session-manager.service");
const task_output_validation_service_1 = require("./services/task-output-validation.service");
const executor_selection_service_1 = require("./services/executor-selection.service");
const scene_optimization_service_1 = require("./services/scene-optimization.service");
const plan_management_service_1 = require("./services/plan-management.service");
const task_management_service_1 = require("./services/task-management.service");
const plan_execution_service_1 = require("./services/plan-execution.service");
const incremental_planning_service_1 = require("./services/incremental-planning.service");
const task_lifecycle_service_1 = require("./services/task-lifecycle.service");
const plan_stats_service_1 = require("./services/plan-stats.service");
const plan_event_stream_service_1 = require("./services/plan-event-stream.service");
const orchestration_context_service_1 = require("./services/orchestration-context.service");
const orchestration_execution_engine_service_1 = require("./services/orchestration-execution-engine.service");
const orchestration_step_dispatcher_service_1 = require("./services/orchestration-step-dispatcher.service");
const orchestration_event_listener_service_1 = require("./services/orchestration-event-listener.service");
const orchestration_message_center_event_service_1 = require("./services/orchestration-message-center-event.service");
let OrchestrationModule = class OrchestrationModule {
};
exports.OrchestrationModule = OrchestrationModule;
exports.OrchestrationModule = OrchestrationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            agent_client_module_1.AgentClientModule,
            messages_module_1.MessagesModule,
            mongoose_1.MongooseModule.forFeature([
                { name: orchestration_plan_schema_1.OrchestrationPlan.name, schema: orchestration_plan_schema_1.OrchestrationPlanSchema },
                { name: orchestration_task_schema_1.OrchestrationTask.name, schema: orchestration_task_schema_1.OrchestrationTaskSchema },
                { name: orchestration_plan_session_schema_1.PlanSession.name, schema: orchestration_plan_session_schema_1.PlanSessionSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
                { name: tool_schema_1.Tool.name, schema: tool_schema_1.ToolSchema },
                { name: employee_schema_1.Employee.name, schema: employee_schema_1.EmployeeSchema },
                { name: agent_role_schema_1.AgentRole.name, schema: agent_role_schema_1.AgentRoleSchema },
                { name: agent_skill_schema_1.Skill.name, schema: agent_skill_schema_1.SkillSchema },
                { name: orchestration_run_schema_1.OrchestrationRun.name, schema: orchestration_run_schema_1.OrchestrationRunSchema },
                { name: orchestration_run_task_schema_1.OrchestrationRunTask.name, schema: orchestration_run_task_schema_1.OrchestrationRunTaskSchema },
                { name: ei_project_schema_1.RdProject.name, schema: ei_project_schema_1.RdProjectSchema },
            ]),
        ],
        controllers: [orchestration_controller_1.OrchestrationController],
        providers: [
            orchestration_service_1.OrchestrationService,
            planner_service_1.PlannerService,
            session_manager_service_1.SessionManagerService,
            plan_management_service_1.PlanManagementService,
            task_management_service_1.TaskManagementService,
            plan_execution_service_1.PlanExecutionService,
            incremental_planning_service_1.IncrementalPlanningService,
            orchestration_step_dispatcher_service_1.OrchestrationStepDispatcherService,
            orchestration_event_listener_service_1.OrchestrationEventListenerService,
            task_lifecycle_service_1.TaskLifecycleService,
            plan_stats_service_1.PlanStatsService,
            plan_event_stream_service_1.PlanEventStreamService,
            orchestration_context_service_1.OrchestrationContextService,
            orchestration_execution_engine_service_1.OrchestrationExecutionEngineService,
            orchestration_message_center_event_service_1.OrchestrationMessageCenterEventService,
            task_output_validation_service_1.TaskOutputValidationService,
            executor_selection_service_1.ExecutorSelectionService,
            scene_optimization_service_1.SceneOptimizationService,
        ],
        exports: [orchestration_service_1.OrchestrationService],
    })
], OrchestrationModule);
//# sourceMappingURL=orchestration.module.js.map