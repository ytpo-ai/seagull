"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const meeting_schema_1 = require("../../shared/schemas/meeting.schema");
const meeting_service_1 = require("./meeting.service");
const meeting_controller_1 = require("./meeting.controller");
const agent_client_module_1 = require("../agents-client/agent-client.module");
const employee_module_1 = require("../employees/employee.module");
const messages_module_1 = require("../messages/messages.module");
const meeting_event_service_1 = require("./services/meeting-event.service");
const meeting_agent_state_service_1 = require("./services/meeting-agent-state.service");
const meeting_lifecycle_service_1 = require("./services/meeting-lifecycle.service");
const meeting_participant_service_1 = require("./services/meeting-participant.service");
const meeting_message_service_1 = require("./services/meeting-message.service");
const meeting_orchestration_service_1 = require("./services/meeting-orchestration.service");
const meeting_summary_service_1 = require("./services/meeting-summary.service");
const meeting_message_center_event_service_1 = require("./services/meeting-message-center-event.service");
let MeetingModule = class MeetingModule {
};
exports.MeetingModule = MeetingModule;
exports.MeetingModule = MeetingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: meeting_schema_1.Meeting.name, schema: meeting_schema_1.MeetingSchema }]),
            agent_client_module_1.AgentClientModule,
            employee_module_1.EmployeeModule,
            messages_module_1.MessagesModule,
        ],
        controllers: [meeting_controller_1.MeetingController],
        providers: [
            meeting_service_1.MeetingService,
            meeting_event_service_1.MeetingEventService,
            meeting_agent_state_service_1.MeetingAgentStateService,
            meeting_lifecycle_service_1.MeetingLifecycleService,
            meeting_participant_service_1.MeetingParticipantService,
            meeting_message_service_1.MeetingMessageService,
            meeting_orchestration_service_1.MeetingOrchestrationService,
            meeting_summary_service_1.MeetingSummaryService,
            meeting_message_center_event_service_1.MeetingMessageCenterEventService,
        ],
        exports: [meeting_service_1.MeetingService],
    })
], MeetingModule);
//# sourceMappingURL=meeting.module.js.map