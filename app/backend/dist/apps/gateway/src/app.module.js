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
exports.GatewayAppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const gateway_controller_1 = require("./gateway.controller");
const gateway_proxy_service_1 = require("./gateway-proxy.service");
const gateway_auth_guard_1 = require("./gateway-auth.guard");
const database_config_1 = __importDefault(require("../../../src/config/database.config"));
const operation_log_schema_1 = require("../../../src/shared/schemas/operation-log.schema");
const employee_schema_1 = require("../../../src/shared/schemas/employee.schema");
const project_api_key_schema_1 = require("../../../src/shared/schemas/project-api-key.schema");
let GatewayAppModule = class GatewayAppModule {
};
exports.GatewayAppModule = GatewayAppModule;
exports.GatewayAppModule = GatewayAppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.development', '.env'],
                load: [database_config_1.default],
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
            mongoose_1.MongooseModule.forFeature([
                { name: operation_log_schema_1.OperationLog.name, schema: operation_log_schema_1.OperationLogSchema },
                { name: employee_schema_1.Employee.name, schema: employee_schema_1.EmployeeSchema },
                { name: project_api_key_schema_1.ProjectApiKey.name, schema: project_api_key_schema_1.ProjectApiKeySchema },
            ]),
        ],
        controllers: [gateway_controller_1.GatewayController],
        providers: [gateway_proxy_service_1.GatewayProxyService, gateway_auth_guard_1.GatewayAuthGuard],
    })
], GatewayAppModule);
//# sourceMappingURL=app.module.js.map