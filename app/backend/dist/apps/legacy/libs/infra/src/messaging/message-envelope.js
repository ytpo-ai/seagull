"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMessageEnvelope = buildMessageEnvelope;
const crypto_1 = require("crypto");
function buildMessageEnvelope(topic, payload, headers) {
    const messageId = (0, crypto_1.randomUUID)();
    return {
        messageId,
        topic,
        payload,
        headers: {
            traceId: (0, crypto_1.randomUUID)(),
            retryCount: 0,
            correlationId: messageId,
            ...headers,
        },
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=message-envelope.js.map