"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeEiSyncRequeueBodySchema = exports.RuntimeEiSyncDeadLetterQuerySchema = exports.RuntimeMaintenanceAuditQuerySchema = exports.RuntimePurgeLegacyBodySchema = exports.RuntimeDeadLetterRequeueBodySchema = exports.RuntimeDeadLetterQuerySchema = exports.RuntimeReplayBodySchema = exports.RuntimeControlBodySchema = exports.RuntimeActorTypeSchema = void 0;
const zod_1 = require("zod");
exports.RuntimeActorTypeSchema = zod_1.z.enum(['employee', 'system', 'agent']);
exports.RuntimeControlBodySchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(500).optional(),
    actorId: zod_1.z.string().min(1).max(120).optional(),
    actorType: exports.RuntimeActorTypeSchema.optional(),
});
exports.RuntimeReplayBodySchema = zod_1.z.object({
    eventTypes: zod_1.z.array(zod_1.z.string().min(1)).max(50).optional(),
    fromSequence: zod_1.z.number().int().nonnegative().optional(),
    toSequence: zod_1.z.number().int().nonnegative().optional(),
    channel: zod_1.z.string().min(1).max(200).optional(),
    limit: zod_1.z.number().int().positive().max(1000).optional(),
}).refine((value) => {
    if (typeof value.fromSequence !== 'number' || typeof value.toSequence !== 'number') {
        return true;
    }
    return value.fromSequence <= value.toSequence;
}, {
    message: 'fromSequence must be less than or equal to toSequence',
    path: ['toSequence'],
});
exports.RuntimeDeadLetterQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(1000).optional(),
    runId: zod_1.z.string().min(1).max(120).optional(),
    eventType: zod_1.z.string().min(1).max(120).optional(),
});
exports.RuntimeDeadLetterRequeueBodySchema = zod_1.z.object({
    eventIds: zod_1.z.array(zod_1.z.string().min(1).max(120)).min(1).max(500).optional(),
    runId: zod_1.z.string().min(1).max(120).optional(),
    eventType: zod_1.z.string().min(1).max(120).optional(),
    limit: zod_1.z.number().int().positive().max(1000).optional(),
    dryRun: zod_1.z.boolean().optional(),
});
exports.RuntimePurgeLegacyBodySchema = zod_1.z.object({
    confirm: zod_1.z.literal('DELETE_LEGACY_RUNTIME_DATA'),
    collections: zod_1.z.array(zod_1.z.string().min(1).max(120)).max(20).optional(),
    dryRun: zod_1.z.boolean().optional(),
});
exports.RuntimeMaintenanceAuditQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(500).optional(),
    action: zod_1.z.enum(['dead_letter_requeue', 'purge_legacy']).optional(),
    batchId: zod_1.z.string().min(1).max(120).optional(),
});
exports.RuntimeEiSyncDeadLetterQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(500).optional(),
});
exports.RuntimeEiSyncRequeueBodySchema = zod_1.z.object({
    runIds: zod_1.z.array(zod_1.z.string().min(1).max(120)).min(1).max(500).optional(),
    limit: zod_1.z.number().int().positive().max(500).optional(),
    dryRun: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=runtime-control.contract.js.map