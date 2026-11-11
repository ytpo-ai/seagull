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
var ExaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ExaService = ExaService_1 = class ExaService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ExaService_1.name);
        this.baseUrl = 'https://api.exa.ai';
        this.apiKey = this.configService.get('EXA_API_KEY');
        if (!this.isConfigured()) {
            this.logger.warn('EXA_API_KEY not configured, Exa search unavailable');
        }
    }
    isConfigured() {
        return !!this.apiKey && this.apiKey !== 'YOUR_API_KEY';
    }
    async webSearch(query, maxResults = 10) {
        if (!this.isConfigured()) {
            return {
                successful: false,
                error: 'EXA_API_KEY not configured',
            };
        }
        const trimmedQuery = String(query || '').trim();
        if (!trimmedQuery) {
            return {
                successful: false,
                error: 'Exa search query is empty',
            };
        }
        const payload = {
            query: trimmedQuery,
            type: 'auto',
            num_results: Math.min(Math.max(Number(maxResults || 10), 1), 20),
            contents: {
                highlights: {
                    max_characters: 4000,
                },
            },
        };
        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': this.apiKey,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const text = await response.text();
                return {
                    successful: false,
                    error: `Exa search failed with status ${response.status}: ${text.slice(0, 300)}`,
                };
            }
            const data = (await response.json());
            return {
                successful: true,
                data,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Exa search error';
            this.logger.error('Exa webSearch execution failed', error);
            return {
                successful: false,
                error: message,
            };
        }
    }
};
exports.ExaService = ExaService;
exports.ExaService = ExaService = ExaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ExaService);
//# sourceMappingURL=exa.service.js.map