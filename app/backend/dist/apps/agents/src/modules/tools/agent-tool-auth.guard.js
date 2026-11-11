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
exports.AgentToolAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const agent_tool_auth_service_1 = require("./agent-tool-auth.service");
let AgentToolAuthGuard = class AgentToolAuthGuard {
    constructor(authService) {
        this.authService = authService;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const mode = this.authService.getAuthMode();
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (token) {
            const claims = await this.authService.verifyToken(token);
            const bodyAgentId = String(req.body?.agentId || '').trim();
            if (bodyAgentId && bodyAgentId !== claims.agentId) {
                throw new common_1.UnauthorizedException('agentId in request body does not match token subject');
            }
            req.agentToolAuth = {
                mode: 'jwt',
                agentId: claims.agentId,
                scopes: claims.toolScopes || [],
                permissions: claims.permissions || [],
                jti: claims.jti,
                originSessionId: claims.originSessionId,
            };
            return true;
        }
        if (mode === 'jwt-strict') {
            throw new common_1.UnauthorizedException('Missing Bearer token');
        }
        if (req.userContext) {
            req.agentToolAuth = {
                mode: 'internal-context',
                agentId: String(req.body?.agentId || '').trim() || undefined,
                scopes: ['tool:execute:*'],
            };
            return true;
        }
        if (mode === 'legacy') {
            return true;
        }
        throw new common_1.UnauthorizedException('Missing authorization context');
    }
};
exports.AgentToolAuthGuard = AgentToolAuthGuard;
exports.AgentToolAuthGuard = AgentToolAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agent_tool_auth_service_1.AgentToolAuthService])
], AgentToolAuthGuard);
//# sourceMappingURL=agent-tool-auth.guard.js.map