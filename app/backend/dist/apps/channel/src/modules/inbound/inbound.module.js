"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboundModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const employee_schema_1 = require("../../../../../src/shared/schemas/employee.schema");
const feishu_module_1 = require("../../providers/feishu/feishu.module");
const channel_auth_bridge_service_1 = require("./channel-auth-bridge.service");
const channel_api_client_service_1 = require("./channel-api-client.service");
const channel_inbound_service_1 = require("./channel-inbound.service");
const channel_inbound_worker_service_1 = require("./channel-inbound-worker.service");
const channel_meeting_auto_service_1 = require("./channel-meeting-auto.service");
const channel_meeting_relay_service_1 = require("./channel-meeting-relay.service");
const channel_outbound_worker_service_1 = require("./channel-outbound-worker.service");
const command_parser_service_1 = require("./command-parser.service");
const channel_session_service_1 = require("./channel-session.service");
const channel_user_mapping_controller_1 = require("./channel-user-mapping.controller");
const channel_user_mapping_service_1 = require("./channel-user-mapping.service");
const feishu_event_listener_service_1 = require("./feishu-event-listener.service");
const channel_session_schema_1 = require("./schemas/channel-session.schema");
const channel_user_mapping_schema_1 = require("./schemas/channel-user-mapping.schema");
let InboundModule = class InboundModule {
};
exports.InboundModule = InboundModule;
exports.InboundModule = InboundModule = __decorate([
    (0, common_1.Module)({
        imports: [
            feishu_module_1.FeishuModule,
            mongoose_1.MongooseModule.forFeature([
                { name: employee_schema_1.Employee.name, schema: employee_schema_1.EmployeeSchema },
                { name: channel_user_mapping_schema_1.ChannelUserMapping.name, schema: channel_user_mapping_schema_1.ChannelUserMappingSchema },
                { name: channel_session_schema_1.ChannelSession.name, schema: channel_session_schema_1.ChannelSessionSchema },
            ]),
        ],
        controllers: [channel_user_mapping_controller_1.ChannelUserMappingController],
        providers: [
            channel_auth_bridge_service_1.ChannelAuthBridgeService,
            channel_api_client_service_1.ChannelApiClientService,
            channel_inbound_service_1.ChannelInboundService,
            channel_inbound_worker_service_1.ChannelInboundWorkerService,
            channel_meeting_auto_service_1.ChannelMeetingAutoService,
            channel_meeting_relay_service_1.ChannelMeetingRelayService,
            channel_outbound_worker_service_1.ChannelOutboundWorkerService,
            command_parser_service_1.CommandParserService,
            channel_session_service_1.ChannelSessionService,
            channel_user_mapping_service_1.ChannelUserMappingService,
            feishu_event_listener_service_1.FeishuEventListenerService,
        ],
        exports: [channel_auth_bridge_service_1.ChannelAuthBridgeService, channel_api_client_service_1.ChannelApiClientService, channel_inbound_service_1.ChannelInboundService, channel_session_service_1.ChannelSessionService, channel_user_mapping_service_1.ChannelUserMappingService],
    })
], InboundModule);
//# sourceMappingURL=inbound.module.js.map