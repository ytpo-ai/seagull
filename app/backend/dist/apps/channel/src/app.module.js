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
exports.ChannelAppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const infra_1 = require("../../../libs/infra/src/index");
const database_config_1 = __importDefault(require("../../../src/config/database.config"));
const health_controller_1 = require("./health.controller");
const channel_module_1 = require("./modules/channel/channel.module");
const inbound_module_1 = require("./modules/inbound/inbound.module");
let ChannelAppModule = class ChannelAppModule {
};
exports.ChannelAppModule = ChannelAppModule;
exports.ChannelAppModule = ChannelAppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.development', '.env'],
                load: [database_config_1.default],
            }),
            infra_1.InfraModule,
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
            channel_module_1.ChannelModule,
            inbound_module_1.InboundModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], ChannelAppModule);
//# sourceMappingURL=app.module.js.map