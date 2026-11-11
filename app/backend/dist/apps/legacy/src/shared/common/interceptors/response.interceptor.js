"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let ResponseInterceptor = class ResponseInterceptor {
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const requestId = request?.headers?.['x-request-id'] || `req_${Date.now()}`;
        return next.handle().pipe((0, rxjs_1.map)((data) => {
            if (this.isWrappedResponse(data)) {
                return {
                    ...data,
                    requestId: data.requestId || requestId,
                    timestamp: data.timestamp || new Date().toISOString(),
                };
            }
            if (this.isLegacySuccessResponse(data)) {
                return {
                    code: 0,
                    message: data.message || 'success',
                    data: data.data,
                    timestamp: data.timestamp || new Date().toISOString(),
                    requestId: data.requestId || requestId,
                };
            }
            return {
                code: 0,
                message: 'success',
                data,
                timestamp: new Date().toISOString(),
                requestId,
            };
        }));
    }
    isWrappedResponse(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        const body = payload;
        return 'code' in body && 'message' in body && 'data' in body;
    }
    isLegacySuccessResponse(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        const body = payload;
        return body.success === true && Object.prototype.hasOwnProperty.call(body, 'data');
    }
};
exports.ResponseInterceptor = ResponseInterceptor;
exports.ResponseInterceptor = ResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], ResponseInterceptor);
//# sourceMappingURL=response.interceptor.js.map