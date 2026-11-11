"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const skill_controller_1 = require("./skill.controller");
const skill_service_1 = require("./skill.service");
const skill_doc_loader_service_1 = require("./skill-doc-loader.service");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const memo_module_1 = require("../memos/memo.module");
let SkillModule = class SkillModule {
};
exports.SkillModule = SkillModule;
exports.SkillModule = SkillModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: agent_skill_schema_1.Skill.name, schema: agent_skill_schema_1.SkillSchema },
                { name: agent_schema_1.Agent.name, schema: agent_schema_1.AgentSchema },
            ]),
            memo_module_1.MemoModule,
        ],
        controllers: [skill_controller_1.SkillController],
        providers: [skill_service_1.SkillService, skill_doc_loader_service_1.SkillDocLoaderService],
        exports: [skill_service_1.SkillService],
    })
], SkillModule);
//# sourceMappingURL=skill.module.js.map