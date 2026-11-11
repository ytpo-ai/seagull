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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PromptResolverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptResolverService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const infra_1 = require("../../../../../libs/infra/src/index");
const prompt_template_schema_1 = require("../../schemas/prompt-template.schema");
let PromptResolverService = PromptResolverService_1 = class PromptResolverService {
    constructor(promptTemplateModel, redisService) {
        this.promptTemplateModel = promptTemplateModel;
        this.redisService = redisService;
        this.logger = new common_1.Logger(PromptResolverService_1.name);
        this.localPromptCache = new Map();
        this.localPromptExistence = new Map();
        this.localCacheTtlMs = Number(process.env.PROMPT_REGISTRY_LOCAL_CACHE_TTL_MS || 300000);
        this.redisReadTimeoutMs = Number(process.env.PROMPT_REGISTRY_REDIS_READ_TIMEOUT_MS || 250);
        this.redisBypassMs = Number(process.env.PROMPT_REGISTRY_REDIS_BYPASS_MS || 60000);
        this.redisBypassUntil = 0;
    }
    async resolve(input) {
        const scene = String(input.scene || '').trim();
        const role = String(input.role || '').trim();
        const defaultContent = String(input.defaultContent || '').trim();
        const sessionOverride = String(input.sessionOverride || '').trim();
        if (!scene || !role) {
            return { content: defaultContent, source: 'code_default' };
        }
        if (sessionOverride) {
            return { content: sessionOverride, source: 'session_override' };
        }
        const redisKey = this.cacheKey(scene, role);
        const cached = await this.readPublishedCache(scene, role, redisKey);
        if (cached) {
            return {
                content: cached.content,
                source: 'redis_cache',
                version: cached.version,
                updatedAt: cached.updatedAt,
            };
        }
        try {
            const published = await this.getLatestByStatus(scene, role, 'published');
            if (published?.content?.trim()) {
                const content = published.content.trim();
                await this.cachePublishedTemplate({
                    scene,
                    role,
                    content,
                    version: Number(published.version || 0) || undefined,
                    updatedAt: published.updatedAt,
                });
                return {
                    content,
                    source: 'db_published',
                    version: Number(published.version || 0) || undefined,
                    updatedAt: published.updatedAt ? new Date(published.updatedAt).toISOString() : undefined,
                };
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[prompt_registry_db_read_failed] scene=${scene} role=${role} error=${message}`);
        }
        return { content: defaultContent, source: 'code_default' };
    }
    async hasPublishedCache(scene, role) {
        const normalizedScene = String(scene || '').trim();
        const normalizedRole = String(role || '').trim();
        if (!normalizedScene || !normalizedRole) {
            return false;
        }
        const localKey = this.localCacheKey(normalizedScene, normalizedRole);
        const cachedExistence = this.localPromptExistence.get(localKey);
        if (cachedExistence && cachedExistence.expiresAt > Date.now()) {
            return cachedExistence.exists;
        }
        if (this.isRedisBypassed()) {
            this.localPromptExistence.set(localKey, {
                exists: false,
                expiresAt: Date.now() + this.localCacheTtlMs,
            });
            return false;
        }
        const redisKey = this.cacheKey(normalizedScene, normalizedRole);
        const cached = await this.readPublishedCache(normalizedScene, normalizedRole, redisKey);
        return Boolean(cached);
    }
    async cachePublishedTemplate(input) {
        const scene = String(input.scene || '').trim();
        const role = String(input.role || '').trim();
        const content = String(input.content || '').trim();
        if (!scene || !role || !content) {
            return;
        }
        const updatedAt = input.updatedAt ? new Date(input.updatedAt) : undefined;
        const payload = {
            content,
            version: Number(input.version || 0) || undefined,
            updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toISOString() : undefined,
        };
        this.setLocalPromptCache(scene, role, payload);
        await this.setCache(this.cacheKey(scene, role), {
            scene,
            role,
            content: payload.content,
            version: payload.version,
            updatedAt: payload.updatedAt,
        });
    }
    async clearPublishedCache(scene, role) {
        const normalizedScene = String(scene || '').trim();
        const normalizedRole = String(role || '').trim();
        if (!normalizedScene || !normalizedRole) {
            return;
        }
        this.clearLocalPromptCache(normalizedScene, normalizedRole);
        await this.redisService.del(this.cacheKey(normalizedScene, normalizedRole));
    }
    async refreshPublishedCache(scene, role) {
        const normalizedScene = String(scene || '').trim();
        const normalizedRole = String(role || '').trim();
        if (!normalizedScene || !normalizedRole) {
            return;
        }
        await this.clearPublishedCache(normalizedScene, normalizedRole);
        const published = await this.getLatestByStatus(normalizedScene, normalizedRole, 'published');
        if (!published?.content?.trim()) {
            return;
        }
        await this.cachePublishedTemplate({
            scene: normalizedScene,
            role: normalizedRole,
            content: published.content.trim(),
            version: Number(published.version || 0) || undefined,
            updatedAt: published.updatedAt,
        });
    }
    cacheKey(scene, role) {
        return `prompt-registry:scene:${scene}:role:${role}:published`;
    }
    localCacheKey(scene, role) {
        return `${scene}::${role}`;
    }
    isRedisBypassed() {
        return Date.now() < this.redisBypassUntil;
    }
    tripRedisBypass() {
        this.redisBypassUntil = Date.now() + this.redisBypassMs;
    }
    setLocalPromptCache(scene, role, payload) {
        const key = this.localCacheKey(scene, role);
        const expiresAt = Date.now() + this.localCacheTtlMs;
        this.localPromptCache.set(key, {
            payload,
            expiresAt,
        });
        this.localPromptExistence.set(key, {
            exists: true,
            expiresAt,
        });
    }
    clearLocalPromptCache(scene, role) {
        const key = this.localCacheKey(scene, role);
        this.localPromptCache.delete(key);
        this.localPromptExistence.delete(key);
    }
    async getRedisWithTimeout(key) {
        if (!Number.isFinite(this.redisReadTimeoutMs) || this.redisReadTimeoutMs <= 0) {
            const value = await this.redisService.get(key);
            return { status: 'ok', value };
        }
        return await Promise.race([
            this.redisService.get(key).then((value) => ({ status: 'ok', value })),
            new Promise((resolve) => {
                setTimeout(() => resolve({ status: 'timeout' }), this.redisReadTimeoutMs);
            }),
        ]);
    }
    async getLatestByStatus(scene, role, status) {
        return this.promptTemplateModel.findOne({ scene, role, status }).sort({ version: -1, updatedAt: -1 }).exec();
    }
    async setCache(key, value) {
        await this.redisService.set(key, JSON.stringify({
            ...value,
            cachedAt: new Date().toISOString(),
        }));
    }
    async readPublishedCache(scene, role, key) {
        const localKey = this.localCacheKey(scene, role);
        const localCached = this.localPromptCache.get(localKey);
        if (localCached && localCached.expiresAt > Date.now()) {
            return localCached.payload;
        }
        const localExistence = this.localPromptExistence.get(localKey);
        if (localExistence && localExistence.expiresAt > Date.now() && !localExistence.exists) {
            return null;
        }
        if (this.isRedisBypassed()) {
            this.localPromptExistence.set(localKey, {
                exists: false,
                expiresAt: Date.now() + this.localCacheTtlMs,
            });
            return null;
        }
        try {
            const redisResult = await this.getRedisWithTimeout(key);
            if (redisResult.status === 'timeout') {
                this.tripRedisBypass();
                this.localPromptExistence.set(localKey, {
                    exists: false,
                    expiresAt: Date.now() + this.localCacheTtlMs,
                });
                this.logger.warn(`[prompt_registry_cache_read_timeout] scene=${scene} role=${role} timeoutMs=${this.redisReadTimeoutMs} bypassMs=${this.redisBypassMs}`);
                return null;
            }
            const cached = redisResult.value;
            if (!cached) {
                this.localPromptExistence.set(localKey, {
                    exists: false,
                    expiresAt: Date.now() + this.localCacheTtlMs,
                });
                return null;
            }
            const parsed = JSON.parse(cached);
            const content = String(parsed?.content || '').trim();
            if (!content) {
                this.localPromptExistence.set(localKey, {
                    exists: false,
                    expiresAt: Date.now() + this.localCacheTtlMs,
                });
                return null;
            }
            const payload = {
                content,
                version: typeof parsed.version === 'number' ? parsed.version : undefined,
                updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
            };
            this.setLocalPromptCache(scene, role, payload);
            return payload;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            this.logger.warn(`[prompt_registry_cache_read_failed] scene=${scene} role=${role} error=${message}`);
            this.tripRedisBypass();
            this.localPromptExistence.set(localKey, {
                exists: false,
                expiresAt: Date.now() + this.localCacheTtlMs,
            });
            return null;
        }
    }
};
exports.PromptResolverService = PromptResolverService;
exports.PromptResolverService = PromptResolverService = PromptResolverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(prompt_template_schema_1.PromptTemplate.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        infra_1.RedisService])
], PromptResolverService);
//# sourceMappingURL=prompt-resolver.service.js.map