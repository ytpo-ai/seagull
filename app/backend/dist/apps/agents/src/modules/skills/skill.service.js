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
var SkillService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const crypto_1 = require("crypto");
const agent_schema_1 = require("../../schemas/agent.schema");
const agent_skill_schema_1 = require("../../schemas/agent-skill.schema");
const skill_doc_loader_service_1 = require("./skill-doc-loader.service");
const memo_event_bus_service_1 = require("../memos/memo-event-bus.service");
const infra_1 = require("../../../../../libs/infra/src/index");
let SkillService = SkillService_1 = class SkillService {
    constructor(skillModel, agentModel, skillDocLoaderService, memoEventBus, redisService) {
        this.skillModel = skillModel;
        this.agentModel = agentModel;
        this.skillDocLoaderService = skillDocLoaderService;
        this.memoEventBus = memoEventBus;
        this.redisService = redisService;
        this.logger = new common_1.Logger(SkillService_1.name);
        this.skillIndexCacheTtlSeconds = Math.max(60, Number(process.env.SKILL_INDEX_CACHE_TTL_SECONDS || 1800));
        this.skillDetailCacheTtlSeconds = Math.max(60, Number(process.env.SKILL_DETAIL_CACHE_TTL_SECONDS || 900));
        this.skillContentCacheTtlSeconds = Math.max(60, Number(process.env.SKILL_CONTENT_CACHE_TTL_SECONDS || 900));
    }
    async createSkill(payload) {
        if (!payload?.name?.trim()) {
            throw new common_1.BadRequestException('Skill name is required');
        }
        if (!payload?.description?.trim()) {
            throw new common_1.BadRequestException('Skill description is required');
        }
        const normalizedName = payload.name.trim();
        const slug = this.normalizeSlug(payload.slug || normalizedName);
        const normalizedContent = this.normalizeOptionalContent(payload.content);
        const contentHash = normalizedContent ? this.computeContentHash(normalizedContent) : undefined;
        const skill = await this.skillModel.create({
            id: (0, uuid_1.v4)(),
            name: normalizedName,
            slug,
            description: payload.description.trim(),
            category: payload.category?.trim() || 'general',
            tags: this.uniqueStrings(payload.tags || []),
            sourceType: payload.sourceType || 'manual',
            sourceUrl: payload.sourceUrl,
            provider: payload.provider || 'system',
            version: payload.version || '1.0.0',
            status: payload.status || 'active',
            confidenceScore: this.normalizeScore(payload.confidenceScore ?? 60),
            discoveredBy: payload.discoveredBy || 'AgentSkillManager',
            metadata: payload.metadata || {},
            metadataUpdatedAt: new Date(),
            content: normalizedContent,
            contentType: payload.contentType?.trim() || 'text/markdown',
            contentHash,
            contentSize: normalizedContent ? Buffer.byteLength(normalizedContent, 'utf8') : 0,
            contentUpdatedAt: normalizedContent ? new Date() : undefined,
            promptTemplateRef: this.normalizePromptTemplateRef(payload.promptTemplateRef),
            lastVerifiedAt: new Date(),
        });
        await this.cacheSkillIndex(skill);
        await this.cacheSkillDetail(skill, false);
        if (normalizedContent && contentHash) {
            await this.cacheSkillContent(skill.id, contentHash, {
                content: normalizedContent,
                contentType: skill.contentType || 'text/markdown',
                contentHash,
                contentUpdatedAt: skill.contentUpdatedAt,
                contentSize: skill.contentSize || Buffer.byteLength(normalizedContent, 'utf8'),
            });
        }
        return skill;
    }
    async getAllSkills(filters, options) {
        const query = this.buildSkillsQuery(filters);
        const projection = this.buildSkillProjection({
            includeContent: options?.includeContent,
            includeMetadata: options?.includeMetadata !== false,
        });
        return this.skillModel.find(query, projection).sort({ updatedAt: -1 }).exec();
    }
    async getSkillsPaged(filters, options) {
        const query = this.buildSkillsQuery(filters);
        const page = Math.max(1, Number(filters?.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(filters?.pageSize || 10)));
        const skip = (page - 1) * pageSize;
        const projection = this.buildSkillProjection({
            includeContent: options?.includeContent,
            includeMetadata: options?.includeMetadata !== false,
        });
        const [items, total] = await Promise.all([
            this.skillModel.find(query, projection).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).exec(),
            this.skillModel.countDocuments(query).exec(),
        ]);
        return {
            items: items,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    }
    async getSkillById(skillId, options) {
        const includeContent = options?.includeContent === true;
        if (!includeContent) {
            const cached = await this.loadSkillDetailFromCache(skillId);
            if (cached)
                return cached;
        }
        const projection = this.buildSkillProjection({
            includeContent,
            includeMetadata: options?.includeMetadata !== false,
        });
        const skill = await this.skillModel.findOne({ id: skillId }, projection).exec();
        if (!skill)
            throw new common_1.NotFoundException(`Skill not found: ${skillId}`);
        await this.cacheSkillIndex(skill);
        await this.cacheSkillDetail(skill, includeContent);
        return skill;
    }
    async getSkillContentById(skillId) {
        const latestHash = await this.redisService.get(this.skillContentLatestKey(skillId));
        if (latestHash) {
            const cached = await this.redisService.get(this.skillContentCacheKey(skillId, latestHash));
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed?.contentHash && typeof parsed.content === 'string') {
                        return {
                            id: skillId,
                            content: parsed.content,
                            contentType: parsed.contentType || 'text/markdown',
                            contentHash: parsed.contentHash,
                            contentSize: Number(parsed.contentSize || 0),
                            contentUpdatedAt: parsed.contentUpdatedAt ? new Date(parsed.contentUpdatedAt) : undefined,
                        };
                    }
                }
                catch {
                }
            }
        }
        const skill = await this.skillModel
            .findOne({ id: skillId }, { id: 1, content: 1, contentType: 1, contentHash: 1, contentSize: 1, contentUpdatedAt: 1 })
            .exec();
        if (!skill)
            throw new common_1.NotFoundException(`Skill not found: ${skillId}`);
        const content = this.normalizeOptionalContent(skill.content);
        if (!content) {
            throw new common_1.NotFoundException(`Skill content not found: ${skillId}`);
        }
        const contentHash = String(skill.contentHash || this.computeContentHash(content));
        const result = {
            id: skillId,
            content,
            contentType: String(skill.contentType || 'text/markdown'),
            contentHash,
            contentSize: Number(skill.contentSize || Buffer.byteLength(content, 'utf8')),
            contentUpdatedAt: skill.contentUpdatedAt,
        };
        await this.cacheSkillContent(skillId, contentHash, result);
        return result;
    }
    async updateSkill(skillId, updates) {
        const existed = await this.getSkillById(skillId, { includeContent: true });
        const updatePayload = {
            ...updates,
            updatedAt: new Date(),
        };
        if (updates.name) {
            updatePayload.name = updates.name.trim();
        }
        if (updates.description) {
            updatePayload.description = updates.description.trim();
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'slug')) {
            updatePayload.slug = this.normalizeSlug((updates.slug || updatePayload.name || existed.name));
        }
        if (updates.tags) {
            updatePayload.tags = this.uniqueStrings(updates.tags);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
            updatePayload.metadata = updates.metadata || {};
            updatePayload.metadataUpdatedAt = new Date();
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'content')) {
            const normalizedContent = this.normalizeOptionalContent(updates.content);
            updatePayload.content = normalizedContent;
            updatePayload.contentType = updates.contentType?.trim() || existed.contentType || 'text/markdown';
            updatePayload.contentHash = normalizedContent ? this.computeContentHash(normalizedContent) : undefined;
            updatePayload.contentSize = normalizedContent ? Buffer.byteLength(normalizedContent, 'utf8') : 0;
            updatePayload.contentUpdatedAt = new Date();
        }
        else if (Object.prototype.hasOwnProperty.call(updates, 'contentType') && updates.contentType?.trim()) {
            updatePayload.contentType = updates.contentType.trim();
        }
        if (typeof updates.confidenceScore === 'number') {
            updatePayload.confidenceScore = this.normalizeScore(updates.confidenceScore);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'promptTemplateRef')) {
            const normalizedPromptTemplateRef = this.normalizePromptTemplateRef(updates.promptTemplateRef);
            if (normalizedPromptTemplateRef) {
                updatePayload.promptTemplateRef = normalizedPromptTemplateRef;
            }
            else {
                updatePayload.$unset = {
                    ...(updatePayload.$unset || {}),
                    promptTemplateRef: 1,
                };
            }
        }
        const skill = await this.skillModel.findOneAndUpdate({ id: skillId }, updatePayload, { new: true }).exec();
        if (!skill) {
            throw new common_1.NotFoundException(`Skill not found: ${skillId}`);
        }
        await this.invalidateSkillCaches(existed);
        await this.cacheSkillIndex(skill);
        await this.cacheSkillDetail(skill, false);
        const nextContent = this.normalizeOptionalContent(skill.content);
        const nextHash = String(skill.contentHash || '');
        if (nextContent && nextHash) {
            await this.cacheSkillContent(skill.id, nextHash, {
                content: nextContent,
                contentType: String(skill.contentType || 'text/markdown'),
                contentHash: nextHash,
                contentSize: Number(skill.contentSize || Buffer.byteLength(nextContent, 'utf8')),
                contentUpdatedAt: skill.contentUpdatedAt,
            });
        }
        await this.invalidateEnabledSkillCacheBySkillIds([skillId]);
        return skill;
    }
    async deleteSkill(skillId) {
        const existed = await this.skillModel.findOne({ id: skillId }).exec();
        if (!existed)
            return false;
        await this.invalidateEnabledSkillCacheBySkillIds([skillId]);
        await this.invalidateSkillCaches(existed);
        await this.skillModel.deleteOne({ id: skillId }).exec();
        await this.agentModel.updateMany({ skills: skillId }, { $pull: { skills: skillId } }).exec();
        return true;
    }
    async assignSkillToAgent(agentId, skillId, payload) {
        const agent = await this.findAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        await this.getSkillById(skillId);
        const enabled = payload?.enabled ?? true;
        const update = enabled
            ? { $addToSet: { skills: skillId } }
            : { $pull: { skills: skillId } };
        const updatedAgent = await this.agentModel
            .findOneAndUpdate({ _id: agent._id }, update, { new: true })
            .exec();
        this.memoEventBus.emit({
            name: 'agent.skill_changed',
            agentId,
            memoKinds: ['identity', 'custom'],
        });
        await this.invalidateEnabledSkillCacheByAgentIds([agentId]);
        return {
            agentId,
            skillId,
            enabled,
            skills: this.uniqueStrings((updatedAgent?.skills || []).map((item) => String(item || '').trim())),
        };
    }
    async getAgentSkills(agentId) {
        const agent = await this.findAgent(agentId);
        if (!agent) {
            throw new common_1.NotFoundException(`Agent not found: ${agentId}`);
        }
        const skillIds = this.uniqueStrings((agent.skills || []).map((item) => String(item || '').trim()));
        if (!skillIds.length)
            return [];
        const skills = await this.skillModel.find({ id: { $in: skillIds } }).exec();
        const skillMap = new Map(skills.map((item) => [item.id, item]));
        return skillIds.map((skillId) => ({
            skillId,
            skill: skillMap.get(skillId) || null,
        }));
    }
    async getSkillAgents(skillId) {
        const agents = await this.agentModel
            .find({ skills: skillId })
            .sort({ updatedAt: -1 })
            .select({ id: 1, name: 1 })
            .lean()
            .exec();
        return (agents || []).map((agent) => ({
            id: String(agent.id || agent._id || ''),
            name: String(agent.name || ''),
        }));
    }
    async getAllSkillAgents() {
        const agents = await this.agentModel
            .find({ skills: { $exists: true, $ne: [] } })
            .select({ id: 1, name: 1, skills: 1 })
            .lean()
            .exec();
        const result = {};
        for (const agent of agents) {
            const agentId = String(agent.id || agent._id || '').trim();
            if (!agentId)
                continue;
            const agentName = String(agent.name || agentId);
            const skillIds = this.uniqueStrings((agent.skills || []).map((item) => String(item || '').trim()));
            for (const skillId of skillIds) {
                if (!result[skillId]) {
                    result[skillId] = [];
                }
                result[skillId].push({ agentId, agentName });
            }
        }
        return result;
    }
    async syncSkillDocsToDb() {
        const docs = await this.skillDocLoaderService.loadDocs();
        const result = {
            scanned: docs.length,
            inserted: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
        };
        for (const doc of docs) {
            const synced = await this.syncSingleSkillDoc(doc);
            result.inserted += synced.inserted;
            result.updated += synced.updated;
            result.skipped += synced.skipped;
            result.failed += synced.failed;
        }
        return result;
    }
    normalizeSlug(value) {
        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        if (!normalized) {
            throw new common_1.BadRequestException('Invalid skill slug');
        }
        return normalized;
    }
    normalizeScore(score) {
        return Math.max(0, Math.min(100, Math.round(Number(score || 0))));
    }
    uniqueStrings(items) {
        const normalized = items.map((item) => String(item || '').trim()).filter(Boolean);
        return Array.from(new Set(normalized));
    }
    buildSkillProjection(options) {
        const projection = {};
        if (options?.includeContent !== true) {
            projection.content = 0;
        }
        if (options?.includeMetadata !== true) {
            projection.metadata = 0;
        }
        return Object.keys(projection).length ? projection : undefined;
    }
    normalizeOptionalContent(content) {
        if (typeof content !== 'string')
            return undefined;
        const normalized = content.trim();
        return normalized.length ? normalized : undefined;
    }
    normalizePromptTemplateRef(input) {
        if (input === undefined || input === null) {
            return undefined;
        }
        if (typeof input !== 'object' || Array.isArray(input)) {
            throw new common_1.BadRequestException('promptTemplateRef must be an object with scene and role');
        }
        const scene = String(input.scene || '').trim();
        const role = String(input.role || '').trim();
        if (!scene || !role) {
            throw new common_1.BadRequestException('promptTemplateRef requires non-empty scene and role');
        }
        return { scene, role };
    }
    computeContentHash(content) {
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    skillIndexCacheKey(slug) {
        return `skill:index:${slug}`;
    }
    skillDetailCacheKey(skillId) {
        return `skill:detail:${skillId}`;
    }
    skillContentLatestKey(skillId) {
        return `skill:content:latest:${skillId}`;
    }
    skillContentCacheKey(skillId, contentHash) {
        return `skill:content:${skillId}:${contentHash}`;
    }
    async cacheSkillIndex(skill) {
        const payload = {
            id: skill.id,
            slug: skill.slug,
            name: skill.name,
            description: skill.description,
            status: skill.status,
            category: skill.category,
            tags: skill.tags || [],
            provider: skill.provider,
            version: skill.version,
            metadata: skill.metadata || {},
            updatedAt: skill.updatedAt,
        };
        await this.redisService.set(this.skillIndexCacheKey(skill.slug), JSON.stringify(payload), this.skillIndexCacheTtlSeconds);
    }
    async cacheSkillDetail(skill, includeContent) {
        const payload = this.toPlainSkill(skill);
        if (!includeContent) {
            delete payload.content;
        }
        await this.redisService.set(this.skillDetailCacheKey(skill.id), JSON.stringify(payload), this.skillDetailCacheTtlSeconds);
    }
    async loadSkillDetailFromCache(skillId) {
        const cached = await this.redisService.get(this.skillDetailCacheKey(skillId));
        if (!cached)
            return null;
        try {
            return JSON.parse(cached);
        }
        catch {
            return null;
        }
    }
    async cacheSkillContent(skillId, contentHash, payload) {
        await this.redisService.set(this.skillContentCacheKey(skillId, contentHash), JSON.stringify(payload), this.skillContentCacheTtlSeconds);
        await this.redisService.set(this.skillContentLatestKey(skillId), contentHash, this.skillContentCacheTtlSeconds);
    }
    async invalidateSkillContentCache(skillId, oldHash) {
        if (oldHash?.trim()) {
            await this.redisService.del(this.skillContentCacheKey(skillId, oldHash.trim()));
        }
        const latestHash = await this.redisService.get(this.skillContentLatestKey(skillId));
        if (latestHash?.trim()) {
            await this.redisService.del(this.skillContentCacheKey(skillId, latestHash.trim()));
        }
        await this.redisService.del(this.skillContentLatestKey(skillId));
    }
    async invalidateSkillCaches(skill) {
        await this.redisService.del(this.skillIndexCacheKey(skill.slug));
        await this.redisService.del(this.skillDetailCacheKey(skill.id));
        await this.invalidateSkillContentCache(skill.id, skill.contentHash);
    }
    toPlainSkill(skill) {
        const doc = skill;
        if (typeof doc?.toObject === 'function') {
            return doc.toObject();
        }
        return { ...doc };
    }
    async invalidateEnabledSkillCacheBySkillIds(skillIds) {
        const normalizedSkillIds = this.uniqueStrings(skillIds || []);
        if (!normalizedSkillIds.length)
            return;
        const agents = await this.agentModel
            .find({ skills: { $in: normalizedSkillIds } })
            .select({ id: 1, _id: 1 })
            .lean()
            .exec();
        const agentIds = (agents || [])
            .map((item) => String(item.id || item._id || '').trim())
            .filter(Boolean);
        await this.invalidateEnabledSkillCacheByAgentIds(agentIds);
    }
    async invalidateEnabledSkillCacheByAgentIds(agentIds) {
        const normalizedAgentIds = this.uniqueStrings(agentIds || []);
        if (!normalizedAgentIds.length)
            return;
        await Promise.all(normalizedAgentIds.map((agentId) => this.redisService.del(this.enabledSkillCacheKey(agentId))));
    }
    enabledSkillCacheKey(agentId) {
        return `agent:enabled-skills:${agentId}`;
    }
    buildSkillsQuery(filters) {
        const query = {};
        if (filters?.status)
            query.status = filters.status;
        if (filters?.category?.trim())
            query.category = filters.category.trim();
        if (filters?.search?.trim()) {
            const escaped = this.escapeRegex(filters.search.trim());
            const regex = new RegExp(escaped, 'i');
            query.$or = [
                { name: regex },
                { description: regex },
                { category: regex },
                { provider: regex },
                { version: regex },
                { tags: regex },
            ];
        }
        return query;
    }
    escapeRegex(input) {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    async findAgent(agentId) {
        const byId = await this.agentModel.findById(agentId).exec();
        if (byId)
            return byId;
        return this.agentModel.findOne({ id: agentId }).exec();
    }
    async syncSingleSkillDoc(doc) {
        const slug = this.normalizeSkillDocSlug(doc);
        const name = doc.name?.trim();
        const description = doc.description?.trim();
        if (!slug || !name || !description) {
            this.logger.warn(`Skip invalid skill doc: ${doc.filePath}`);
            return { inserted: 0, updated: 0, skipped: 1, failed: 0 };
        }
        try {
            const existed = await this.skillModel.findOne({ slug }).exec();
            const payload = this.buildSkillDocUpdatePayload(doc, {
                slug,
                name,
                description,
            });
            if (!existed) {
                const created = await this.skillModel.create({
                    id: (0, uuid_1.v4)(),
                    ...payload,
                });
                await this.cacheSkillIndex(created);
                await this.cacheSkillDetail(created, false);
                if (payload.content && payload.contentHash) {
                    await this.cacheSkillContent(created.id, payload.contentHash, {
                        content: payload.content,
                        contentType: payload.contentType,
                        contentHash: payload.contentHash,
                        contentSize: payload.contentSize,
                        contentUpdatedAt: payload.contentUpdatedAt,
                    });
                }
                return { inserted: 1, updated: 0, skipped: 0, failed: 0 };
            }
            const contentChanged = String(existed.contentHash || '') !== String(payload.contentHash || '');
            const metadataChanged = this.hasMetadataChanged(existed, payload);
            if (!contentChanged && !metadataChanged) {
                return { inserted: 0, updated: 0, skipped: 1, failed: 0 };
            }
            const updated = await this.skillModel.findOneAndUpdate({ id: existed.id }, payload, { new: true }).exec();
            if (!updated) {
                return { inserted: 0, updated: 0, skipped: 0, failed: 1 };
            }
            await this.invalidateSkillCaches(existed);
            await this.cacheSkillIndex(updated);
            await this.cacheSkillDetail(updated, false);
            if (payload.content && payload.contentHash) {
                await this.cacheSkillContent(updated.id, payload.contentHash, {
                    content: payload.content,
                    contentType: payload.contentType,
                    contentHash: payload.contentHash,
                    contentSize: payload.contentSize,
                    contentUpdatedAt: payload.contentUpdatedAt,
                });
            }
            await this.invalidateEnabledSkillCacheBySkillIds([updated.id]);
            return { inserted: 0, updated: 1, skipped: 0, failed: 0 };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed syncing skill doc ${doc.filePath}: ${message}`);
            return { inserted: 0, updated: 0, skipped: 0, failed: 1 };
        }
    }
    normalizeSkillDocSlug(doc) {
        const source = doc.slug?.trim() || doc.name?.trim();
        if (!source)
            return null;
        try {
            return this.normalizeSlug(source);
        }
        catch {
            return null;
        }
    }
    buildSkillDocUpdatePayload(doc, normalized) {
        const now = new Date();
        return {
            slug: normalized.slug,
            name: normalized.name,
            description: normalized.description,
            category: doc.category?.trim() || 'general',
            tags: this.uniqueStrings(doc.tags || []),
            sourceType: doc.sourceType || 'manual',
            sourceUrl: doc.sourceUrl?.trim(),
            provider: doc.provider?.trim() || 'system',
            version: doc.version?.trim() || '1.0.0',
            status: doc.status || 'active',
            confidenceScore: this.normalizeScore(doc.confidenceScore ?? 60),
            discoveredBy: doc.discoveredBy?.trim() || 'SkillDocSync',
            metadata: doc.metadata || {},
            metadataUpdatedAt: now,
            content: doc.content,
            contentType: doc.contentType || 'text/markdown',
            contentHash: doc.contentHash,
            contentSize: doc.contentSize || 0,
            contentUpdatedAt: doc.content ? now : undefined,
            lastVerifiedAt: now,
            updatedAt: now,
        };
    }
    hasMetadataChanged(existed, next) {
        const keys = [
            'name',
            'slug',
            'description',
            'category',
            'sourceType',
            'sourceUrl',
            'provider',
            'version',
            'status',
            'confidenceScore',
            'discoveredBy',
            'contentType',
            'contentSize',
            'contentHash',
        ];
        for (const key of keys) {
            if (String(existed[key] || '') !== String(next[key] || '')) {
                return true;
            }
        }
        const existedTags = this.uniqueStrings((existed.tags || []).map((tag) => String(tag || '')));
        const nextTags = this.uniqueStrings((next.tags || []).map((tag) => String(tag || '')));
        if (JSON.stringify(existedTags) !== JSON.stringify(nextTags)) {
            return true;
        }
        const existedMetadata = existed.metadata || {};
        const nextMetadata = next.metadata || {};
        return JSON.stringify(existedMetadata) !== JSON.stringify(nextMetadata);
    }
};
exports.SkillService = SkillService;
exports.SkillService = SkillService = SkillService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_skill_schema_1.Skill.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        skill_doc_loader_service_1.SkillDocLoaderService,
        memo_event_bus_service_1.MemoEventBusService,
        infra_1.RedisService])
], SkillService);
//# sourceMappingURL=skill.service.js.map