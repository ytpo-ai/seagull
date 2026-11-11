"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelManagementController = void 0;
const common_1 = require("@nestjs/common");
const model_management_service_1 = require("./model-management.service");
let ModelManagementController = class ModelManagementController {
    constructor(modelManagementService) {
        this.modelManagementService = modelManagementService;
    }
    getAvailableModels() {
        return this.modelManagementService.getAvailableModels();
    }
    getModelCategories() {
        return this.modelManagementService.getModelCategories();
    }
    getRecommendedModels() {
        return this.modelManagementService.getRecommendedModels();
    }
    getModelsByProvider(provider) {
        return this.modelManagementService.getModelsByProvider(provider);
    }
    createModel(modelData) {
        return this.modelManagementService.createModel(modelData);
    }
    updateModel(id, updates) {
        return this.modelManagementService.updateModel(id, updates);
    }
    deleteModel(id) {
        return this.modelManagementService.deleteModel(id);
    }
    deleteModelByProviderAndModel(provider, model) {
        return this.modelManagementService.deleteModelByProviderAndModel(provider, decodeURIComponent(model));
    }
    getModelSettings() {
        return this.modelManagementService.getModelSettings();
    }
    updateModelSettings(settings) {
        return this.modelManagementService.updateModelSettings(settings);
    }
    selectModelForFounder(founderType, body) {
        return this.modelManagementService.selectModelForFounder(founderType, body.modelId);
    }
    getFounderModels() {
        return this.modelManagementService.getFounderModels();
    }
};
exports.ModelManagementController = ModelManagementController;
__decorate([
    (0, common_1.Get)('available'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "getAvailableModels", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "getModelCategories", null);
__decorate([
    (0, common_1.Get)('recommended'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "getRecommendedModels", null);
__decorate([
    (0, common_1.Get)('by-provider/:provider'),
    __param(0, (0, common_1.Param)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "getModelsByProvider", null);
__decorate([
    (0, common_1.Post)('models'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "createModel", null);
__decorate([
    (0, common_1.Put)('models/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "updateModel", null);
__decorate([
    (0, common_1.Delete)('models/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "deleteModel", null);
__decorate([
    (0, common_1.Delete)('models/:provider/:model'),
    __param(0, (0, common_1.Param)('provider')),
    __param(1, (0, common_1.Param)('model')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "deleteModelByProviderAndModel", null);
__decorate([
    (0, common_1.Get)('settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], ModelManagementController.prototype, "getModelSettings", null);
__decorate([
    (0, common_1.Put)('settings'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], ModelManagementController.prototype, "updateModelSettings", null);
__decorate([
    (0, common_1.Post)('select-for-founder/:founderType'),
    __param(0, (0, common_1.Param)('founderType')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ModelManagementController.prototype, "selectModelForFounder", null);
__decorate([
    (0, common_1.Get)('founder-models'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], ModelManagementController.prototype, "getFounderModels", null);
exports.ModelManagementController = ModelManagementController = __decorate([
    (0, common_1.Controller)('model-management'),
    __metadata("design:paramtypes", [model_management_service_1.ModelManagementService])
], ModelManagementController);
//# sourceMappingURL=model-management.controller.js.map