"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskOutputValidationService = void 0;
const common_1 = require("@nestjs/common");
let TaskOutputValidationService = class TaskOutputValidationService {
    constructor() {
        this.generalInabilitySignalPatterns = [
            /(?:^|\n)\s*task_inability\s*:/i,
            /\b(?:cannot execute|unable to complete|cannot complete|i cannot perform|unable to access|cannot browse)\b/i,
            /\b(?:i don't have|i do not have|missing tool|lack the ability|not equipped|don't have direct access)\b/i,
            /(?:无法执行|无法完成|无法按|我没有|缺少工具|没有可用的|无法直接|不具备|无法访问|无法浏览|我这边无法|当前会话没有|没有接入)/u,
        ];
    }
    validateGeneralOutput(output) {
        const text = (output || '').trim();
        if (!text) {
            return { valid: false, reason: 'empty output', missing: ['content'] };
        }
        const matchedSignal = this.findInabilitySignal(text, this.generalInabilitySignalPatterns, 500);
        if (matchedSignal) {
            return {
                valid: false,
                reason: `agent reported inability to execute task (${matchedSignal})`,
                missing: ['executable-result'],
            };
        }
        return { valid: true };
    }
    findInabilitySignal(text, patterns, limit) {
        const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500;
        const snippet = String(text || '').slice(0, normalizedLimit);
        for (const pattern of patterns) {
            if (pattern.test(snippet)) {
                return pattern.source;
            }
        }
        return null;
    }
};
exports.TaskOutputValidationService = TaskOutputValidationService;
exports.TaskOutputValidationService = TaskOutputValidationService = __decorate([
    (0, common_1.Injectable)()
], TaskOutputValidationService);
//# sourceMappingURL=task-output-validation.service.js.map