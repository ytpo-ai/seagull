"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const app_module_1 = require("./app.module");
const infra_1 = require("../libs/infra/src/index");
const response_interceptor_1 = require("./shared/common/interceptors/response.interceptor");
const http_exception_filter_1 = require("./shared/common/filters/http-exception.filter");
async function bootstrap() {
    await (0, infra_1.initializeNetworkProxy)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.setGlobalPrefix('api');
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 AI Agent Team Platform Server running on http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    console.log(`🤖 Ready to manage your AI startup team!`);
}
bootstrap();
//# sourceMappingURL=main.js.map