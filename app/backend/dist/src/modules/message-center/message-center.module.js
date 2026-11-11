"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageCenterModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_module_1 = require("../auth/auth.module");
const system_message_schema_1 = require("../../shared/schemas/system-message.schema");
const message_center_controller_1 = require("./message-center.controller");
const message_center_service_1 = require("./message-center.service");
const message_center_event_consumer_service_1 = require("./message-center-event-consumer.service");
let MessageCenterModule = class MessageCenterModule {
};
exports.MessageCenterModule = MessageCenterModule;
exports.MessageCenterModule = MessageCenterModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            mongoose_1.MongooseModule.forFeature([
                { name: system_message_schema_1.SystemMessage.name, schema: system_message_schema_1.SystemMessageSchema },
            ]),
        ],
        controllers: [message_center_controller_1.MessageCenterController],
        providers: [message_center_service_1.MessageCenterService, message_center_event_consumer_service_1.MessageCenterEventConsumerService],
        exports: [message_center_service_1.MessageCenterService],
    })
], MessageCenterModule);
//# sourceMappingURL=message-center.module.js.map