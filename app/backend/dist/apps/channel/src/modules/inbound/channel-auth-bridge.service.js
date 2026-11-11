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
exports.ChannelAuthBridgeService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_1 = require("../../../../../libs/auth/src/index");
const mongoose_2 = require("mongoose");
const employee_schema_1 = require("../../../../../src/shared/schemas/employee.schema");
let ChannelAuthBridgeService = class ChannelAuthBridgeService {
    constructor(employeeModel) {
        this.employeeModel = employeeModel;
        this.contextSecret = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
        this.employeeCacheTtlMs = 30 * 1000;
        this.employeeCache = new Map();
    }
    async buildSignedHeaders(employeeId, extra, contextHint) {
        const normalizedEmployeeId = String(employeeId || '').trim();
        const now = Date.now();
        const cached = this.employeeCache.get(normalizedEmployeeId);
        let role = String(contextHint?.role || '').trim() || undefined;
        let email = String(contextHint?.email || '').trim() || undefined;
        if (!role && !email && cached && cached.expiresAt > now) {
            role = cached.role;
            email = cached.email;
        }
        if (!role && !email) {
            const employee = await this.employeeModel
                .findOne({ id: normalizedEmployeeId })
                .select({ id: 1, email: 1, role: 1 })
                .exec();
            role = employee?.role;
            email = employee?.email;
            this.employeeCache.set(normalizedEmployeeId, {
                role,
                email,
                expiresAt: now + this.employeeCacheTtlMs,
            });
        }
        const context = {
            employeeId: normalizedEmployeeId,
            email,
            role,
            issuedAt: now,
            expiresAt: now + 60 * 1000,
        };
        const encoded = (0, auth_1.encodeUserContext)(context);
        const signature = (0, auth_1.signEncodedContext)(encoded, this.contextSecret);
        return {
            'x-user-context': encoded,
            'x-user-signature': signature,
            'x-channel-source': 'feishu',
            ...(extra || {}),
        };
    }
};
exports.ChannelAuthBridgeService = ChannelAuthBridgeService;
exports.ChannelAuthBridgeService = ChannelAuthBridgeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ChannelAuthBridgeService);
//# sourceMappingURL=channel-auth-bridge.service.js.map