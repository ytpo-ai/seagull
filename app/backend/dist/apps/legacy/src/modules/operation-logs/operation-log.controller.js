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
exports.OperationLogController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const operation_log_service_1 = require("./operation-log.service");
let OperationLogController = class OperationLogController {
    constructor(authService, operationLogService) {
        this.authService = authService;
        this.operationLogService = operationLogService;
    }
    async getOperationLogs(authHeader, query) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        await this.operationLogService.assertHumanViewer(employee.id);
        const data = await this.operationLogService.queryAllHumanOperationLogs(query);
        return {
            success: true,
            data,
        };
    }
};
exports.OperationLogController = OperationLogController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OperationLogController.prototype, "getOperationLogs", null);
exports.OperationLogController = OperationLogController = __decorate([
    (0, common_1.Controller)('operation-logs'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        operation_log_service_1.OperationLogService])
], OperationLogController);
//# sourceMappingURL=operation-log.controller.js.map