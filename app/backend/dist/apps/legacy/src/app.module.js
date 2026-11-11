"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const hr_module_1 = require("./modules/hr/hr.module");
const api_keys_module_1 = require("./modules/api-keys/api-keys.module");
const meeting_module_1 = require("./modules/meetings/meeting.module");
const employee_module_1 = require("./modules/employees/employee.module");
const invitation_module_1 = require("./modules/invitations/invitation.module");
const auth_module_1 = require("./modules/auth/auth.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
const agent_client_module_1 = require("./modules/agents-client/agent-client.module");
const operation_log_module_1 = require("./modules/operation-logs/operation-log.module");
const messages_module_1 = require("./modules/messages/messages.module");
const message_center_module_1 = require("./modules/message-center/message-center.module");
const projects_module_1 = require("./modules/projects/projects.module");
const infra_1 = require("../libs/infra/src/index");
const app_config_1 = __importDefault(require("./config/app.config"));
const database_config_1 = __importDefault(require("./config/database.config"));
const ai_config_1 = __importDefault(require("./config/ai.config"));
const jwt_config_1 = __importDefault(require("./config/jwt.config"));
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.development', '.env'],
                load: [app_config_1.default, database_config_1.default, ai_config_1.default, jwt_config_1.default],
            }),
            infra_1.InfraModule,
            event_emitter_1.EventEmitterModule.forRoot({
                wildcard: true,
                delimiter: '.',
                maxListeners: 20,
            }),
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => {
                    const dbConfig = configService.get('database');
                    return {
                        uri: dbConfig.uri,
                        ...dbConfig.options,
                    };
                },
                inject: [config_1.ConfigService],
            }),
            operation_log_module_1.OperationLogModule,
            messages_module_1.MessagesModule,
            message_center_module_1.MessageCenterModule,
            agent_client_module_1.AgentClientModule,
            hr_module_1.HRModule,
            api_keys_module_1.ApiKeysModule,
            meeting_module_1.MeetingModule,
            employee_module_1.EmployeeModule,
            invitation_module_1.InvitationModule,
            auth_module_1.AuthModule,
            scheduler_module_1.SchedulerModule,
            projects_module_1.ProjectsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map