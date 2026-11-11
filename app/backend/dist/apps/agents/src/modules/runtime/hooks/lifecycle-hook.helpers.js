"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provideLifecycleHook = provideLifecycleHook;
const lifecycle_hook_types_1 = require("./lifecycle-hook.types");
function provideLifecycleHook(hookClass) {
    return {
        provide: lifecycle_hook_types_1.LIFECYCLE_HOOKS_TOKEN,
        useClass: hookClass,
        multi: true,
    };
}
//# sourceMappingURL=lifecycle-hook.helpers.js.map