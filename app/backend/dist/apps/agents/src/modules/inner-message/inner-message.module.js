"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InnerMessageModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const inner_message_schema_1 = require("../../schemas/inner-message.schema");
const inner_message_subscription_schema_1 = require("../../schemas/inner-message-subscription.schema");
const inner_message_service_1 = require("./inner-message.service");
const inner_message_controller_1 = require("./inner-message.controller");
const inner_message_dispatcher_service_1 = require("./inner-message-dispatcher.service");
const inner_message_collaboration_automation_service_1 = require("./inner-message-collaboration-automation.service");
const agent_schema_1 = require("../../schemas/agent.schema");
const inner_message_agent_runtime_bridge_service_1 = require("./inner-message-agent-runtime-bridge.service");
const agent_module_1 = require("../agents/agent.module");
let InnerMessageModule = class InnerMessageModule {
};
exports.InnerMessageModule = InnerMessageModule;
exports.InnerMessageModule = InnerMessageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            agent_module_1.AgentModule,
            mongoose_1.MongooseModule.forFeature([
                { name: inner_message_schema_1.InnerMessage.name, schema: inner_message_schema_1.InnerMessageSchema },
                { name: inner_message_subscription_schema_1.InnerMessageSubscription.name, schema: inner_message_subscription_schema_1.InnerMessageSubscriptionSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
            ]),
        ],
        controllers: [inner_message_controller_1.InnerMessageController, inner_message_controller_1.InnerMessageSubscriptionController],
        providers: [
            inner_message_service_1.InnerMessageService,
            inner_message_dispatcher_service_1.InnerMessageDispatcherService,
            inner_message_collaboration_automation_service_1.InnerMessageCollaborationAutomationService,
            inner_message_agent_runtime_bridge_service_1.InnerMessageAgentRuntimeBridgeService,
        ],
        exports: [inner_message_service_1.InnerMessageService],
    })
], InnerMessageModule);
//# sourceMappingURL=inner-message.module.js.map