"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DebugTimingProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugTimingProvider = void 0;
const common_1 = require("@nestjs/common");
let DebugTimingProvider = DebugTimingProvider_1 = class DebugTimingProvider {
    constructor() {
        this.logger = new common_1.Logger(DebugTimingProvider_1.name);
        this.enabled = this.readEnvBoolean('AGENT_DEBUG_TIMING', false);
    }
    log(record) {
        if (!this.enabled) {
            return;
        }
        const traceFieldName = record.traceFieldName || 'traceId';
        const extraText = record.extras
            ? Object.entries(record.extras)
                .map(([key, value]) => `${key}=${String(value)}`)
                .join(' ')
            : '';
        this.logger.debug(`[timing_debug] ${traceFieldName}=${record.traceId} stage=${record.stage} durationMs=${Date.now() - record.startedAt}${extraText ? ` ${extraText}` : ''}`);
    }
    readEnvBoolean(name, fallback) {
        const raw = process.env[name];
        if (raw === undefined) {
            return fallback;
        }
        const normalized = raw.trim().toLowerCase();
        if (!normalized) {
            return fallback;
        }
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
    }
};
exports.DebugTimingProvider = DebugTimingProvider;
exports.DebugTimingProvider = DebugTimingProvider = DebugTimingProvider_1 = __decorate([
    (0, common_1.Injectable)()
], DebugTimingProvider);
//# sourceMappingURL=debug-timing.provider.js.map