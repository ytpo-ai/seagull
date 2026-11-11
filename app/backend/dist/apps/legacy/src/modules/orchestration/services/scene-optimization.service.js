"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SceneOptimizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneOptimizationService = exports.MAX_DESCRIPTION_LENGTH = exports.MAX_TITLE_LENGTH = exports.MAX_TASKS = void 0;
const common_1 = require("@nestjs/common");
const MAX_TASKS = parseInt(process.env.PLANNER_MAX_TASKS || '8', 10);
exports.MAX_TASKS = MAX_TASKS;
const MAX_TITLE_LENGTH = parseInt(process.env.PLANNER_MAX_TITLE_LENGTH || '120', 10);
exports.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH;
const MAX_DESCRIPTION_LENGTH = parseInt(process.env.PLANNER_MAX_DESCRIPTION_LENGTH || '1000', 10);
exports.MAX_DESCRIPTION_LENGTH = MAX_DESCRIPTION_LENGTH;
const MIN_DESCRIPTION_LENGTH = parseInt(process.env.PLANNER_MIN_DESCRIPTION_LENGTH || '20', 10);
let SceneOptimizationService = SceneOptimizationService_1 = class SceneOptimizationService {
    constructor() {
        this.logger = new common_1.Logger(SceneOptimizationService_1.name);
    }
    optimizeTasks(tasks) {
        return tasks;
    }
    validateTaskQuality(tasks, customRules) {
        void tasks;
        void customRules;
        return {
            passed: true,
            warnings: [],
        };
    }
    async applyPostExecuteOptimizations(context) {
        const rules = this.getPostExecuteRules();
        const appliedRuleIds = [];
        for (const rule of rules) {
            if (!rule.match(context)) {
                continue;
            }
            try {
                const applied = await rule.apply(context);
                if (applied) {
                    appliedRuleIds.push(rule.id);
                }
            }
            catch (error) {
                this.logger.warn(`[scene_optimization] rule=${rule.id} failed planId=${context.planId} taskId=${context.taskId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { appliedRuleIds };
    }
    getPostExecuteRules() {
        return [];
    }
};
exports.SceneOptimizationService = SceneOptimizationService;
exports.SceneOptimizationService = SceneOptimizationService = SceneOptimizationService_1 = __decorate([
    (0, common_1.Injectable)()
], SceneOptimizationService);
//# sourceMappingURL=scene-optimization.service.js.map