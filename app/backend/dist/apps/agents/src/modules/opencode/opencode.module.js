"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeModule = void 0;
const common_1 = require("@nestjs/common");
const opencode_adapter_1 = require("./opencode.adapter");
const opencode_execution_service_1 = require("./opencode-execution.service");
const runtime_module_1 = require("../runtime/runtime.module");
let OpenCodeModule = class OpenCodeModule {
};
exports.OpenCodeModule = OpenCodeModule;
exports.OpenCodeModule = OpenCodeModule = __decorate([
    (0, common_1.Module)({
        imports: [runtime_module_1.RuntimeModule],
        providers: [opencode_adapter_1.OpenCodeAdapter, opencode_execution_service_1.OpenCodeExecutionService],
        exports: [opencode_adapter_1.OpenCodeAdapter, opencode_execution_service_1.OpenCodeExecutionService],
    })
], OpenCodeModule);
//# sourceMappingURL=opencode.module.js.map