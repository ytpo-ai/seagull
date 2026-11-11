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
exports.EmployeeController = void 0;
const common_1 = require("@nestjs/common");
const employee_service_1 = require("./employee.service");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
let EmployeeController = class EmployeeController {
    constructor(employeeService) {
        this.employeeService = employeeService;
    }
    async createEmployee(dto) {
        const employee = await this.employeeService.createEmployee(dto);
        return {
            success: true,
            data: employee,
            message: '员工创建成功',
        };
    }
    async getEmployeesByOrganization(type, status, departmentId) {
        const employees = await this.employeeService.getEmployeesByOrganization({ type, status, departmentId });
        return {
            success: true,
            data: employees,
        };
    }
    async getEmployeeStats() {
        const stats = await this.employeeService.getEmployeeStats();
        return {
            success: true,
            data: stats,
        };
    }
    async getEmployee(id) {
        const employee = await this.employeeService.getEmployee(id);
        if (!employee) {
            return {
                success: false,
                message: '员工不存在',
            };
        }
        return {
            success: true,
            data: employee,
        };
    }
    async updateEmployee(id, dto) {
        const employee = await this.employeeService.updateEmployee(id, dto);
        if (!employee) {
            return {
                success: false,
                message: '员工不存在',
            };
        }
        return {
            success: true,
            data: employee,
            message: '员工信息更新成功',
        };
    }
    async deleteEmployee(id) {
        const success = await this.employeeService.deleteEmployee(id);
        return {
            success,
            message: success ? '员工删除成功' : '员工不存在',
        };
    }
    async confirmEmployee(id) {
        const employee = await this.employeeService.confirmEmployee(id);
        return {
            success: !!employee,
            data: employee,
            message: employee ? '员工已转正' : '员工不存在',
        };
    }
    async terminateEmployee(id, reason) {
        const employee = await this.employeeService.terminateEmployee(id, reason);
        return {
            success: !!employee,
            data: employee,
            message: employee ? '员工已离职' : '员工不存在',
        };
    }
    async setAIProxy(id, agentId) {
        const employee = await this.employeeService.setAIProxy(id, agentId);
        return {
            success: !!employee,
            data: employee,
            message: agentId ? 'AI代理已设置' : 'AI代理已取消',
        };
    }
    async setExclusiveAssistant(id, agentId) {
        const employee = await this.employeeService.setExclusiveAssistant(id, agentId);
        return {
            success: !!employee,
            data: employee,
            message: employee ? '专属助理绑定成功' : '员工不存在',
        };
    }
    async getExclusiveAssistant(id) {
        const binding = await this.employeeService.getExclusiveAssistant(id);
        return {
            success: !!binding,
            data: binding,
            message: binding ? '查询成功' : '员工不存在',
        };
    }
    async createAndBindExclusiveAssistant(id) {
        const employee = await this.employeeService.createAndBindExclusiveAssistant(id);
        return {
            success: !!employee,
            data: employee,
            message: employee ? '专属助理创建并绑定成功' : '员工不存在',
        };
    }
};
exports.EmployeeController = EmployeeController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "createEmployee", null);
__decorate([
    (0, common_1.Get)('organization'),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('departmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "getEmployeesByOrganization", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "getEmployeeStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "getEmployee", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "updateEmployee", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "deleteEmployee", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "confirmEmployee", null);
__decorate([
    (0, common_1.Post)(':id/terminate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "terminateEmployee", null);
__decorate([
    (0, common_1.Post)(':id/ai-proxy'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "setAIProxy", null);
__decorate([
    (0, common_1.Post)(':id/exclusive-assistant'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "setExclusiveAssistant", null);
__decorate([
    (0, common_1.Get)(':id/exclusive-assistant'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "getExclusiveAssistant", null);
__decorate([
    (0, common_1.Post)(':id/exclusive-assistant/auto-create'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeController.prototype, "createAndBindExclusiveAssistant", null);
exports.EmployeeController = EmployeeController = __decorate([
    (0, common_1.Controller)('employees'),
    __metadata("design:paramtypes", [employee_service_1.EmployeeService])
], EmployeeController);
//# sourceMappingURL=employee.controller.js.map