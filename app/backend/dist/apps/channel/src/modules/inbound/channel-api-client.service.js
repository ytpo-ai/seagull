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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelApiClientService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const channel_auth_bridge_service_1 = require("./channel-auth-bridge.service");
let ChannelApiClientService = class ChannelApiClientService {
    constructor(authBridgeService) {
        this.authBridgeService = authBridgeService;
        this.gatewayBaseUrl = process.env.GATEWAY_SERVICE_URL || 'http://127.0.0.1:3100';
        this.executeTimeoutMs = Math.max(5000, Number(process.env.CHANNEL_AGENT_EXECUTE_TIMEOUT_MS || 120000));
        this.httpClient = axios_1.default.create({
            baseURL: this.gatewayBaseUrl,
            timeout: this.executeTimeoutMs,
            validateStatus: () => true,
        });
    }
    async callApiAsUser(employeeId, request) {
        const headers = await this.authBridgeService.buildSignedHeaders(employeeId, {
            'content-type': 'application/json',
        });
        const response = await this.httpClient.request({
            method: request.method,
            url: request.url,
            data: request.data,
            params: request.params,
            headers,
        });
        if (response.status >= 400) {
            throw new Error(`api_request_failed:${response.status} ${request.method.toUpperCase()} ${request.url}`);
        }
        const payload = response.data;
        if (payload && typeof payload === 'object' && 'data' in payload) {
            const data = payload.data;
            if (Array.isArray(data)) {
                return data.filter((item) => Boolean(item && typeof item === 'object'));
            }
            if (data && typeof data === 'object') {
                return data;
            }
        }
        if (Array.isArray(payload)) {
            return payload.filter((item) => Boolean(item && typeof item === 'object'));
        }
        if (payload && typeof payload === 'object') {
            return payload;
        }
        return {};
    }
};
exports.ChannelApiClientService = ChannelApiClientService;
exports.ChannelApiClientService = ChannelApiClientService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [channel_auth_bridge_service_1.ChannelAuthBridgeService])
], ChannelApiClientService);
//# sourceMappingURL=channel-api-client.service.js.map