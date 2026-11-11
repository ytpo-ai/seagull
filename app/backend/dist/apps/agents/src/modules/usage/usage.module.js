"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const usage_controller_1 = require("./usage.controller");
const usage_aggregation_service_1 = require("./usage-aggregation.service");
const agent_message_schema_1 = require("../../schemas/agent-message.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const model_registry_schema_1 = require("../../schemas/model-registry.schema");
const usage_daily_snapshot_schema_1 = require("../../schemas/usage-daily-snapshot.schema");
const model_module_1 = require("../models/model.module");
let UsageModule = class UsageModule {
};
exports.UsageModule = UsageModule;
exports.UsageModule = UsageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            model_module_1.ModelModule,
            mongoose_1.MongooseModule.forFeature([
                { name: agent_message_schema_1.AgentMessage.name, schema: agent_message_schema_1.AgentMessageSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
                { name: model_registry_schema_1.ModelRegistry.name, schema: model_registry_schema_1.ModelRegistrySchema },
                { name: usage_daily_snapshot_schema_1.UsageDailySnapshot.name, schema: usage_daily_snapshot_schema_1.UsageDailySnapshotSchema },
            ]),
        ],
        controllers: [usage_controller_1.UsageController],
        providers: [usage_aggregation_service_1.UsageAggregationService],
        exports: [usage_aggregation_service_1.UsageAggregationService],
    })
], UsageModule);
//# sourceMappingURL=usage.module.js.map