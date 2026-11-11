"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrapResponseEnvelope = unwrapResponseEnvelope;
function unwrapResponseEnvelope(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }
    const body = payload;
    if (typeof body.code === 'number' &&
        'message' in body &&
        Object.prototype.hasOwnProperty.call(body, 'data')) {
        return body.data;
    }
    return payload;
}
//# sourceMappingURL=unwrap-response-envelope.js.map