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
exports.ToolService = void 0;
const common_1 = require("@nestjs/common");
const tool_execution_service_1 = require("./tool-execution.service");
const tool_registry_service_1 = require("./tool-registry.service");
let ToolService = class ToolService {
    constructor(registry, execution) {
        this.registry = registry;
        this.execution = execution;
    }
    async seedBuiltinTools(mode = 'sync') {
        return this.registry.seedBuiltinTools(mode);
    }
    async getAllTools() {
        return this.registry.getAllTools();
    }
    async getAllToolsView() {
        return this.registry.getAllToolsView();
    }
    async getToolkits(query) {
        return this.registry.getToolkits(query);
    }
    async getToolkit(id) {
        return this.registry.getToolkit(id);
    }
    async getToolRegistry(query) {
        return this.registry.getToolRegistry(query);
    }
    async getTopKToolRoutes(query) {
        return this.registry.getTopKToolRoutes(query);
    }
    async getTool(toolId) {
        return this.registry.getTool(toolId);
    }
    async getToolView(toolId) {
        return this.registry.getToolView(toolId);
    }
    async getToolInputContract(toolId) {
        return this.registry.getToolInputContract(toolId);
    }
    async getToolsByIds(toolIds) {
        return this.registry.getToolsByIds(toolIds);
    }
    async createTool(data) {
        return this.registry.createTool(data);
    }
    async updateTool(toolId, updates) {
        return this.registry.updateTool(toolId, updates);
    }
    async deleteTool(toolId) {
        return this.registry.deleteTool(toolId);
    }
    async executeTool(toolId, agentId, params, taskId, executionContext) {
        return this.execution.executeTool(toolId, agentId, params, taskId, executionContext);
    }
    async getToolExecutions(agentId, toolId) {
        return this.registry.getToolExecutions(agentId, toolId);
    }
    async getToolExecutionStats() {
        return this.registry.getToolExecutionStats();
    }
};
exports.ToolService = ToolService;
exports.ToolService = ToolService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tool_registry_service_1.ToolRegistryService,
        tool_execution_service_1.ToolExecutionService])
], ToolService);
//# sourceMappingURL=tool.service.js.map