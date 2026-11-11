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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoController = void 0;
const common_1 = require("@nestjs/common");
const memo_service_1 = require("./memo.service");
const identity_aggregation_service_1 = require("./identity-aggregation.service");
const evaluation_aggregation_service_1 = require("./evaluation-aggregation.service");
const memo_aggregation_service_1 = require("./memo-aggregation.service");
let MemoController = class MemoController {
    constructor(memoService, memoAggregationService, identityAggregationService, evaluationAggregationService) {
        this.memoService = memoService;
        this.memoAggregationService = memoAggregationService;
        this.identityAggregationService = identityAggregationService;
        this.evaluationAggregationService = evaluationAggregationService;
    }
    getActorContext(req) {
        const context = req.userContext;
        return {
            employeeId: context?.employeeId,
            role: context?.role,
        };
    }
    async listMemos(agentId, memoType, memoKind, topic, search, page, pageSize) {
        return this.memoService.listMemos({
            agentId,
            memoType,
            memoKind,
            topic,
            search,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
        });
    }
    async searchMemos(body) {
        return this.memoService.searchMemos(body.agentId, body.query, {
            memoType: body.memoType,
            memoKind: body.memoKind,
            topic: body.topic,
            limit: body.limit,
            progressive: body.progressive,
            detail: body.detail,
        });
    }
    async createMemo(req, body) {
        return this.memoService.createMemo(body, { actor: this.getActorContext(req) });
    }
    async recordBehavior(body) {
        return this.memoService.recordBehavior(body);
    }
    async flushEvents(body) {
        return this.memoService.flushEventQueue(body?.agentId);
    }
    async getAggregationStatus(agentId) {
        return this.memoService.getAggregationStatus(agentId);
    }
    async repairCoreDocs(body) {
        return this.memoService.repairCoreDocuments(body?.agentId);
    }
    async upsertTodo(body) {
        return this.memoService.upsertTaskTodo(body.agentId, body.task || {});
    }
    async updateTodoStatus(id, body) {
        return this.memoService.updateTodoStatus(id, body.status, body.note, {
            taskId: body.taskId,
            sourceType: body.sourceType,
        });
    }
    async getTaskContext(agentId, taskText) {
        const context = await this.memoService.getTaskMemoryContext(agentId, taskText || '');
        return { agentId, taskText: taskText || '', context };
    }
    async rebuildDocs() {
        return this.memoService.rebuildMemoDocs();
    }
    async aggregateIdentity(body) {
        await this.identityAggregationService.aggregateIdentity(body.agentId);
        return { success: true, agentId: body.agentId, type: 'identity' };
    }
    async aggregateEvaluation(body) {
        await this.evaluationAggregationService.aggregateEvaluation(body.agentId);
        return { success: true, agentId: body.agentId, type: 'evaluation' };
    }
    async aggregateFull() {
        await this.memoAggregationService.triggerFullAggregation();
        return { success: true, type: 'full' };
    }
    async getMemo(id) {
        return this.memoService.getMemoById(id);
    }
    async updateMemo(id, req, updates) {
        return this.memoService.updateMemo(id, updates, { actor: this.getActorContext(req) });
    }
    async deleteMemo(id) {
        return this.memoService.deleteMemo(id);
    }
};
exports.MemoController = MemoController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('agentId')),
    __param(1, (0, common_1.Query)('memoType')),
    __param(2, (0, common_1.Query)('memoKind')),
    __param(3, (0, common_1.Query)('topic')),
    __param(4, (0, common_1.Query)('search')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "listMemos", null);
__decorate([
    (0, common_1.Post)('search'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "searchMemos", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "createMemo", null);
__decorate([
    (0, common_1.Post)('behavior'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "recordBehavior", null);
__decorate([
    (0, common_1.Post)('events/flush'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "flushEvents", null);
__decorate([
    (0, common_1.Get)('aggregation/status'),
    __param(0, (0, common_1.Query)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "getAggregationStatus", null);
__decorate([
    (0, common_1.Post)('repair/core-docs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "repairCoreDocs", null);
__decorate([
    (0, common_1.Post)('todos/upsert'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "upsertTodo", null);
__decorate([
    (0, common_1.Put)('todos/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "updateTodoStatus", null);
__decorate([
    (0, common_1.Get)('agents/:agentId/context'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Query)('taskText')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "getTaskContext", null);
__decorate([
    (0, common_1.Post)('docs/rebuild'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "rebuildDocs", null);
__decorate([
    (0, common_1.Post)('identity/aggregate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "aggregateIdentity", null);
__decorate([
    (0, common_1.Post)('evaluation/aggregate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "aggregateEvaluation", null);
__decorate([
    (0, common_1.Post)('aggregation/full'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "aggregateFull", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "getMemo", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "updateMemo", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MemoController.prototype, "deleteMemo", null);
exports.MemoController = MemoController = __decorate([
    (0, common_1.Controller)('memos'),
    __metadata("design:paramtypes", [memo_service_1.MemoService,
        memo_aggregation_service_1.MemoAggregationService,
        identity_aggregation_service_1.IdentityAggregationService,
        evaluation_aggregation_service_1.EvaluationAggregationService])
], MemoController);
//# sourceMappingURL=memo.controller.js.map