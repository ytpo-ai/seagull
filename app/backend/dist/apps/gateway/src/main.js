"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const express_1 = require("express");
const app_module_1 = require("./app.module");
const response_interceptor_1 = require("../../../src/shared/common/interceptors/response.interceptor");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.GatewayAppModule);
    app.use((0, express_1.json)({ limit: '5mb' }));
    app.use((0, express_1.urlencoded)({ limit: '5mb', extended: true }));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });
    const port = Number(process.env.GATEWAY_PORT || 3100);
    await app.listen(port);
    console.log(`Gateway service running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map