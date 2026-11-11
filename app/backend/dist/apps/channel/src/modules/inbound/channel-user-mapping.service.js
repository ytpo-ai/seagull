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
exports.ChannelUserMappingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const channel_user_mapping_schema_1 = require("./schemas/channel-user-mapping.schema");
const employee_schema_1 = require("../../../../../src/shared/schemas/employee.schema");
let ChannelUserMappingService = class ChannelUserMappingService {
    constructor(mappingModel, employeeModel) {
        this.mappingModel = mappingModel;
        this.employeeModel = employeeModel;
        this.lastActiveUpdateIntervalMs = 5 * 60 * 1000;
    }
    async resolveEmployee(providerType, externalUserId) {
        const provider = String(providerType || '').trim();
        const externalId = String(externalUserId || '').trim();
        if (!provider || !externalId) {
            return null;
        }
        const mapping = await this.mappingModel
            .findOne({
            providerType: provider,
            externalUserId: externalId,
            isActive: true,
        })
            .exec();
        if (!mapping) {
            return null;
        }
        const employee = await this.employeeModel
            .findOne({
            id: mapping.employeeId,
            type: employee_schema_1.EmployeeType.HUMAN,
        })
            .select({ id: 1, email: 1, role: 1, exclusiveAssistantAgentId: 1, aiProxyAgentId: 1 })
            .exec();
        if (!employee) {
            return null;
        }
        const lastActiveAt = mapping.lastActiveAt instanceof Date ? mapping.lastActiveAt.getTime() : 0;
        if (Date.now() - lastActiveAt >= this.lastActiveUpdateIntervalMs) {
            await this.mappingModel
                .updateOne({ _id: mapping._id }, {
                $set: {
                    lastActiveAt: new Date(),
                },
            })
                .exec();
        }
        return {
            employeeId: employee.id,
            exclusiveAssistantAgentId: employee.exclusiveAssistantAgentId || employee.aiProxyAgentId || undefined,
            role: employee.role,
            email: employee.email,
        };
    }
    async bindUser(input) {
        const providerType = String(input.providerType || '').trim();
        const externalUserId = String(input.externalUserId || '').trim();
        const employeeId = String(input.employeeId || '').trim();
        const displayName = String(input.displayName || '').trim() || undefined;
        if (!providerType || !externalUserId || !employeeId) {
            throw new common_1.BadRequestException('providerType/externalUserId/employeeId are required');
        }
        const employee = await this.employeeModel
            .findOne({
            id: employeeId,
            type: employee_schema_1.EmployeeType.HUMAN,
        })
            .select({ id: 1 })
            .exec();
        if (!employee) {
            throw new common_1.NotFoundException('employee not found');
        }
        const mapping = await this.mappingModel
            .findOneAndUpdate({ providerType, externalUserId }, {
            $set: {
                employeeId,
                displayName,
                isActive: true,
                lastActiveAt: new Date(),
                boundAt: new Date(),
            },
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        })
            .exec();
        return this.toResponse(mapping);
    }
    async bindByEmail(input) {
        const email = String(input.email || '').trim().toLowerCase();
        if (!email) {
            throw new common_1.BadRequestException('email is required');
        }
        const allowedRoles = input.allowedRoles;
        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const employee = await this.employeeModel
            .findOne({
            email: { $regex: `^${escapedEmail}$`, $options: 'i' },
            type: employee_schema_1.EmployeeType.HUMAN,
        })
            .select({ id: 1, role: 1 })
            .exec();
        if (!employee) {
            throw new common_1.NotFoundException('employee not found by email');
        }
        if (allowedRoles && allowedRoles.size > 0) {
            const normalizedRole = String(employee.role || '').trim().toLowerCase();
            if (!allowedRoles.has(normalizedRole)) {
                throw new common_1.BadRequestException('该绑定方式仅限管理员，请先在系统中获取 token 绑定');
            }
        }
        return this.bindUser({
            providerType: input.providerType,
            externalUserId: input.externalUserId,
            employeeId: employee.id,
            displayName: input.displayName,
        });
    }
    async listMappings() {
        const rows = await this.mappingModel.find().sort({ updatedAt: -1 }).exec();
        return rows.map((item) => this.toResponse(item));
    }
    async unbindUser(id) {
        const docId = String(id || '').trim();
        if (!docId) {
            throw new common_1.BadRequestException('id is required');
        }
        const deleted = await this.mappingModel.findOneAndDelete({ _id: docId }).exec();
        if (!deleted) {
            throw new common_1.NotFoundException('channel user mapping not found');
        }
        return { success: true };
    }
    toResponse(doc) {
        if (!doc) {
            return null;
        }
        return {
            id: doc._id.toString(),
            providerType: doc.providerType,
            externalUserId: doc.externalUserId,
            employeeId: doc.employeeId,
            displayName: doc.displayName,
            boundAt: doc.boundAt,
            lastActiveAt: doc.lastActiveAt,
            isActive: doc.isActive,
        };
    }
};
exports.ChannelUserMappingService = ChannelUserMappingService;
exports.ChannelUserMappingService = ChannelUserMappingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(channel_user_mapping_schema_1.ChannelUserMapping.name)),
    __param(1, (0, mongoose_1.InjectModel)(employee_schema_1.Employee.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ChannelUserMappingService);
//# sourceMappingURL=channel-user-mapping.service.js.map