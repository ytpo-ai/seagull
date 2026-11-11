"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTaskModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const agent_task_schema_1 = require("../../schemas/agent-task.schema");
const agent_task_controller_1 = require("./agent-task.controller");
const agent_task_service_1 = require("./agent-task.service");
const runtime_sse_stream_service_1 = require("./runtime-sse-stream.service");
const agent_task_worker_1 = require("./agent-task.worker");
const runtime_module_1 = require("../runtime/runtime.module");
const agent_module_1 = require("../agents/agent.module");
const opencode_serve_router_service_1 = require("./opencode-serve-router.service");
const opencode_module_1 = require("../opencode/opencode.module");
let AgentTaskModule = class AgentTaskModule {
};
exports.AgentTaskModule = AgentTaskModule;
exports.AgentTaskModule = AgentTaskModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: agent_task_schema_1.AgentTask.name, schema: agent_task_schema_1.AgentTaskSchema }]),
            runtime_module_1.RuntimeModule,
            agent_module_1.AgentModule,
            opencode_module_1.OpenCodeModule,
        ],
        controllers: [agent_task_controller_1.AgentTaskController],
        providers: [agent_task_service_1.AgentTaskService, runtime_sse_stream_service_1.RuntimeSseStreamService, opencode_serve_router_service_1.OpenCodeServeRouterService, agent_task_worker_1.AgentTaskWorker],
        exports: [agent_task_service_1.AgentTaskService],
    })
], AgentTaskModule);
//# sourceMappingURL=agent-task.module.js.map