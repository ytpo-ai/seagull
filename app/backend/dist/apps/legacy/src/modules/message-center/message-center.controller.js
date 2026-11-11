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
exports.MessageCenterController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const message_center_service_1 = require("./message-center.service");
let MessageCenterController = class MessageCenterController {
    constructor(authService, messageCenterService) {
        this.authService = authService;
        this.messageCenterService = messageCenterService;
    }
    async resolveCurrentEmployee(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.verifyToken(token);
        if (!employee?.id) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        const receiverAgentId = String(employee.exclusiveAssistantAgentId || employee.aiProxyAgentId || '').trim() || undefined;
        return {
            employeeId: employee.id,
            receiverAgentId,
        };
    }
    async listMessages(authHeader, page, pageSize, isRead, type) {
        const currentEmployee = await this.resolveCurrentEmployee(authHeader);
        const normalizedIsRead = typeof isRead === 'string'
            ? isRead.toLowerCase() === 'true'
                ? true
                : isRead.toLowerCase() === 'false'
                    ? false
                    : undefined
            : undefined;
        return {
            success: true,
            data: await this.messageCenterService.listMessages({
                receiverId: currentEmployee.employeeId,
                page: page ? Number(page) : undefined,
                pageSize: pageSize ? Number(pageSize) : undefined,
                isRead: normalizedIsRead,
                type,
            }),
        };
    }
    async getUnreadCount(authHeader) {
        const currentEmployee = await this.resolveCurrentEmployee(authHeader);
        const unreadCount = await this.messageCenterService.getUnreadCount(currentEmployee.employeeId);
        return {
            success: true,
            data: {
                unreadCount,
            },
        };
    }
    async markAsRead(authHeader, messageId) {
        if (!messageId?.trim()) {
            throw new common_1.BadRequestException('messageId is required');
        }
        const currentEmployee = await this.resolveCurrentEmployee(authHeader);
        return {
            success: true,
            data: await this.messageCenterService.markAsRead(currentEmployee.employeeId, messageId),
        };
    }
    async markAllAsRead(authHeader) {
        const currentEmployee = await this.resolveCurrentEmployee(authHeader);
        return {
            success: true,
            data: await this.messageCenterService.markAllAsRead(currentEmployee.employeeId),
        };
    }
};
exports.MessageCenterController = MessageCenterController;
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('isRead')),
    __param(4, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MessageCenterController.prototype, "listMessages", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MessageCenterController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Patch)('messages/:messageId/read'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessageCenterController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Patch)('messages/read-all'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MessageCenterController.prototype, "markAllAsRead", null);
exports.MessageCenterController = MessageCenterController = __decorate([
    (0, common_1.Controller)('message-center'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        message_center_service_1.MessageCenterService])
], MessageCenterController);
//# sourceMappingURL=message-center.controller.js.map