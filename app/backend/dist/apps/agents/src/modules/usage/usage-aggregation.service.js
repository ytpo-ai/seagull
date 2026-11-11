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
var UsageAggregationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageAggregationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_message_schema_1 = require("../../schemas/agent-message.schema");
const agent_schema_1 = require("../../schemas/agent.schema");
const model_registry_schema_1 = require("../../schemas/model-registry.schema");
const usage_daily_snapshot_schema_1 = require("../../schemas/usage-daily-snapshot.schema");
let UsageAggregationService = UsageAggregationService_1 = class UsageAggregationService {
    constructor(agentMessageModel, agentModel, modelRegistryModel, usageDailySnapshotModel) {
        this.agentMessageModel = agentMessageModel;
        this.agentModel = agentModel;
        this.modelRegistryModel = modelRegistryModel;
        this.usageDailySnapshotModel = usageDailySnapshotModel;
        this.logger = new common_1.Logger(UsageAggregationService_1.name);
    }
    onModuleInit() {
        this.startDailySnapshotSchedule();
    }
    async getOverview(period = 'month') {
        const currentRange = this.resolvePeriodRange(period, new Date());
        const previousRange = this.resolvePreviousRange(currentRange);
        const [current, previous] = await Promise.all([
            this.aggregateSummaryByRange(currentRange),
            this.aggregateSummaryByRange(previousRange),
        ]);
        return {
            totalCost: current.totalCost,
            totalTokens: current.totalTokens,
            requestCount: current.requestCount,
            activeModels: current.activeModels,
            previousPeriod: {
                totalCost: previous.totalCost,
                totalTokens: previous.totalTokens,
                requestCount: previous.requestCount,
                activeModels: previous.activeModels,
            },
            period,
            from: currentRange.from.toISOString(),
            to: currentRange.to.toISOString(),
        };
    }
    async getDailyTrend(from, to) {
        const range = this.resolveDateRange(from, to);
        const rows = await this.aggregateDailyTrend(range);
        return rows.map((row) => ({
            date: String(row._id),
            cost: Number(row.cost || 0),
            tokens: Number(row.tokens || 0),
            requests: Number(row.requests || 0),
        }));
    }
    async getByAgent(from, to, limit = 10) {
        const range = this.resolveDateRange(from, to);
        const safeLimit = this.normalizeLimit(limit);
        const rows = await this.agentMessageModel.aggregate([
            { $match: this.buildMatch(range) },
            {
                $group: {
                    _id: '$agentId',
                    cost: { $sum: '$cost' },
                    tokens: { $sum: { $ifNull: ['$tokens.total', 0] } },
                    requests: { $sum: 1 },
                },
            },
            { $sort: { cost: -1 } },
            { $limit: safeLimit },
        ]);
        const agentIds = rows.map((row) => String(row._id)).filter(Boolean);
        const objectIdAgentIds = agentIds.filter((id) => mongoose_2.Types.ObjectId.isValid(id)).map((id) => new mongoose_2.Types.ObjectId(id));
        const agents = await this.agentModel
            .find({
            $or: [
                { id: { $in: agentIds } },
                { _id: { $in: objectIdAgentIds } },
            ],
        })
            .select({ id: 1, name: 1 })
            .lean()
            .exec();
        const agentNameMap = new Map();
        for (const item of agents) {
            const displayName = String(item.name || item.id || item._id || 'unknown');
            if (item.id) {
                agentNameMap.set(String(item.id), displayName);
            }
            if (item._id) {
                agentNameMap.set(String(item._id), displayName);
            }
        }
        return rows.map((row) => {
            const agentId = String(row._id || 'unknown');
            return {
                agentId,
                agentName: agentNameMap.get(agentId) || agentId,
                cost: Number(row.cost || 0),
                tokens: Number(row.tokens || 0),
                requests: Number(row.requests || 0),
            };
        });
    }
    async getByModel(from, to, limit = 10) {
        const range = this.resolveDateRange(from, to);
        const safeLimit = this.normalizeLimit(limit);
        const rows = await this.agentMessageModel.aggregate([
            { $match: this.buildMatch(range) },
            {
                $group: {
                    _id: {
                        modelId: { $ifNull: ['$modelID', 'unknown'] },
                        provider: { $ifNull: ['$providerID', 'unknown'] },
                    },
                    cost: { $sum: '$cost' },
                    tokens: { $sum: { $ifNull: ['$tokens.total', 0] } },
                    requests: { $sum: 1 },
                },
            },
            { $sort: { cost: -1 } },
            { $limit: safeLimit },
        ]);
        const modelIds = rows.map((row) => String(row._id?.modelId || '')).filter(Boolean);
        const modelDocs = await this.modelRegistryModel
            .find({ $or: [{ id: { $in: modelIds } }, { model: { $in: modelIds } }] })
            .select({ id: 1, model: 1, name: 1, provider: 1 })
            .lean()
            .exec();
        const modelMap = new Map();
        for (const item of modelDocs) {
            const name = String(item.name || item.model || item.id);
            const provider = String(item.provider || 'unknown');
            modelMap.set(String(item.id), { name, provider });
            modelMap.set(String(item.model), { name, provider });
        }
        return rows.map((row) => {
            const modelId = String(row._id?.modelId || 'unknown');
            const provider = String(row._id?.provider || 'unknown');
            const metadata = modelMap.get(modelId);
            return {
                modelId,
                modelName: metadata?.name || modelId,
                provider: metadata?.provider || provider,
                cost: Number(row.cost || 0),
                tokens: Number(row.tokens || 0),
                requests: Number(row.requests || 0),
            };
        });
    }
    async createDailySnapshot(targetDate) {
        const date = this.normalizeDateString(targetDate) || this.getDateString(this.shiftDate(new Date(), -1));
        const range = this.resolveWholeDayRange(date);
        const rows = await this.agentMessageModel.aggregate([
            { $match: this.buildMatch(range) },
            {
                $group: {
                    _id: {
                        agentId: { $ifNull: ['$agentId', null] },
                        modelId: { $ifNull: ['$modelID', null] },
                    },
                    totalCost: { $sum: '$cost' },
                    input: { $sum: { $ifNull: ['$tokens.input', 0] } },
                    output: { $sum: { $ifNull: ['$tokens.output', 0] } },
                    reasoning: { $sum: { $ifNull: ['$tokens.reasoning', 0] } },
                    cacheRead: { $sum: { $ifNull: ['$tokens.cacheRead', 0] } },
                    cacheWrite: { $sum: { $ifNull: ['$tokens.cacheWrite', 0] } },
                    total: { $sum: { $ifNull: ['$tokens.total', 0] } },
                    requestCount: { $sum: 1 },
                },
            },
        ]);
        if (rows.length === 0) {
            return {
                date,
                rowCount: 0,
                createdAt: new Date().toISOString(),
            };
        }
        await this.usageDailySnapshotModel.deleteMany({ date }).exec();
        await this.usageDailySnapshotModel.insertMany(rows.map((row) => ({
            date,
            agentId: row._id?.agentId ?? null,
            modelId: row._id?.modelId ?? null,
            tokens: {
                input: Number(row.input || 0),
                output: Number(row.output || 0),
                reasoning: Number(row.reasoning || 0),
                cacheRead: Number(row.cacheRead || 0),
                cacheWrite: Number(row.cacheWrite || 0),
                total: Number(row.total || 0),
            },
            totalCost: Number(row.totalCost || 0),
            requestCount: Number(row.requestCount || 0),
        })));
        return {
            date,
            rowCount: rows.length,
            createdAt: new Date().toISOString(),
        };
    }
    async aggregateSummaryByRange(range) {
        const [summary] = await this.agentMessageModel.aggregate([
            { $match: this.buildMatch(range) },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$cost' },
                    totalTokens: { $sum: { $ifNull: ['$tokens.total', 0] } },
                    requestCount: { $sum: 1 },
                    activeModels: {
                        $addToSet: {
                            $ifNull: ['$modelID', '$providerID'],
                        },
                    },
                },
            },
        ]);
        return {
            totalCost: Number(summary?.totalCost || 0),
            totalTokens: Number(summary?.totalTokens || 0),
            requestCount: Number(summary?.requestCount || 0),
            activeModels: Array.isArray(summary?.activeModels) ? summary.activeModels.length : 0,
        };
    }
    async aggregateDailyTrend(range) {
        return this.agentMessageModel.aggregate([
            { $match: this.buildMatch(range) },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    cost: { $sum: '$cost' },
                    tokens: { $sum: { $ifNull: ['$tokens.total', 0] } },
                    requests: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
    }
    resolvePeriodRange(period, now) {
        const end = new Date(now);
        const start = new Date(now);
        const days = period === 'week' ? 7 : 30;
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));
        return { from: start, to: end };
    }
    resolvePreviousRange(range) {
        const duration = range.to.getTime() - range.from.getTime();
        const to = new Date(range.from.getTime() - 1);
        const from = new Date(to.getTime() - duration);
        return { from, to };
    }
    resolveDateRange(from, to) {
        const now = new Date();
        const defaultFrom = this.shiftDate(now, -29);
        defaultFrom.setHours(0, 0, 0, 0);
        const parsedFrom = this.parseDate(from) || defaultFrom;
        const parsedTo = this.parseDate(to) || now;
        const normalizedFrom = new Date(parsedFrom);
        normalizedFrom.setHours(0, 0, 0, 0);
        const normalizedTo = new Date(parsedTo);
        normalizedTo.setHours(23, 59, 59, 999);
        if (normalizedFrom.getTime() > normalizedTo.getTime()) {
            return {
                from: defaultFrom,
                to: now,
            };
        }
        return {
            from: normalizedFrom,
            to: normalizedTo,
        };
    }
    resolveWholeDayRange(date) {
        const day = this.parseDate(date) || new Date();
        const from = new Date(day);
        from.setHours(0, 0, 0, 0);
        const to = new Date(day);
        to.setHours(23, 59, 59, 999);
        return { from, to };
    }
    buildMatch(range) {
        return {
            role: 'assistant',
            createdAt: { $gte: range.from, $lte: range.to },
            $or: [
                { cost: { $exists: true, $ne: null } },
                { 'tokens.total': { $gt: 0 } },
            ],
        };
    }
    normalizeLimit(limit) {
        const numeric = Number(limit);
        if (!Number.isFinite(numeric))
            return 10;
        return Math.max(1, Math.min(100, Math.floor(numeric)));
    }
    parseDate(value) {
        if (!value) {
            return undefined;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed;
    }
    shiftDate(date, delta) {
        const next = new Date(date);
        next.setDate(next.getDate() + delta);
        return next;
    }
    getDateString(date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    normalizeDateString(value) {
        if (!value)
            return undefined;
        const date = this.parseDate(value);
        if (!date)
            return undefined;
        return this.getDateString(date);
    }
    startDailySnapshotSchedule() {
        this.dailySnapshotTimer = setInterval(() => {
            void this.maybeRunDailySnapshot();
        }, 60 * 60 * 1000);
        this.dailySnapshotTimer.unref();
        void this.maybeRunDailySnapshot();
    }
    async maybeRunDailySnapshot() {
        const yesterday = this.getDateString(this.shiftDate(new Date(), -1));
        if (this.lastDailySnapshotDate === yesterday) {
            return;
        }
        try {
            const result = await this.createDailySnapshot(yesterday);
            this.lastDailySnapshotDate = yesterday;
            this.logger.log(`Daily usage snapshot updated date=${result.date} rows=${result.rowCount}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.warn(`Daily usage snapshot failed date=${yesterday} error=${message}`);
        }
    }
};
exports.UsageAggregationService = UsageAggregationService;
exports.UsageAggregationService = UsageAggregationService = UsageAggregationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_message_schema_1.AgentMessage.name)),
    __param(1, (0, mongoose_1.InjectModel)(agent_schema_1.Agent.name)),
    __param(2, (0, mongoose_1.InjectModel)(model_registry_schema_1.ModelRegistry.name)),
    __param(3, (0, mongoose_1.InjectModel)(usage_daily_snapshot_schema_1.UsageDailySnapshot.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], UsageAggregationService);
//# sourceMappingURL=usage-aggregation.service.js.map