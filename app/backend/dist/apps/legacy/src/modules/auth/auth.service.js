"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
const invitation_service_1 = require("../invitations/invitation.service");
const crypto = __importStar(require("crypto"));
const infra_1 = require("../../../libs/infra/src/index");
const password_util_1 = require("../../shared/utils/password.util");
function createToken(payload, secret, expiresIn) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadStr = Buffer.from(JSON.stringify({
        ...payload,
        exp: Date.now() + (expiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payloadStr}`).digest('base64url');
    return `${header}.${payloadStr}.${signature}`;
}
function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const [header, payload, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
        if (signature !== expectedSig)
            return null;
        const payloadObj = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (payloadObj.exp < Date.now())
            return null;
        return payloadObj;
    }
    catch {
        return null;
    }
}
let AuthService = AuthService_1 = class AuthService {
    constructor(employeeModel, invitationService, redisService) {
        this.employeeModel = employeeModel;
        this.invitationService = invitationService;
        this.redisService = redisService;
        this.logger = new common_1.Logger(AuthService_1.name);
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.feishuBindTokenTtlSeconds = Math.max(60, Number(process.env.FEISHU_BIND_TOKEN_TTL_SECONDS || 300));
        this.feishuBindTokenRateLimitWindowSeconds = Math.max(30, Number(process.env.FEISHU_BIND_TOKEN_RATE_LIMIT_WINDOW_SECONDS || 60));
        this.feishuBindTokenRateLimitMax = Math.max(1, Number(process.env.FEISHU_BIND_TOKEN_RATE_LIMIT_MAX || 3));
        this.lifeScriptRedirectTokenTtlSeconds = Math.max(10, Number(process.env.LIFE_SCRIPT_REDIRECT_TOKEN_TTL_SECONDS || 30));
        this.lifeScriptRedirectTokenRateLimitWindowSeconds = Math.max(30, Number(process.env.LIFE_SCRIPT_REDIRECT_TOKEN_RATE_LIMIT_WINDOW_SECONDS || 60));
        this.lifeScriptRedirectTokenRateLimitMax = Math.max(1, Number(process.env.LIFE_SCRIPT_REDIRECT_TOKEN_RATE_LIMIT_MAX || 10));
    }
    async login(dto) {
        const employee = await this.employeeModel.findOne({
            email: dto.email.toLowerCase(),
            type: employee_schema_1.EmployeeType.HUMAN,
        }).exec();
        if (!employee) {
            throw new common_1.NotFoundException('邮箱或密码错误');
        }
        if (!employee.passwordHash) {
            throw new common_1.BadRequestException('请通过邀请链接设置密码');
        }
        const isValid = await this.verifyPassword(dto.password, employee.passwordHash);
        if (!isValid) {
            throw new common_1.BadRequestException('邮箱或密码错误');
        }
        if (employee.status === employee_schema_1.EmployeeStatus.TERMINATED) {
            throw new common_1.BadRequestException('账户已被终止');
        }
        if (employee.status === employee_schema_1.EmployeeStatus.SUSPENDED) {
            throw new common_1.BadRequestException('账户已被暂停');
        }
        const token = this.generateToken(employee);
        this.logger.log(`Employee ${employee.name} logged in`);
        return {
            employee: {
                id: employee.id,
                name: employee.name || '',
                email: employee.email || '',
                type: employee.type,
                role: employee.role,
            },
            token,
        };
    }
    async verifyToken(token) {
        try {
            const decoded = verifyToken(token, this.jwtSecret);
            if (!decoded)
                return null;
            const employee = await this.employeeModel.findOne({ id: decoded.employeeId }).exec();
            return employee;
        }
        catch (error) {
            return null;
        }
    }
    async getEmployeeFromToken(token) {
        const decoded = verifyToken(token, this.jwtSecret);
        if (!decoded)
            return null;
        return {
            id: decoded.employeeId,
            name: '',
            email: decoded.email,
            type: employee_schema_1.EmployeeType.HUMAN,
            role: '',
        };
    }
    async refreshToken(oldToken) {
        const decoded = verifyToken(oldToken, this.jwtSecret);
        if (!decoded) {
            throw new common_1.BadRequestException('无效的Token');
        }
        return this.generateTokenFromData(decoded);
    }
    generateTokenFromData(data) {
        return createToken({
            employeeId: data.employeeId,
            email: data.email,
        }, this.jwtSecret, this.jwtExpiresIn);
    }
    async changePassword(employeeId, oldPassword, newPassword) {
        const employee = await this.employeeModel.findOne({ id: employeeId }).exec();
        if (!employee) {
            throw new common_1.NotFoundException('员工不存在');
        }
        if (employee.passwordHash) {
            const isValid = await this.verifyPassword(oldPassword, employee.passwordHash);
            if (!isValid) {
                throw new common_1.BadRequestException('原密码错误');
            }
        }
        employee.passwordHash = await this.hashPassword(newPassword);
        await employee.save();
        this.logger.log(`Password changed for employee ${employeeId}`);
    }
    async resetPasswordViaInvite(code, linkToken, newPassword) {
        const employee = await this.employeeModel.findOne({
            email: (await this.invitationService.getByCode(code))?.email,
        }).exec();
        if (!employee) {
            throw new common_1.NotFoundException('员工不存在');
        }
        employee.passwordHash = await this.hashPassword(newPassword);
        await employee.save();
        this.logger.log(`Password reset for employee ${employee.id}`);
    }
    async generateFeishuBindToken(employeeId) {
        const normalizedEmployeeId = String(employeeId || '').trim();
        if (!normalizedEmployeeId) {
            throw new common_1.BadRequestException('employeeId is required');
        }
        const employee = await this.employeeModel
            .findOne({
            id: normalizedEmployeeId,
            type: employee_schema_1.EmployeeType.HUMAN,
        })
            .select({ id: 1 })
            .exec();
        if (!employee) {
            throw new common_1.NotFoundException('员工不存在');
        }
        const rateLimitKey = `channel:feishu-bind:limit:${normalizedEmployeeId}`;
        const currentCount = await this.redisService.incr(rateLimitKey);
        if (currentCount === 1) {
            await this.redisService.expire(rateLimitKey, this.feishuBindTokenRateLimitWindowSeconds);
        }
        if (currentCount > this.feishuBindTokenRateLimitMax) {
            throw new common_1.HttpException('请求过于频繁，请稍后重试', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const token = crypto.randomBytes(16).toString('hex');
        const redisKey = `channel:feishu-bind:${token}`;
        await this.redisService.set(redisKey, normalizedEmployeeId, this.feishuBindTokenTtlSeconds);
        return {
            token,
            expiresIn: this.feishuBindTokenTtlSeconds,
            command: `/bind token:${token}`,
        };
    }
    async generateLifeScriptRedirectToken(employeeId) {
        const normalizedEmployeeId = String(employeeId || '').trim();
        if (!normalizedEmployeeId) {
            throw new common_1.BadRequestException('employeeId is required');
        }
        const employee = await this.employeeModel
            .findOne({
            id: normalizedEmployeeId,
            type: employee_schema_1.EmployeeType.HUMAN,
        })
            .select({ id: 1, email: 1, name: 1, role: 1 })
            .lean()
            .exec();
        if (!employee) {
            throw new common_1.NotFoundException('员工不存在');
        }
        const rateLimitKey = `redirect:rate:${normalizedEmployeeId}`;
        const currentCount = await this.redisService.incr(rateLimitKey);
        if (currentCount === 1) {
            await this.redisService.expire(rateLimitKey, this.lifeScriptRedirectTokenRateLimitWindowSeconds);
        }
        if (currentCount > this.lifeScriptRedirectTokenRateLimitMax) {
            throw new common_1.HttpException('请求过于频繁，请稍后重试', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const redirectToken = crypto.randomBytes(32).toString('hex');
        const redisKey = `redirect:life-script:${redirectToken}`;
        const payload = {
            employeeId: normalizedEmployeeId,
            email: String(employee.email || ''),
            name: String(employee.name || ''),
            role: String(employee.role || ''),
            issuedAt: Date.now(),
        };
        await this.redisService.set(redisKey, JSON.stringify(payload), this.lifeScriptRedirectTokenTtlSeconds);
        return {
            redirectToken,
            expiresIn: this.lifeScriptRedirectTokenTtlSeconds,
        };
    }
    generateToken(employee) {
        return createToken({
            employeeId: employee.id,
            email: employee.email,
        }, this.jwtSecret, this.jwtExpiresIn);
    }
    hashPassword(password) {
        return (0, password_util_1.hashPassword)(password);
    }
    verifyPassword(password, storedHash) {
        return (0, password_util_1.verifyPassword)(password, storedHash);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        invitation_service_1.InvitationService,
        infra_1.RedisService])
], AuthService);
//# sourceMappingURL=auth.service.js.map