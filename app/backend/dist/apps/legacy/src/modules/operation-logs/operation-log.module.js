"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationLogModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const auth_module_1 = require("../auth/auth.module");
const operation_log_schema_1 = require("../../shared/schemas/operation-log.schema");
const employee_schema_1 = require("../../shared/schemas/employee.schema");
const operation_log_service_1 = require("./operation-log.service");
const operation_log_controller_1 = require("./operation-log.controller");
let OperationLogModule = class OperationLogModule {
};
exports.OperationLogModule = OperationLogModule;
exports.OperationLogModule = OperationLogModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            mongoose_1.MongooseModule.forFeature([
                { name: operation_log_schema_1.OperationLog.name, schema: operation_log_schema_1.OperationLogSchema },
                { name: employee_schema_1.Employee.name, schema: employee_schema_1.EmployeeSchema },
            ]),
        ],
        providers: [operation_log_service_1.OperationLogService],
        controllers: [operation_log_controller_1.OperationLogController],
    })
], OperationLogModule);
//# sourceMappingURL=operation-log.module.js.map