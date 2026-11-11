"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_CENTER_EVENT_SOURCE_AGENTS = exports.MESSAGE_CENTER_EVENT_SOURCE_SCHEDULER = exports.MESSAGE_CENTER_EVENT_SOURCE_ORCHESTRATION = exports.MESSAGE_CENTER_EVENT_SOURCE_MEETING = exports.MESSAGE_CENTER_EVENT_SOURCE_EI = exports.MESSAGE_CENTER_EVENT_CONSUMER_GROUP = exports.MESSAGE_CENTER_EVENT_STREAM_KEY = void 0;
exports.buildMessageCenterEvent = buildMessageCenterEvent;
exports.validateMessageCenterEventEnvelope = validateMessageCenterEventEnvelope;
const crypto_1 = require("crypto");
exports.MESSAGE_CENTER_EVENT_STREAM_KEY = 'streams:message-center:events';
exports.MESSAGE_CENTER_EVENT_CONSUMER_GROUP = 'message-center-group';
exports.MESSAGE_CENTER_EVENT_SOURCE_EI = 'engineering-intelligence';
exports.MESSAGE_CENTER_EVENT_SOURCE_MEETING = 'meeting-service';
exports.MESSAGE_CENTER_EVENT_SOURCE_ORCHESTRATION = 'orchestration-service';
exports.MESSAGE_CENTER_EVENT_SOURCE_SCHEDULER = 'scheduler-service';
exports.MESSAGE_CENTER_EVENT_SOURCE_AGENTS = 'agents-service';
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function normalizeString(value) {
    return String(value || '').trim();
}
function normalizePriority(value) {
    if (value === 'low' || value === 'high') {
        return value;
    }
    return 'normal';
}
function buildMessageCenterEvent(input) {
    const nowIso = new Date().toISOString();
    return {
        eventId: (0, crypto_1.randomUUID)(),
        eventType: input.eventType,
        version: 'v1',
        occurredAt: normalizeString(input.occurredAt) || nowIso,
        source: normalizeString(input.source) || 'unknown',
        traceId: normalizeString(input.traceId) || (0, crypto_1.randomUUID)(),
        data: {
            receiverId: normalizeString(input.data?.receiverId),
            messageType: input.data?.messageType,
            title: normalizeString(input.data?.title),
            content: normalizeString(input.data?.content),
            bizKey: normalizeString(input.data?.bizKey),
            actionUrl: normalizeString(input.data?.actionUrl) || undefined,
            priority: normalizePriority(input.data?.priority),
            extra: isRecord(input.data?.extra) ? input.data.extra : {},
        },
    };
}
function validateMessageCenterEventEnvelope(payload) {
    if (!isRecord(payload)) {
        return { ok: false, error: 'payload must be an object' };
    }
    const eventId = normalizeString(payload.eventId);
    const eventType = normalizeString(payload.eventType);
    const version = normalizeString(payload.version);
    const occurredAt = normalizeString(payload.occurredAt);
    const source = normalizeString(payload.source);
    const traceId = normalizeString(payload.traceId);
    const dataRaw = payload.data;
    if (!eventId || !eventType || !version || !occurredAt || !source || !traceId) {
        return { ok: false, error: 'eventId/eventType/version/occurredAt/source/traceId are required' };
    }
    if (version !== 'v1') {
        return { ok: false, error: `unsupported event version: ${version}` };
    }
    if (eventType !== 'meeting.session.ended' &&
        eventType !== 'meeting.summary.generated' &&
        eventType !== 'engineering.tool.completed' &&
        eventType !== 'orchestration.task.completed' &&
        eventType !== 'agent.action.completed' &&
        eventType !== 'agent.cost.exceeded' &&
        eventType !== 'system.alert.scheduler' &&
        eventType !== 'scheduler.report.generated') {
        return { ok: false, error: `unsupported event type: ${eventType}` };
    }
    if (!isRecord(dataRaw)) {
        return { ok: false, error: 'data must be an object' };
    }
    const receiverId = normalizeString(dataRaw.receiverId);
    const messageType = normalizeString(dataRaw.messageType);
    const title = normalizeString(dataRaw.title);
    const content = normalizeString(dataRaw.content);
    const bizKey = normalizeString(dataRaw.bizKey);
    const actionUrl = normalizeString(dataRaw.actionUrl);
    const priority = normalizePriority(dataRaw.priority);
    const extra = isRecord(dataRaw.extra) ? dataRaw.extra : {};
    if (!messageType || !title || !content || !bizKey) {
        return { ok: false, error: 'data.messageType/title/content/bizKey are required' };
    }
    if (messageType !== 'engineering_statistics' && messageType !== 'orchestration' && messageType !== 'system_alert') {
        return { ok: false, error: `unsupported message type: ${messageType}` };
    }
    return {
        ok: true,
        event: {
            eventId,
            eventType,
            version: 'v1',
            occurredAt,
            source,
            traceId,
            data: {
                receiverId: receiverId || undefined,
                messageType,
                title,
                content,
                bizKey,
                actionUrl: actionUrl || undefined,
                priority,
                extra,
            },
        },
    };
}
//# sourceMappingURL=message-center-events.js.map