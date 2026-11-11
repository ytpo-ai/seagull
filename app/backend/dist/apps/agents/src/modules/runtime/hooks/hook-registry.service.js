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
var HookRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookRegistryService = void 0;
const common_1 = require("@nestjs/common");
const lifecycle_hook_types_1 = require("./lifecycle-hook.types");
let HookRegistryService = HookRegistryService_1 = class HookRegistryService {
    constructor(discoveredHooks = []) {
        this.discoveredHooks = discoveredHooks;
        this.logger = new common_1.Logger(HookRegistryService_1.name);
        this.hooks = new Map();
    }
    onModuleInit() {
        const discovered = Array.isArray(this.discoveredHooks) ? this.discoveredHooks : [];
        for (const hook of discovered) {
            this.register(hook);
        }
        this.logger.log(`[hook_registry_init] registered=${this.hooks.size} hooks=[${[...this.hooks.keys()].join(', ')}]`);
    }
    register(hook) {
        if (!hook?.id) {
            this.logger.warn('[hook_registry] attempted to register hook without id, ignored');
            return;
        }
        if (this.hooks.has(hook.id)) {
            this.logger.warn(`[hook_registry] duplicate hookId=${hook.id}, overwriting`);
        }
        this.hooks.set(hook.id, hook);
        this.logger.debug(`[hook_registry] registered hookId=${hook.id} phases=[${hook.phases.join(',')}] priority=${hook.priority}`);
    }
    unregister(hookId) {
        const removed = this.hooks.delete(hookId);
        if (removed) {
            this.logger.debug(`[hook_registry] unregistered hookId=${hookId}`);
        }
        return removed;
    }
    getHooksForPhase(phase) {
        return [...this.hooks.values()]
            .filter((h) => h.enabled !== false && h.phases.includes(phase))
            .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    }
    has(hookId) {
        return this.hooks.has(hookId);
    }
    listAll() {
        return [...this.hooks.values()].map((h) => ({
            id: h.id,
            phases: h.phases,
            priority: h.priority ?? 100,
            enabled: h.enabled !== false,
        }));
    }
    get size() {
        return this.hooks.size;
    }
};
exports.HookRegistryService = HookRegistryService;
exports.HookRegistryService = HookRegistryService = HookRegistryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(lifecycle_hook_types_1.LIFECYCLE_HOOKS_TOKEN)),
    __metadata("design:paramtypes", [Array])
], HookRegistryService);
//# sourceMappingURL=hook-registry.service.js.map