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
exports.AgentsAppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const agent_module_1 = require("./modules/agents/agent.module");
const model_module_1 = require("./modules/models/model.module");
const api_keys_module_1 = require("../../../src/modules/api-keys/api-keys.module");
const app_config_1 = __importDefault(require("../../../src/config/app.config"));
const database_config_1 = __importDefault(require("../../../src/config/database.config"));
const ai_config_1 = __importDefault(require("../../../src/config/ai.config"));
const jwt_config_1 = __importDefault(require("../../../src/config/jwt.config"));
const infra_1 = require("../../../libs/infra/src/index");
const internal_context_middleware_1 = require("./security/internal-context.middleware");
const stream_controller_1 = require("./controllers/stream.controller");
const health_controller_1 = require("./controllers/health.controller");
const skill_module_1 = require("./modules/skills/skill.module");
const memo_module_1 = require("./modules/memos/memo.module");
const agent_task_module_1 = require("./modules/agent-tasks/agent-task.module");
const prompt_registry_admin_module_1 = require("./modules/prompt-registry/prompt-registry-admin.module");
const agent_action_log_module_1 = require("./modules/action-logs/agent-action-log.module");
const inner_message_module_1 = require("./modules/inner-message/inner-message.module");
const message_center_module_1 = require("./modules/message-center/message-center.module");
const usage_module_1 = require("./modules/usage/usage.module");
let AgentsAppModule = class AgentsAppModule {
    configure(consumer) {
        consumer.apply(internal_context_middleware_1.InternalContextMiddleware).forRoutes('*');
    }
};
exports.AgentsAppModule = AgentsAppModule;
exports.AgentsAppModule = AgentsAppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.development', '.env'],
                load: [app_config_1.default, database_config_1.default, ai_config_1.default, jwt_config_1.default],
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
            infra_1.InfraModule,
            model_module_1.ModelModule,
            api_keys_module_1.ApiKeysModule,
            agent_task_module_1.AgentTaskModule,
            prompt_registry_admin_module_1.PromptRegistryAdminModule,
            agent_action_log_module_1.AgentActionLogModule,
            inner_message_module_1.InnerMessageModule,
            message_center_module_1.MessageCenterModule,
            usage_module_1.UsageModule,
            agent_module_1.AgentModule,
            skill_module_1.SkillModule,
            memo_module_1.MemoModule,
        ],
        controllers: [health_controller_1.HealthController, stream_controller_1.AgentStreamController],
    })
], AgentsAppModule);
//# sourceMappingURL=app.module.js.map