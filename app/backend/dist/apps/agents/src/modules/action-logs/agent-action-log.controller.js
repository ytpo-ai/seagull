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
exports.AgentActionLogController = void 0;
const common_1 = require("@nestjs/common");
const agent_action_log_service_1 = require("./agent-action-log.service");
let AgentActionLogController = class AgentActionLogController {
    constructor(agentActionLogService) {
        this.agentActionLogService = agentActionLogService;
    }
    getUserContext(req) {
        const context = req.userContext;
        if (!context) {
            throw new common_1.ForbiddenException('Missing user context');
        }
        return context;
    }
    async getAgentActionLogs(req, query) {
        this.getUserContext(req);
        const data = await this.agentActionLogService.queryAgentActionLogs(query);
        return {
            success: true,
            data,
        };
    }
    async createRuntimeHookLog(req, event) {
        const caller = this.getUserContext(req);
        const role = String(caller.role || '').toLowerCase();
        if (role !== 'system') {
            throw new common_1.ForbiddenException('Internal runtime hook write requires system role');
        }
        await this.agentActionLogService.recordRuntimeHookEvent(event);
        return {
            success: true,
        };
    }
};
exports.AgentActionLogController = AgentActionLogController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AgentActionLogController.prototype, "getAgentActionLogs", null);
__decorate([
    (0, common_1.Post)('internal/runtime-hooks'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AgentActionLogController.prototype, "createRuntimeHookLog", null);
exports.AgentActionLogController = AgentActionLogController = __decorate([
    (0, common_1.Controller)('agent-action-logs'),
    __metadata("design:paramtypes", [agent_action_log_service_1.AgentActionLogService])
], AgentActionLogController);
//# sourceMappingURL=agent-action-log.controller.js.map