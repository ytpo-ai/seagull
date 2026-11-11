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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeAgentExecutorEngine = void 0;
const common_1 = require("@nestjs/common");
const model_service_1 = require("../../models/model.service");
let NativeAgentExecutorEngine = class NativeAgentExecutorEngine {
    constructor(modelService) {
        this.modelService = modelService;
        this.mode = 'detailed';
        this.channel = 'native';
    }
    async execute(input) {
        const customApiKey = await input.resolveCustomApiKey('task');
        this.modelService.ensureProviderWithKey(input.modelConfig, customApiKey);
        const response = await input.executeWithToolCalling(input.agent, input.task, input.messages, input.modelConfig, input.runtimeContext, {
            collaborationContext: input.context?.collaborationContext,
            actor: input.context?.actor,
            taskType: input.task.type,
            teamId: input.task.teamId,
            preactivatedToolIds: Array.isArray(input.context?.sessionContext?.preactivatedToolIds)
                ? (input.context?.sessionContext).preactivatedToolIds
                : undefined,
        });
        return { response };
    }
};
exports.NativeAgentExecutorEngine = NativeAgentExecutorEngine;
exports.NativeAgentExecutorEngine = NativeAgentExecutorEngine = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_service_1.ModelService])
], NativeAgentExecutorEngine);
//# sourceMappingURL=native-agent-executor.engine.js.map