"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provideLifecycleHook = exports.HookPipelineService = exports.HookRegistryService = exports.LIFECYCLE_HOOKS_TOKEN = exports.LIFECYCLE_HOOK_CONTINUE = void 0;
var lifecycle_hook_types_1 = require("./lifecycle-hook.types");
Object.defineProperty(exports, "LIFECYCLE_HOOK_CONTINUE", { enumerable: true, get: function () { return lifecycle_hook_types_1.LIFECYCLE_HOOK_CONTINUE; } });
Object.defineProperty(exports, "LIFECYCLE_HOOKS_TOKEN", { enumerable: true, get: function () { return lifecycle_hook_types_1.LIFECYCLE_HOOKS_TOKEN; } });
var hook_registry_service_1 = require("./hook-registry.service");
Object.defineProperty(exports, "HookRegistryService", { enumerable: true, get: function () { return hook_registry_service_1.HookRegistryService; } });
var hook_pipeline_service_1 = require("./hook-pipeline.service");
Object.defineProperty(exports, "HookPipelineService", { enumerable: true, get: function () { return hook_pipeline_service_1.HookPipelineService; } });
var lifecycle_hook_helpers_1 = require("./lifecycle-hook.helpers");
Object.defineProperty(exports, "provideLifecycleHook", { enumerable: true, get: function () { return lifecycle_hook_helpers_1.provideLifecycleHook; } });
//# sourceMappingURL=index.js.map