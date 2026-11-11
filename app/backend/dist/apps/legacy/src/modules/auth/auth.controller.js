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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async login(dto) {
        return this.authService.login(dto);
    }
    async verify(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        return {
            valid: true,
            employee,
        };
    }
    async refresh(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const newToken = await this.authService.refreshToken(token);
        return { token: newToken };
    }
    async changePassword(authHeader, body) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        await this.authService.changePassword(employee.id, body.oldPassword, body.newPassword);
        return {
            success: true,
            message: '密码修改成功',
        };
    }
    async getCurrentUser(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        return employee;
    }
    async generateFeishuBindToken(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        return this.authService.generateFeishuBindToken(employee.id);
    }
    async issueRedirectToken(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('无效的Token');
        }
        const token = authHeader.replace('Bearer ', '');
        const employee = await this.authService.getEmployeeFromToken(token);
        if (!employee) {
            throw new common_1.UnauthorizedException('Token已过期或无效');
        }
        return this.authService.generateLifeScriptRedirectToken(employee.id);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('verify'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('change-password'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getCurrentUser", null);
__decorate([
    (0, common_1.Post)('me/feishu-bind-token'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "generateFeishuBindToken", null);
__decorate([
    (0, common_1.Post)('issue-redirect-token'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "issueRedirectToken", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map