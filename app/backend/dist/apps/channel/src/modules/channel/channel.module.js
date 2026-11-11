"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const feishu_module_1 = require("../../providers/feishu/feishu.module");
const channel_config_controller_1 = require("./channel-config.controller");
const channel_aggregator_service_1 = require("./channel-aggregator.service");
const channel_config_service_1 = require("./channel-config.service");
const channel_provider_registry_1 = require("./channel-provider.registry");
const channel_dispatcher_service_1 = require("./channel-dispatcher.service");
const channel_config_schema_1 = require("./schemas/channel-config.schema");
const channel_delivery_log_schema_1 = require("./schemas/channel-delivery-log.schema");
let ChannelModule = class ChannelModule {
};
exports.ChannelModule = ChannelModule;
exports.ChannelModule = ChannelModule = __decorate([
    (0, common_1.Module)({
        imports: [
            feishu_module_1.FeishuModule,
            mongoose_1.MongooseModule.forFeature([
                { name: channel_config_schema_1.ChannelConfig.name, schema: channel_config_schema_1.ChannelConfigSchema },
                { name: channel_delivery_log_schema_1.ChannelDeliveryLog.name, schema: channel_delivery_log_schema_1.ChannelDeliveryLogSchema },
            ]),
        ],
        controllers: [channel_config_controller_1.ChannelConfigController],
        providers: [channel_config_service_1.ChannelConfigService, channel_provider_registry_1.ChannelProviderRegistry, channel_dispatcher_service_1.ChannelDispatcherService, channel_aggregator_service_1.ChannelAggregatorService],
        exports: [channel_config_service_1.ChannelConfigService],
    })
], ChannelModule);
//# sourceMappingURL=channel.module.js.map