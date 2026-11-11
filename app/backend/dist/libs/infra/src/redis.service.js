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
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const common_2 = require("../../common/src/index");
let RedisService = RedisService_1 = class RedisService {
    constructor() {
        this.logger = (0, common_2.createServiceLogger)(RedisService_1.name);
        this.redisUrl = this.buildRedisUrl();
        this.sanitizedRedisUrl = this.sanitizeRedisUrl(this.redisUrl);
        this.slowOpThresholdMs = Math.max(1, Number(process.env.REDIS_SLOW_OP_THRESHOLD_MS || 200));
        this.listeners = new Map();
        this.ready = false;
        const redisOptions = {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
        };
        this.publisher = new ioredis_1.default(this.redisUrl, redisOptions);
        this.subscriber = new ioredis_1.default(this.redisUrl, redisOptions);
        this.blockingClient = new ioredis_1.default(this.redisUrl, redisOptions);
        this.publisher.on('error', (err) => {
            this.ready = false;
            this.logger.warn(`Redis publisher unavailable: ${err.message}`);
        });
        this.subscriber.on('error', (err) => {
            this.ready = false;
            this.logger.warn(`Redis subscriber unavailable: ${err.message}`);
        });
        this.blockingClient.on('error', (err) => {
            this.ready = false;
            this.logger.warn(`Redis blocking client unavailable: ${err.message}`);
        });
        this.subscriber.on('message', (channel, message) => {
            const channelListeners = this.listeners.get(channel);
            if (!channelListeners)
                return;
            channelListeners.forEach((listener) => listener(message));
        });
        void this.initialize();
    }
    buildRedisUrl() {
        const password = process.env.REDIS_PASSWORD || '';
        const db = process.env.REDIS_DB || '0';
        const rawUrl = process.env.REDIS_URL;
        if (rawUrl) {
            try {
                const parsed = new URL(rawUrl);
                if (!parsed.password && password) {
                    parsed.password = password;
                }
                if (!parsed.pathname || parsed.pathname === '/') {
                    parsed.pathname = `/${db}`;
                }
                return parsed.toString();
            }
            catch {
            }
        }
        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = process.env.REDIS_PORT || '6379';
        const authPart = password ? `:${encodeURIComponent(password)}@` : '';
        return `redis://${authPart}${host}:${port}/${db}`;
    }
    async initialize() {
        try {
            await this.publisher.connect();
            await this.subscriber.connect();
            await this.blockingClient.connect();
            this.ready = true;
            this.logger.log(`Redis connected: ${this.sanitizedRedisUrl}`);
        }
        catch (error) {
            this.ready = false;
            const message = error instanceof Error ? error.message : 'Unknown redis connection error';
            this.logger.warn(`Redis disabled, falling back to no-op bus: ${message}`);
        }
    }
    sanitizeRedisUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.password) {
                parsed.password = '***';
            }
            return parsed.toString();
        }
        catch {
            return url.replace(/(redis:\/\/:)[^@]*@/, '$1***@');
        }
    }
    async publish(channel, payload) {
        if (!this.ready)
            return 0;
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return this.publisher.publish(channel, message);
    }
    async set(key, value, ttlSeconds) {
        if (!this.ready)
            return;
        const startedAt = Date.now();
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await this.publisher.set(key, value, 'EX', ttlSeconds);
            }
            else {
                await this.publisher.set(key, value);
            }
            this.logSlowRedisOp('set', key, startedAt, {
                ttlSeconds: ttlSeconds && ttlSeconds > 0 ? ttlSeconds : undefined,
                valueBytes: Buffer.byteLength(value || '', 'utf8'),
            });
            return;
        }
        catch (error) {
            this.logRedisOpError('set', key, startedAt, error);
            throw error;
        }
    }
    async setnx(key, value, ttlSeconds) {
        if (!this.ready)
            return false;
        const ttl = Math.max(1, Number(ttlSeconds || 1));
        const startedAt = Date.now();
        try {
            const result = await this.publisher.set(key, value, 'EX', String(ttl), 'NX');
            this.logSlowRedisOp('setnx', key, startedAt, {
                ttlSeconds: ttl,
                acquired: result === 'OK',
            });
            return result === 'OK';
        }
        catch (error) {
            this.logRedisOpError('setnx', key, startedAt, error);
            throw error;
        }
    }
    async get(key) {
        if (!this.ready)
            return null;
        const startedAt = Date.now();
        try {
            const value = await this.publisher.get(key);
            this.logSlowRedisOp('get', key, startedAt, {
                hit: Boolean(value),
                valueBytes: value ? Buffer.byteLength(value, 'utf8') : 0,
            });
            return value;
        }
        catch (error) {
            this.logRedisOpError('get', key, startedAt, error);
            throw error;
        }
    }
    async getdel(key) {
        if (!this.ready)
            return null;
        const startedAt = Date.now();
        try {
            const value = await this.publisher.call('GETDEL', key);
            const normalizedValue = typeof value === 'string' ? value : null;
            this.logSlowRedisOp('getdel', key, startedAt, {
                hit: Boolean(normalizedValue),
                valueBytes: normalizedValue ? Buffer.byteLength(normalizedValue, 'utf8') : 0,
            });
            return normalizedValue;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            if (message.toLowerCase().includes('unknown command')) {
                const value = await this.publisher.eval('local v = redis.call("GET", KEYS[1]); if v then redis.call("DEL", KEYS[1]); end; return v;', 1, key);
                const normalizedValue = typeof value === 'string' ? value : null;
                this.logSlowRedisOp('getdel', key, startedAt, {
                    hit: Boolean(normalizedValue),
                    fallback: 'lua',
                    valueBytes: normalizedValue ? Buffer.byteLength(normalizedValue, 'utf8') : 0,
                });
                return normalizedValue;
            }
            this.logRedisOpError('getdel', key, startedAt, error);
            throw error;
        }
    }
    async del(key) {
        if (!this.ready)
            return 0;
        return this.publisher.del(key);
    }
    async delMany(keys) {
        if (!this.ready)
            return 0;
        if (!keys.length)
            return 0;
        return this.publisher.del(...keys);
    }
    async keys(pattern) {
        if (!this.ready)
            return [];
        return this.publisher.keys(pattern);
    }
    async expire(key, ttlSeconds) {
        if (!this.ready)
            return 0;
        if (!ttlSeconds || ttlSeconds <= 0)
            return 0;
        return this.publisher.expire(key, ttlSeconds);
    }
    async lpush(key, value) {
        if (!this.ready)
            return 0;
        const startedAt = Date.now();
        try {
            const nextLength = await this.publisher.lpush(key, value);
            this.logSlowRedisOp('lpush', key, startedAt, {
                valueBytes: Buffer.byteLength(value || '', 'utf8'),
                nextLength,
            });
            return nextLength;
        }
        catch (error) {
            this.logRedisOpError('lpush', key, startedAt, error);
            throw error;
        }
    }
    async sadd(key, members) {
        if (!this.ready)
            return 0;
        if (!members.length)
            return 0;
        return this.publisher.sadd(key, ...members);
    }
    async srem(key, members) {
        if (!this.ready)
            return 0;
        if (!members.length)
            return 0;
        return this.publisher.srem(key, ...members);
    }
    async smembers(key) {
        if (!this.ready)
            return [];
        return this.publisher.smembers(key);
    }
    async sunion(keys) {
        if (!this.ready)
            return [];
        if (!keys.length)
            return [];
        return this.publisher.sunion(...keys);
    }
    async hset(key, values) {
        if (!this.ready)
            return 0;
        if (!Object.keys(values).length)
            return 0;
        return this.publisher.hset(key, values);
    }
    async hgetall(key) {
        if (!this.ready)
            return {};
        return this.publisher.hgetall(key);
    }
    async zadd(key, score, member) {
        if (!this.ready)
            return 0;
        return this.publisher.zadd(key, String(score), member);
    }
    async zrevrange(key, start, stop) {
        if (!this.ready)
            return [];
        return this.publisher.zrevrange(key, start, stop);
    }
    async incr(key) {
        if (!this.ready)
            return 0;
        return this.publisher.incr(key);
    }
    async lrange(key, start, stop) {
        if (!this.ready)
            return [];
        return this.publisher.lrange(key, start, stop);
    }
    async llen(key) {
        if (!this.ready)
            return 0;
        return this.publisher.llen(key);
    }
    async ltrim(key, start, stop) {
        if (!this.ready)
            return null;
        return this.publisher.ltrim(key, start, stop);
    }
    async brpop(key, timeoutSeconds = 1) {
        if (!this.ready)
            return null;
        const startedAt = Date.now();
        try {
            const response = await this.blockingClient.brpop(key, timeoutSeconds);
            const hit = Boolean(response && response.length >= 2);
            if (hit) {
                this.logSlowRedisOp('brpop', key, startedAt, {
                    timeoutSeconds,
                    hit,
                });
            }
            if (!response || response.length < 2) {
                return null;
            }
            return response[1] || null;
        }
        catch (error) {
            this.logRedisOpError('brpop', key, startedAt, error);
            throw error;
        }
    }
    async xadd(streamKey, fields, options) {
        if (!this.ready)
            return null;
        const startedAt = Date.now();
        try {
            const args = [];
            if (options?.maxLen && options.maxLen > 0) {
                args.push('MAXLEN');
                if (options.approximate !== false) {
                    args.push('~');
                }
                args.push(String(options.maxLen));
            }
            const messageId = options?.id || '*';
            const flattenedFields = Object.entries(fields || {}).flatMap(([key, value]) => [key, value]);
            if (!flattenedFields.length) {
                throw new Error('xadd requires at least one field');
            }
            const streamId = await this.publisher.xadd(streamKey, ...args, messageId, ...flattenedFields);
            this.logSlowRedisOp('xadd', streamKey, startedAt, {
                fieldCount: flattenedFields.length / 2,
            });
            return typeof streamId === 'string' ? streamId : null;
        }
        catch (error) {
            this.logRedisOpError('xadd', streamKey, startedAt, error);
            throw error;
        }
    }
    async xgroupCreate(streamKey, groupName, startId = '0', mkstream = true) {
        if (!this.ready)
            return;
        const startedAt = Date.now();
        try {
            const args = ['CREATE', streamKey, groupName, startId];
            if (mkstream) {
                args.push('MKSTREAM');
            }
            await this.publisher.xgroup(...args);
            this.logSlowRedisOp('xgroup_create', streamKey, startedAt, {
                groupName,
                startId,
                mkstream,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown');
            if (message.includes('BUSYGROUP')) {
                return;
            }
            this.logRedisOpError('xgroup_create', streamKey, startedAt, error);
            throw error;
        }
    }
    async xreadgroup(streamKey, groupName, consumerName, options) {
        if (!this.ready)
            return [];
        const startedAt = Date.now();
        try {
            const count = Math.max(1, Number(options?.count || 10));
            const blockMs = Math.max(0, Number(options?.blockMs || 2000));
            const streamId = options?.streamId || '>';
            const response = await this.blockingClient.xreadgroup('GROUP', groupName, consumerName, 'COUNT', String(count), 'BLOCK', String(blockMs), 'STREAMS', streamKey, streamId);
            const result = this.parseXreadgroupResponse(response);
            if (result.length > 0) {
                this.logSlowRedisOp('xreadgroup', streamKey, startedAt, {
                    groupName,
                    consumerName,
                    count,
                    blockMs,
                    fetched: result.reduce((sum, item) => sum + item.messages.length, 0),
                });
            }
            return result;
        }
        catch (error) {
            this.logRedisOpError('xreadgroup', streamKey, startedAt, error);
            throw error;
        }
    }
    async xack(streamKey, groupName, messageIds) {
        if (!this.ready)
            return 0;
        if (!messageIds.length)
            return 0;
        const startedAt = Date.now();
        try {
            const acknowledged = await this.publisher.xack(streamKey, groupName, ...messageIds);
            this.logSlowRedisOp('xack', streamKey, startedAt, {
                groupName,
                acked: Number(acknowledged || 0),
            });
            return Number(acknowledged || 0);
        }
        catch (error) {
            this.logRedisOpError('xack', streamKey, startedAt, error);
            throw error;
        }
    }
    async subscribe(channel, listener) {
        if (!this.ready)
            return;
        const existing = this.listeners.get(channel) || new Set();
        const needsSubscribe = existing.size === 0;
        existing.add(listener);
        this.listeners.set(channel, existing);
        if (needsSubscribe) {
            await this.subscriber.subscribe(channel);
        }
    }
    async unsubscribe(channel, listener) {
        if (!this.ready)
            return;
        const existing = this.listeners.get(channel);
        if (!existing)
            return;
        existing.delete(listener);
        if (existing.size > 0)
            return;
        this.listeners.delete(channel);
        await this.subscriber.unsubscribe(channel);
    }
    isReady() {
        return this.ready;
    }
    parseXreadgroupResponse(raw) {
        if (!Array.isArray(raw)) {
            return [];
        }
        const result = [];
        for (const streamItem of raw) {
            if (!Array.isArray(streamItem) || streamItem.length < 2) {
                continue;
            }
            const stream = String(streamItem[0] || '').trim();
            const entries = Array.isArray(streamItem[1]) ? streamItem[1] : [];
            if (!stream) {
                continue;
            }
            const messages = [];
            for (const entry of entries) {
                if (!Array.isArray(entry) || entry.length < 2) {
                    continue;
                }
                const id = String(entry[0] || '').trim();
                const fieldsArray = Array.isArray(entry[1]) ? entry[1] : [];
                if (!id || fieldsArray.length === 0) {
                    continue;
                }
                const fields = {};
                for (let i = 0; i < fieldsArray.length; i += 2) {
                    const key = String(fieldsArray[i] || '').trim();
                    if (!key) {
                        continue;
                    }
                    fields[key] = String(fieldsArray[i + 1] ?? '');
                }
                messages.push({ id, fields });
            }
            result.push({ stream, messages });
        }
        return result;
    }
    normalizeKeyForLog(key) {
        const normalized = String(key || '').trim();
        if (!normalized)
            return 'empty';
        if (normalized.length <= 96)
            return normalized;
        return `${normalized.slice(0, 96)}...`;
    }
    logSlowRedisOp(op, key, startedAt, extras) {
        const durationMs = Date.now() - startedAt;
        if (durationMs < this.slowOpThresholdMs) {
            return;
        }
        const extraText = extras
            ? Object.entries(extras)
                .filter(([, value]) => value !== undefined)
                .map(([name, value]) => `${name}=${String(value)}`)
                .join(' ')
            : '';
        this.logger.warn(`[redis_slow_op] op=${op} key=${this.normalizeKeyForLog(key)} durationMs=${durationMs} publisherStatus=${this.publisher.status} subscriberStatus=${this.subscriber.status} blockingStatus=${this.blockingClient.status} ready=${this.ready}${extraText ? ` ${extraText}` : ''}`);
    }
    logRedisOpError(op, key, startedAt, error) {
        const message = error instanceof Error ? error.message : String(error || 'unknown');
        const durationMs = Date.now() - startedAt;
        this.logger.warn(`[redis_op_failed] op=${op} key=${this.normalizeKeyForLog(key)} durationMs=${durationMs} publisherStatus=${this.publisher.status} subscriberStatus=${this.subscriber.status} blockingStatus=${this.blockingClient.status} ready=${this.ready} error=${message}`);
    }
    async onModuleDestroy() {
        try {
            if (this.publisher.status === 'ready') {
                await this.publisher.quit();
            }
            if (this.subscriber.status === 'ready') {
                await this.subscriber.quit();
            }
            if (this.blockingClient.status === 'ready') {
                await this.blockingClient.quit();
            }
        }
        catch {
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisService);
//# sourceMappingURL=redis.service.js.map