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
var MemoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const infra_1 = require("../../../../../libs/infra/src/index");
const mongoose_2 = require("mongoose");
const uuid_1 = require("uuid");
const agent_memo_schema_1 = require("../../schemas/agent-memo.schema");
const memo_doc_sync_service_1 = require("./memo-doc-sync.service");
const memo_task_history_service_1 = require("./memo-task-history.service");
const memo_task_todo_service_1 = require("./memo-task-todo.service");
const EVENT_KEY_PREFIX = 'memo:event:';
const REFRESH_KEY_PREFIX = 'memo:refresh:queue';
const EVENT_QUEUE_TTL_SECONDS = 7 * 24 * 3600;
const EVENT_QUEUE_MAX = 1000;
const HISTORY_STATUSES = new Set(['running', 'success', 'failed', 'cancelled']);
let MemoService = MemoService_1 = class MemoService {
    constructor(memoModel, memoDocSyncService, redisService, memoTaskTodoService, memoTaskHistoryService) {
        this.memoModel = memoModel;
        this.memoDocSyncService = memoDocSyncService;
        this.redisService = redisService;
        this.memoTaskTodoService = memoTaskTodoService;
        this.memoTaskHistoryService = memoTaskHistoryService;
        this.logger = new common_1.Logger(MemoService_1.name);
        this.topicAggregationEnabled = String(process.env.MEMO_TOPIC_AGGREGATION_ENABLED || 'false').toLowerCase() === 'true';
        this.achievementAllowedRoles = [
            'executive',
            'executive-lead',
            'management-assistant',
            'human-exclusive-assistant',
            'hr',
            'human-resources',
            'human-resources-manager',
        ];
        this.criticismAllowedRoles = [...this.achievementAllowedRoles, 'agent'];
        this.appendOnlyMemoKinds = ['achievement', 'criticism'];
    }
    async createMemo(payload, options) {
        if (!payload?.agentId?.trim())
            throw new common_1.BadRequestException('agentId is required');
        if (!payload?.title?.trim())
            throw new common_1.BadRequestException('title is required');
        if (!payload?.content?.trim())
            throw new common_1.BadRequestException('content is required');
        const agentId = payload.agentId.trim();
        this.assertMemoTypeKindCompatibility(payload.memoKind, payload.memoType, 'create');
        const defaults = this.resolveMemoDefaults(payload.memoKind, payload.memoType);
        if (!options?.skipRolePermissionCheck) {
            this.assertMemoWritePermission(defaults.memoKind, agentId, payload.source, options?.actor);
        }
        if (!options?.skipEnsureCoreDocs) {
            await this.ensureCoreDocuments(agentId);
        }
        const nextPayload = payload.payload || {};
        const resolvedTopic = typeof nextPayload.topic === 'string' ? nextPayload.topic : undefined;
        const resolvedTitle = this.resolveCanonicalMemoTitle(defaults.memoKind, payload.title);
        const slug = payload.slug?.trim() || this.buildStableSlug(payload.memoKind || 'topic', payload.title, resolvedTopic);
        const nextTags = this.uniqueStrings(payload.tags || []);
        const nextKeywords = this.uniqueStrings(payload.contextKeywords || []);
        const upsertFilter = this.buildUpsertFilter(agentId, defaults.memoKind, slug);
        const existed = await this.memoModel.findOne(upsertFilter).exec();
        if (existed) {
            if (this.isAppendOnlyMemoKind(defaults.memoKind)) {
                return this.updateMemo(existed.id, {
                    ...payload,
                    title: existed.title,
                    memoKind: defaults.memoKind,
                    memoType: defaults.memoType,
                    slug: existed.slug,
                    content: this.appendWithDivider(existed.content, payload.content),
                    payload: {
                        ...(existed.payload || {}),
                        ...(nextPayload || {}),
                    },
                    tags: this.uniqueStrings([...(existed.tags || []), ...nextTags]),
                    contextKeywords: this.uniqueStrings([...(existed.contextKeywords || []), ...nextKeywords]),
                }, options);
            }
            return this.updateMemo(existed.id, {
                ...payload,
                memoKind: defaults.memoKind,
                memoType: defaults.memoType,
                slug,
            }, options);
        }
        const updated = await this.memoModel
            .findOneAndUpdate(upsertFilter, {
            $set: {
                agentId,
                title: resolvedTitle,
                slug,
                content: payload.content.trim(),
                version: 1,
                memoType: defaults.memoType,
                memoKind: defaults.memoKind,
                payload: this.toNormalizedPayload(defaults.memoKind, nextPayload, payload.title),
                tags: nextTags,
                contextKeywords: nextKeywords,
                source: payload.source || 'agent',
                updatedAt: new Date(),
            },
            $setOnInsert: {
                id: (0, uuid_1.v4)(),
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true })
            .exec();
        if (defaults.memoKind === 'identity' || defaults.memoKind === 'todo') {
            await this.cleanupCoreDocDuplicates(agentId, defaults.memoKind, updated?.id);
        }
        await this.syncMemoSafely(updated);
        await this.refreshMemoCacheByKind(agentId, defaults.memoKind);
        await this.rebuildIndexSafely();
        return updated;
    }
    async listMemos(filters) {
        const query = this.buildQuery(filters);
        const page = Math.max(1, Number(filters?.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(filters?.pageSize || 20)));
        const skip = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            this.memoModel.find(query).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).exec(),
            this.memoModel.countDocuments(query).exec(),
        ]);
        return {
            items: items,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    }
    async getMemoById(id) {
        const memo = await this.memoModel.findOne({ id }).exec();
        if (!memo)
            throw new common_1.NotFoundException(`Memo not found: ${id}`);
        return memo;
    }
    async updateMemo(id, updates, options) {
        const existing = await this.memoModel.findOne({ id }).exec();
        if (!existing)
            throw new common_1.NotFoundException(`Memo not found: ${id}`);
        this.assertMemoTypeKindCompatibility((updates.memoKind || existing.memoKind || 'topic'), updates.memoType, 'update');
        const defaults = this.resolveMemoDefaults((updates.memoKind || existing.memoKind || 'topic'), (updates.memoType || existing.memoType || 'knowledge'));
        const memoKind = defaults.memoKind;
        const memoType = defaults.memoType;
        if (!options?.skipRolePermissionCheck) {
            this.assertMemoWritePermission(memoKind, existing.agentId, updates.source || existing.source, options?.actor);
        }
        const nextTitle = this.resolveCanonicalMemoTitle(memoKind, updates.title?.trim() || existing.title);
        const mergedPayload = this.toNormalizedPayload(memoKind, {
            ...(existing.payload || {}),
            ...(updates.payload || {}),
        }, nextTitle);
        const payload = {
            updatedAt: new Date(),
            title: nextTitle,
            memoKind,
            memoType,
            payload: mergedPayload,
            version: Math.max(1, Number(existing.version || 1)) + 1,
        };
        if (updates.content)
            payload.content = updates.content.trim();
        if (updates.tags)
            payload.tags = this.uniqueStrings(updates.tags);
        if (updates.contextKeywords)
            payload.contextKeywords = this.uniqueStrings(updates.contextKeywords);
        if (updates.source)
            payload.source = updates.source;
        const nextTopic = typeof mergedPayload.topic === 'string' ? mergedPayload.topic : undefined;
        const nextSlug = updates.slug?.trim() ||
            (updates.title || updates.payload || updates.memoKind
                ? this.buildStableSlug(memoKind, nextTitle, nextTopic)
                : existing.slug);
        payload.slug = nextSlug;
        const updated = await this.memoModel.findOneAndUpdate({ id }, payload, { new: true }).exec();
        if (!updated)
            throw new common_1.NotFoundException(`Memo not found: ${id}`);
        if (memoKind === 'identity' || memoKind === 'todo') {
            await this.cleanupCoreDocDuplicates(updated.agentId, memoKind, updated.id);
        }
        if (existing.slug !== updated.slug || existing.agentId !== updated.agentId) {
            await this.removeMemoSafely(existing);
        }
        await this.syncMemoSafely(updated);
        await this.refreshMemoCacheByKind(updated.agentId, updated.memoKind);
        await this.rebuildIndexSafely();
        return updated;
    }
    async deleteMemo(id) {
        const existing = await this.memoModel.findOne({ id }).exec();
        if (!existing)
            return false;
        await this.memoModel.deleteOne({ id }).exec();
        await this.removeMemoSafely(existing);
        await this.refreshMemoCacheByKind(existing.agentId, existing.memoKind);
        await this.rebuildIndexSafely();
        return true;
    }
    async searchMemos(agentId, query, options) {
        const trimmedAgentId = String(agentId || '').trim();
        if (!trimmedAgentId)
            return [];
        const limit = Math.max(1, Math.min(Number(options?.limit || 8), 30));
        const filter = { agentId: trimmedAgentId };
        if (options?.memoType)
            filter.memoType = options.memoType;
        if (options?.memoKind)
            filter.memoKind = options.memoKind;
        if (options?.topic?.trim())
            filter['payload.topic'] = options.topic.trim();
        const keyword = String(query || '').trim();
        if (keyword) {
            const escaped = this.escapeRegex(keyword);
            const regex = new RegExp(escaped, 'i');
            filter.$or = [{ title: regex }, { content: regex }, { tags: regex }, { contextKeywords: regex }, { 'payload.topic': regex }];
        }
        const memos = await this.memoModel.find(filter).sort({ updatedAt: -1 }).limit(limit).exec();
        return memos.map((memo) => {
            const base = {
                id: memo.id,
                title: memo.title,
                memoType: memo.memoType,
                memoKind: memo.memoKind,
                topic: memo.payload?.topic,
                tags: memo.tags || [],
                updatedAt: memo.updatedAt,
            };
            if (options?.detail === true) {
                return {
                    ...base,
                    content: memo.content,
                    source: memo.source,
                    payload: memo.payload || {},
                };
            }
            return {
                ...base,
                summary: this.toSummary(memo.content, options?.progressive !== false ? 240 : 520),
            };
        });
    }
    async recordBehavior(payload) {
        const agentId = String(payload.agentId || '').trim();
        if (!agentId)
            throw new common_1.BadRequestException('agentId is required');
        await this.ensureCoreDocuments(agentId);
        const event = {
            id: (0, uuid_1.v4)(),
            agentId,
            event: payload.event,
            taskId: payload.taskId,
            title: payload.title,
            details: payload.details,
            topic: payload.topic,
            tags: this.uniqueStrings([payload.event, ...(payload.tags || [])]),
            createdAt: new Date().toISOString(),
        };
        const key = `${EVENT_KEY_PREFIX}${agentId}`;
        await this.redisService.lpush(key, JSON.stringify(event));
        await this.redisService.ltrim(key, 0, EVENT_QUEUE_MAX - 1);
        await this.redisService.expire(key, EVENT_QUEUE_TTL_SECONDS);
        return { queued: true, key, eventId: event.id };
    }
    async upsertTaskTodo(agentId, task) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            throw new common_1.BadRequestException('agentId is required');
        await this.ensureCoreDocuments(normalizedAgentId);
        const taskId = String(task?.id || (0, uuid_1.v4)()).trim();
        const title = String(task?.title || 'Untitled task').trim();
        const description = String(task?.description || '').trim();
        const sourceType = this.memoTaskTodoService.normalizeTaskSourceType(task?.sourceType);
        if (sourceType !== 'orchestration_task') {
            throw new common_1.BadRequestException(`todo only accepts sourceType=orchestration_task, received ${sourceType}`);
        }
        const status = this.memoTaskTodoService.normalizeTaskStatus(task?.status);
        const nowIso = new Date().toISOString();
        if (HISTORY_STATUSES.has(status)) {
            if (!this.memoTaskHistoryService.isHistoryStatus(status)) {
                throw new common_1.BadRequestException(`invalid history status: ${status}`);
            }
            return this.upsertTaskHistory({
                agentId: normalizedAgentId,
                taskId,
                title,
                description,
                status,
                note: task?.note,
                sourceType,
                orchestrationId: task?.orchestrationId,
                priority: task?.priority,
                at: nowIso,
            });
        }
        if (!this.memoTaskTodoService.isTodoActiveStatus(status)) {
            throw new common_1.BadRequestException(`invalid todo status: ${status}`);
        }
        const todoDoc = await this.getOrCreateTodoDocument(normalizedAgentId);
        const todoItems = this.memoTaskTodoService.readTodoItems(todoDoc.payload);
        const nextTodoItems = this.memoTaskTodoService.upsertTodoItem(todoItems, {
            taskId,
            title,
            description,
            status,
            orchestrationId: task?.orchestrationId,
            priority: task?.priority,
            sourceType,
            updatedAt: nowIso,
            note: task?.note,
        });
        return this.updateMemo(todoDoc.id, {
            memoKind: 'todo',
            memoType: 'standard',
            title: todoDoc.title,
            content: this.memoTaskTodoService.renderTodoContent(nextTodoItems, this.compact.bind(this)),
            payload: {
                ...(todoDoc.payload || {}),
                status,
                sourceType,
                tasks: nextTodoItems,
            },
            tags: this.uniqueStrings([...(todoDoc.tags || []), 'task', 'todo']),
            contextKeywords: this.uniqueStrings([...(todoDoc.contextKeywords || []), ...this.extractKeywords(`${title} ${description}`)]),
        });
    }
    async updateTodoStatus(id, status, note, options) {
        const todoDoc = await this.memoModel.findOne({ id, memoKind: 'todo' }).exec();
        if (!todoDoc)
            throw new common_1.NotFoundException(`TODO memo not found: ${id}`);
        const sourceType = this.memoTaskTodoService.normalizeTaskSourceType(options?.sourceType);
        if (sourceType !== 'orchestration_task') {
            throw new common_1.BadRequestException(`todo status update only accepts sourceType=orchestration_task, received ${sourceType}`);
        }
        const normalizedStatus = this.memoTaskTodoService.normalizeTaskStatus(status);
        const todoItems = this.memoTaskTodoService.readTodoItems(todoDoc.payload);
        const targetTaskId = String(options?.taskId || '').trim() || todoItems[0]?.taskId;
        if (!targetTaskId) {
            throw new common_1.BadRequestException('taskId is required when updating todo status');
        }
        const targetTask = todoItems.find((item) => item.taskId === targetTaskId);
        if (!targetTask) {
            throw new common_1.NotFoundException(`TODO task not found in memo ${id}: ${targetTaskId}`);
        }
        if (HISTORY_STATUSES.has(normalizedStatus)) {
            if (!this.memoTaskHistoryService.isHistoryStatus(normalizedStatus)) {
                throw new common_1.BadRequestException(`invalid history status: ${normalizedStatus}`);
            }
            await this.upsertTaskHistory({
                agentId: todoDoc.agentId,
                taskId: targetTask.taskId,
                title: targetTask.title,
                description: targetTask.description,
                status: normalizedStatus,
                note,
                sourceType,
                orchestrationId: targetTask.orchestrationId,
                priority: targetTask.priority,
            });
            const nextTodoItems = todoItems.filter((item) => item.taskId !== targetTaskId);
            return this.updateMemo(id, {
                memoKind: 'todo',
                memoType: 'standard',
                payload: {
                    ...(todoDoc.payload || {}),
                    status: nextTodoItems[0]?.status || 'pending',
                    sourceType,
                    tasks: nextTodoItems,
                },
                content: this.memoTaskTodoService.renderTodoContent(nextTodoItems, this.compact.bind(this)),
            });
        }
        if (!this.memoTaskTodoService.isTodoActiveStatus(normalizedStatus)) {
            throw new common_1.BadRequestException(`invalid todo status: ${normalizedStatus}`);
        }
        const nextTodoItems = this.memoTaskTodoService.upsertTodoItem(todoItems, {
            ...targetTask,
            status: normalizedStatus,
            updatedAt: new Date().toISOString(),
            note,
        });
        return this.updateMemo(id, {
            memoKind: 'todo',
            memoType: 'standard',
            payload: {
                ...(todoDoc.payload || {}),
                status: normalizedStatus,
                sourceType,
                tasks: nextTodoItems,
            },
            content: this.memoTaskTodoService.renderTodoContent(nextTodoItems, this.compact.bind(this)),
        });
    }
    async completeTaskTodo(agentId, taskId, note, status = 'success') {
        const normalizedAgentId = String(agentId || '').trim();
        const normalizedTaskId = String(taskId || '').trim();
        if (!normalizedAgentId || !normalizedTaskId)
            return;
        const todoDoc = await this.memoModel.findOne({ agentId: normalizedAgentId, memoKind: 'todo' }).exec();
        const todoItems = todoDoc ? this.memoTaskTodoService.readTodoItems(todoDoc.payload) : [];
        const existingTodoTask = todoItems.find((item) => item.taskId === normalizedTaskId);
        await this.upsertTaskHistory({
            agentId: normalizedAgentId,
            taskId: normalizedTaskId,
            title: existingTodoTask?.title || `Task ${normalizedTaskId}`,
            description: existingTodoTask?.description,
            status,
            note,
            sourceType: 'orchestration_task',
            orchestrationId: existingTodoTask?.orchestrationId,
            priority: existingTodoTask?.priority,
        });
        if (!todoDoc)
            return;
        const nextTodoItems = todoItems.filter((item) => item.taskId !== normalizedTaskId);
        await this.updateMemo(todoDoc.id, {
            memoKind: 'todo',
            memoType: 'standard',
            payload: {
                ...(todoDoc.payload || {}),
                status: nextTodoItems[0]?.status || 'pending',
                sourceType: 'orchestration_task',
                tasks: nextTodoItems,
            },
            content: this.memoTaskTodoService.renderTodoContent(nextTodoItems, this.compact.bind(this)),
        });
    }
    async rebuildMemoDocs() {
        const memos = await this.memoModel.find().sort({ updatedAt: -1 }).exec();
        for (const memo of memos) {
            await this.syncMemoSafely(memo);
        }
        await this.rebuildIndexSafely();
        return { memos: memos.length };
    }
    async getTaskMemoryContext(agentId, taskText) {
        const query = String(taskText || '').trim();
        if (!query)
            return '';
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            return '';
        const candidateKinds = ['identity', 'todo', 'history', 'topic', 'custom'];
        const matched = await this.searchMemosFromCache(normalizedAgentId, query, candidateKinds, 4);
        if (matched.length) {
            return matched
                .map((item, idx) => `${idx + 1}. [${item.memoKind}] ${item.title} | topic=${item.topic || 'N/A'} | summary=${item.summary || ''}`)
                .join('\n');
        }
        const dbMatched = await this.searchMemos(agentId, query, {
            limit: 4,
            progressive: true,
            detail: false,
        });
        if (!dbMatched.length)
            return '';
        return dbMatched
            .map((item, idx) => `${idx + 1}. [${item.memoKind}] ${item.title} | topic=${item.topic || 'N/A'} | summary=${item.summary || ''}`)
            .join('\n');
    }
    async getIdentityMemos(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            return [];
        return (await this.memoModel
            .find({ agentId: normalizedAgentId, memoKind: 'identity' })
            .sort({ updatedAt: -1 })
            .limit(5)
            .exec());
    }
    async getFirstMemoContentMapByKind(agentIds, memoKind) {
        const normalizedAgentIds = Array.from(new Set((agentIds || []).map((item) => String(item || '').trim()).filter(Boolean)));
        const result = new Map();
        if (!normalizedAgentIds.length) {
            return result;
        }
        const docs = await this.memoModel
            .find({
            agentId: { $in: normalizedAgentIds },
            memoKind,
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .exec();
        for (const doc of docs) {
            const agentId = String(doc?.agentId || '').trim();
            if (!agentId || result.has(agentId))
                continue;
            result.set(agentId, String(doc?.content || ''));
        }
        return result;
    }
    async enqueueRefreshTask(payload) {
        const agentId = String(payload.agentId || '').trim();
        if (!agentId)
            return { queued: false, key: '' };
        const key = `${REFRESH_KEY_PREFIX}:${agentId}`;
        const memoKinds = this.uniqueMemoKinds(payload.memoKinds || ['identity']);
        await this.redisService.lpush(key, JSON.stringify({
            id: (0, uuid_1.v4)(),
            agentId,
            memoKinds,
            reason: payload.reason || 'manual',
            taskId: payload.taskId,
            summary: payload.summary,
            createdAt: new Date().toISOString(),
        }));
        await this.redisService.ltrim(key, 0, EVENT_QUEUE_MAX - 1);
        await this.redisService.expire(key, EVENT_QUEUE_TTL_SECONDS);
        return { queued: true, key };
    }
    async flushRefreshQueue(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        const keys = normalizedAgentId
            ? [`${REFRESH_KEY_PREFIX}:${normalizedAgentId}`]
            : await this.redisService.keys(`${REFRESH_KEY_PREFIX}:*`);
        if (!keys.length)
            return { jobs: 0, agents: 0, writes: 0 };
        let jobs = 0;
        let writes = 0;
        const agentSet = new Set();
        for (const key of keys) {
            const rows = await this.redisService.lrange(key, 0, -1);
            if (!rows.length)
                continue;
            const grouped = new Map();
            for (const row of rows) {
                try {
                    const item = JSON.parse(row);
                    const owner = String(item.agentId || '').trim();
                    if (!owner)
                        continue;
                    agentSet.add(owner);
                    jobs += 1;
                    const current = grouped.get(owner) || new Set();
                    this.uniqueMemoKinds(item.memoKinds || ['identity']).forEach((memoKind) => current.add(memoKind));
                    grouped.set(owner, current);
                }
                catch {
                    continue;
                }
            }
            for (const [owner, kinds] of grouped.entries()) {
                for (const memoKind of kinds) {
                    await this.refreshMemoCacheByKind(owner, memoKind);
                    writes += 1;
                }
            }
            await this.redisService.del(key);
        }
        return { jobs, agents: agentSet.size, writes };
    }
    async flushEventQueue(agentId) {
        const keys = agentId ? [`${EVENT_KEY_PREFIX}${agentId}`] : await this.redisService.keys(`${EVENT_KEY_PREFIX}*`);
        if (!keys.length)
            return { agents: 0, events: 0, topics: 0 };
        if (!this.topicAggregationEnabled) {
            let discardedEvents = 0;
            const touchedAgents = new Set();
            for (const key of keys) {
                const rows = await this.redisService.lrange(key, 0, -1);
                if (!rows.length) {
                    await this.redisService.del(key);
                    continue;
                }
                const events = rows
                    .map((row) => this.parseEvent(row))
                    .filter((item) => !!item);
                for (const event of events) {
                    touchedAgents.add(event.agentId);
                }
                discardedEvents += events.length;
                await this.redisService.del(key);
            }
            if (discardedEvents > 0) {
                this.logger.log(`Topic aggregation paused, discarded events=${discardedEvents}, agents=${touchedAgents.size}`);
            }
            return {
                agents: touchedAgents.size,
                events: discardedEvents,
                topics: 0,
            };
        }
        let totalEvents = 0;
        let topicWrites = 0;
        const touchedAgents = new Set();
        for (const key of keys) {
            const rows = await this.redisService.lrange(key, 0, -1);
            if (!rows.length)
                continue;
            const events = rows
                .map((row) => this.parseEvent(row))
                .filter((item) => !!item)
                .reverse();
            if (!events.length) {
                await this.redisService.del(key);
                continue;
            }
            const ownerAgentId = events[0].agentId;
            touchedAgents.add(ownerAgentId);
            await this.ensureCoreDocuments(ownerAgentId);
            const grouped = new Map();
            for (const event of events) {
                const topic = this.normalizeTopic(event.topic || this.inferTopicFromEvent(event));
                const list = grouped.get(topic) || [];
                list.push(event);
                grouped.set(topic, list);
            }
            for (const [topic, topicEvents] of grouped.entries()) {
                await this.mergeTopicEvents(ownerAgentId, topic, topicEvents);
                topicWrites += 1;
            }
            totalEvents += events.length;
            await this.redisService.del(key);
        }
        return {
            agents: touchedAgents.size,
            events: totalEvents,
            topics: topicWrites,
        };
    }
    async getAggregationStatus(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        const keys = normalizedAgentId
            ? [`${EVENT_KEY_PREFIX}${normalizedAgentId}`]
            : await this.redisService.keys(`${EVENT_KEY_PREFIX}*`);
        let queuedEvents = 0;
        for (const key of keys) {
            queuedEvents += await this.redisService.llen(key);
        }
        const refreshKeys = normalizedAgentId
            ? [`${REFRESH_KEY_PREFIX}:${normalizedAgentId}`]
            : await this.redisService.keys(`${REFRESH_KEY_PREFIX}:*`);
        let refreshJobs = 0;
        for (const key of refreshKeys) {
            refreshJobs += await this.redisService.llen(key);
        }
        const memoFilter = normalizedAgentId ? { agentId: normalizedAgentId } : {};
        const [latest, count] = await Promise.all([
            this.memoModel.findOne(memoFilter).sort({ updatedAt: -1 }).exec(),
            this.memoModel.countDocuments(memoFilter).exec(),
        ]);
        return {
            redisReady: this.redisService.isReady(),
            queueKeys: keys.length,
            queuedEvents,
            refreshQueueKeys: refreshKeys.length,
            refreshJobs,
            memoDocuments: count,
            latestMemoUpdatedAt: latest?.updatedAt ? new Date(latest.updatedAt).toISOString() : undefined,
            agentId: normalizedAgentId || undefined,
        };
    }
    async repairCoreDocuments(agentId) {
        const targetAgentId = String(agentId || '').trim();
        const agentIds = targetAgentId ? [targetAgentId] : (await this.memoModel.distinct('agentId').exec());
        let fixedDocs = 0;
        for (const id of agentIds) {
            const normalizedId = String(id || '').trim();
            if (!normalizedId)
                continue;
            await this.ensureCoreDocuments(normalizedId);
            const beforeIdentity = await this.memoModel.countDocuments({ agentId: normalizedId, memoKind: 'identity' }).exec();
            const beforeTodo = await this.memoModel.countDocuments({ agentId: normalizedId, memoKind: 'todo' }).exec();
            await this.cleanupCoreDocDuplicates(normalizedId, 'identity');
            await this.cleanupCoreDocDuplicates(normalizedId, 'todo');
            const afterIdentity = await this.memoModel.countDocuments({ agentId: normalizedId, memoKind: 'identity' }).exec();
            const afterTodo = await this.memoModel.countDocuments({ agentId: normalizedId, memoKind: 'todo' }).exec();
            fixedDocs += Math.max(0, beforeIdentity - afterIdentity) + Math.max(0, beforeTodo - afterTodo);
        }
        await this.rebuildIndexSafely();
        return {
            agents: agentIds.length,
            fixedDocs,
        };
    }
    async ensureCoreDocuments(agentId) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            return;
        await this.createIfMissing({
            agentId: normalizedAgentId,
            memoKind: 'identity',
            memoType: 'standard',
            title: '身份与职责',
            slug: this.buildStableSlug('identity', '身份与职责'),
            content: [
                '# 身份与职责',
                '',
                '## Agent Profile',
                '',
                '- 角色：待补充',
                '- 核心职责：待补充',
                '- 日常工作：待补充',
                '',
                '## 工作偏好',
                '',
                '- 决策偏好：待补充',
                '- 协作偏好：待补充',
            ].join('\n'),
            payload: {
                topic: 'identity',
            },
            tags: ['identity', 'responsibility'],
            contextKeywords: ['identity', 'role', 'responsibility'],
            source: 'system-seed',
        });
        await this.createIfMissing({
            agentId: normalizedAgentId,
            memoKind: 'todo',
            memoType: 'standard',
            title: 'TODO List',
            slug: this.buildStableSlug('todo', 'TODO List'),
            content: [
                '# TODO List',
                '',
                '## Tasks',
                '',
                '- No tasks yet.',
            ].join('\n'),
            payload: {
                topic: 'todo',
                status: 'pending',
            },
            tags: ['todo'],
            contextKeywords: ['todo', 'task'],
            source: 'system-seed',
        });
    }
    async createIfMissing(payload) {
        const defaults = this.resolveMemoDefaults(payload.memoKind, payload.memoType);
        const topic = typeof payload.payload?.topic === 'string' ? payload.payload.topic : undefined;
        const slug = payload.slug || this.buildStableSlug(defaults.memoKind, payload.title, topic);
        const exists = await this.memoModel.findOne(this.buildUpsertFilter(payload.agentId, defaults.memoKind, slug)).exec();
        if (exists)
            return;
        await this.createMemo(payload, { skipEnsureCoreDocs: true });
    }
    buildUpsertFilter(agentId, memoKind, slug) {
        if (memoKind === 'identity' || memoKind === 'todo' || memoKind === 'deduction' || this.isAppendOnlyMemoKind(memoKind)) {
            return { agentId, memoKind };
        }
        return { agentId, slug };
    }
    async cleanupCoreDocDuplicates(agentId, memoKind, keepId) {
        if (memoKind !== 'identity' && memoKind !== 'todo')
            return;
        const docs = await this.memoModel.find({ agentId, memoKind }).sort({ updatedAt: -1, createdAt: -1 }).exec();
        if (docs.length <= 1)
            return;
        const keeper = keepId ? docs.find((doc) => doc.id === keepId) || docs[0] : docs[0];
        const stale = docs.filter((doc) => doc.id !== keeper.id);
        for (const doc of stale) {
            await this.memoModel.deleteOne({ id: doc.id }).exec();
            await this.removeMemoSafely(doc);
        }
    }
    async mergeTopicEvents(agentId, topic, events) {
        if (!events.length)
            return;
        const slug = this.buildStableSlug('topic', topic, topic);
        const title = `专题积累: ${topic}`;
        const existing = await this.memoModel.findOne({ agentId, slug }).exec();
        const origin = existing?.content || this.buildTopicTemplate(topic);
        const appendable = events.filter((event) => !origin.includes(`[event:${event.id}]`));
        if (!appendable.length)
            return;
        const section = this.renderEventSection(appendable);
        const nextContent = `${origin.trim()}\n\n${section}`;
        const tags = this.uniqueStrings([
            ...(existing?.tags || []),
            ...appendable.flatMap((item) => item.tags || []),
            'topic',
            topic,
        ]);
        const keywords = this.uniqueStrings([
            ...(existing?.contextKeywords || []),
            ...appendable.flatMap((item) => this.extractKeywords(`${item.title || ''} ${item.details || ''}`)),
            topic,
        ]);
        await this.createMemo({
            agentId,
            memoKind: 'topic',
            memoType: 'knowledge',
            title,
            slug,
            payload: {
                ...(existing?.payload || {}),
                topic,
            },
            content: nextContent,
            tags,
            contextKeywords: keywords,
            source: 'redis-aggregator',
        });
    }
    renderEventSection(events) {
        const ts = new Date().toISOString();
        const lines = [`## Update ${ts}`, ''];
        for (const event of events) {
            const line = [
                `- [event:${event.id}] ${event.event}`,
                event.taskId ? `task=${event.taskId}` : '',
                event.title ? `title=${this.compact(event.title, 80)}` : '',
                `tags=${event.tags.join(',') || 'N/A'}`,
            ]
                .filter(Boolean)
                .join(' | ');
            lines.push(line);
            lines.push(`  - detail: ${this.compact(event.details, 260)}`);
        }
        return lines.join('\n');
    }
    buildTopicTemplate(topic) {
        return [
            `# 专题积累: ${topic}`,
            '',
            '## Snapshot',
            '',
            `- topic: ${topic}`,
            `- lastUpdatedAt: ${new Date().toISOString()}`,
            '',
            '## Notes',
        ].join('\n');
    }
    async getOrCreateTodoDocument(agentId) {
        const slug = this.buildStableSlug('todo', 'TODO List');
        const doc = await this.memoModel.findOne({ agentId, memoKind: 'todo' }).exec();
        if (doc)
            return doc;
        return this.createMemo({
            agentId,
            memoKind: 'todo',
            memoType: 'standard',
            title: 'TODO List',
            slug,
            content: '# TODO List\n\n## Tasks\n\n- No tasks yet.',
            payload: {
                topic: 'todo',
                status: 'pending',
                sourceType: 'orchestration_task',
                tasks: [],
            },
            tags: ['todo'],
            contextKeywords: ['task', 'todo'],
            source: 'system-seed',
        });
    }
    async getOrCreateHistoryDocument(agentId) {
        const slug = this.buildStableSlug('history', 'History Log');
        const doc = await this.memoModel.findOne({ agentId, memoKind: 'history' }).exec();
        if (doc)
            return doc;
        return this.createMemo({
            agentId,
            memoKind: 'history',
            memoType: 'standard',
            title: 'History Log',
            slug,
            content: '# History Log\n\n## Executed Tasks\n\n- No executed tasks yet.',
            payload: {
                topic: 'history',
                sourceType: 'orchestration_task',
                tasks: [],
            },
            tags: ['history', 'task'],
            contextKeywords: ['history', 'task', 'status'],
            source: 'system-seed',
        });
    }
    async upsertTaskHistory(payload) {
        const historyDoc = await this.getOrCreateHistoryDocument(payload.agentId);
        const historyItems = this.memoTaskHistoryService.readHistoryItems(historyDoc.payload);
        const compactedNote = payload.note ? this.compact(payload.note, 200) : undefined;
        const { nextItems, status } = this.memoTaskHistoryService.upsertHistoryItem(historyItems, {
            taskId: payload.taskId,
            title: payload.title,
            description: payload.description,
            status: payload.status,
            note: compactedNote,
            sourceType: payload.sourceType,
            orchestrationId: payload.orchestrationId,
            priority: payload.priority,
            at: payload.at,
            maxItems: 500,
        });
        return this.updateMemo(historyDoc.id, {
            memoKind: 'history',
            memoType: 'standard',
            title: historyDoc.title,
            content: this.memoTaskHistoryService.renderHistoryContent(nextItems, this.compact.bind(this)),
            payload: {
                ...(historyDoc.payload || {}),
                topic: 'history',
                sourceType: payload.sourceType,
                status,
                tasks: nextItems,
            },
            tags: this.uniqueStrings([...(historyDoc.tags || []), 'history', 'task']),
            contextKeywords: this.uniqueStrings([
                ...(historyDoc.contextKeywords || []),
                ...this.extractKeywords(`${payload.title} ${payload.description || ''} ${payload.status}`),
            ]),
        });
    }
    parseEvent(raw) {
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !parsed.agentId || !parsed.event || !parsed.id)
                return null;
            return {
                id: String(parsed.id),
                agentId: String(parsed.agentId),
                event: parsed.event,
                taskId: parsed.taskId ? String(parsed.taskId) : undefined,
                title: parsed.title ? String(parsed.title) : undefined,
                details: String(parsed.details || ''),
                tags: this.uniqueStrings(Array.isArray(parsed.tags) ? parsed.tags : []),
                topic: parsed.topic ? String(parsed.topic) : undefined,
                createdAt: String(parsed.createdAt || new Date().toISOString()),
            };
        }
        catch {
            return null;
        }
    }
    inferTopicFromEvent(event) {
        const source = `${event.title || ''} ${event.details || ''} ${(event.tags || []).join(' ')}`.toLowerCase();
        if (source.includes('系统') || source.includes('system') || source.includes('功能') || source.includes('feature')) {
            return 'system-status';
        }
        if (source.includes('部门') || source.includes('department') || source.includes('进度') || source.includes('progress')) {
            return 'department-progress';
        }
        if (event.tags?.length)
            return event.tags[0];
        return 'general';
    }
    assertMemoWritePermission(memoKind, agentId, source, actor) {
        if (memoKind !== 'achievement' && memoKind !== 'criticism') {
            return;
        }
        const normalizedRole = this.normalizeActorValue(actor?.role);
        const normalizedSource = this.normalizeActorValue(source);
        const normalizedEmployeeId = this.normalizeActorValue(actor?.employeeId);
        const normalizedAgentId = this.normalizeActorValue(agentId);
        const isAgentSelf = normalizedRole === 'agent' && normalizedEmployeeId && normalizedEmployeeId === normalizedAgentId;
        const matchedAchievementRole = this.achievementAllowedRoles.some((role) => this.roleMatches(normalizedRole, role));
        if (memoKind === 'achievement') {
            if (isAgentSelf || this.roleMatches(normalizedSource, 'agent')) {
                throw new common_1.ForbiddenException('achievement memo can only be recorded by executive/human-exclusive-assistant/hr');
            }
            if (!matchedAchievementRole) {
                throw new common_1.ForbiddenException('achievement memo requires executive/human-exclusive-assistant/hr role');
            }
            return;
        }
        const matchedCriticismRole = this.criticismAllowedRoles.some((role) => this.roleMatches(normalizedRole, role));
        if (isAgentSelf || this.roleMatches(normalizedSource, 'agent') || matchedCriticismRole) {
            return;
        }
        throw new common_1.ForbiddenException('criticism memo requires executive/human-exclusive-assistant/hr/agent role');
    }
    normalizeActorValue(value) {
        return String(value || '').trim().toLowerCase();
    }
    roleMatches(normalizedValue, expected) {
        if (!normalizedValue)
            return false;
        if (normalizedValue === expected)
            return true;
        if (normalizedValue.includes(expected))
            return true;
        if (expected === 'executive' && normalizedValue.includes('high-management'))
            return true;
        if (expected === 'human-exclusive-assistant' && normalizedValue.includes('exclusive-assistant'))
            return true;
        if (expected === 'hr' && (normalizedValue.includes('human-resource') || normalizedValue.includes('human-resources'))) {
            return true;
        }
        return false;
    }
    buildQuery(filters) {
        const query = {};
        if (filters?.agentId?.trim())
            query.agentId = filters.agentId.trim();
        if (filters?.memoType)
            query.memoType = filters.memoType;
        if (filters?.memoKind)
            query.memoKind = filters.memoKind;
        if (filters?.topic?.trim())
            query['payload.topic'] = filters.topic.trim();
        if (filters?.search?.trim()) {
            const regex = new RegExp(this.escapeRegex(filters.search.trim()), 'i');
            query.$or = [{ title: regex }, { content: regex }, { tags: regex }, { contextKeywords: regex }, { 'payload.topic': regex }];
        }
        return query;
    }
    resolveMemoDefaults(memoKind, memoType) {
        const resolvedKind = memoKind || 'topic';
        if (resolvedKind === 'topic') {
            return { memoKind: resolvedKind, memoType: 'knowledge' };
        }
        const standardMemoKinds = [
            'identity',
            'todo',
            'history',
            'draft',
            'custom',
            'evaluation',
            'achievement',
            'criticism',
            'deduction',
        ];
        if (standardMemoKinds.includes(resolvedKind)) {
            return { memoKind: resolvedKind, memoType: 'standard' };
        }
        return { memoKind: resolvedKind, memoType: memoType || 'knowledge' };
    }
    assertMemoTypeKindCompatibility(memoKind, memoType, phase) {
        if (!memoType)
            return;
        const resolvedKind = (memoKind || 'topic');
        if (resolvedKind === 'topic' && memoType !== 'knowledge') {
            throw new common_1.BadRequestException(`${phase}: memoKind=topic requires memoType=knowledge`);
        }
        const standardMemoKinds = [
            'identity',
            'todo',
            'history',
            'draft',
            'custom',
            'evaluation',
            'achievement',
            'criticism',
            'deduction',
        ];
        if (standardMemoKinds.includes(resolvedKind) && memoType !== 'standard') {
            throw new common_1.BadRequestException(`${phase}: memoKind=${resolvedKind} requires memoType=standard`);
        }
    }
    buildStableSlug(kind, title, topic) {
        if (kind === 'identity')
            return 'identity-and-responsibilities';
        if (kind === 'todo')
            return 'todo-list';
        if (kind === 'history')
            return 'history-log';
        if (kind === 'draft')
            return 'draft-buffer';
        if (kind === 'achievement')
            return 'achievement-log';
        if (kind === 'criticism')
            return 'criticism-log';
        if (kind === 'deduction')
            return 'deduction-history';
        if (kind === 'custom') {
            const customBase = this.normalizeTopic(topic || title || 'custom');
            return `custom-${customBase}`;
        }
        const base = this.normalizeTopic(topic || title || kind || 'general');
        return `${kind}-${base}`;
    }
    resolveCanonicalMemoTitle(kind, inputTitle) {
        if (kind === 'achievement')
            return 'Achievement';
        if (kind === 'criticism')
            return 'Criticism';
        return String(inputTitle || '').trim();
    }
    normalizeTopic(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        return normalized || 'general';
    }
    uniqueStrings(items) {
        return Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));
    }
    toSummary(content, maxLength) {
        const normalized = String(content || '').replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength)
            return normalized;
        return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
    }
    extractKeywords(content) {
        const tokens = String(content || '')
            .toLowerCase()
            .split(/[^a-z0-9\u4e00-\u9fa5]+/)
            .map((item) => item.trim())
            .filter((item) => item.length >= 2)
            .slice(0, 32);
        return Array.from(new Set(tokens));
    }
    compact(content, maxLength) {
        const normalized = String(content || '').replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength)
            return normalized;
        return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
    }
    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    toNormalizedPayload(memoKind, payload, title) {
        const next = { ...(payload || {}) };
        if (typeof next.topic !== 'string' || !next.topic.trim()) {
            if (memoKind === 'identity')
                next.topic = 'identity';
            else if (memoKind === 'todo')
                next.topic = 'todo';
            else
                next.topic = this.normalizeTopic(title);
        }
        else {
            next.topic = String(next.topic).trim();
        }
        return next;
    }
    memoCacheKey(agentId, memoKind) {
        return `memo:${agentId}:${memoKind}`;
    }
    uniqueMemoKinds(kinds) {
        const allowed = ['identity', 'todo', 'topic', 'history', 'draft', 'custom', 'evaluation', 'achievement', 'criticism', 'deduction'];
        const normalized = Array.from(new Set((kinds || []).map((item) => String(item || '').trim()).filter(Boolean)));
        return normalized.filter((item) => allowed.includes(item));
    }
    isAppendOnlyMemoKind(memoKind) {
        return this.appendOnlyMemoKinds.includes(memoKind);
    }
    appendWithDivider(origin, incoming) {
        const base = String(origin || '').trim();
        const next = String(incoming || '').trim();
        if (!next)
            return base;
        if (!base)
            return next;
        return `${base}\n\n—\n\n${next}`;
    }
    async loadMemoKindCache(agentId, memoKind) {
        const key = this.memoCacheKey(agentId, memoKind);
        const cached = await this.redisService.get(key);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed?.items))
                    return parsed.items;
            }
            catch {
            }
        }
        await this.refreshMemoCacheByKind(agentId, memoKind);
        const rebuilt = await this.redisService.get(key);
        if (!rebuilt)
            return [];
        try {
            const parsed = JSON.parse(rebuilt);
            return Array.isArray(parsed?.items) ? parsed.items : [];
        }
        catch {
            return [];
        }
    }
    async searchMemosFromCache(agentId, query, kinds, limit) {
        const keyword = String(query || '').trim().toLowerCase();
        if (!keyword)
            return [];
        const results = [];
        const uniqueKinds = this.uniqueMemoKinds(kinds);
        for (const memoKind of uniqueKinds) {
            const rows = await this.loadMemoKindCache(agentId, memoKind);
            for (const row of rows) {
                const title = String(row.title || '');
                const content = String(row.content || '');
                const topic = row?.payload?.topic ? String(row.payload.topic) : undefined;
                const tags = Array.isArray(row.tags) ? row.tags.join(' ') : '';
                const haystack = `${title} ${content} ${topic || ''} ${tags}`.toLowerCase();
                if (!haystack.includes(keyword))
                    continue;
                results.push({
                    memoKind,
                    title,
                    topic,
                    summary: this.toSummary(content, 220),
                    updatedAt: row.updatedAt,
                });
            }
        }
        return results
            .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
            .slice(0, Math.max(1, limit))
            .map(({ memoKind, title, topic, summary }) => ({ memoKind, title, topic, summary }));
    }
    async refreshMemoCacheByKind(agentId, memoKind) {
        const normalizedAgentId = String(agentId || '').trim();
        if (!normalizedAgentId)
            return;
        const items = await this.memoModel.find({ agentId: normalizedAgentId, memoKind }).sort({ updatedAt: -1 }).limit(200).exec();
        const payload = {
            agentId: normalizedAgentId,
            memoKind,
            items,
            updatedAt: new Date().toISOString(),
        };
        await this.redisService.set(this.memoCacheKey(normalizedAgentId, memoKind), JSON.stringify(payload));
    }
    async syncMemoSafely(memo) {
        try {
            await this.memoDocSyncService.syncMemo(memo);
        }
        catch (error) {
            this.memoDocSyncService.reportSyncError(error, `Failed to sync memo doc ${memo.id}`);
        }
    }
    async removeMemoSafely(memo) {
        try {
            await this.memoDocSyncService.removeMemo(memo);
        }
        catch (error) {
            this.memoDocSyncService.reportSyncError(error, `Failed to remove memo doc ${memo.id}`);
        }
    }
    async rebuildIndexSafely() {
        try {
            if (!this.memoDocSyncService.isFileSyncEnabled()) {
                return;
            }
            const memos = await this.memoModel.find().sort({ updatedAt: -1 }).exec();
            await this.memoDocSyncService.rebuildIndex(memos);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Memo index rebuild skipped: ${message}`);
        }
    }
};
exports.MemoService = MemoService;
exports.MemoService = MemoService = MemoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_memo_schema_1.AgentMemo.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        memo_doc_sync_service_1.MemoDocSyncService,
        infra_1.RedisService,
        memo_task_todo_service_1.MemoTaskTodoService,
        memo_task_history_service_1.MemoTaskHistoryService])
], MemoService);
//# sourceMappingURL=memo.service.js.map