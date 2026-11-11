"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const context = host.switchToHttp();
        const response = context.getResponse();
        const request = context.getRequest();
        const statusCode = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const exceptionResponse = exception instanceof common_1.HttpException
            ? exception.getResponse()
            : null;
        const message = this.resolveMessage(exceptionResponse, exception);
        const error = this.resolveError(exceptionResponse, exception);
        const requestId = request.headers['x-request-id'] || `req_${Date.now()}`;
        response.status(statusCode).json({
            code: statusCode,
            message,
            error,
            timestamp: new Date().toISOString(),
            requestId,
            path: request.url,
        });
    }
    resolveMessage(exceptionResponse, exception) {
        if (typeof exceptionResponse === 'string') {
            return exceptionResponse;
        }
        if (exceptionResponse && typeof exceptionResponse === 'object') {
            const maybeMessage = exceptionResponse.message;
            if (Array.isArray(maybeMessage)) {
                return maybeMessage.join(', ');
            }
            if (typeof maybeMessage === 'string') {
                return maybeMessage;
            }
        }
        if (exception instanceof Error) {
            return exception.message;
        }
        return 'Internal server error';
    }
    resolveError(exceptionResponse, exception) {
        if (exceptionResponse && typeof exceptionResponse === 'object') {
            return exceptionResponse;
        }
        if (typeof exceptionResponse === 'string') {
            return { message: exceptionResponse };
        }
        if (exception instanceof Error) {
            return { name: exception.name, message: exception.message };
        }
        return { message: 'Unknown error' };
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map