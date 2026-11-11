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
var GatewayAuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_1 = require("../../../libs/auth/src/index");
const mongoose_2 = require("mongoose");
const crypto = __importStar(require("crypto"));
const employee_schema_1 = require("../../../src/shared/schemas/employee.schema");
const project_api_key_schema_1 = require("../../../src/shared/schemas/project-api-key.schema");
const PROJECT_API_KEY_PREFIX = 'sk-proj-';
const PUBLIC_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/verify',
    '/api/auth/refresh',
    '/api/invitations/validate',
    '/api/invitations/accept',
    '/api/health',
]);
const PUBLIC_ROUTE_RULES = [
    { path: '/api/life-script/auth/exchange' },
    { path: '/api/life-script/upload' },
    { path: '/api/life-script/submissions', method: 'POST' },
];
let GatewayAuthGuard = GatewayAuthGuard_1 = class GatewayAuthGuard {
    constructor(employeeModel, projectApiKeyModel) {
        this.employeeModel = employeeModel;
        this.projectApiKeyModel = projectApiKeyModel;
        this.logger = new common_1.Logger(GatewayAuthGuard_1.name);
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const path = req.originalUrl?.split('?')[0] || req.url;
        const method = String(req.method || 'GET').toUpperCase();
        if (this.isPublicPath(path, method)) {
            return true;
        }
        const token = this.extractBearerToken(req);
        if (!token) {
            throw new common_1.UnauthorizedException('Missing Bearer token');
        }
        if (token.startsWith(PROJECT_API_KEY_PREFIX)) {
            return this.authenticateByProjectApiKey(req, token);
        }
        if (path.startsWith('/api/life-script')) {
            return this.authenticateLifeScriptToken(req, token);
        }
        return this.authenticateByEmployeeJwt(req, token);
    }
    async authenticateByProjectApiKey(req, rawKey) {
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const apiKey = await this.projectApiKeyModel
            .findOne({ keyHash, isActive: true })
            .exec();
        if (!apiKey) {
            this.logger.warn(`Project API Key auth failed: invalid or inactive key`);
            throw new common_1.UnauthorizedException('Invalid Project API Key');
        }
        this.projectApiKeyModel
            .updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() })
            .exec()
            .catch((err) => this.logger.warn(`Failed to update API Key usage time: ${err.message}`));
        const userContext = {
            employeeId: `proj-key:${apiKey._id}`,
            role: 'project-api-key',
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600 * 1000,
        };
        req.projectApiKeyContext = {
            authMode: 'project-api-key',
            projectId: apiKey.projectId,
            allowedAgentIds: apiKey.agentIds || [],
            keyId: apiKey._id.toString(),
            keyName: apiKey.name,
        };
        req.userContext = userContext;
        this.logger.log(`Project API Key authenticated: key=${apiKey.name} project=${apiKey.projectId} agentIds=${apiKey.agentIds?.length || 'all'}`);
        return true;
    }
    async authenticateByEmployeeJwt(req, token) {
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const payload = (0, auth_1.verifyEmployeeToken)(token, secret);
        if (!payload) {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        const employee = await this.employeeModel
            .findOne({ id: payload.employeeId })
            .select({ role: 1 })
            .lean()
            .exec();
        const userContext = {
            employeeId: payload.employeeId,
            email: payload.email,
            role: String(employee?.role || ''),
            issuedAt: Date.now(),
            expiresAt: payload.exp,
        };
        req.userContext = userContext;
        return true;
    }
    isPublicPath(path, method) {
        if (PUBLIC_PATHS.has(path)) {
            return true;
        }
        return PUBLIC_ROUTE_RULES.some((rule) => {
            if (rule.path !== path) {
                return false;
            }
            if (!rule.method) {
                return true;
            }
            return rule.method === method;
        });
    }
    extractBearerToken(req) {
        const authHeader = req.headers.authorization;
        const queryToken = String(req.query?.access_token || '').trim();
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.slice(7);
        }
        return queryToken;
    }
    authenticateLifeScriptToken(req, token) {
        const secret = process.env.LS_JWT_SECRET;
        if (!secret) {
            throw new common_1.UnauthorizedException('LS_JWT_SECRET not configured');
        }
        const payload = (0, auth_1.verifyEmployeeToken)(token, secret);
        if (!payload?.employeeId) {
            throw new common_1.UnauthorizedException('Invalid or expired LifeScript token');
        }
        const userContext = {
            employeeId: payload.employeeId,
            email: payload.email || '',
            role: String(payload.role || ''),
            issuedAt: payload.iat || Date.now(),
            expiresAt: payload.exp,
        };
        req.userContext = userContext;
        return true;
    }
};
exports.GatewayAuthGuard = GatewayAuthGuard;
exports.GatewayAuthGuard = GatewayAuthGuard = GatewayAuthGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __param(1, (0, mongoose_1.InjectModel)(project_api_key_schema_1.ProjectApiKey.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], GatewayAuthGuard);
//# sourceMappingURL=gateway-auth.guard.js.map