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
exports.InvitationController = void 0;
const common_1 = require("@nestjs/common");
const invitation_service_1 = require("./invitation.service");
let InvitationController = class InvitationController {
    constructor(invitationService) {
        this.invitationService = invitationService;
    }
    async createInvitation(dto) {
        const invitation = await this.invitationService.createInvitation(dto);
        const link = this.invitationService.getInvitationLink(invitation.code, invitation.linkToken);
        return {
            success: true,
            data: {
                ...invitation,
                link,
            },
            message: '邀请创建成功',
        };
    }
    async validateInvitation(body) {
        const result = await this.invitationService.validateInvitation(body.code, body.linkToken);
        return {
            valid: result.valid,
            error: result.error,
            data: result.invitation ? {
                id: result.invitation.id,
                role: result.invitation.role,
                title: result.invitation.title,
                invitedByName: result.invitation.invitedByName,
                message: result.invitation.message,
                expiresAt: result.invitation.expiresAt,
            } : undefined,
        };
    }
    async acceptInvitation(dto) {
        const employee = await this.invitationService.acceptInvitation(dto);
        return {
            success: true,
            data: {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                role: employee.role,
            },
            message: '加入组织成功',
        };
    }
    async cancelInvitation(id) {
        const invitation = await this.invitationService.cancelInvitation(id);
        return {
            success: !!invitation,
            message: invitation ? '邀请已取消' : '邀请不存在',
        };
    }
    async resendInvitation(id, body) {
        const invitation = await this.invitationService.resendInvitation(id, body.expiresInDays);
        if (!invitation) {
            return { success: false, message: '邀请不存在' };
        }
        const link = this.invitationService.getInvitationLink(invitation.code, invitation.linkToken);
        return {
            success: true,
            data: {
                ...invitation,
                link,
            },
            message: '邀请已重新发送',
        };
    }
};
exports.InvitationController = InvitationController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InvitationController.prototype, "createInvitation", null);
__decorate([
    (0, common_1.Post)('validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InvitationController.prototype, "validateInvitation", null);
__decorate([
    (0, common_1.Post)('accept'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InvitationController.prototype, "acceptInvitation", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InvitationController.prototype, "cancelInvitation", null);
__decorate([
    (0, common_1.Post)(':id/resend'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InvitationController.prototype, "resendInvitation", null);
exports.InvitationController = InvitationController = __decorate([
    (0, common_1.Controller)('invitations'),
    __metadata("design:paramtypes", [invitation_service_1.InvitationService])
], InvitationController);
//# sourceMappingURL=invitation.controller.js.map