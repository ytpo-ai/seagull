"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionLoggingFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionLoggingFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionLoggingFilter = HttpExceptionLoggingFilter_1 = class HttpExceptionLoggingFilter {
    constructor() {
        this.logger = new common_1.Logger(HttpExceptionLoggingFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const requestIdHeader = request.headers['x-request-id'];
        const requestId = Array.isArray(requestIdHeader)
            ? String(requestIdHeader[0] || '').trim()
            : String(requestIdHeader || '').trim();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const payload = exception.getResponse();
            const detail = this.extractDetail(payload);
            const baseMessage = `[http_exception] method=${request.method} path=${request.originalUrl || request.url} ` +
                `status=${status} requestId=${requestId || 'none'} detail="${detail}"`;
            if (status >= 500) {
                this.logger.error(baseMessage);
            }
            else {
                this.logger.warn(baseMessage);
            }
            response.status(status).json(payload);
            return;
        }
        const message = exception instanceof Error ? exception.message : String(exception || 'Unknown error');
        this.logger.error(`[unhandled_exception] method=${request.method} path=${request.originalUrl || request.url} requestId=${requestId || 'none'} error=${message}`, exception instanceof Error ? exception.stack : undefined);
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
        });
    }
    extractDetail(payload) {
        if (!payload)
            return 'none';
        if (typeof payload === 'string')
            return this.compact(payload, 300);
        if (typeof payload === 'object') {
            const source = payload;
            const message = source.message;
            const error = source.error;
            const statusCode = source.statusCode;
            const parts = [
                statusCode ? `statusCode=${this.compact(statusCode, 20)}` : '',
                message
                    ? `message=${Array.isArray(message)
                        ? this.compact(message.join('; '), 300)
                        : this.compact(message, 300)}`
                    : '',
                error ? `error=${this.compact(error, 120)}` : '',
            ].filter(Boolean);
            if (parts.length > 0)
                return parts.join(' ');
            return this.compact(JSON.stringify(source), 300);
        }
        return this.compact(payload, 300);
    }
    compact(value, maxLength = 120) {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        if (!normalized)
            return '';
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
    }
};
exports.HttpExceptionLoggingFilter = HttpExceptionLoggingFilter;
exports.HttpExceptionLoggingFilter = HttpExceptionLoggingFilter = HttpExceptionLoggingFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpExceptionLoggingFilter);
//# sourceMappingURL=http-exception-logging.filter.js.map