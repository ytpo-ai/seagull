"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProjectAuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectAuthGuard = void 0;
exports.extractUserContext = extractUserContext;
const common_1 = require("@nestjs/common");
const auth_1 = require("../../../libs/auth/src/index");
const INTERNAL_CONTEXT_SECRET = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
let ProjectAuthGuard = ProjectAuthGuard_1 = class ProjectAuthGuard {
    constructor() {
        this.logger = new common_1.Logger(ProjectAuthGuard_1.name);
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const encoded = request.headers['x-user-context'];
        const signature = request.headers['x-user-signature'];
        if (!encoded || !signature) {
            this.logger.warn('Missing x-user-context or x-user-signature headers');
            throw new common_1.ForbiddenException('Missing user context');
        }
        if (!(0, auth_1.verifyEncodedContext)(encoded, signature, INTERNAL_CONTEXT_SECRET)) {
            this.logger.warn('User context signature verification failed');
            throw new common_1.ForbiddenException('Invalid user context signature');
        }
        const userContext = (0, auth_1.decodeUserContext)(encoded);
        if (!userContext.employeeId) {
            this.logger.warn('User context missing employeeId');
            throw new common_1.ForbiddenException('Invalid user context');
        }
        request.userContext = userContext;
        return true;
    }
};
exports.ProjectAuthGuard = ProjectAuthGuard;
exports.ProjectAuthGuard = ProjectAuthGuard = ProjectAuthGuard_1 = __decorate([
    (0, common_1.Injectable)()
], ProjectAuthGuard);
function extractUserContext(request) {
    return request.userContext;
}
//# sourceMappingURL=project-auth.guard.js.map