"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptRegistryAdminModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const prompt_registry_controller_1 = require("./prompt-registry.controller");
const prompt_registry_admin_service_1 = require("./prompt-registry-admin.service");
const prompt_registry_module_1 = require("./prompt-registry.module");
const prompt_template_schema_1 = require("../../schemas/prompt-template.schema");
const prompt_template_audit_schema_1 = require("../../schemas/prompt-template-audit.schema");
let PromptRegistryAdminModule = class PromptRegistryAdminModule {
};
exports.PromptRegistryAdminModule = PromptRegistryAdminModule;
exports.PromptRegistryAdminModule = PromptRegistryAdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prompt_registry_module_1.PromptRegistryModule,
            mongoose_1.MongooseModule.forFeature([
                { name: prompt_template_schema_1.PromptTemplate.name, schema: prompt_template_schema_1.PromptTemplateSchema },
                { name: prompt_template_audit_schema_1.PromptTemplateAudit.name, schema: prompt_template_audit_schema_1.PromptTemplateAuditSchema },
            ]),
        ],
        controllers: [prompt_registry_controller_1.PromptRegistryController],
        providers: [prompt_registry_admin_service_1.PromptRegistryAdminService],
        exports: [prompt_registry_admin_service_1.PromptRegistryAdminService],
    })
], PromptRegistryAdminModule);
//# sourceMappingURL=prompt-registry-admin.module.js.map