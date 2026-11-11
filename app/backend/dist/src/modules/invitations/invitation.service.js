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
var InvitationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const invitation_schema_1 = require("../../shared/schemas/invitation.schema");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
const uuid_1 = require("uuid");
const password_util_1 = require("../../shared/utils/password.util");
let InvitationService = InvitationService_1 = class InvitationService {
    constructor(invitationModel, employeeModel) {
        this.invitationModel = invitationModel;
        this.employeeModel = employeeModel;
        this.logger = new common_1.Logger(InvitationService_1.name);
    }
    async createInvitation(dto) {
        const code = this.generateShortCode();
        const linkToken = (0, uuid_1.v4)();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays || 7));
        const invitation = new this.invitationModel({
            id: (0, uuid_1.v4)(),
            code,
            invitedBy: dto.invitedBy,
            invitedByName: dto.invitedByName,
            role: dto.role,
            departmentId: dto.departmentId,
            title: dto.title,
            email: dto.email,
            name: dto.name,
            message: dto.message,
            linkToken,
            expiresAt,
            status: invitation_schema_1.InvitationStatus.PENDING,
            maxUses: dto.maxUses || 1,
            usedCount: 0,
        });
        const saved = await invitation.save();
        this.logger.log(`Created invitation: ${code}`);
        return saved;
    }
    async getByCode(code) {
        return this.invitationModel.findOne({ code }).exec();
    }
    async getByLinkToken(linkToken) {
        return this.invitationModel.findOne({ linkToken }).exec();
    }
    async validateInvitation(code, linkToken) {
        const invitation = await this.getByCode(code);
        if (!invitation) {
            return { valid: false, error: '邀请码不存在' };
        }
        if (invitation.linkToken !== linkToken) {
            return { valid: false, error: '邀请链接无效' };
        }
        if (invitation.status !== invitation_schema_1.InvitationStatus.PENDING) {
            return { valid: false, error: `邀请已${invitation.status === invitation_schema_1.InvitationStatus.ACCEPTED ? '被使用' : '失效'}` };
        }
        if (new Date() > invitation.expiresAt) {
            await this.invitationModel.updateOne({ id: invitation.id }, { status: invitation_schema_1.InvitationStatus.EXPIRED });
            return { valid: false, error: '邀请已过期' };
        }
        if (invitation.usedCount >= invitation.maxUses) {
            return { valid: false, error: '邀请使用次数已用完' };
        }
        return { valid: true, invitation };
    }
    async acceptInvitation(dto) {
        const validation = await this.validateInvitation(dto.code, dto.linkToken);
        if (!validation.valid || !validation.invitation) {
            throw new common_1.BadRequestException(validation.error);
        }
        const invitation = validation.invitation;
        if (invitation.email && invitation.email.toLowerCase() !== dto.email.toLowerCase()) {
            throw new common_1.BadRequestException('邮箱与邀请不匹配');
        }
        const existingEmployee = await this.employeeModel.findOne({
            email: dto.email.toLowerCase(),
        }).exec();
        if (existingEmployee) {
            throw new common_1.ConflictException('该邮箱已是成员');
        }
        const employeeRole = this.convertToEmployeeRole(invitation.role);
        const employee = new this.employeeModel({
            id: (0, uuid_1.v4)(),
            type: employee_schema_1.EmployeeType.HUMAN,
            email: dto.email.toLowerCase(),
            name: dto.name,
            role: employeeRole,
            departmentId: invitation.departmentId,
            title: invitation.title,
            status: employee_schema_1.EmployeeStatus.PROBATION,
            joinDate: new Date(),
            passwordHash: this.hashPassword(dto.password),
            shares: 0,
            stockOptions: 0,
            salary: 0,
            capabilities: [],
            permissions: [],
            toolAccess: [],
            performance: {
                overallScore: 0,
                taskCompletionRate: 0,
                codeQuality: 0,
                collaboration: 0,
                innovation: 0,
                efficiency: 0,
                totalEvaluations: 0,
            },
            statistics: {
                totalTasks: 0,
                completedTasks: 0,
                totalTokens: 0,
                totalCost: 0,
                meetingsAttended: 0,
                meetingsHosted: 0,
            },
            meetingPreferences: {
                autoJoin: true,
                notifications: true,
                preferredMeetingTypes: [],
            },
        });
        const savedEmployee = await employee.save();
        await this.invitationModel.updateOne({ id: invitation.id }, {
            status: invitation_schema_1.InvitationStatus.ACCEPTED,
            usedAt: new Date(),
            usedBy: savedEmployee.id,
            usedCount: invitation.usedCount + 1,
        });
        this.logger.log(`Employee ${savedEmployee.name} joined via invitation ${invitation.code}`);
        return savedEmployee;
    }
    async cancelInvitation(invitationId) {
        const invitation = await this.invitationModel.findOne({ id: invitationId }).exec();
        if (!invitation)
            return null;
        if (invitation.status !== invitation_schema_1.InvitationStatus.PENDING) {
            throw new common_1.BadRequestException('只能取消待处理的邀请');
        }
        await this.invitationModel.updateOne({ id: invitationId }, { status: invitation_schema_1.InvitationStatus.CANCELLED });
        this.logger.log(`Invitation ${invitation.code} cancelled`);
        return invitation;
    }
    async resendInvitation(invitationId, expiresInDays = 7) {
        const invitation = await this.invitationModel.findOne({ id: invitationId }).exec();
        if (!invitation)
            return null;
        if (invitation.status !== invitation_schema_1.InvitationStatus.PENDING) {
            throw new common_1.BadRequestException('只能重新发送待处理的邀请');
        }
        invitation.expiresAt = new Date();
        invitation.expiresAt.setDate(invitation.expiresAt.getDate() + expiresInDays);
        invitation.linkToken = (0, uuid_1.v4)();
        await invitation.save();
        this.logger.log(`Invitation ${invitation.code} resent, expires at ${invitation.expiresAt}`);
        return invitation;
    }
    async validateLogin(email, password) {
        const employee = await this.employeeModel.findOne({
            email: email.toLowerCase(),
            type: employee_schema_1.EmployeeType.HUMAN,
        }).exec();
        if (!employee) {
            return null;
        }
        if (!employee.passwordHash) {
            return null;
        }
        if (!this.verifyPassword(password, employee.passwordHash)) {
            return null;
        }
        if (employee.status === employee_schema_1.EmployeeStatus.TERMINATED) {
            throw new common_1.BadRequestException('账户已被终止');
        }
        return employee;
    }
    async updatePassword(employeeId, newPassword) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee) {
            throw new common_1.NotFoundException('员工不存在');
        }
        employee.passwordHash = this.hashPassword(newPassword);
        await employee.save();
        this.logger.log(`Password updated for employee ${employeeId}`);
    }
    getInvitationLink(code, linkToken, baseUrl = 'http://localhost:3000') {
        return `${baseUrl}/invite/${code}?token=${linkToken}`;
    }
    generateShortCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    hashPassword(password) {
        return (0, password_util_1.hashPassword)(password);
    }
    verifyPassword(password, storedHash) {
        return (0, password_util_1.verifyPassword)(password, storedHash);
    }
    convertToEmployeeRole(invitationRole) {
        const mapping = {
            [invitation_schema_1.InvitationRole.FOUNDER]: employee_schema_1.EmployeeRole.FOUNDER,
            [invitation_schema_1.InvitationRole.CO_FOUNDER]: employee_schema_1.EmployeeRole.CO_FOUNDER,
            [invitation_schema_1.InvitationRole.MANAGER]: employee_schema_1.EmployeeRole.MANAGER,
            [invitation_schema_1.InvitationRole.SENIOR]: employee_schema_1.EmployeeRole.SENIOR,
            [invitation_schema_1.InvitationRole.JUNIOR]: employee_schema_1.EmployeeRole.JUNIOR,
            [invitation_schema_1.InvitationRole.INTERN]: employee_schema_1.EmployeeRole.INTERN,
        };
        return mapping[invitationRole] || employee_schema_1.EmployeeRole.JUNIOR;
    }
};
exports.InvitationService = InvitationService;
exports.InvitationService = InvitationService = InvitationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(invitation_schema_1.Invitation.name)),
    __param(1, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], InvitationService);
//# sourceMappingURL=invitation.service.js.map