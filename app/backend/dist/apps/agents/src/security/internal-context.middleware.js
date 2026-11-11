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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalContextMiddleware = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("../../../../libs/auth/src/index");
let InternalContextMiddleware = class InternalContextMiddleware {
    constructor() {
        this.contextSecret = String(process.env.INTERNAL_CONTEXT_SECRET || '').trim();
        if (!this.contextSecret) {
            throw new Error('INTERNAL_CONTEXT_SECRET is required');
        }
    }
    use(req, _res, next) {
        const path = req.originalUrl?.split('?')[0] || req.url;
        if (path === '/api/health') {
            next();
            return;
        }
        const authMode = String(process.env.TOOLS_AUTH_MODE || 'legacy').trim().toLowerCase();
        if (path === '/api/tools/auth/agent-token' && (authMode === 'hybrid' || authMode === 'jwt-strict')) {
            next();
            return;
        }
        const authHeader = req.headers.authorization;
        const hasBearer = Boolean(authHeader?.startsWith('Bearer '));
        if (hasBearer && (path === '/api/tools/auth/agent-token' || path.startsWith('/api/tools/'))) {
            if (authMode === 'hybrid' || authMode === 'jwt-strict') {
                next();
                return;
            }
        }
        const encodedContext = req.headers['x-user-context'];
        const signature = req.headers['x-user-signature'];
        if (!encodedContext || !signature) {
            throw new common_1.UnauthorizedException('Missing internal user context');
        }
        const valid = (0, auth_1.verifyEncodedContext)(encodedContext, signature, this.contextSecret);
        if (!valid) {
            throw new common_1.UnauthorizedException('Invalid internal user context signature');
        }
        req.userContext = (0, auth_1.decodeUserContext)(encodedContext);
        next();
    }
};
exports.InternalContextMiddleware = InternalContextMiddleware;
exports.InternalContextMiddleware = InternalContextMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], InternalContextMiddleware);
//# sourceMappingURL=internal-context.middleware.js.map