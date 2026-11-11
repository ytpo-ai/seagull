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
exports.SchedulerController = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("../../../libs/auth/src/index");
const auth_service_1 = require("../auth/auth.service");
const scheduler_service_1 = require("./scheduler.service");
const dto_1 = require("./dto");
let SchedulerController = class SchedulerController {
    constructor(schedulerService, authService) {
        this.schedulerService = schedulerService;
        this.authService = authService;
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
    }
    resolveUserFromInternalContext(encoded, signature) {
        if (!encoded || !signature) {
            return null;
        }
        if (!(0, auth_1.verifyEncodedContext)(encoded, signature, this.contextSecret)) {
            return null;
        }
        const context = (0, auth_1.decodeUserContext)(encoded);
        if (!context?.employeeId) {
            return null;
        }
        if (context.expiresAt <= Date.now()) {
            return null;
        }
        return { id: context.employeeId };
    }
    async getUserFromAuthHeader(authHeader, encodedContext, signature) {
        const internal = this.resolveUserFromInternalContext(encodedContext, signature);
        if (internal) {
            return internal;
        }
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        return { id: employee.id };
    }
    async create(dto, authHeader, internalContext, internalSignature) {
        const user = await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.schedulerService.createSchedule(user.id, dto);
    }
    async list(authHeader, internalContext, internalSignature, projectId) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        const filters = projectId !== undefined ? { projectId } : undefined;
        return this.schedulerService.listSchedules(filters);
    }
    async detail(scheduleId, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.schedulerService.getScheduleById(scheduleId);
    }
    async update(scheduleId, dto, authHeader, internalContext, internalSignature) {
        await this.getUserFromAuthHeader(authHeader, internalContext, internalSignature);
        return this.schedulerService.updateSchedule(scheduleId, dto);
    }
    async remove(scheduleId, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.schedulerService.deleteSchedule(scheduleId);
    }
    async enable(scheduleId, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.schedulerService.enableSchedule(scheduleId);
    }
    async disable(scheduleId, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.schedulerService.disableSchedule(scheduleId);
    }
    async trigger(scheduleId, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.schedulerService.triggerSchedule(scheduleId);
    }
    async history(scheduleId, query, authHeader) {
        await this.getUserFromAuthHeader(authHeader);
        return this.schedulerService.getScheduleHistory(scheduleId, query.limit || 20);
    }
};
exports.SchedulerController = SchedulerController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateScheduleDto, String, String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-user-context')),
    __param(2, (0, common_1.Headers)('x-user-signature')),
    __param(3, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-user-context')),
    __param(3, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "detail", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-user-context')),
    __param(4, (0, common_1.Headers)('x-user-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateScheduleDto, String, String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/enable'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "enable", null);
__decorate([
    (0, common_1.Post)(':id/disable'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "disable", null);
__decorate([
    (0, common_1.Post)(':id/trigger'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "trigger", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ScheduleHistoryQueryDto, String]),
    __metadata("design:returntype", Promise)
], SchedulerController.prototype, "history", null);
exports.SchedulerController = SchedulerController = __decorate([
    (0, common_1.Controller)(['schedules', 'orchestration/schedules']),
    __metadata("design:paramtypes", [scheduler_service_1.SchedulerService,
        auth_service_1.AuthService])
], SchedulerController);
//# sourceMappingURL=scheduler.controller.js.map