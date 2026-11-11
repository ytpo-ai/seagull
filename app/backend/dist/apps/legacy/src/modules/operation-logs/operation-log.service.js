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
exports.OperationLogService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const operation_log_schema_1 = require("../../shared/schemas/operation-log.schema");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
let OperationLogService = class OperationLogService {
    constructor(operationLogModel, employeeModel) {
        this.operationLogModel = operationLogModel;
        this.employeeModel = employeeModel;
    }
    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    parseDate(value) {
        if (!value)
            return undefined;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new common_1.BadRequestException('日期格式无效');
        }
        return parsed;
    }
    parseBoolean(value) {
        if (typeof value !== 'string')
            return undefined;
        const normalized = value.trim().toLowerCase();
        if (!normalized)
            return undefined;
        if (['true', '1', 'yes', 'on'].includes(normalized))
            return true;
        if (['false', '0', 'no', 'off'].includes(normalized))
            return false;
        return undefined;
    }
    async assertHumanViewer(employeeId) {
        const viewer = await this.employeeModel
            .findOne({ id: employeeId, type: employee_schema_1.EmployeeType.HUMAN })
            .select({ id: 1 })
            .lean()
            .exec();
        if (!viewer?.id) {
            throw new common_1.ForbiddenException('仅允许人类用户访问日志查询');
        }
    }
    async queryAllHumanOperationLogs(params) {
        const from = this.parseDate(params.from);
        const to = this.parseDate(params.to);
        if (from && to && from.getTime() > to.getTime()) {
            throw new common_1.BadRequestException('时间范围无效：from 必须早于 to');
        }
        const page = Math.max(1, Math.min(Number(params.page || 1), 10000));
        const pageSize = Math.max(1, Math.min(Number(params.pageSize || 20), 100));
        const skip = (page - 1) * pageSize;
        const filter = {};
        if (params.action?.trim()) {
            filter.action = { $regex: this.escapeRegex(params.action.trim()), $options: 'i' };
        }
        if (params.resourceKeyword?.trim()) {
            filter.resource = { $regex: this.escapeRegex(params.resourceKeyword.trim()), $options: 'i' };
        }
        if (params.humanEmployeeId?.trim()) {
            filter.humanEmployeeId = params.humanEmployeeId.trim();
        }
        if (params.assistantAgentId?.trim()) {
            filter.assistantAgentId = params.assistantAgentId.trim();
        }
        const success = this.parseBoolean(params.success);
        if (typeof success === 'boolean') {
            filter.success = success;
        }
        const statusCode = Number(params.statusCode);
        if (Number.isFinite(statusCode) && statusCode >= 100 && statusCode <= 599) {
            filter.statusCode = statusCode;
        }
        if (from || to) {
            filter.timestamp = {};
            if (from)
                filter.timestamp.$gte = from;
            if (to)
                filter.timestamp.$lte = to;
        }
        const [total, logs] = await Promise.all([
            this.operationLogModel.countDocuments(filter).exec(),
            this.operationLogModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(pageSize).lean().exec(),
        ]);
        const humanIds = Array.from(new Set(logs.map((item) => item.humanEmployeeId).filter(Boolean)));
        const humanList = await this.employeeModel
            .find({ id: { $in: humanIds } })
            .select({ id: 1, name: 1, email: 1 })
            .lean()
            .exec();
        const humanMap = new Map(humanList.map((item) => [item.id, item]));
        return {
            total,
            page,
            pageSize,
            totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
            logs: logs.map((item) => {
                const human = humanMap.get(item.humanEmployeeId);
                return {
                    id: item.id,
                    humanEmployeeId: item.humanEmployeeId,
                    humanName: human?.name || '',
                    humanEmail: human?.email || '',
                    assistantAgentId: item.assistantAgentId,
                    action: item.action,
                    resource: item.resource,
                    httpMethod: item.httpMethod,
                    statusCode: item.statusCode,
                    success: item.success,
                    requestId: item.requestId,
                    ip: item.ip,
                    userAgent: item.userAgent,
                    query: item.query,
                    payload: item.payload,
                    responseSummary: item.responseSummary,
                    sourceService: item.sourceService,
                    durationMs: item.durationMs,
                    timestamp: item.timestamp,
                };
            }),
            fetchedAt: new Date().toISOString(),
        };
    }
};
exports.OperationLogService = OperationLogService;
exports.OperationLogService = OperationLogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(operation_log_schema_1.OperationLog.name)),
    __param(1, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], OperationLogService);
//# sourceMappingURL=operation-log.service.js.map