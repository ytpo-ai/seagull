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
exports.AuditToolHandler = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const employee_schema_1 = require("../../../../../../src/shared/schemas/employee.schema");
const operation_log_schema_1 = require("../../../../../../src/shared/schemas/operation-log.schema");
let AuditToolHandler = class AuditToolHandler {
    constructor(employeeModel, operationLogModel) {
        this.employeeModel = employeeModel;
        this.operationLogModel = operationLogModel;
    }
    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    parseDateOrThrow(raw, fieldName) {
        if (!raw)
            return undefined;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            throw new Error(`Invalid ${fieldName || 'date'} format`);
        }
        return parsed;
    }
    async getBoundHumanByAssistant(agentId) {
        if (!agentId) {
            throw new Error('human_operation_log_mcp_list requires assistant agentId');
        }
        const humanEmployees = await this.employeeModel
            .find({
            type: employee_schema_1.EmployeeType.HUMAN,
            exclusiveAssistantAgentId: agentId,
        })
            .select({ id: 1, name: 1 })
            .lean()
            .exec();
        if (humanEmployees.length === 0) {
            throw new Error('Current assistant is not bound to any human employee');
        }
        if (humanEmployees.length > 1) {
            throw new Error('Current assistant is bound to multiple humans, access denied');
        }
        const [human] = humanEmployees;
        if (!human?.id) {
            throw new Error('Bound human employee data is incomplete');
        }
        return {
            id: human.id,
            name: human.name,
        };
    }
    async listHumanOperationLogs(params, agentId) {
        const boundHuman = await this.getBoundHumanByAssistant(agentId || '');
        const from = this.parseDateOrThrow(params?.from, 'from');
        const to = this.parseDateOrThrow(params?.to, 'to');
        if (from && to && from.getTime() > to.getTime()) {
            throw new Error('Invalid date range: from must be earlier than to');
        }
        const page = Math.max(1, Math.min(Number(params?.page || 1), 10000));
        const pageSize = Math.max(1, Math.min(Number(params?.pageSize || 20), 100));
        const skip = (page - 1) * pageSize;
        const filter = {
            humanEmployeeId: boundHuman.id,
        };
        if (params?.action?.trim()) {
            filter.action = { $regex: this.escapeRegex(params.action.trim()), $options: 'i' };
        }
        if (params?.resourceKeyword?.trim()) {
            filter.resource = { $regex: this.escapeRegex(params.resourceKeyword.trim()), $options: 'i' };
        }
        if (typeof params?.success === 'boolean') {
            filter.success = params.success;
        }
        const parsedStatusCode = Number(params?.statusCode);
        if (Number.isFinite(parsedStatusCode) && parsedStatusCode >= 100 && parsedStatusCode <= 599) {
            filter.statusCode = parsedStatusCode;
        }
        if (from || to) {
            filter.timestamp = {};
            if (from)
                filter.timestamp.$gte = from;
            if (to)
                filter.timestamp.$lte = to;
        }
        const [total, rows] = await Promise.all([
            this.operationLogModel.countDocuments(filter).exec(),
            this.operationLogModel
                .find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean()
                .exec(),
        ]);
        return {
            humanEmployeeId: boundHuman.id,
            humanName: boundHuman.name || '',
            assistantAgentId: agentId,
            total,
            page,
            pageSize,
            totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
            logs: rows.map((row) => ({
                id: row.id,
                action: row.action,
                resource: row.resource,
                httpMethod: row.httpMethod,
                statusCode: row.statusCode,
                success: row.success,
                sourceService: row.sourceService,
                durationMs: row.durationMs,
                ip: row.ip,
                userAgent: row.userAgent,
                requestId: row.requestId,
                query: row.query,
                payload: row.payload,
                responseSummary: row.responseSummary,
                timestamp: row.timestamp,
            })),
            fetchedAt: new Date().toISOString(),
        };
    }
};
exports.AuditToolHandler = AuditToolHandler;
exports.AuditToolHandler = AuditToolHandler = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __param(1, (0, mongoose_1.InjectModel)(operation_log_schema_1.OperationLog.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], AuditToolHandler);
//# sourceMappingURL=audit-tool-handler.service.js.map