"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const model_service_1 = require("./model.service");
const model_controller_1 = require("./model.controller");
const model_management_controller_1 = require("./model-management.controller");
const model_management_service_1 = require("./model-management.service");
const model_registry_schema_1 = require("../../schemas/model-registry.schema");
const model_pricing_service_1 = require("./model-pricing.service");
let ModelModule = class ModelModule {
};
exports.ModelModule = ModelModule;
exports.ModelModule = ModelModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: model_registry_schema_1.ModelRegistry.name, schema: model_registry_schema_1.ModelRegistrySchema }]),
        ],
        controllers: [model_controller_1.ModelController, model_management_controller_1.ModelManagementController],
        providers: [model_service_1.ModelService, model_management_service_1.ModelManagementService, model_pricing_service_1.ModelPricingService],
        exports: [model_service_1.ModelService, model_management_service_1.ModelManagementService, model_pricing_service_1.ModelPricingService],
    })
], ModelModule);
//# sourceMappingURL=model.module.js.map