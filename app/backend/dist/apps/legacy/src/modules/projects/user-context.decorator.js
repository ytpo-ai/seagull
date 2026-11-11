"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserContext = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("../../../libs/auth/src/index");
const INTERNAL_CONTEXT_SECRET = process.env.INTERNAL_CONTEXT_SECRET || 'internal-context-secret';
exports.UserContext = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const encoded = request.headers['x-user-context'];
    const signature = request.headers['x-user-signature'];
    if (!encoded || !signature) {
        throw new common_1.UnauthorizedException('Missing user context headers');
    }
    if (!(0, auth_1.verifyEncodedContext)(encoded, signature, INTERNAL_CONTEXT_SECRET)) {
        throw new common_1.UnauthorizedException('Invalid user context signature');
    }
    return (0, auth_1.decodeUserContext)(encoded);
});
//# sourceMappingURL=user-context.decorator.js.map