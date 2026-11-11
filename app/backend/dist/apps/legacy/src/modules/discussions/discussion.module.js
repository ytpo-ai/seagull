"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const discussion_space_schema_1 = require("../../shared/schemas/discussion-space.schema");
const discussion_thread_schema_1 = require("../../shared/schemas/discussion-thread.schema");
const discussion_message_schema_1 = require("../../shared/schemas/discussion-message.schema");
const discussion_participant_schema_1 = require("../../shared/schemas/discussion-participant.schema");
const discussion_knowledge_entry_schema_1 = require("../../shared/schemas/discussion-knowledge-entry.schema");
const discussion_controller_1 = require("./discussion.controller");
const discussion_space_service_1 = require("./services/discussion-space.service");
const discussion_thread_service_1 = require("./services/discussion-thread.service");
const discussion_message_service_1 = require("./services/discussion-message.service");
const discussion_participant_service_1 = require("./services/discussion-participant.service");
const message_center_module_1 = require("../message-center/message-center.module");
const discussion_mention_dispatch_service_1 = require("./services/discussion-mention-dispatch.service");
const discussion_knowledge_service_1 = require("./services/discussion-knowledge.service");
const discussion_sediment_service_1 = require("./services/discussion-sediment.service");
const agent_client_module_1 = require("../agents-client/agent-client.module");
const discussion_message_stream_service_1 = require("./services/discussion-message-stream.service");
const discussion_outline_service_1 = require("./services/discussion-outline.service");
const discussion_requirement_bridge_service_1 = require("./services/discussion-requirement-bridge.service");
let DiscussionModule = class DiscussionModule {
};
exports.DiscussionModule = DiscussionModule;
exports.DiscussionModule = DiscussionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            message_center_module_1.MessageCenterModule,
            agent_client_module_1.AgentClientModule,
            mongoose_1.MongooseModule.forFeature([
                { name: discussion_space_schema_1.DiscussionSpace.name, schema: discussion_space_schema_1.DiscussionSpaceSchema },
                { name: discussion_thread_schema_1.DiscussionThread.name, schema: discussion_thread_schema_1.DiscussionThreadSchema },
                { name: discussion_message_schema_1.DiscussionMessage.name, schema: discussion_message_schema_1.DiscussionMessageSchema },
                { name: discussion_participant_schema_1.DiscussionParticipant.name, schema: discussion_participant_schema_1.DiscussionParticipantSchema },
                { name: discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntry.name, schema: discussion_knowledge_entry_schema_1.DiscussionKnowledgeEntrySchema },
            ]),
        ],
        controllers: [discussion_controller_1.DiscussionController],
        providers: [
            discussion_space_service_1.DiscussionSpaceService,
            discussion_thread_service_1.DiscussionThreadService,
            discussion_message_service_1.DiscussionMessageService,
            discussion_participant_service_1.DiscussionParticipantService,
            discussion_mention_dispatch_service_1.DiscussionMentionDispatchService,
            discussion_knowledge_service_1.DiscussionKnowledgeService,
            discussion_sediment_service_1.DiscussionSedimentService,
            discussion_message_stream_service_1.DiscussionMessageStreamService,
            discussion_outline_service_1.DiscussionOutlineService,
            discussion_requirement_bridge_service_1.DiscussionRequirementBridgeService,
        ],
        exports: [
            discussion_space_service_1.DiscussionSpaceService,
            discussion_thread_service_1.DiscussionThreadService,
            discussion_message_service_1.DiscussionMessageService,
            discussion_participant_service_1.DiscussionParticipantService,
            discussion_mention_dispatch_service_1.DiscussionMentionDispatchService,
            discussion_knowledge_service_1.DiscussionKnowledgeService,
            discussion_sediment_service_1.DiscussionSedimentService,
            discussion_message_stream_service_1.DiscussionMessageStreamService,
            discussion_outline_service_1.DiscussionOutlineService,
            discussion_requirement_bridge_service_1.DiscussionRequirementBridgeService,
        ],
    })
], DiscussionModule);
//# sourceMappingURL=discussion.module.js.map